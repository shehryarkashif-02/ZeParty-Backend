import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  createAssetSchema,
  updateAssetSchema,
  purchaseAssetSchema,
  queryAssetsSchema,
} from '../src/validators/asset.validator.js';
import {
  createAsset,
  updateAsset,
  deactivateAsset,
  getUserBackpack,
  equipAsset,
  unequipAsset,
  serializeUserAsset,
} from '../src/services/asset.service.js';

describe('Phase 9 Dynamic Assets & Backpack Specification Suite', () => {
  describe('1. Asset Validation Schemas', () => {
    it('accepts valid asset creation payload and normalizes type to uppercase', () => {
      const input = {
        name: 'Golden Warrior Frame',
        assetType: 'frame',
        assetSubcategory: 'static',
        thumbnailUrl: 'https://cdn.zeparty.app/assets/warrior.png',
        priceCoins: '300000',
        validDays: 15,
        roomAvailability: 'both',
      };
      const validated = createAssetSchema.parse(input);
      assert.strictEqual(validated.name, 'Golden Warrior Frame');
      assert.strictEqual(validated.assetType, 'FRAME');
      assert.strictEqual(validated.assetSubcategory, 'STATIC');
      assert.strictEqual(validated.validDays, 15);
    });

    it('rejects asset with invalid assetType', () => {
      assert.throws(() => {
        createAssetSchema.parse({
          name: 'Invalid Type Asset',
          assetType: 'UNKNOWN_TYPE',
          thumbnailUrl: 'https://cdn.zeparty.app/assets/test.png',
        });
      });
    });

    it('rejects asset with negative validity days', () => {
      assert.throws(() => {
        createAssetSchema.parse({
          name: 'Negative Days',
          assetType: 'FRAME',
          thumbnailUrl: 'https://cdn.zeparty.app/assets/test.png',
          validDays: -5,
        });
      });
    });
  });

  describe('2. Backpack Inventory & Ownership Management', () => {
    it('serializes UserAsset and correctly derives isExpired boolean', () => {
      const activeUserAsset = {
        id: 'ua-001',
        userId: 'usr-001',
        assetId: 'ast-001',
        isEquipped: true,
        expiresAt: new Date(Date.now() + 86400000), // Tomorrow
        asset: { id: 'ast-001', name: 'Gold Frame', priceCoins: 1000n },
      };

      const expiredUserAsset = {
        id: 'ua-002',
        userId: 'usr-001',
        assetId: 'ast-002',
        isEquipped: false,
        expiresAt: new Date(Date.now() - 86400000), // Yesterday
        asset: { id: 'ast-002', name: 'Old Frame', priceCoins: 500n },
      };

      const serializedActive = serializeUserAsset(activeUserAsset);
      const serializedExpired = serializeUserAsset(expiredUserAsset);

      assert.strictEqual(serializedActive.isExpired, false);
      assert.strictEqual(serializedExpired.isExpired, true);
      assert.strictEqual(serializedActive.asset.priceCoins, '1000');
    });

    it('rejects equip action when user is not the asset owner (IDOR defense)', async () => {
      const mockDb = {
        userAsset: {
          findUnique: async () => ({
            id: 'ua-999',
            userId: 'usr-victim-owner',
            assetId: 'ast-001',
            expiresAt: new Date(Date.now() + 86400000),
          }),
        },
      };

      await assert.rejects(
        async () => {
          await equipAsset('usr-attacker', 'ua-999', {}, mockDb);
        },
        (err) => err.code === 'FORBIDDEN_ASSET_ACCESS'
      );
    });

    it('rejects equip action when the asset is expired', async () => {
      const mockDb = {
        userAsset: {
          findUnique: async () => ({
            id: 'ua-001',
            userId: 'usr-001',
            assetId: 'ast-001',
            expiresAt: new Date(Date.now() - 86400000), // Expired
          }),
        },
      };

      await assert.rejects(
        async () => {
          await equipAsset('usr-001', 'ua-001', {}, mockDb);
        },
        (err) => err.code === 'ASSET_EXPIRED'
      );
    });

    it('atomically un-equips existing equipped item of the same assetType when equipping a new one', async () => {
      let unequippedTypeCount = 0;
      let equippedId = null;

      const mockDb = {
        userAsset: {
          findUnique: async () => ({
            id: 'ua-new-frame',
            userId: 'usr-001',
            assetId: 'ast-frame-02',
            expiresAt: new Date(Date.now() + 86400000),
            asset: { id: 'ast-frame-02', name: 'New Frame', assetType: 'FRAME' },
          }),
        },
        $transaction: async (cb) => {
          const tx = {
            userAsset: {
              findMany: async () => [{ id: 'ua-old-frame' }],
              updateMany: async () => {
                unequippedTypeCount++;
                return { count: 1 };
              },
              update: async ({ where, data }) => {
                equippedId = where.id;
                return {
                  id: where.id,
                  userId: 'usr-001',
                  assetId: 'ast-frame-02',
                  isEquipped: data.isEquipped,
                  expiresAt: new Date(Date.now() + 86400000),
                  asset: { id: 'ast-frame-02', name: 'New Frame', assetType: 'FRAME' },
                };
              },
            },
          };
          return await cb(tx);
        },
        auditLog: { create: async () => ({ id: 'audit-001' }) },
      };

      const result = await equipAsset('usr-001', 'ua-new-frame', {}, mockDb);
      assert.strictEqual(result.isEquipped, true);
      assert.strictEqual(equippedId, 'ua-new-frame');
      assert.strictEqual(unequippedTypeCount, 1);
    });
  });
});
