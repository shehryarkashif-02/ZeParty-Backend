import { describe, it } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import { getPaymentAdapter } from '../src/adapters/payment/paymentAdapter.factory.js';
import rechargeRepository from '../src/repositories/recharge.repository.js';
import paymentProviderService from '../src/services/paymentProvider.service.js';
import rechargeService from '../src/services/recharge.service.js';

describe('Phase 3 Payment Webhook & Signature Verification Suite', () => {
  describe('1. Adapter Signature Verification & Event Parsing', () => {
    it('StripeAdapter cryptographically validates HMAC-SHA256 signature', async () => {
      const adapter = getPaymentAdapter('STRIPE');
      const webhookSecret = 'whsec_test_stripe_secret_key_123';
      const rawBody = JSON.stringify({
        id: 'evt_123',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_9988',
            amount: 1000,
          },
        },
      });

      const timestamp = Math.floor(Date.now() / 1000);
      const payloadToSign = `${timestamp}.${rawBody}`;
      const signatureHex = crypto.createHmac('sha256', webhookSecret).update(payloadToSign).digest('hex');
      const signatureHeader = `t=${timestamp},v1=${signatureHex}`;

      const isValid = await adapter.verifyWebhookSignature({
        rawBody,
        signature: signatureHeader,
        webhookSecret,
      });

      assert.strictEqual(isValid, true);

      // Verify tampered signature fails
      const isInvalid = await adapter.verifyWebhookSignature({
        rawBody,
        signature: `t=${timestamp},v1=bad_signature_hex`,
        webhookSecret,
      });
      assert.strictEqual(isInvalid, false);

      // Verify parsed event
      const parsed = adapter.parseWebhookEvent(rawBody);
      assert.strictEqual(parsed.eventType, 'payment_intent.succeeded');
      assert.strictEqual(parsed.isSuccessful, true);
      assert.strictEqual(parsed.gatewayTxId, 'pi_test_9988');
      assert.strictEqual(parsed.amountUSD, 10.0);
    });

    it('PayPalAdapter validates webhook signature and parses capture completion', async () => {
      const adapter = getPaymentAdapter('PAYPAL');
      const webhookSecret = 'paypal_test_webhook_secret';
      const rawBody = JSON.stringify({
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          id: 'CAPTURE_ORD_1001',
          amount: { value: '25.00' },
        },
      });

      const computedSig = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

      const isValid = await adapter.verifyWebhookSignature({
        rawBody,
        signature: computedSig,
        webhookSecret,
      });
      assert.strictEqual(isValid, true);

      const parsed = adapter.parseWebhookEvent(rawBody);
      assert.strictEqual(parsed.isSuccessful, true);
      assert.strictEqual(parsed.gatewayTxId, 'CAPTURE_ORD_1001');
      assert.strictEqual(parsed.amountUSD, 25.0);
    });
  });

  describe('2. Webhook Replay Protection & Idempotent Processing', () => {
    it('rejects webhook processing when signature is invalid', async () => {
      const originalGetConfig = paymentProviderService.getDecryptedProviderConfig;
      paymentProviderService.getDecryptedProviderConfig = async () => ({
        name: 'STRIPE',
        webhookSecret: 'correct_secret',
      });

      try {
        await assert.rejects(async () => {
          await rechargeService.processPaymentWebhook({
            provider: 'STRIPE',
            rawBody: JSON.stringify({ type: 'payment_intent.succeeded' }),
            signature: 'invalid_sig',
          });
        }, /Invalid webhook signature/);
      } finally {
        paymentProviderService.getDecryptedProviderConfig = originalGetConfig;
      }
    });

    it('returns alreadyProcessed true without duplicating credit when duplicate webhook is delivered', async () => {
      const webhookSecret = 'test_whsec';
      const rawBody = JSON.stringify({
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_already_paid_123', amount: 500 } },
      });

      const timestamp = Math.floor(Date.now() / 1000);
      const sigHex = crypto.createHmac('sha256', webhookSecret).update(`${timestamp}.${rawBody}`).digest('hex');
      const signature = `t=${timestamp},v1=${sigHex}`;

      const originalGetConfig = paymentProviderService.getDecryptedProviderConfig;
      const originalFindRecharge = rechargeRepository.findOnlineRechargeByGatewayTxId;

      paymentProviderService.getDecryptedProviderConfig = async () => ({
        name: 'STRIPE',
        webhookSecret,
      });

      rechargeRepository.findOnlineRechargeByGatewayTxId = async () => ({
        id: 'rec-paid-1',
        gatewayTxId: 'pi_already_paid_123',
        status: 'SUCCESS', // Already SUCCESS
        userId: 'u-1',
        coinsCredited: 50000n,
        amountUSD: '5.00',
      });

      try {
        const result = await rechargeService.processPaymentWebhook({
          provider: 'STRIPE',
          rawBody,
          signature,
        });

        assert.strictEqual(result.received, true);
        assert.strictEqual(result.alreadyProcessed, true);
        assert.ok(result.message.includes('previously confirmed'));
      } finally {
        paymentProviderService.getDecryptedProviderConfig = originalGetConfig;
        rechargeRepository.findOnlineRechargeByGatewayTxId = originalFindRecharge;
      }
    });

    it('prevents double-crediting when two webhooks arrive concurrently observing PENDING state', async () => {
      const webhookSecret = 'test_whsec';
      const rawBody = JSON.stringify({
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_concurrent_999', amount: 1000 } },
      });

      const timestamp = Math.floor(Date.now() / 1000);
      const sigHex = crypto.createHmac('sha256', webhookSecret).update(`${timestamp}.${rawBody}`).digest('hex');
      const signature = `t=${timestamp},v1=${sigHex}`;

      const originalGetConfig = paymentProviderService.getDecryptedProviderConfig;
      const originalFindRecharge = rechargeRepository.findOnlineRechargeByGatewayTxId;
      const originalFindRechargeById = rechargeRepository.findOnlineRechargeById;
      const originalClaimSuccess = rechargeRepository.claimOnlineRechargeSuccess;
      const originalFindWallet = (await import('../src/repositories/wallet.repository.js')).default.findByUserId;
      const ledgerService = (await import('../src/services/ledger.service.js')).default;
      const originalPostTx = ledgerService.postTransaction;
      const prisma = (await import('../src/config/database.js')).default;
      const originalPrismaTx = prisma.$transaction;

      paymentProviderService.getDecryptedProviderConfig = async () => ({
        name: 'STRIPE',
        webhookSecret,
      });

      (await import('../src/repositories/wallet.repository.js')).default.findByUserId = async () => ({
        id: 'w-1',
        userId: 'u-1',
      });

      ledgerService.postTransaction = async () => ({ referenceId: 'TXN-ONL-1' });
      prisma.$transaction = async (fn) => fn(prisma);

      // Both webhooks initially find the record in PENDING state
      rechargeRepository.findOnlineRechargeByGatewayTxId = async () => ({
        id: 'rec-concurrent-1',
        gatewayTxId: 'pi_concurrent_999',
        status: 'PENDING',
        userId: 'u-1',
        coinsCredited: 100000n,
        amountUSD: '10.00',
      });

      rechargeRepository.findOnlineRechargeById = async (id) => ({
        id,
        gatewayTxId: 'pi_concurrent_999',
        status: 'SUCCESS',
        userId: 'u-1',
        coinsCredited: 100000n,
        amountUSD: '10.00',
      });

      // Only the first atomic update succeeds in claiming PENDING -> SUCCESS
      let claimCount = 0;
      rechargeRepository.claimOnlineRechargeSuccess = async () => {
        claimCount++;
        return claimCount === 1; // 1st wins, 2nd gets false
      };

      try {
        const [res1, res2] = await Promise.all([
          rechargeService.processPaymentWebhook({ provider: 'STRIPE', rawBody, signature }),
          rechargeService.processPaymentWebhook({ provider: 'STRIPE', rawBody, signature }),
        ]);

        // One must succeed and credit, the other must return alreadyProcessed without error
        const credited = [res1, res2].filter((r) => r.processed && !r.alreadyProcessed);
        const deduplicated = [res1, res2].filter((r) => r.alreadyProcessed);

        assert.strictEqual(credited.length, 1, 'Exactly one webhook must credit the wallet');
        assert.strictEqual(deduplicated.length, 1, 'Concurrent webhook must be recognized as alreadyProcessed');
      } finally {
        paymentProviderService.getDecryptedProviderConfig = originalGetConfig;
        rechargeRepository.findOnlineRechargeByGatewayTxId = originalFindRecharge;
        rechargeRepository.findOnlineRechargeById = originalFindRechargeById;
        rechargeRepository.claimOnlineRechargeSuccess = originalClaimSuccess;
        (await import('../src/repositories/wallet.repository.js')).default.findByUserId = originalFindWallet;
        ledgerService.postTransaction = originalPostTx;
        prisma.$transaction = originalPrismaTx;
      }
    });
  });
});
