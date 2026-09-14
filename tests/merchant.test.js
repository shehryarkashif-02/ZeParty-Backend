import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  createMerchantSchema,
  updateMerchantSchema,
} from '../src/validators/merchant.validator.js';
import {
  createMerchant,
  updateMerchant,
  getMerchantDetails,
  sanitizeMerchant,
} from '../src/services/merchant.service.js';

describe('Phase 8 Merchant Specification Suite', () => {
  describe('1. Merchant Validation Schemas', () => {
    it('validates merchant creation and sets default monthly quota of 1,000,000 coins', () => {
      const input = {
        userId: 'usr-merch-001',
        companyName: 'Global Gaming Pay Ltd',
      };
      const validated = createMerchantSchema.parse(input);
      assert.strictEqual(validated.companyName, 'Global Gaming Pay Ltd');
      assert.strictEqual(validated.monthlyQuotaCoins, '1000000');
    });

    it('rejects merchant with empty company name', () => {
      assert.throws(() => {
        createMerchantSchema.parse({
          userId: 'usr-merch-001',
          companyName: '',
        });
      });
    });
  });

  describe('2. Merchant Service Logic & Security', () => {
    it('creates merchant, generates secure credentials, and returns raw secret only once at creation', async () => {
      let createdData = null;
      let userTypeUpdated = null;

      const mockDb = {
        merchant: {
          findUnique: async () => null,
        },
        $transaction: async (cb) => {
          const tx = {
            merchant: {
              create: async ({ data }) => {
                createdData = { id: 'merch-001', ...data, createdAt: new Date(), updatedAt: new Date() };
                return createdData;
              },
            },
            user: {
              update: async ({ data }) => {
                userTypeUpdated = data.userType;
                return { id: 'usr-merch-001', userType: data.userType };
              },
            },
          };
          return await cb(tx);
        },
        auditLog: { create: async () => ({ id: 'audit-001' }) },
      };

      const result = await createMerchant(
        {
          userId: 'usr-merch-001',
          companyName: 'Global Gaming Pay Ltd',
        },
        { adminId: 'admin-001', adminName: 'Super Admin' },
        mockDb
      );

      assert.strictEqual(result.id, 'merch-001');
      assert.strictEqual(userTypeUpdated, 'MERCHANT');
      assert.ok(result.rawCredentials);
      assert.match(result.rawCredentials.apiKey, /^zp_live_[a-f0-9]{32}$/);
      assert.match(result.rawCredentials.apiSecret, /^zp_sec_[a-f0-9]{64}$/);

      // Verify hashes were stored in database, not raw credentials
      assert.notStrictEqual(createdData.apiKeyHash, result.rawCredentials.apiKey);
      assert.notStrictEqual(createdData.apiSecretHash, result.rawCredentials.apiSecret);

      // Verify hashes are omitted from the sanitized result
      assert.strictEqual(result.apiKeyHash, undefined);
      assert.strictEqual(result.apiSecretHash, undefined);
    });

    it('sanitizes merchant details on fetch to ensure secrets and hashes are never exposed', async () => {
      const rawMerchant = {
        id: 'merch-001',
        userId: 'usr-merch-001',
        companyName: 'Global Gaming Pay Ltd',
        apiKeyHash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        apiSecretHash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
        monthlyQuotaCoins: 2500000n,
        totalSpentUSD: '150.00',
        status: 'ACTIVE',
      };

      const mockDb = {
        merchant: {
          findUnique: async () => rawMerchant,
        },
      };

      const details = await getMerchantDetails('merch-001', mockDb);
      assert.strictEqual(details.id, 'merch-001');
      assert.strictEqual(details.apiKeyHash, undefined);
      assert.strictEqual(details.apiSecretHash, undefined);
      assert.strictEqual(details.monthlyQuotaCoins, '2500000');
    });
  });
});
