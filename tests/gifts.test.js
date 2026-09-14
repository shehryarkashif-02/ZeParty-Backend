import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  createGiftSchema,
  updateGiftSchema,
  sendGiftSchema,
  queryGiftsSchema,
} from '../src/validators/gift.validator.js';
import {
  createGift,
  updateGift,
  deactivateGift,
  getGiftDetails,
  sendGift,
  serializeGift,
} from '../src/services/gift.service.js';

describe('Phase 9 Virtual Gifts Specification Suite', () => {
  describe('1. Gift Validation Schemas', () => {
    it('accepts valid gift creation payload and normalizes category to uppercase', () => {
      const input = {
        name: 'Sports Car',
        coinValue: '500',
        iconUrl: 'https://cdn.zeparty.app/gifts/car.png',
        svgaAssetUrl: 'https://cdn.zeparty.app/svga/sports_car.svga',
        giftCategory: 'luxury',
        isAnimated: true,
        isFullScreen: true,
      };
      const validated = createGiftSchema.parse(input);
      assert.strictEqual(validated.name, 'Sports Car');
      assert.strictEqual(validated.coinValue, '500');
      assert.strictEqual(validated.giftCategory, 'LUXURY');
      assert.strictEqual(validated.isAnimated, true);
    });

    it('rejects gift with non-positive or zero coin value', () => {
      assert.throws(() => {
        createGiftSchema.parse({
          name: 'Free Gift',
          coinValue: '0',
          iconUrl: 'https://cdn.zeparty.app/gifts/free.png',
        });
      });
    });

    it('rejects gift with malformed icon URL', () => {
      assert.throws(() => {
        createGiftSchema.parse({
          name: 'Invalid Icon',
          coinValue: '100',
          iconUrl: 'not-a-url',
        });
      });
    });

    it('validates send gift payload and rejects quantity <= 0', () => {
      assert.throws(() => {
        sendGiftSchema.parse({
          giftId: 'gift-001',
          recipientUserId: 'usr-host-001',
          quantity: 0,
        });
      });
    });
  });

  describe('2. Gift Catalog Service Lifecycle', () => {
    it('creates a gift and serializes BigInt coin value', async () => {
      const mockDb = {
        gift: {
          create: async ({ data }) => ({
            id: 'gift-001',
            ...data,
            createdAt: new Date(),
          }),
        },
        auditLog: { create: async () => ({ id: 'audit-001' }) },
      };

      const result = await createGift(
        {
          name: 'Rose',
          coinValue: '10',
          iconUrl: 'https://cdn.zeparty.app/gifts/rose.png',
          giftCategory: 'POPULAR',
        },
        { adminId: 'admin-001', adminName: 'Admin' },
        mockDb
      );

      assert.strictEqual(result.id, 'gift-001');
      assert.strictEqual(result.name, 'Rose');
      assert.strictEqual(result.coinValue, '10');
    });

    it('deactivates a gift via soft-deactivation flag', async () => {
      let updatedState = null;
      const mockDb = {
        gift: {
          findUnique: async () => ({
            id: 'gift-001',
            name: 'Rose',
            coinValue: 10n,
            isActive: true,
          }),
          update: async ({ data }) => {
            updatedState = data.isActive;
            return {
              id: 'gift-001',
              name: 'Rose',
              coinValue: 10n,
              isActive: data.isActive,
            };
          },
        },
        auditLog: { create: async () => ({ id: 'audit-002' }) },
      };

      const result = await deactivateGift('gift-001', { adminId: 'admin-001' }, mockDb);
      assert.strictEqual(result.isActive, false);
      assert.strictEqual(updatedState, false);
    });
  });

  describe('3. Virtual Gifting Execution & Double-Entry Revenue Split', () => {
    it('rejects gifting when sender and recipient are identical', async () => {
      const mockDb = {};
      await assert.rejects(
        async () => {
          await sendGift(
            {
              senderUserId: 'usr-user-001',
              recipientUserId: 'usr-user-001',
              giftId: 'gift-001',
              quantity: 1,
            },
            {},
            mockDb
          );
        },
        (err) => err.code === 'CANNOT_GIFT_SELF'
      );
    });

    it('rejects gifting when recipient is not an active host', async () => {
      const mockDb = {
        gift: {
          findUnique: async () => ({ id: 'gift-001', name: 'Rose', coinValue: 10n, isActive: true }),
        },
        hostProfile: {
          findUnique: async () => null, // Not a host
        },
      };

      await assert.rejects(
        async () => {
          await sendGift(
            {
              senderUserId: 'usr-user-001',
              recipientUserId: 'usr-regular-user',
              giftId: 'gift-001',
              quantity: 1,
            },
            {},
            mockDb
          );
        },
        (err) => err.code === 'RECIPIENT_NOT_A_HOST'
      );
    });

    it('atomically executes gift send: debits sender coins, credits host diamonds, credits agency & room, and logs GiftTransaction', async () => {
      let ledgerPosted = false;
      let hostPerfIncremented = false;
      let giftTxCreated = null;

      const mockDb = {
        gift: {
          findUnique: async () => ({
            id: 'gift-car-01',
            name: 'Sports Car',
            coinValue: 500n,
            iconUrl: 'https://cdn.zeparty.app/car.png',
            isActive: true,
          }),
        },
        hostProfile: {
          findUnique: async () => ({
            id: 'hst-001',
            userId: 'usr-host-001',
            hostStatus: 'ACTIVE',
            agencyId: 'agency-001',
          }),
        },
        agency: {
          findUnique: async () => ({
            id: 'agency-001',
            status: 'ACTIVE',
            ownerUserId: 'usr-agency-owner',
          }),
        },
        room: {
          findUnique: async () => ({
            id: 'room-001',
            status: 'LIVE',
            creatorUserId: 'usr-room-creator',
          }),
        },
        policy: {
          findUnique: async () => null, // Uses baseline 45/35/12/8
        },
        policyConfiguration: {
          findUnique: async () => null,
        },
        wallet: {
          findUnique: async ({ where }) => ({
            id: `wal-${where.userId}`,
            userId: where.userId,
            coinBalance: 50000n,
            diamondBalance: 0n,
            sellerBalanceCoins: 0n,
            escrowLockedCoins: 0n,
          }),
          create: async ({ data }) => ({
            id: `wal-${data.userId}`,
            userId: data.userId,
            coinBalance: 0n,
            diamondBalance: 0n,
          }),
        },
        $transaction: async (cb) => {
          const tx = {
            wallet: {
              findUnique: async ({ where }) => ({
                id: where.id,
                userId: 'usr-user-001',
                coinBalance: 50000n,
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
            hostProfile: {
              update: async () => {
                hostPerfIncremented = true;
                return { id: 'hst-001' };
              },
            },
            giftTransaction: {
              create: async ({ data }) => {
                giftTxCreated = { id: 'gtx-001', ...data };
                return giftTxCreated;
              },
            },
          };
          return await cb(tx);
        },
        auditLog: { create: async () => ({ id: 'audit-003' }) },
      };

      const result = await sendGift(
        {
          senderUserId: 'usr-user-001',
          recipientUserId: 'usr-host-001',
          giftId: 'gift-car-01',
          quantity: 2, // 2x 500 = 1000 coins total
          roomId: 'room-001',
        },
        { ipAddress: '127.0.0.1' },
        mockDb
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.totalCoinsDebited, '1000');
      // 35% of 1000 = 350 diamonds
      assert.strictEqual(result.data.hostDiamondsCredited, '350');
      // 12% of 1000 = 120 coins to agency
      assert.strictEqual(result.data.agencyCoinsCredited, '120');
      // 8% of 1000 = 80 coins to room owner
      assert.strictEqual(result.data.roomCoinsCredited, '80');
      assert.strictEqual(ledgerPosted, true);
      assert.strictEqual(hostPerfIncremented, true);
      assert.strictEqual(giftTxCreated.id, 'gtx-001');
    });

    it('rejects gift send when sender has insufficient coin balance', async () => {
      const mockDb = {
        gift: {
          findUnique: async () => ({ id: 'gift-castle', name: 'Castle', coinValue: 5000n, isActive: true }),
        },
        hostProfile: {
          findUnique: async () => ({ id: 'hst-001', userId: 'usr-host-001', hostStatus: 'ACTIVE' }),
        },
        wallet: {
          findUnique: async () => ({ id: 'wal-001', userId: 'usr-poor-user', coinBalance: 100n, diamondBalance: 0n }),
        },
        $transaction: async (cb) => {
          const tx = {
            wallet: {
              findUnique: async () => ({ id: 'wal-001', userId: 'usr-poor-user', coinBalance: 100n, diamondBalance: 0n }),
            },
          };
          return await cb(tx);
        },
      };

      await assert.rejects(
        async () => {
          await sendGift(
            {
              senderUserId: 'usr-poor-user',
              recipientUserId: 'usr-host-001',
              giftId: 'gift-castle',
              quantity: 1,
            },
            {},
            mockDb
          );
        },
        (err) => err.code === 'INSUFFICIENT_BALANCE'
      );
    });
  });
});
