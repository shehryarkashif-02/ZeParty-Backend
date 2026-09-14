import { describe, it } from 'node:test';
import assert from 'node:assert';
import { calculateBDCenterSettlement } from '../src/services/payroll.service.js';

describe('Phase 5 BD Center Settlement & Tier Salary Suite', () => {
  it('calculates base salary correctly according to BD Center tier', async () => {
    const bronzeBD = {
      id: 'bd-bronze',
      managerUserId: 'user-bd-1',
      currentTier: 'BRONZE',
      baseSalaryUSD: 500.0,
    };

    const goldBD = {
      id: 'bd-gold',
      managerUserId: 'user-bd-2',
      currentTier: 'GOLD',
      baseSalaryUSD: 2000.0,
    };

    const bronzeResult = await calculateBDCenterSettlement({
      bdCenter: bronzeBD,
      agencyResults: [],
      directHostResults: [],
    });

    const goldResult = await calculateBDCenterSettlement({
      bdCenter: goldBD,
      agencyResults: [],
      directHostResults: [],
    });

    assert.strictEqual(bronzeResult.baseSalaryUSD, 500.0);
    assert.strictEqual(bronzeResult.netPayableUSD, 500.0);
    assert.strictEqual(goldResult.baseSalaryUSD, 2000.0);
    assert.strictEqual(goldResult.netPayableUSD, 2000.0);
  });

  it('calculates performance bonus when group turnover exceeds threshold', async () => {
    const activeBD = {
      id: 'bd-active',
      managerUserId: 'user-bd-active',
      currentTier: 'SILVER',
      baseSalaryUSD: 1000.0,
    };

    // Direct hosts: $4,000 USD turnover
    const directHostResults = [
      { recipientId: 'h1', grossDiamondsOrCoins: 40000000n },
    ];

    // Agencies: $2,000 USD turnover
    const agencyResults = [
      { recipientId: 'a1', grossDiamondsOrCoins: 20000000n },
    ];

    // Total Group: 60,000,000 diamonds = $6,000 USD (>= $5,000 USD threshold).
    // Bonus @ 2% of $6,000 = $120.00 USD.
    const result = await calculateBDCenterSettlement({
      bdCenter: activeBD,
      agencyResults,
      directHostResults,
    });

    assert.strictEqual(result.baseSalaryUSD, 1000.0);
    assert.strictEqual(result.performanceBonusUSD, 120.0);
    assert.strictEqual(result.grossEarningsUSD, 1120.0);
    assert.strictEqual(result.netPayableUSD, 1120.0);
    assert.strictEqual(result.allocations.length, 2);
  });
});
