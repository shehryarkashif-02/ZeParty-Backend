import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  createPaymentProviderSchema,
  updatePaymentProviderSchema,
} from '../src/validators/paymentProvider.validator.js';
import paymentProviderRepository from '../src/repositories/paymentProvider.repository.js';
import paymentProviderService, { sanitizeProviderForAdmin } from '../src/services/paymentProvider.service.js';
import { decrypt } from '../src/utils/encryption.util.js';

describe('Phase 3 Payment Provider & Encryption Suite', () => {
  describe('1. Provider Validation Schemas', () => {
    it('validates legitimate payment provider creation payload', () => {
      const valid = {
        name: 'STRIPE',
        apiKey: 'pk_live_stripe_public_key_123',
        apiSecret: 'sk_live_stripe_secret_key_456',
        webhookUrl: 'https://api.zeparty.com/v1/webhooks/payments/stripe',
        webhookSecret: 'whsec_stripe_test_secret',
        isSandbox: false,
        isActive: true,
        feeDescription: '2.9% + $0.30',
        limitsDescription: '$10 - $5,000',
      };

      const parsed = createPaymentProviderSchema.parse(valid);
      assert.strictEqual(parsed.name, 'STRIPE');
      assert.strictEqual(parsed.isSandbox, false);
      assert.strictEqual(parsed.feeDescription, '2.9% + $0.30');
    });

    it('rejects invalid provider name or malformed webhook URL', () => {
      assert.throws(() => {
        createPaymentProviderSchema.parse({
          name: 'UNSUPPORTED_GATEWAY',
          webhookUrl: 'https://valid.com',
        });
      });

      assert.throws(() => {
        createPaymentProviderSchema.parse({
          name: 'STRIPE',
          webhookUrl: 'invalid-url',
        });
      });
    });
  });

  describe('2. Credential Encryption & Masking Safety', () => {
    it('encrypts API secrets using AES-256-GCM and never persists plaintext', async () => {
      let savedData = null;
      const originalFind = paymentProviderRepository.findProviderByName;
      const originalCreate = paymentProviderRepository.createProvider;

      paymentProviderRepository.findProviderByName = async () => null;
      paymentProviderRepository.createProvider = async (data) => {
        savedData = data;
        return {
          id: 'gw-stripe-1',
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      };

      try {
        const result = await paymentProviderService.createPaymentProvider(
          {
            name: 'STRIPE',
            apiKey: 'pk_live_my_api_key_1234',
            apiSecret: 'sk_live_my_super_secret_998877',
            webhookSecret: 'whsec_secret_key_5544',
          },
          'admin-1',
          false,
          '127.0.0.1'
        );

        // Verify saved data in DB contains encrypted tokens with "v1:" prefix
        assert.ok(savedData.encryptedApiKey.startsWith('v1:'));
        assert.ok(savedData.encryptedApiSecret.startsWith('v1:'));
        assert.ok(savedData.encryptedWebhookSecret.startsWith('v1:'));
        assert.notStrictEqual(savedData.encryptedApiSecret, 'sk_live_my_super_secret_998877');

        // Verify decrypted value matches original
        assert.strictEqual(decrypt(savedData.encryptedApiSecret), 'sk_live_my_super_secret_998877');

        // Verify Admin return object masks sensitive keys
        assert.strictEqual(result.maskedApiKey, '****1234');
        assert.strictEqual(result.maskedApiSecret, '****8877');
        assert.strictEqual(result.maskedWebhookSecret, '****5544');
      } finally {
        paymentProviderRepository.findProviderByName = originalFind;
        paymentProviderRepository.createProvider = originalCreate;
      }
    });

    it('sanitizeProviderForAdmin safely handles unencrypted legacy and missing fields', () => {
      const sanitized = sanitizeProviderForAdmin({
        id: 'gw-2',
        name: 'PAYPAL',
        apiKey: 'client_id_live_8819',
        isSandbox: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      assert.strictEqual(sanitized.name, 'PAYPAL');
      assert.strictEqual(sanitized.maskedApiKey, '****8819');
      assert.strictEqual(sanitized.maskedApiSecret, '');
    });

    it('produces unique IVs on repeated encryption and fails on tampered authentication tag', async () => {
      const { encrypt, decrypt } = await import('../src/utils/encryption.util.js');
      const secret = 'stripe_sk_test_1234567890abcdef';

      const enc1 = encrypt(secret);
      const enc2 = encrypt(secret);

      // Unique IV and ciphertext
      assert.notStrictEqual(enc1, enc2);
      assert.strictEqual(decrypt(enc1), secret);
      assert.strictEqual(decrypt(enc2), secret);

      // Tamper with authentication tag
      const parts = enc1.split(':');
      // parts: [ 'v1', ivHex, authTagHex, cipherHex ]
      const tamperedTag = '00'.repeat(16);
      const tamperedPayload = `${parts[0]}:${parts[1]}:${tamperedTag}:${parts[3]}`;

      assert.throws(() => {
        decrypt(tamperedPayload);
      }, /Decryption failed/);
    });
  });
});
