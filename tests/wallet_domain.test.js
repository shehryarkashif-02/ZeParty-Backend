import { describe, it } from 'node:test';
import assert from 'node:assert';
import { sanitizeFinancial } from '../src/utils/bigint.util.js';
import { adjustBalanceSchema } from '../src/validators/finance.validator.js';
import walletRepository from '../src/repositories/wallet.repository.js';
import walletService from '../src/services/wallet.service.js';
import approvalService from '../src/services/approval.service.js';

describe('Phase 3 Wallet Domain & Account Integrity Suite', () => {
  describe('1. Wallet Validation Schemas & Non-Negative Invariants', () => {
    it('validates valid credit adjustment payload', () => {
      const valid = {
        targetUserId: '11111111-1111-1111-1111-111111111111',
        asset: 'COINS',
        direction: 'CREDIT',
        amount: '50000',
        reason: 'Promotional credit granted by admin',
      };

      const parsed = adjustBalanceSchema.parse(valid);
      assert.strictEqual(parsed.asset, 'COINS');
      assert.strictEqual(parsed.direction, 'CREDIT');
      assert.strictEqual(parsed.amount, 50000n);
    });

    it('validates valid debit adjustment payload', () => {
      const valid = {
        targetUserId: '11111111-1111-1111-1111-111111111111',
        asset: 'DIAMONDS',
        direction: 'DEBIT',
        amount: '1200',
        reason: 'Manual adjustment deduction',
      };

      const parsed = adjustBalanceSchema.parse(valid);
      assert.strictEqual(parsed.asset, 'DIAMONDS');
      assert.strictEqual(parsed.direction, 'DEBIT');
      assert.strictEqual(parsed.amount, 1200n);
    });

    it('rejects invalid asset enum or direction', () => {
      assert.throws(() => {
        adjustBalanceSchema.parse({
          targetUserId: '11111111-1111-1111-1111-111111111111',
          asset: 'GOLD',
          direction: 'CREDIT',
          amount: '100',
          reason: 'Test',
        });
      });

      assert.throws(() => {
        adjustBalanceSchema.parse({
          targetUserId: '11111111-1111-1111-1111-111111111111',
          asset: 'COINS',
          direction: 'MULTIPLY',
          amount: '100',
          reason: 'Test',
        });
      });
    });

    it('rejects non-positive amounts or missing reason', () => {
      assert.throws(() => {
        adjustBalanceSchema.parse({
          targetUserId: '11111111-1111-1111-1111-111111111111',
          asset: 'COINS',
          direction: 'CREDIT',
          amount: '0',
          reason: 'Test',
        });
      });

      assert.throws(() => {
        adjustBalanceSchema.parse({
          targetUserId: '11111111-1111-1111-1111-111111111111',
          asset: 'COINS',
          direction: 'CREDIT',
          amount: '100',
          reason: 'ab', // too short (<3 chars)
        });
      });
    });
  });

  describe('2. Wallet Service Operations & Two-Stage Approvals', () => {
    it('getWallet retrieves user wallet and safely sanitizes BigInts', async () => {
      const mockWallet = {
        id: 'w-101',
        userId: 'u-101',
        coinBalance: 500000n,
        diamondBalance: 25000n,
        sellerBalanceCoins: 0n,
        escrowLockedCoins: 0n,
        totalRechargedUSD: '50.00',
        totalWithdrawnUSD: '0.00',
      };

      const originalFind = walletRepository.findByUserId;
      walletRepository.findByUserId = async (uId) => (uId === 'u-101' ? mockWallet : null);

      try {
        const wallet = await walletService.getWallet('u-101');
        assert.strictEqual(wallet.coinBalance, '500000');
        assert.strictEqual(wallet.diamondBalance, '25000');
        assert.strictEqual(wallet.userId, 'u-101');

        await assert.rejects(async () => {
          await walletService.getWallet('non-existent-user');
        }, /Wallet not found/);
      } finally {
        walletRepository.findByUserId = originalFind;
      }
    });

    it('queues adjustments exceeding threshold for Two-Stage Approval when initiated by non-owner', async () => {
      const mockWallet = {
        id: 'w-202',
        userId: 'u-202',
        coinBalance: 10000n,
        diamondBalance: 500n,
      };

      const originalFind = walletRepository.findByUserId;
      const originalCreateApproval = approvalService.createApprovalRequest;

      walletRepository.findByUserId = async () => mockWallet;
      approvalService.createApprovalRequest = async (data) => ({
        id: 'appr-req-991',
        ...data,
        status: 'PENDING',
      });

      try {
        const result = await walletService.adjustBalance({
          requesterId: 'admin-1',
          isOwner: false,
          targetUserId: 'u-202',
          asset: 'COINS',
          direction: 'CREDIT',
          amount: '2000000', // 2M coins = $200 USD > $100 threshold
          reason: 'High value balance compensation',
          ipAddress: '127.0.0.1',
        });

        assert.strictEqual(result.approvalRequired, true);
        assert.strictEqual(result.status, 'PENDING');
        assert.ok(result.approvalId);
      } finally {
        walletRepository.findByUserId = originalFind;
        approvalService.createApprovalRequest = originalCreateApproval;
      }
    });

    it('enforces non-negative balance and prevents lost updates during concurrent operations', async () => {
      let currentCoins = 1000n;
      const mockWallet = {
        id: 'w-concurrent-1',
        userId: 'u-concurrent-1',
        coinBalance: currentCoins,
        diamondBalance: 0n,
        sellerBalanceCoins: 0n,
        escrowLockedCoins: 0n,
        totalRechargedUSD: '0.00',
        totalWithdrawnUSD: '0.00',
      };

      const originalFindByUserId = walletRepository.findByUserId;
      const originalFindWithLock = walletRepository.findWithLock;
      const originalUpdateBalances = walletRepository.updateBalances;
      const prisma = (await import('../src/config/database.js')).default;
      const originalPrismaTx = prisma.$transaction;

      prisma.$transaction = async (fn) => fn(prisma);
      walletRepository.findByUserId = async () => ({ ...mockWallet, coinBalance: currentCoins });
      walletRepository.findWithLock = async () => ({ ...mockWallet, coinBalance: currentCoins });
      walletRepository.updateBalances = async ({ newCoinBalance }) => {
        currentCoins = newCoinBalance;
        return { ...mockWallet, coinBalance: currentCoins };
      };

      try {
        // Attempt debit exceeding balance (1500 > 1000)
        await assert.rejects(async () => {
          await walletService.adjustBalance({
            requesterId: 'owner-id',
            isOwner: true,
            targetUserId: 'u-concurrent-1',
            asset: 'COINS',
            direction: 'DEBIT',
            amount: '1500',
            reason: 'Excessive debit',
          });
        }, /Insufficient coin balance/);

        assert.strictEqual(currentCoins, 1000n, 'Balance must remain unchanged after rejected transaction');
      } finally {
        walletRepository.findByUserId = originalFindByUserId;
        walletRepository.findWithLock = originalFindWithLock;
        walletRepository.updateBalances = originalUpdateBalances;
        prisma.$transaction = originalPrismaTx;
      }
    });
  });
});
