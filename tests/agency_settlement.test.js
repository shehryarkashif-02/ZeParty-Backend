import { describe, it } from 'node:test';
import assert from 'node:assert';
import { calculateAgencyCommissions } from '../src/services/payroll.service.js';

describe('Phase 5 Agency Commission & Multi-Host Settlement Suite', () => {
  it('derives agency commission strictly from host gifting turnover using agency commission rate', async () => {
    const mockAgency = {
      id: 'agency-alpha',
      ownerUserId: 'user-agency-owner-1',
      agencyName: 'Alpha Talent Agency',
      commissionRate: 20.0, // 20.0%
      status: 'ACTIVE',
    };

    const hostPayrollResults = [
      {
        recipientId: 'host-1',
        grossDiamondsOrCoins: 200000n, // $20.00 USD
        grossEarningsUSD: 20.0,
      },
      {
        recipientId: 'host-2',
        grossDiamondsOrCoins: 300000n, // $30.00 USD
        grossEarningsUSD: 30.0,
      },
    ];

    // Total host gifting turnover: $50.00 USD.
    // Agency commission @ 20%: $10.00 USD = 100,000 coins.
    const result = await calculateAgencyCommissions({
      agency: mockAgency,
      hostPayrollResults,
      policyConfig: { version: 'v3.0.0' },
    });

    assert.strictEqual(result.recipientType, 'AGENCY');
    assert.strictEqual(result.recipientId, 'agency-alpha');
    assert.strictEqual(result.userId, 'user-agency-owner-1');
    assert.strictEqual(result.commissionUSD, 10.0);
    assert.strictEqual(result.grossDiamondsOrCoins, 100000n);
    assert.strictEqual(result.grossEarningsUSD, 10.0);
    assert.strictEqual(result.netPayableUSD, 10.0);
    assert.strictEqual(result.hostCount, 2);
  });

  it('handles agency with zero host activity safely without division by zero', async () => {
    const mockAgency = {
      id: 'agency-empty',
      ownerUserId: 'user-owner-empty',
      commissionRate: 15.0,
    };

    const result = await calculateAgencyCommissions({
      agency: mockAgency,
      hostPayrollResults: [],
      policyConfig: { version: 'v3.0.0' },
    });

    assert.strictEqual(result.commissionUSD, 0.0);
    assert.strictEqual(result.grossDiamondsOrCoins, 0n);
    assert.strictEqual(result.netPayableUSD, 0.0);
    assert.strictEqual(result.hostCount, 0);
  });

  it('respects custom agency commission rate overrides', async () => {
    const customAgency = {
      id: 'agency-vip',
      ownerUserId: 'user-vip-agency',
      commissionRate: 25.0, // 25.0% custom tier
    };

    const hostPayrollResults = [
      {
        recipientId: 'host-top',
        grossDiamondsOrCoins: 1000000n, // $100.00 USD
        grossEarningsUSD: 100.0,
      },
    ];

    const result = await calculateAgencyCommissions({
      agency: customAgency,
      hostPayrollResults,
      policyConfig: { version: 'v3.0.0' },
    });

    assert.strictEqual(result.commissionUSD, 25.0); // 25% of $100 = $25.00
    assert.strictEqual(result.grossDiamondsOrCoins, 250000n); // 250,000 coins
  });
});
