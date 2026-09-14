import { describe, it } from 'node:test';
import assert from 'node:assert';
import { submitSettlementForApproval, approveSettlementRecord } from '../src/services/settlement.service.js';

describe('Phase 5 Settlement Approval & Maker-Checker Suite', () => {
  it('triggers Two-Stage Approval request for settlements exceeding $100.00 threshold', async () => {
    let createdApproval = null;
    let updatedRecord = null;

    const mockDb = {
      settlementRecord: {
        findUnique: async () => ({
          id: 'sr-high-value',
          status: 'CALCULATED',
          recipientType: 'HOST',
          recipientId: 'host-1',
          userId: 'user-host-1',
          netPayableUSD: 250.0, // >= $100.00
        }),
        update: async (args) => {
          updatedRecord = { id: args.where.id, ...args.data };
          return updatedRecord;
        },
      },
      adminApproval: {
        create: async (args) => {
          createdApproval = { id: 'app-settle-01', ...args.data };
          return createdApproval;
        },
      },
      auditLog: {
        create: async () => ({ id: 'audit-01' }),
      },
    };

    const result = await submitSettlementForApproval(
      {
        settlementRecordId: 'sr-high-value',
        adminId: 'admin-maker-1',
        adminName: 'Admin Maker',
      },
      mockDb
    );

    assert.strictEqual(result.status, 'PENDING_APPROVAL');
    assert.ok(createdApproval);
    assert.strictEqual(createdApproval.module, 'finance');
    assert.strictEqual(createdApproval.actionType, 'SETTLEMENT_PAYOUT');
  });

  it('blocks self-approval when the submitting administrator attempts to approve their own settlement', async () => {
    const mockDb = {
      settlementRecord: {
        findUnique: async () => ({
          id: 'sr-pending-01',
          status: 'PENDING_APPROVAL',
          approvalId: 'app-001',
          userId: 'user-host-1',
          netPayableUSD: 500.0,
        }),
      },
      adminApproval: {
        findUnique: async () => ({
          id: 'app-001',
          requesterId: 'admin-maker-1', // Submitter ID
          status: 'PENDING',
        }),
      },
    };

    await assert.rejects(
      async () => {
        await approveSettlementRecord(
          {
            settlementRecordId: 'sr-pending-01',
            adminId: 'admin-maker-1', // Same admin attempting self-approval
            isOwner: false,
          },
          mockDb
        );
      },
      (err) => {
        assert.strictEqual(err.code, 'SELF_APPROVAL_FORBIDDEN');
        return true;
      }
    );
  });

  it('allows approval by a distinct authorized checker administrator', async () => {
    let approvedRecord = null;

    const mockDb = {
      settlementRecord: {
        findUnique: async () => ({
          id: 'sr-pending-02',
          status: 'PENDING_APPROVAL',
          approvalId: 'app-002',
          userId: 'user-host-1',
          netPayableUSD: 500.0,
        }),
        update: async (args) => {
          approvedRecord = { id: args.where.id, ...args.data };
          return approvedRecord;
        },
      },
      adminApproval: {
        findUnique: async () => ({
          id: 'app-002',
          requesterId: 'admin-maker-1',
          status: 'PENDING',
        }),
      },
      auditLog: {
        create: async () => ({ id: 'audit-02' }),
      },
    };

    const result = await approveSettlementRecord(
      {
        settlementRecordId: 'sr-pending-02',
        adminId: 'admin-checker-2', // Distinct checker admin
        isOwner: false,
      },
      mockDb
    );

    assert.strictEqual(result.status, 'APPROVED');
  });

  it('allows Root Owner to approve settlement unconditionally', async () => {
    const mockDb = {
      settlementRecord: {
        findUnique: async () => ({
          id: 'sr-pending-03',
          status: 'PENDING_APPROVAL',
          approvalId: 'app-003',
          userId: 'user-host-1',
          netPayableUSD: 500.0,
        }),
        update: async (args) => ({ id: args.where.id, ...args.data }),
      },
      adminApproval: {
        findUnique: async () => ({
          id: 'app-003',
          requesterId: 'owner-master',
          status: 'PENDING',
        }),
      },
      auditLog: {
        create: async () => ({ id: 'audit-03' }),
      },
    };

    const result = await approveSettlementRecord(
      {
        settlementRecordId: 'sr-pending-03',
        adminId: 'owner-master',
        isOwner: true, // Root owner
      },
      mockDb
    );

    assert.strictEqual(result.status, 'APPROVED');
  });
});
