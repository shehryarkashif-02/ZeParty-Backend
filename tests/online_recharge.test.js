import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createPaymentIntentSchema } from '../src/validators/onlineRecharge.validator.js';
import rechargeRepository from '../src/repositories/recharge.repository.js';
import walletRepository from '../src/repositories/wallet.repository.js';
import rechargeService from '../src/services/recharge.service.js';
import paymentProviderService from '../src/services/paymentProvider.service.js';

describe('Phase 3 Online Recharge & Payment Intent Suite', () => {
  describe('1. Intent Validation Schemas', () => {
    it('validates legitimate payment intent request', () => {
      const valid = {
        planId: '11111111-1111-1111-1111-111111111111',
        paymentProvider: 'STRIPE',
      };

      const parsed = createPaymentIntentSchema.parse(valid);
      assert.strictEqual(parsed.planId, '11111111-1111-1111-1111-111111111111');
      assert.strictEqual(parsed.paymentProvider, 'STRIPE');
    });

    it('rejects unsupported payment provider or malformed plan UUID', () => {
      assert.throws(() => {
        createPaymentIntentSchema.parse({
          planId: 'not-a-uuid',
          paymentProvider: 'STRIPE',
        });
      });

      assert.throws(() => {
        createPaymentIntentSchema.parse({
          planId: '11111111-1111-1111-1111-111111111111',
          paymentProvider: 'BITCOIN_UNVERIFIED',
        });
      });
    });
  });

  describe('2. Server-Authoritative Pricing & Intent Creation', () => {
    it('creates online payment intent with server-authoritative pricing and bonus coins', async () => {
      const mockPlan = {
        id: '11111111-1111-1111-1111-111111111111',
        coinAmount: 100000n,
        priceUSD: '9.99',
        bonusCoins: 10000n,
        isActive: true,
      };

      const mockWallet = {
        id: 'w-1',
        userId: 'u-1',
        coinBalance: 0n,
      };

      const originalFindPlan = rechargeRepository.findPlanById;
      const originalFindWallet = walletRepository.findByUserId;
      const originalCreateOnline = rechargeRepository.createOnlineRecharge;
      const originalGetConfig = paymentProviderService.getDecryptedProviderConfig;

      rechargeRepository.findPlanById = async () => mockPlan;
      walletRepository.findByUserId = async () => mockWallet;
      paymentProviderService.getDecryptedProviderConfig = async () => ({
        name: 'STRIPE',
        isSandbox: true,
      });
      rechargeRepository.createOnlineRecharge = async (data) => ({
        id: 'rec-online-100',
        ...data,
        createdAt: new Date(),
      });

      try {
        const result = await rechargeService.createPaymentIntent({
          userId: 'u-1',
          planId: '11111111-1111-1111-1111-111111111111',
          paymentProvider: 'STRIPE',
        });

        assert.strictEqual(result.rechargeId, 'rec-online-100');
        assert.strictEqual(result.amountUSD, 9.99);
        assert.strictEqual(result.coinsToCredit, '110000'); // 100k + 10k bonus
        assert.strictEqual(result.gateway, 'STRIPE');
        assert.ok(result.gatewayTxId.startsWith('pi_'));
        assert.ok(result.clientSecret);
      } finally {
        rechargeRepository.findPlanById = originalFindPlan;
        walletRepository.findByUserId = originalFindWallet;
        rechargeRepository.createOnlineRecharge = originalCreateOnline;
        paymentProviderService.getDecryptedProviderConfig = originalGetConfig;
      }
    });

    it('rejects intent creation if selected recharge plan is inactive or does not exist', async () => {
      const originalFindPlan = rechargeRepository.findPlanById;
      rechargeRepository.findPlanById = async () => null;

      try {
        await assert.rejects(async () => {
          await rechargeService.createPaymentIntent({
            userId: 'u-1',
            planId: '11111111-1111-1111-1111-111111111111',
            paymentProvider: 'STRIPE',
          });
        }, /Selected recharge plan is not available/);
      } finally {
        rechargeRepository.findPlanById = originalFindPlan;
      }
    });
  });
});
