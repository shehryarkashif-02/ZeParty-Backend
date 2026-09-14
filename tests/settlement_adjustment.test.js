import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createSettlementAdjustment } from '../src/services/settlement.service.js';

describe('Phase 5 Settlement Additive Adjustments Suite', () => {
  it('creates additive bonus adjustment and safely recalculates net payable amount', async () => {
    let adjustmentRecord = null;
    let updatedRecord = null;

    const mockRecord = {
      id: 'sr-adj-01',
      userId: 'user-h1',
      status: 'CALCULATED',
      grossEarningsUSD: 100.0,
      deductionsUSD: 0.0,
      adjustmentsUSD: 0.0,
      netPayableUSD: 100.0,
    };

    const mockDb = {
      settlementRecord: {
        findUnique: async () => mockRecord,
        update: async (args) => {
          updatedRecord = { ...mockRecord, ...args.data };
          return updatedRecord;
        },
      },
      settlementAdjustment: {
        create: async (args) => {
          adjustmentRecord = { id: 'adj-01', ...args.data };
          return adjustmentRecord;
        },
      },
      auditLog: {
        create: async () => ({ id: 'audit-adj-01' }),
      },
    };

    const result = await createSettlementAdjustment(
      {
        settlementRecordId: 'sr-adj-01',
        amountUSD: 25.0, // +$25.00 Bonus
        type: 'BONUS',
        reason: 'Exceptional monthly streaming performance bonus',
        adminId: 'admin-1',
      },
      mockDb
    );

    assert.ok(result.adjustment);
    assert.strictEqual(result.adjustment.amountUSD, 25.0);
    assert.strictEqual(result.updatedRecord.adjustmentsUSD, 25.0);
    assert.strictEqual(result.updatedRecord.netPayableUSD, 125.0); // 100.0 + 25.0
  });

  it('creates penalty adjustment and properly reduces net payable amount', async () => {
    let updatedRecord = null;

    const mockRecord = {
      id: 'sr-adj-02',
      userId: 'user-h2',
      status: 'CALCULATED',
      grossEarningsUSD: 100.0,
      deductionsUSD: 0.0,
      adjustmentsUSD: 0.0,
      netPayableUSD: 100.0,
    };

    const mockDb = {
      settlementRecord: {
        findUnique: async () => mockRecord,
        update: async (args) => {
          updatedRecord = { ...mockRecord, ...args.data };
          return updatedRecord;
        },
      },
      settlementAdjustment: {
        create: async (args) => ({ id: 'adj-02', ...args.data }),
      },
      auditLog: {
        create: async () => ({ id: 'audit-02' }),
      },
    };

    const result = await createSettlementAdjustment(
      {
        settlementRecordId: 'sr-adj-02',
        amountUSD: -15.0, // -$15.00 Penalty
        type: 'PENALTY',
        reason: 'Streaming rule violation deduction',
        adminId: 'admin-1',
      },
      mockDb
    );

    assert.strictEqual(result.updatedRecord.adjustmentsUSD, -15.0);
    assert.strictEqual(result.updatedRecord.netPayableUSD, 85.0); // 100.0 - 15.0
  });

  it('blocks adjustment creation on already paid settlements', async () => {
    const mockPaidRecord = {
      id: 'sr-paid-locked',
      status: 'PAID',
      grossEarningsUSD: 50.0,
      netPayableUSD: 50.0,
    };

    const mockDb = {
      settlementRecord: {
        findUnique: async () => mockPaidRecord,
      },
    };

    await assert.rejects(
      async () => {
        await createSettlementAdjustment(
          {
            settlementRecordId: 'sr-paid-locked',
            amountUSD: 10.0,
            type: 'BONUS',
            reason: 'Late bonus',
            adminId: 'admin-1',
          },
          mockDb
        );
      },
      (err) => {
        assert.strictEqual(err.code, 'SETTLEMENT_ALREADY_PAID');
        return true;
      }
    );
  });
});
