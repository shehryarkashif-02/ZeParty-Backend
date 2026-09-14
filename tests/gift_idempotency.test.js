import { describe, it } from 'node:test';
import assert from 'node:assert';
import { sendGift } from '../src/services/gift.service.js';

describe('Phase 4 — Realtime Gifting Idempotency & Balance Safety Suite', () => {
  it('prevents overdraft when multiple gift transactions arrive concurrently', async () => {
    let currentBalance = 150n; // Only enough for 1 gift of 100 coins
    const giftCost = 100n;

    const mockGift = {
      id: 'gift_idemp_1',
      name: 'Single Rose',
      coinValue: giftCost,
      isActive: true,
    };

    const mockHostProfile = {
      id: 'hp_1',
      userId: 'host_idemp_1',
      hostStatus: 'ACTIVE',
      agencyId: null,
    };

    const mockDb = {
      gift: { findUnique: async () => mockGift },
      hostProfile: {
        findUnique: async () => mockHostProfile,
        update: async () => ({}),
      },
      wallet: {
        findUnique: async ({ where }) => {
          if (where.userId === 'sender_idemp_1' || where.id === 'w_sender') {
            return { id: 'w_sender', userId: 'sender_idemp_1', coinBalance: currentBalance, diamondBalance: 0n };
          }
          return { id: 'w_host', userId: 'host_idemp_1', coinBalance: 0n, diamondBalance: 0n };
        },
        update: async ({ data }) => {
          if (data.coinBalance !== undefined) {
            currentBalance = typeof data.coinBalance === 'bigint' ? data.coinBalance : BigInt(data.coinBalance);
          }
          return {};
        },
      },
      systemPolicy: { findFirst: async () => null },
      room: { findUnique: async () => null },
      hostPerformanceMonthly: { upsert: async () => ({}) },
      giftTransaction: {
        create: async ({ data }) => ({ id: `gtx_${Date.now()}`, ...data }),
      },
      walletLedger: { create: async () => ({ id: 'wl_idemp' }) },
      ledgerEntry: { create: async () => ({ id: 'le_idemp' }) },
      auditLog: { create: async () => ({}) },
      $transaction: async (cb) => {
        const res = await cb(mockDb);
        currentBalance -= giftCost; // Simulates debit
        return res;
      },
    };

    // First gift transaction
    const res1 = await sendGift({
      senderUserId: 'sender_idemp_1',
      recipientUserId: 'host_idemp_1',
      giftId: mockGift.id,
      quantity: 1,
    }, {}, mockDb);

    assert.strictEqual(res1.success, true);

    // Second gift transaction (should fail due to balance now 50 < 100)
    await assert.rejects(
      async () => {
        await sendGift({
          senderUserId: 'sender_idemp_1',
          recipientUserId: 'host_idemp_1',
          giftId: mockGift.id,
          quantity: 1,
        }, {}, mockDb);
      },
      (err) => {
        assert.strictEqual(err.code, 'INSUFFICIENT_BALANCE');
        return true;
      }
    );
  });
});
