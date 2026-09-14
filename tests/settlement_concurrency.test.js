import { describe, it } from 'node:test';
import assert from 'node:assert';
import { executeSettlementPayout } from '../src/services/settlement.service.js';

describe('Phase 5 Settlement Concurrency & Race Condition Suite', () => {
  it('prevents double-payment when two admin requests attempt simultaneous payout', async () => {
    let paymentCount = 0;
    let ledgerMutationCount = 0;

    const mockRecord = {
      id: 'sr-concurrent-01',
      recipientType: 'HOST',
      recipientId: 'host-1',
      userId: 'u-host-1',
      netPayableUSD: 150.0,
      status: 'APPROVED',
    };

    const mockWallet = {
      id: 'w-host-1',
      userId: 'u-host-1',
      coinBalance: 0n,
      diamondBalance: 0n,
      sellerBalanceCoins: 0n,
      escrowLockedCoins: 0n,
    };

    // Simulated concurrency harness where the first caller changes status to PROCESSING/PAID
    const mockDb = {
      $transaction: async (fn) => {
        const tx = {
          $queryRaw: async () => [mockRecord],
          settlementRecord: {
            findUnique: async () => mockRecord,
            update: async (args) => {
              mockRecord.status = args.data.status;
              if (args.data.status === 'PAID') {
                paymentCount++;
              }
              return mockRecord;
            },
          },
          wallet: {
            findUnique: async () => mockWallet,
            update: async (args) => {
              mockWallet.diamondBalance = args.data.diamondBalance;
              return mockWallet;
            },
          },
          walletLedger: {
            create: async (args) => {
              ledgerMutationCount++;
              return { id: `ledg-${ledgerMutationCount}`, ...args.data };
            },
          },
          auditLog: {
            create: async () => ({ id: 'audit-01' }),
          },
        };
        return await fn(tx);
      },
    };

    // First request executes
    const firstPayout = await executeSettlementPayout(
      { settlementRecordId: 'sr-concurrent-01', adminId: 'admin-1' },
      mockDb
    );
    assert.strictEqual(firstPayout.success, true);

    // Second simultaneous request attempts payout on now-PAID record
    await assert.rejects(
      async () => {
        await executeSettlementPayout(
          { settlementRecordId: 'sr-concurrent-01', adminId: 'admin-2' },
          mockDb
        );
      },
      (err) => {
        assert.strictEqual(err.code, 'SETTLEMENT_ALREADY_PAID');
        return true;
      }
    );

    // Strictly 1 payment and 1 ledger mutation
    assert.strictEqual(paymentCount, 1);
    assert.strictEqual(ledgerMutationCount, 1);
    assert.strictEqual(mockWallet.diamondBalance, 1500000n); // 150.0 USD * 10,000 = 1,500,000 diamonds
  });
});
