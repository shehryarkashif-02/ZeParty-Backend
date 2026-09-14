import { describe, it } from 'node:test';
import assert from 'node:assert';
import { diamondsToUSD, coinsToUSD, calculateHostPayroll } from '../src/services/payroll.service.js';

describe('Phase 5 Host Earnings & Precision Suite', () => {
  it('converts BigInt diamonds to exact 2-decimal USD value without float inaccuracy', () => {
    assert.strictEqual(diamondsToUSD(10000n), 1.0);
    assert.strictEqual(diamondsToUSD(25000n), 2.5);
    assert.strictEqual(diamondsToUSD(1000000n), 100.0);
    assert.strictEqual(diamondsToUSD(0n), 0.0);
    assert.strictEqual(diamondsToUSD(123456n), 12.34);
  });

  it('converts BigInt coins to exact 2-decimal USD value without float inaccuracy', () => {
    assert.strictEqual(coinsToUSD(10000n), 1.0);
    assert.strictEqual(coinsToUSD(500000n), 50.0);
    assert.strictEqual(coinsToUSD(10000000n), 1000.0);
  });

  it('aggregates multiple verified gift transactions into host diamond earnings', async () => {
    const mockHost = {
      id: 'host-101',
      userId: 'user-host-1',
      hostType: 'LIVE_HOST',
      hostStatus: 'ACTIVE',
      totalLiveHoursMonth: 5.0,
      targetDaysAchieved: 2,
    };

    const mockGifts = [
      { id: 'gtx-1', recipientUserId: 'user-host-1', hostDiamonds: 35000n },
      { id: 'gtx-2', recipientUserId: 'user-host-1', hostDiamonds: 70000n },
      { id: 'gtx-3', recipientUserId: 'user-other-2', hostDiamonds: 50000n }, // other host
      { id: 'gtx-4', recipientUserId: 'user-host-1', hostDiamonds: 15000n },
    ];

    const result = await calculateHostPayroll({
      hostProfile: mockHost,
      giftTransactions: mockGifts,
      policyConfig: {
        version: 'v3.0.0',
        minDailyHours: 1,
        minDaysPerMonth: 10,
        tiers: [],
      },
    });

    // 35,000 + 70,000 + 15,000 = 120,000 diamonds = $12.00 USD
    assert.strictEqual(result.grossDiamondsOrCoins, 120000n);
    assert.strictEqual(result.giftingUSD, 12.0);
    assert.strictEqual(result.grossEarningsUSD, 12.0);
    assert.strictEqual(result.netPayableUSD, 12.0);
    assert.strictEqual(result.allocations.length, 3);
    assert.strictEqual(result.allocations[0].sourceTransactionId, 'gtx-1');
  });

  it('preserves immutable link between host earnings and source transaction IDs', async () => {
    const mockHost = {
      id: 'host-102',
      userId: 'user-host-2',
      hostType: 'LIVE_HOST',
      hostStatus: 'ACTIVE',
    };

    const mockGifts = [
      { id: 'gtx-alpha-99', recipientUserId: 'user-host-2', hostDiamonds: 50000n },
    ];

    const result = await calculateHostPayroll({
      hostProfile: mockHost,
      giftTransactions: mockGifts,
      policyConfig: { version: 'v3.0.0', tiers: [] },
    });

    assert.strictEqual(result.allocations.length, 1);
    assert.strictEqual(result.allocations[0].sourceTransactionType, 'GIFT_TRANSACTION');
    assert.strictEqual(result.allocations[0].sourceTransactionId, 'gtx-alpha-99');
    assert.strictEqual(result.allocations[0].amountCoinsOrDiamonds, 50000n);
    assert.strictEqual(result.allocations[0].amountUSD, 5.0);
  });
});
