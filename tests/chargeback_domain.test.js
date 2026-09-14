import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  createChargebackSchema,
  resolveChargebackSchema,
} from '../src/validators/chargeback.validator.js';
import chargebackRepository from '../src/repositories/chargeback.repository.js';
import walletRepository from '../src/repositories/wallet.repository.js';
import chargebackService from '../src/services/chargeback.service.js';

describe('Phase 3 Chargebacks & Dispute Center Domain Suite', () => {
  describe('1. Chargeback Validation Schemas', () => {
    it('validates legitimate chargeback creation payload', () => {
      const valid = {
        disputeId: 'disp_stripe_99218',
        userId: '11111111-1111-1111-1111-111111111111',
        gateway: 'STRIPE',
        amountUSD: 50.0,
        coinsInvolved: 500000,
        reason: 'Fraudulent card usage claimed by cardholder',
      };

      const parsed = createChargebackSchema.parse(valid);
      assert.strictEqual(parsed.disputeId, 'disp_stripe_99218');
      assert.strictEqual(parsed.gateway, 'STRIPE');
      assert.strictEqual(parsed.amountUSD, 50.0);
      assert.strictEqual(parsed.coinsInvolved, 500000);
    });

    it('rejects invalid gateway or missing disputeId', () => {
      assert.throws(() => {
        createChargebackSchema.parse({
          disputeId: '',
          userId: '11111111-1111-1111-1111-111111111111',
          gateway: 'STRIPE',
          amountUSD: 10,
        });
      });

      assert.throws(() => {
        createChargebackSchema.parse({
          disputeId: 'disp-1',
          userId: '11111111-1111-1111-1111-111111111111',
          gateway: 'UNKNOWN_GATEWAY',
          amountUSD: 10,
        });
      });
    });

    it('validates resolution action enum', () => {
      const parsed = resolveChargebackSchema.parse({
        action: 'RESOLVE_REVERSE_COINS',
        adminNotes: 'Dispute lost with processor, reversing user coins.',
      });
      assert.strictEqual(parsed.action, 'RESOLVE_REVERSE_COINS');

      assert.throws(() => {
        resolveChargebackSchema.parse({
          action: 'INVALID_ACTION',
        });
      });
    });
  });

  describe('2. Chargeback State Machine & Lifecycle Transitions', () => {
    it('prevents duplicate dispute creation with same disputeId', async () => {
      const originalFindByDispute = chargebackRepository.findChargebackByDisputeId;
      chargebackRepository.findChargebackByDisputeId = async (id) => (id === 'disp_dup' ? { id: 'existing' } : null);

      try {
        await assert.rejects(async () => {
          await chargebackService.createChargeback({
            disputeId: 'disp_dup',
            userId: '11111111-1111-1111-1111-111111111111',
            gateway: 'STRIPE',
            amountUSD: 25,
          });
        }, /has already been logged/);
      } finally {
        chargebackRepository.findChargebackByDisputeId = originalFindByDispute;
      }
    });

    it('updates status to INVESTIGATING gracefully', async () => {
      const mockChargeback = {
        id: 'cb-101',
        disputeId: 'disp_101',
        userId: 'u-1',
        status: 'RECEIVED',
        adminNotes: null,
      };

      const originalFind = chargebackRepository.findChargebackById;
      const originalUpdate = chargebackRepository.updateChargeback;

      chargebackRepository.findChargebackById = async () => mockChargeback;
      chargebackRepository.updateChargeback = async (id, data) => ({
        ...mockChargeback,
        ...data,
      });

      try {
        const result = await chargebackService.resolveChargeback({
          id: 'cb-101',
          action: 'INVESTIGATING',
          adminNotes: 'Contacting card issuer for evidence',
          adminId: 'admin-1',
        });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.chargeback.status, 'INVESTIGATING');
      } finally {
        chargebackRepository.findChargebackById = originalFind;
        chargebackRepository.updateChargeback = originalUpdate;
      }
    });

    it('rejects re-resolving an already closed dispute', async () => {
      const mockClosed = {
        id: 'cb-closed',
        status: 'RESOLVED',
      };

      const originalFind = chargebackRepository.findChargebackById;
      chargebackRepository.findChargebackById = async () => mockClosed;

      try {
        await assert.rejects(async () => {
          await chargebackService.resolveChargeback({
            id: 'cb-closed',
            action: 'RESOLVE_REVERSE_COINS',
            adminId: 'admin-1',
          });
        }, /already closed/);
      } finally {
        chargebackRepository.findChargebackById = originalFind;
      }
    });
  });
});
