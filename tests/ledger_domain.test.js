import { describe, it } from 'node:test';
import assert from 'node:assert';
import { sanitizeFinancial } from '../src/utils/bigint.util.js';
import { generateReference } from '../src/utils/reference.util.js';
import { calculateRevenueSplit } from '../src/utils/split.util.js';
import {
  postTransaction,
  executeDirectAdjustment,
  executeDoubleEntryTransfer,
} from '../src/services/ledger.service.js';
import walletRepository from '../src/repositories/wallet.repository.js';
import ledgerRepository from '../src/repositories/ledger.repository.js';

describe('Phase 3 Ledger Domain & Accounting Suite', () => {
  describe('1. Reference Generation & BigInt Serialization', () => {
    it('generates cryptographic transaction references with proper prefixes', () => {
      const ref = generateReference('TXN');
      assert.ok(ref.startsWith('TXN-'));
      assert.strictEqual(ref.length, 40);
    });

    it('sanitizes BigInt balances in deeply nested structures', () => {
      const obj = {
        wallet: {
          coinBalance: 1250000n,
          diamondBalance: 88000n,
        },
        transactions: [{ delta: 100n }, { delta: -50n }],
      };
      const clean = sanitizeFinancial(obj);
      assert.strictEqual(clean.wallet.coinBalance, '1250000');
      assert.strictEqual(clean.wallet.diamondBalance, '88000');
      assert.strictEqual(clean.transactions[0].delta, '100');
    });
  });

  describe('2. Revenue Split Engine (45/35/12/8%)', () => {
    it('calculates exact platform, host, agency, and room revenue splits without loss', () => {
      const split = calculateRevenueSplit(10000n);
      assert.strictEqual(split.platformCoins, 4500n);
      assert.strictEqual(split.hostDiamonds, 3500n);
      assert.strictEqual(split.agencyCoins, 1200n);
      assert.strictEqual(split.roomCoins, 800n);
      assert.strictEqual(split.totalAllocated, 10000n);
    });

    it('reconciles integer division remainders to maintain exact zero-sum balance', () => {
      const split = calculateRevenueSplit(999n);
      assert.strictEqual(split.totalAllocated, 999n);
    });

    it('guarantees zero-sum balance for 1 coin, 3 coins, 7 coins, and 100M coins', () => {
      const testCases = [1n, 2n, 3n, 7n, 13n, 97n, 333n, 7777n, 100000000n];
      for (const amount of testCases) {
        const split = calculateRevenueSplit(amount);
        assert.strictEqual(
          split.totalAllocated,
          amount,
          `Failed for amount ${amount}: sum of splits (${split.totalAllocated}) != original (${amount})`
        );
        assert.strictEqual(
          split.platformCoins + split.hostDiamonds + split.agencyCoins + split.roomCoins,
          amount,
          `Individual parts do not sum to original for ${amount}`
        );
      }
    });
  });

  describe('3. Ledger Invariants & Double-Entry Transfers', () => {
    it('rejects double-entry transfer when source and destination are the same wallet', async () => {
      await assert.rejects(async () => {
        await executeDoubleEntryTransfer({
          sourceWalletId: 'wallet-same',
          destinationWalletId: 'wallet-same',
          amount: '100',
        });
      }, /Source and destination wallets cannot be identical/);
    });

    it('rejects transfer with non-positive amount', async () => {
      await assert.rejects(async () => {
        await executeDoubleEntryTransfer({
          sourceWalletId: 'wallet-1',
          destinationWalletId: 'wallet-2',
          amount: '0',
        });
      }, /Transfer amount must be greater than zero/);
    });
  });
});
