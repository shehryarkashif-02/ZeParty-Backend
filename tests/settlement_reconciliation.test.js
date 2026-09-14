import { describe, it } from 'node:test';
import assert from 'node:assert';
import { reconcileSettlementPeriod } from '../src/services/settlement.service.js';

describe('Phase 5 Settlement Reconciliation & Invariant Engine Suite', () => {
  it('confirms balanced status when all records satisfy accounting invariants', async () => {
    const mockPeriod = {
      id: 'sp-rec-balanced',
      periodCode: '2026-08-W1',
      grossTotalUSD: 150.0,
      netPayableUSD: 160.0,
      records: [
        {
          id: 'sr-1',
          recipientId: 'host-1',
          grossEarningsUSD: 100.0,
          deductionsUSD: 0.0,
          netPayableUSD: 110.0, // 100 gross + 10 adj
        },
        {
          id: 'sr-2',
          recipientId: 'host-2',
          grossEarningsUSD: 50.0,
          deductionsUSD: 0.0,
          netPayableUSD: 50.0,
        },
      ],
    };

    const mockDb = {
      settlementPeriod: {
        findUnique: async () => mockPeriod,
      },
      settlementAllocation: {
        findMany: async (args) => {
          if (args.where.settlementRecordId === 'sr-1') {
            return [{ id: 'a1', amountUSD: 100.0 }];
          }
          return [{ id: 'a2', amountUSD: 50.0 }];
        },
      },
      settlementAdjustment: {
        findMany: async (args) => {
          if (args.where.settlementRecordId === 'sr-1') {
            return [{ id: 'adj-1', amountUSD: 10.0 }];
          }
          return [];
        },
      },
    };

    const result = await reconcileSettlementPeriod('sp-rec-balanced', mockDb);

    assert.strictEqual(result.isBalanced, true);
    assert.strictEqual(result.discrepanciesCount, 0);
    assert.strictEqual(result.calculatedGrossTotal, 150.0);
    assert.strictEqual(result.calculatedNetTotal, 160.0);
  });

  it('detects and flags discrepancies when net payable does not match gross and adjustments', async () => {
    const mockPeriod = {
      id: 'sp-rec-unbalanced',
      periodCode: '2026-08-W2',
      grossTotalUSD: 100.0,
      netPayableUSD: 100.0,
      records: [
        {
          id: 'sr-mismatch',
          recipientId: 'host-err',
          grossEarningsUSD: 100.0,
          deductionsUSD: 0.0,
          netPayableUSD: 80.0, // Incorrectly claims $80.00 when adjustments are 0 => $20 delta
        },
      ],
    };

    const mockDb = {
      settlementPeriod: {
        findUnique: async () => mockPeriod,
      },
      settlementAllocation: {
        findMany: async () => [{ id: 'a1', amountUSD: 100.0 }],
      },
      settlementAdjustment: {
        findMany: async () => [],
      },
    };

    const result = await reconcileSettlementPeriod('sp-rec-unbalanced', mockDb);

    assert.strictEqual(result.isBalanced, false);
    assert.strictEqual(result.discrepanciesCount, 1);
    assert.strictEqual(result.discrepancies[0].settlementRecordId, 'sr-mismatch');
    assert.strictEqual(result.discrepancies[0].delta, -20.0);
  });
});
