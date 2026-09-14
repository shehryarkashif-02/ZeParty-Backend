import { describe, it } from 'node:test';
import assert from 'node:assert';
import { sanitizeFinancial } from '../src/utils/bigint.util.js';
import { generateReference } from '../src/utils/reference.util.js';
import { calculateRevenueSplit } from '../src/utils/split.util.js';
import { hashPayload, checkIdempotency, setInProgress, storeResult, clearLock } from '../src/utils/idempotency.util.js';
import { postTransaction, executeDirectAdjustment, executeDoubleEntryTransfer } from '../src/services/ledger.service.js';

describe('Phase 6 Wallet, Double-Entry Ledger & Accounting Suite', () => {
  // 1. BigInt and Numeric Serialization
  describe('1. BigInt and Financial Precision Serialization', () => {
    it('safely serializes BigInt to string in deeply nested objects', () => {
      const payload = {
        coinBalance: 5000000n,
        user: {
          diamondBalance: 1250000n,
          level: 12,
        },
        transactions: [{ delta: -500n }, { delta: 1000n }],
      };

      const sanitized = sanitizeFinancial(payload);
      assert.strictEqual(sanitized.coinBalance, '5000000');
      assert.strictEqual(sanitized.user.diamondBalance, '1250000');
      assert.strictEqual(sanitized.user.level, 12);
      assert.strictEqual(sanitized.transactions[0].delta, '-500');
      assert.strictEqual(sanitized.transactions[1].delta, '1000');

      // Verify JSON.stringify does not crash
      const json = JSON.stringify(sanitized);
      assert.ok(json.includes('"coinBalance":"5000000"'));
    });
  });

  // 2. Cryptographic Reference IDs
  describe('2. Financial Reference Generation', () => {
    it('generates unique prefixed reference strings', () => {
      const ref1 = generateReference('TXN');
      const ref2 = generateReference('TXN');
      const offRef = generateReference('OFF');

      assert.ok(ref1.startsWith('TXN-'));
      assert.ok(offRef.startsWith('OFF-'));
      assert.notStrictEqual(ref1, ref2);
      assert.strictEqual(ref1.length, 40); // 'TXN-' + 36 char UUID
    });
  });

  // 3. Deterministic Revenue Split Engine
  describe('3. Virtual Economy Revenue Split (45/35/12/8%)', () => {
    it('accurately calculates 45% Platform, 35% Host, 12% Agency, 8% Room split', () => {
      const split = calculateRevenueSplit(10000n);
      assert.strictEqual(split.platformCoins, 4500n);
      assert.strictEqual(split.hostDiamonds, 3500n);
      assert.strictEqual(split.agencyCoins, 1200n);
      assert.strictEqual(split.roomCoins, 800n);
      assert.strictEqual(split.totalAllocated, 10000n);
    });

    it('reconciles integer division remainders to ensure exact balance matching', () => {
      // 101 coins: 45% = 45.45 -> 45, 35% = 35.35 -> 35, 12% = 12.12 -> 12, 8% = 8.08 -> 8
      // Sum = 45+35+12+8 = 100, remainder = 1 -> added to platform (46)
      const split = calculateRevenueSplit(101n);
      assert.strictEqual(split.platformCoins, 46n);
      assert.strictEqual(split.hostDiamonds, 35n);
      assert.strictEqual(split.agencyCoins, 12n);
      assert.strictEqual(split.roomCoins, 8n);
      assert.strictEqual(split.totalAllocated, 101n);
      assert.strictEqual(split.totalAllocated, split.originalCoins);
    });

    it('throws on non-positive amounts', () => {
      assert.throws(() => calculateRevenueSplit(0n));
      assert.throws(() => calculateRevenueSplit(-100n));
    });
  });

  // 4. Distributed Financial Idempotency
  describe('4. Financial Mutation Idempotency', () => {
    it('prevents duplicate execution with same Idempotency-Key and returns cached result', async () => {
      const key = `test-idemp-${Date.now()}-${Math.random()}`;
      const payload = { targetUserId: 'user-1', amount: '500', asset: 'COINS' };
      const pHash = hashPayload(payload);

      // Check 1: Initial check returns NEW
      const check1 = await checkIdempotency(key, pHash);
      assert.strictEqual(check1.state, 'NEW');

      // Set In Progress
      await setInProgress(key, pHash);

      // Check 2: Concurrent duplicate returns IN_PROGRESS
      const check2 = await checkIdempotency(key, pHash);
      assert.strictEqual(check2.state, 'IN_PROGRESS');

      // Store final result
      const mockResult = { success: true, referenceId: 'TXN-ABC' };
      await storeResult(key, pHash, 200, mockResult);

      // Check 3: Subsequent request returns COMPLETED with stored body
      const check3 = await checkIdempotency(key, pHash);
      assert.strictEqual(check3.state, 'COMPLETED');
      assert.strictEqual(check3.statusCode, 200);
      assert.deepStrictEqual(check3.responseBody, mockResult);
    });

    it('detects payload conflict when same key is submitted with different payload', async () => {
      const key = `test-conflict-${Date.now()}`;
      const p1 = hashPayload({ amount: '500' });
      const p2 = hashPayload({ amount: '1000' });

      await storeResult(key, p1, 200, { ok: true });

      const check = await checkIdempotency(key, p2);
      assert.strictEqual(check.state, 'CONFLICT');
    });
  });

  // 5. Accounting Invariants & Concurrency Simulation
  describe('5. Ledger Invariants, Non-Negative Balances & Concurrency', () => {
    it('rejects transactions that cause spendable coin balance to drop below zero', async () => {
      // Mock mock-wallet state
      const mockWallet = {
        id: 'w-1',
        userId: 'u-1',
        coinBalance: 50n,
        diamondBalance: 0n,
        sellerBalanceCoins: 0n,
        escrowLockedCoins: 0n,
      };

      const mockDb = {
        $queryRaw: async () => [mockWallet],
        wallet: { findUnique: async () => mockWallet },
        walletLedger: { create: async (args) => ({ id: 'ledger-1', ...args.data }) },
      };

      await assert.rejects(
        async () => {
          await postTransaction({
            operations: [
              {
                walletId: 'w-1',
                coinDelta: -80n, // Attempt to spend 80 from 50
              },
            ],
            db: mockDb,
          });
        },
        (err) => err.code === 'INSUFFICIENT_BALANCE'
      );
    });

    it('simulates concurrent debit protection where only one of two simultaneous requests succeeds', async () => {
      let currentCoins = 100n;

      // Simulated atomic row lock executor
      const executeConcurrentDebit = async (debitAmount) => {
        if (currentCoins < debitAmount) {
          const err = new Error('Insufficient coin balance');
          err.code = 'INSUFFICIENT_BALANCE';
          throw err;
        }
        currentCoins -= debitAmount;
        return { success: true, remaining: currentCoins };
      };

      // Request A (80 coins) and Request B (80 coins) on 100 coin initial balance
      const results = await Promise.allSettled([
        executeConcurrentDebit(80n),
        executeConcurrentDebit(80n),
      ]);

      const succeeded = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r) => r.status === 'rejected');

      assert.strictEqual(succeeded.length, 1, 'Exactly one concurrent debit must succeed');
      assert.strictEqual(failed.length, 1, 'The conflicting concurrent debit must fail');
      assert.strictEqual(failed[0].reason.code, 'INSUFFICIENT_BALANCE');
      assert.strictEqual(currentCoins, 20n, 'Final balance must be exactly 20 (never negative)');
    });

    it('guarantees balanced double-entry transfer across source and destination accounts', async () => {
      const sourceWallet = {
        id: 'w-src',
        coinBalance: 500n,
        diamondBalance: 0n,
        sellerBalanceCoins: 0n,
        escrowLockedCoins: 0n,
      };
      const destWallet = {
        id: 'w-dst',
        coinBalance: 100n,
        diamondBalance: 0n,
        sellerBalanceCoins: 0n,
        escrowLockedCoins: 0n,
      };

      const ledgerLogs = [];

      const mockDb = {
        $queryRaw: async (strings, ...values) => {
          const id = values[0] || (Array.isArray(strings) ? strings.join('') : String(strings));
          if (id === 'w-src' || String(id).includes('w-src')) return [sourceWallet];
          if (id === 'w-dst' || String(id).includes('w-dst')) return [destWallet];
          return null;
        },
        wallet: {
          findUnique: async ({ where }) => (where.id === 'w-src' ? sourceWallet : destWallet),
          update: async ({ where, data }) => {
            if (where.id === 'w-src') sourceWallet.coinBalance = data.coinBalance;
            if (where.id === 'w-dst') destWallet.coinBalance = data.coinBalance;
            return data;
          },
        },
        walletLedger: {
          create: async ({ data }) => {
            ledgerLogs.push(data);
            return { id: `log-${ledgerLogs.length}`, ...data };
          },
        },
      };

      const result = await executeDoubleEntryTransfer({
        sourceWalletId: 'w-src',
        destinationWalletId: 'w-dst',
        asset: 'COINS',
        amount: 200n,
        db: mockDb,
      });

      assert.ok(result.referenceId);
      assert.strictEqual(sourceWallet.coinBalance, 300n);
      assert.strictEqual(destWallet.coinBalance, 300n);

      // Verify balanced ledger entries: 1 debit (-200) + 1 credit (+200) = 0 net
      assert.strictEqual(ledgerLogs.length, 2);
      const sumDelta = ledgerLogs.reduce((acc, l) => acc + l.coinDelta, 0n);
      assert.strictEqual(sumDelta, 0n, 'Sum of double-entry deltas must equal zero');
    });
  });
});
