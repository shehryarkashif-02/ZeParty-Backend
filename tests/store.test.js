import { describe, it } from 'node:test';
import assert from 'node:assert';
import { queryStoreCatalogSchema } from '../src/validators/store.validator.js';
import { purchaseAssetSchema } from '../src/validators/asset.validator.js';
import { getStoreCatalog, getVipStoreCatalog, purchaseAsset } from '../src/services/store.service.js';

describe('Phase 9 Store Catalog & Purchasing Specification Suite', () => {
  describe('1. Store Validation Schemas', () => {
    it('validates store catalog query parameters with type filtering', () => {
      const query = {
        assetType: 'vehicle',
        roomAvailability: 'both',
        page: '2',
        limit: '15',
      };
      const validated = queryStoreCatalogSchema.parse(query);
      assert.strictEqual(validated.assetType, 'VEHICLE');
      assert.strictEqual(validated.roomAvailability, 'BOTH');
      assert.strictEqual(validated.page, 2);
      assert.strictEqual(validated.limit, 15);
    });

    it('validates purchase asset payload', () => {
      const payload = { assetId: 'ast-car-01' };
      const validated = purchaseAssetSchema.parse(payload);
      assert.strictEqual(validated.assetId, 'ast-car-01');
    });
  });

  describe('2. Store Purchasing Lifecycle & Double-Entry Accounting', () => {
    it('rejects purchase of an inactive or non-existent asset', async () => {
      const mockDb = {
        asset: {
          findUnique: async () => ({ id: 'ast-001', name: 'Draft Item', isActive: false }),
        },
      };

      await assert.rejects(
        async () => {
          await purchaseAsset({ userId: 'usr-001', assetId: 'ast-001' }, {}, mockDb);
        },
        (err) => err.code === 'ASSET_NOT_ACTIVE'
      );
    });

    it('atomically executes store purchase: debits coins via double-entry ledger and creates UserAsset with validDays', async () => {
      let ledgerPosted = false;
      let createdUserAsset = null;

      const mockDb = {
        asset: {
          findUnique: async () => ({
            id: 'ast-car-01',
            name: 'Golden Sports Car',
            assetType: 'VEHICLE',
            priceCoins: 500000n,
            validDays: 30,
            isActive: true,
          }),
        },
        wallet: {
          findUnique: async () => ({
            id: 'wal-001',
            userId: 'usr-buyer-001',
            coinBalance: 1000000n,
            diamondBalance: 0n,
            sellerBalanceCoins: 0n,
            escrowLockedCoins: 0n,
          }),
        },
        userAsset: {
          findFirst: async () => null, // First-time purchase
        },
        $transaction: async (cb) => {
          const tx = {
            wallet: {
              findUnique: async () => ({
                id: 'wal-001',
                userId: 'usr-buyer-001',
                coinBalance: 1000000n,
                diamondBalance: 0n,
                sellerBalanceCoins: 0n,
                escrowLockedCoins: 0n,
              }),
              update: async () => ({ id: 'wal-001' }),
            },
            walletLedger: {
              create: async () => {
                ledgerPosted = true;
                return { id: 'led-001' };
              },
            },
            userAsset: {
              findFirst: async () => null,
              create: async ({ data }) => {
                createdUserAsset = {
                  id: 'ua-car-001',
                  ...data,
                  asset: {
                    id: 'ast-car-01',
                    name: 'Golden Sports Car',
                    assetType: 'VEHICLE',
                    priceCoins: 500000n,
                  },
                };
                return createdUserAsset;
              },
            },
          };
          return await cb(tx);
        },
        auditLog: { create: async () => ({ id: 'audit-001' }) },
      };

      const result = await purchaseAsset(
        { userId: 'usr-buyer-001', assetId: 'ast-car-01' },
        { ipAddress: '127.0.0.1' },
        mockDb
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.coinsDebited, '500000');
      assert.strictEqual(ledgerPosted, true);
      assert.strictEqual(createdUserAsset.userId, 'usr-buyer-001');
      assert.strictEqual(createdUserAsset.assetId, 'ast-car-01');
      assert.ok(createdUserAsset.expiresAt > new Date());
    });

    it('extends active expiration date when user purchases an asset they already actively own', async () => {
      const existingExpiry = new Date(Date.now() + 10 * 86400000); // 10 days left
      let updatedExpiry = null;

      const mockDb = {
        asset: {
          findUnique: async () => ({
            id: 'ast-frame-01',
            name: 'Warrior Frame',
            assetType: 'FRAME',
            priceCoins: 300000n,
            validDays: 15,
            isActive: true,
          }),
        },
        wallet: {
          findUnique: async () => ({
            id: 'wal-001',
            userId: 'usr-001',
            coinBalance: 500000n,
            diamondBalance: 0n,
            sellerBalanceCoins: 0n,
            escrowLockedCoins: 0n,
          }),
        },
        $transaction: async (cb) => {
          const tx = {
            wallet: {
              findUnique: async () => ({
                id: 'wal-001',
                userId: 'usr-001',
                coinBalance: 500000n,
                diamondBalance: 0n,
                sellerBalanceCoins: 0n,
                escrowLockedCoins: 0n,
              }),
              update: async () => ({ id: 'wal-001' }),
            },
            walletLedger: { create: async () => ({ id: 'led-001' }) },
            userAsset: {
              findFirst: async () => ({
                id: 'ua-existing',
                userId: 'usr-001',
                assetId: 'ast-frame-01',
                expiresAt: existingExpiry,
              }),
              update: async ({ data }) => {
                updatedExpiry = data.expiresAt;
                return {
                  id: 'ua-existing',
                  userId: 'usr-001',
                  assetId: 'ast-frame-01',
                  isEquipped: false,
                  expiresAt: data.expiresAt,
                  asset: { id: 'ast-frame-01', name: 'Warrior Frame', priceCoins: 300000n },
                };
              },
            },
          };
          return await cb(tx);
        },
        auditLog: { create: async () => ({ id: 'audit-002' }) },
      };

      const result = await purchaseAsset(
        { userId: 'usr-001', assetId: 'ast-frame-01' },
        {},
        mockDb
      );

      assert.strictEqual(result.success, true);
      // Expected new expiry = existingExpiry + 15 days
      const expectedTime = existingExpiry.getTime() + 15 * 86400000;
      assert.strictEqual(updatedExpiry.getTime(), expectedTime);
    });
  });
});
