import { describe, it } from 'node:test';
import assert from 'node:assert';
import { submitOfflineRechargeSchema } from '../src/validators/onlineRecharge.validator.js';
import { rejectFinancialItemSchema } from '../src/validators/finance.validator.js';
import rechargeRepository from '../src/repositories/recharge.repository.js';
import walletRepository from '../src/repositories/wallet.repository.js';
import rechargeService from '../src/services/recharge.service.js';

describe('Phase 3 Offline Recharge & Maker-Checker Suite', () => {
  describe('1. Offline Recharge Validation', () => {
    it('validates legitimate offline recharge submission payload', () => {
      const valid = {
        amountUSD: 100,
        bankName: 'Chase Bank',
        receiptPhotoUrl: 'https://cdn.zeparty.com/receipts/rec-991.jpg',
        transactionRef: 'BANK-REF-99281',
      };

      const parsed = submitOfflineRechargeSchema.parse(valid);
      assert.strictEqual(parsed.amountUSD, 100);
      assert.strictEqual(parsed.bankName, 'Chase Bank');
      assert.strictEqual(parsed.transactionRef, 'BANK-REF-99281');
    });

    it('rejects invalid photo URL or missing bank name', () => {
      assert.throws(() => {
        submitOfflineRechargeSchema.parse({
          amountUSD: 50,
          bankName: 'A',
          receiptPhotoUrl: 'not-a-valid-url',
          transactionRef: 'REF-1',
        });
      });
    });

    it('validates rejection reason payload', () => {
      const parsed = rejectFinancialItemSchema.parse({
        reason: 'Bank slip photo is unreadable and reference not found in statement',
      });
      assert.ok(parsed.reason);
    });
  });

  describe('2. Maker-Checker Invariants & Replay Defenses', () => {
    it('prevents an administrator from approving their own recharge request (Maker-Checker Invariant)', async () => {
      const mockRecord = {
        id: 'off-1',
        userId: 'admin-user-same-id',
        amountUSD: '100.00',
        status: 'PENDING',
      };

      const originalFind = rechargeRepository.findOfflineRechargeById;
      rechargeRepository.findOfflineRechargeById = async () => mockRecord;

      try {
        await assert.rejects(async () => {
          await rechargeService.approveOfflineRecharge({
            id: 'off-1',
            adminId: 'admin-user-same-id',
            isOwner: false,
            ipAddress: '127.0.0.1',
          });
        }, /Self-approval forbidden/);
      } finally {
        rechargeRepository.findOfflineRechargeById = originalFind;
      }
    });

    it('rejects approval or rejection of an already processed request', async () => {
      const mockProcessedRecord = {
        id: 'off-2',
        userId: 'user-202',
        amountUSD: '50.00',
        status: 'APPROVED',
      };

      const originalFind = rechargeRepository.findOfflineRechargeById;
      rechargeRepository.findOfflineRechargeById = async () => mockProcessedRecord;

      try {
        await assert.rejects(async () => {
          await rechargeService.approveOfflineRecharge({
            id: 'off-2',
            adminId: 'admin-reviewer',
            isOwner: false,
            ipAddress: '127.0.0.1',
          });
        }, /already been processed/);

        await assert.rejects(async () => {
          await rechargeService.rejectOfflineRecharge({
            id: 'off-2',
            adminId: 'admin-reviewer',
            isOwner: false,
            reason: 'Duplicate check',
            ipAddress: '127.0.0.1',
          });
        }, /already been processed/);
      } finally {
        rechargeRepository.findOfflineRechargeById = originalFind;
      }
    });

    it('rejects duplicate submission with identical transaction reference', async () => {
      const originalFindRef = rechargeRepository.findOfflineRechargeByRef;
      rechargeRepository.findOfflineRechargeByRef = async (ref) => (ref === 'DUP-REF-1' ? { id: 'existing-rec' } : null);

      try {
        await assert.rejects(async () => {
          await rechargeService.submitOfflineRecharge({
            userId: 'user-1',
            amountUSD: 50,
            bankName: 'Bank of America',
            receiptPhotoUrl: 'https://cdn.zeparty.com/receipt.png',
            transactionRef: 'DUP-REF-1',
          });
        }, /Transaction reference has already been submitted/);
      } finally {
        rechargeRepository.findOfflineRechargeByRef = originalFindRef;
      }
    });
  });
});
