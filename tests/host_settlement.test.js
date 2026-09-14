import { describe, it } from 'node:test';
import assert from 'node:assert';
import { calculateHostPayroll } from '../src/services/payroll.service.js';

describe('Phase 5 Host Settlement & Tier Salary Suite', () => {
  const samplePolicy = {
    version: 'v3.0.0',
    minDailyHours: 1,
    minDaysPerMonth: 10,
    tiers: [
      { level: 1, targetDiamonds: 25000, durationDays: 10, basicSalaryUSD: 2.0 },
      { level: 2, targetDiamonds: 50000, durationDays: 10, basicSalaryUSD: 4.0 },
      { level: 3, targetDiamonds: 100000, durationDays: 10, basicSalaryUSD: 8.0 },
      { level: 4, targetDiamonds: 250000, durationDays: 10, basicSalaryUSD: 20.0 },
    ],
  };

  it('awards base salary when host meets diamond target and streaming requirements', async () => {
    const qualifiedHost = {
      id: 'host-q1',
      userId: 'user-q1',
      hostType: 'LIVE_HOST',
      hostStatus: 'ACTIVE',
      totalLiveHoursMonth: 15.0, // 15 hours > 10 hours required (1 hr/day * 10 days)
      targetDaysAchieved: 12,    // 12 days > 10 days required
    };

    const gifts = [
      { id: 'g1', recipientUserId: 'user-q1', hostDiamonds: 60000n }, // Qualifies for Level 2 (50,000 target)
    ];

    const result = await calculateHostPayroll({
      hostProfile: qualifiedHost,
      giftTransactions: gifts,
      policyConfig: samplePolicy,
    });

    assert.strictEqual(result.grossDiamondsOrCoins, 60000n);
    assert.strictEqual(result.giftingUSD, 6.0); // $6.00 from gifts
    assert.strictEqual(result.baseSalaryUSD, 4.0); // $4.00 from Level 2 salary
    assert.strictEqual(result.grossEarningsUSD, 10.0); // $6.00 + $4.00 = $10.00
    assert.strictEqual(result.netPayableUSD, 10.0);

    const baseSalaryAlloc = result.allocations.find((a) => a.sourceTransactionType === 'BASE_SALARY');
    assert.ok(baseSalaryAlloc);
    assert.strictEqual(baseSalaryAlloc.amountUSD, 4.0);
  });

  it('does not award base salary if host fails to achieve required active streaming days', async () => {
    const underperformingHost = {
      id: 'host-u1',
      userId: 'user-u1',
      hostType: 'LIVE_HOST',
      hostStatus: 'ACTIVE',
      totalLiveHoursMonth: 20.0,
      targetDaysAchieved: 5, // Only 5 days (10 required)
    };

    const gifts = [
      { id: 'g2', recipientUserId: 'user-u1', hostDiamonds: 100000n }, // Level 3 target achieved
    ];

    const result = await calculateHostPayroll({
      hostProfile: underperformingHost,
      giftTransactions: gifts,
      policyConfig: samplePolicy,
    });

    assert.strictEqual(result.grossDiamondsOrCoins, 100000n);
    assert.strictEqual(result.giftingUSD, 10.0);
    assert.strictEqual(result.baseSalaryUSD, 0.0, 'Base salary must be 0 if days requirement is not met');
    assert.strictEqual(result.grossEarningsUSD, 10.0);
  });

  it('selects highest qualified tier when host exceeds multiple diamond milestones', async () => {
    const starHost = {
      id: 'host-star',
      userId: 'user-star',
      hostType: 'LIVE_HOST',
      hostStatus: 'ACTIVE',
      totalLiveHoursMonth: 30.0,
      targetDaysAchieved: 15,
    };

    const gifts = [
      { id: 'g3', recipientUserId: 'user-star', hostDiamonds: 300000n }, // Exceeds Level 4 (250,000 target)
    ];

    const result = await calculateHostPayroll({
      hostProfile: starHost,
      giftTransactions: gifts,
      policyConfig: samplePolicy,
    });

    assert.strictEqual(result.baseSalaryUSD, 20.0); // Level 4 salary ($20.00)
    assert.strictEqual(result.giftingUSD, 30.0);
    assert.strictEqual(result.grossEarningsUSD, 50.0);
  });
});
