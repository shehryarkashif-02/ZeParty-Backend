import { describe, it } from 'node:test';
import assert from 'node:assert';
import { calculateSettlementPeriod } from '../src/services/settlement.service.js';

describe('Phase 5 Settlement Calculation & Period Boundaries Suite', () => {
  it('enforces strict half-open date boundary [startDate, endDate)', async () => {
    const mockDb = {
      settlementPeriod: {
        findUnique: async () => null,
        create: async (args) => ({
          id: 'sp-mock-01',
          ...args.data,
          grossTotalCoins: 0n,
          grossTotalUSD: 0,
          netPayableUSD: 0,
          records: [],
        }),
        update: async (args) => ({
          id: args.where.id,
          ...args.data,
          records: [],
        }),
      },
      giftTransaction: {
        findMany: async (args) => {
          // Verify exact gte and lt filters
          assert.ok(args.where.createdAt.gte instanceof Date);
          assert.ok(args.where.createdAt.lt instanceof Date);
          return [];
        },
      },
      hostProfile: {
        findMany: async () => [],
        count: async () => 0,
      },
      auditLog: {
        create: async () => ({ id: 'audit-001' }),
      },
    };

    const periodResult = await calculateSettlementPeriod(
      {
        periodCode: '2026-08-W1',
        entityType: 'HOST',
        startDate: '2026-08-01T00:00:00Z',
        endDate: '2026-08-08T00:00:00Z',
        adminId: 'admin-tester',
      },
      mockDb
    );

    assert.strictEqual(periodResult.periodCode, '2026-08-W1');
    assert.strictEqual(periodResult.status, 'CALCULATED');
  });

  it('rejects invalid date range where startDate >= endDate', async () => {
    await assert.rejects(
      async () => {
        await calculateSettlementPeriod({
          periodCode: '2026-BAD-RANGE',
          entityType: 'HOST',
          startDate: '2026-08-10T00:00:00Z',
          endDate: '2026-08-05T00:00:00Z', // before start
        });
      },
      (err) => {
        assert.strictEqual(err.code, 'INVALID_DATE_RANGE');
        return true;
      }
    );
  });

  it('prevents recalculation of periods that are already approved, processing, or paid', async () => {
    const mockLockedDb = {
      settlementPeriod: {
        findUnique: async () => ({
          id: 'sp-locked',
          periodCode: '2026-LOCKED',
          status: 'PAID',
        }),
      },
    };

    await assert.rejects(
      async () => {
        await calculateSettlementPeriod(
          {
            periodCode: '2026-LOCKED',
            entityType: 'HOST',
            startDate: '2026-08-01T00:00:00Z',
            endDate: '2026-08-15T00:00:00Z',
          },
          mockLockedDb
        );
      },
      (err) => {
        assert.strictEqual(err.code, 'SETTLEMENT_ALREADY_LOCKED');
        return true;
      }
    );
  });
});
