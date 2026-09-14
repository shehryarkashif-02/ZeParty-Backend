import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createCoinRefundSchema } from '../src/validators/finance.validator.js';
import refundRepository from '../src/repositories/refund.repository.js';
import walletRepository from '../src/repositories/wallet.repository.js';
import refundService from '../src/services/refund.service.js';

describe('Phase 3 Coin Refund & Dispute Domain Suite', () => {
  describe('1. Refund Validation Schemas', () => {
    it('validates legitimate refund dispute submission payload', () => {
      const valid = {
        coinAmount: 50000,
        disputeReason: 'Double charged during live stream gift broadcast',
      };

      const parsed = createCoinRefundSchema.parse(valid);
      assert.strictEqual(parsed.coinAmount, 50000);
      assert.strictEqual(parsed.disputeReason, 'Double charged during live stream gift broadcast');
    });

    it('rejects refund dispute with zero or negative coins', () => {
      assert.throws(() => {
        createCoinRefundSchema.parse({
          coinAmount: 0,
          disputeReason: 'Test',
        });
      });

      assert.throws(() => {
        createCoinRefundSchema.parse({
          coinAmount: -100,
          disputeReason: 'Negative coins',
        });
      });
    });
  });

  describe('2. Refund Processing & Idempotency', () => {
    it('prevents double processing of already completed or rejected refunds', async () => {
      const mockProcessed = {
        id: 'ref-already-done',
        userId: 'u-1',
        coinAmount: 10000n,
        status: 'PROCESSED',
      };

      const originalFind = refundRepository.findById;
      refundRepository.findById = async () => mockProcessed;

      try {
        await assert.rejects(async () => {
          await refundService.processCoinRefund({
            id: 'ref-already-done',
            adminId: 'admin-1',
            isOwner: false,
            ipAddress: '127.0.0.1',
          });
        }, /already been processed/);

        await assert.rejects(async () => {
          await refundService.rejectCoinRefund({
            id: 'ref-already-done',
            adminId: 'admin-1',
            isOwner: false,
            reason: 'Already completed',
            ipAddress: '127.0.0.1',
          });
        }, /already been processed/);
      } finally {
        refundRepository.findById = originalFind;
      }
    });

    it('rejects processing when refund record does not exist', async () => {
      const originalFind = refundRepository.findById;
      refundRepository.findById = async () => null;

      try {
        await assert.rejects(async () => {
          await refundService.processCoinRefund({
            id: 'non-existent-ref',
            adminId: 'admin-1',
            isOwner: false,
            ipAddress: '127.0.0.1',
          });
        }, /not found/);
      } finally {
        refundRepository.findById = originalFind;
      }
    });
  });
});
