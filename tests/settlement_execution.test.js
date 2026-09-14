import { describe, it } from 'node:test';
import assert from 'node:assert';
import { executeSettlementPayout } from '../src/services/settlement.service.js';

describe('Phase 5 Settlement Execution & Atomic Ledger Mutation Suite', () => {
  it('executes atomic payout crediting recipient host wallet and posting double-entry ledger record', async () => {
    let paidStatus = null;
    let ledgerCreated = false;
    let walletUpdated = false;

    const mockWallet = {
      id: 'w-host-1',
      userId: 'u-host-1',
      coinBalance: 0n,
      diamondBalance: 50000n,
      sellerBalanceCoins: 0n,
      escrowLockedCoins: 0n,
    };

    const mockRecord = {
      id: 'sr-pay-01',
      recipientType: 'HOST',
      recipientId: 'host-1',
      userId: 'u-host-1',
      netPayableUSD: 100.0, // $100.00 USD = 1,000,000 diamonds
      status: 'APPROVED',
    };

    const mockDb = {
      $transaction: async (fn) => {
        const tx = {
          $queryRaw: async (strings) => {
            const str = strings ? strings.join(' ') : '';
            if (str.includes('Wallet')) {
              return [mockWallet];
            }
            return [mockRecord];
          },
          settlementRecord: {
            findUnique: async () => mockRecord,
            update: async (args) => {
              paidStatus = args.data.status;
              return { ...mockRecord, ...args.data };
            },
          },
          wallet: {
            findUnique: async () => mockWallet,
            update: async (args) => {
              walletUpdated = true;
              mockWallet.diamondBalance = args.data.diamondBalance;
              return mockWallet;
            },
          },
          walletLedger: {
            create: async (args) => {
              ledgerCreated = true;
              assert.strictEqual(args.data.transactionType, 'SETTLEMENT_PAYOUT');
              assert.strictEqual(args.data.diamondDelta, 1000000n);
              return { id: 'ledg-001', ...args.data };
            },
          },
          auditLog: {
            create: async () => ({ id: 'audit-pay-01' }),
          },
        };
        return await fn(tx);
      },
    };

    const result = await executeSettlementPayout(
      {
        settlementRecordId: 'sr-pay-01',
        adminId: 'admin-exec',
        adminName: 'Admin Exec',
      },
      mockDb
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(paidStatus, 'PAID');
    assert.strictEqual(ledgerCreated, true);
    assert.strictEqual(walletUpdated, true);
    assert.strictEqual(mockWallet.diamondBalance, 1050000n); // 50,000 + 1,000,000
  });

  it('credits coins when executing payout for an Agency recipient', async () => {
    const mockAgencyWallet = {
      id: 'w-ag-1',
      userId: 'u-ag-owner-1',
      coinBalance: 100000n,
      diamondBalance: 0n,
      sellerBalanceCoins: 0n,
      escrowLockedCoins: 0n,
    };

    const mockAgencyRecord = {
      id: 'sr-agency-pay-01',
      recipientType: 'AGENCY',
      recipientId: 'agency-1',
      userId: 'u-ag-owner-1',
      netPayableUSD: 50.0, // $50.00 USD = 500,000 coins
      status: 'APPROVED',
    };

    let ledgerCoinDelta = 0n;

    const mockDb = {
      $transaction: async (fn) => {
        const tx = {
          $queryRaw: async (strings) => {
            const str = strings ? strings.join(' ') : '';
            if (str.includes('Wallet')) {
              return [mockAgencyWallet];
            }
            return [mockAgencyRecord];
          },
          settlementRecord: {
            findUnique: async () => mockAgencyRecord,
            update: async (args) => ({ ...mockAgencyRecord, ...args.data }),
          },
          wallet: {
            findUnique: async () => mockAgencyWallet,
            update: async (args) => {
              mockAgencyWallet.coinBalance = args.data.coinBalance;
              return mockAgencyWallet;
            },
          },
          walletLedger: {
            create: async (args) => {
              ledgerCoinDelta = args.data.coinDelta;
              return { id: 'ledg-ag-01', ...args.data };
            },
          },
          auditLog: {
            create: async () => ({ id: 'audit-ag-01' }),
          },
        };
        return await fn(tx);
      },
    };

    const result = await executeSettlementPayout(
      {
        settlementRecordId: 'sr-agency-pay-01',
        adminId: 'admin-exec',
      },
      mockDb
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(ledgerCoinDelta, 500000n);
    assert.strictEqual(mockAgencyWallet.coinBalance, 600000n); // 100,000 + 500,000
  });
});
