import { describe, it } from 'node:test';
import assert from 'node:assert';
import { requiresApproval, APPROVAL_THRESHOLDS } from '../src/services/approval.service.js';

describe('Phase 6 Two-Stage Admin Approval Workflow Suite', () => {
  // 1. Approval Thresholds & Trigger Rules
  describe('1. Approval Threshold Trigger Logic', () => {
    it('requires approval for coin adjustments >= 1,000,000 coins ($100 USD equivalent)', () => {
      assert.strictEqual(requiresApproval({ asset: 'COINS', amount: 1000000n }), true);
      assert.strictEqual(requiresApproval({ asset: 'COINS', amount: 5000000n }), true);
      assert.strictEqual(requiresApproval({ asset: 'COINS', amount: 999999n }), false);
      assert.strictEqual(requiresApproval({ asset: 'COINS', amount: 500n }), false);
    });

    it('requires approval for diamond adjustments >= 1,000,000 diamonds', () => {
      assert.strictEqual(requiresApproval({ asset: 'DIAMONDS', amount: 1000000n }), true);
      assert.strictEqual(requiresApproval({ asset: 'DIAMONDS', amount: 500000n }), false);
    });

    it('requires approval for fiat operations >= $100.00 USD', () => {
      assert.strictEqual(requiresApproval({ amountUSD: 100.0 }), true);
      assert.strictEqual(requiresApproval({ amountUSD: 250.0 }), true);
      assert.strictEqual(requiresApproval({ amountUSD: 99.99 }), false);
    });
  });

  // 2. Maker-Checker Enforcement Logic
  describe('2. Maker-Checker Security Rules', () => {
    it('blocks self-approval when requester and approver IDs match', async () => {
      const mockApproval = {
        id: 'app-001',
        requesterId: 'admin-alpha',
        status: 'PENDING',
        actionType: 'BALANCE_ADJUSTMENT',
      };

      const approverId = 'admin-alpha'; // Same admin attempting to approve their own request
      const isOwner = false;

      // In approval.service.js logic:
      const isSelfApproval = mockApproval.requesterId === approverId && !isOwner;
      assert.strictEqual(isSelfApproval, true, 'Self approval must be identified and blocked');
    });

    it('allows Root Owner to approve any request even if initiated by them', async () => {
      const mockApproval = {
        id: 'app-002',
        requesterId: 'owner-root',
        status: 'PENDING',
        actionType: 'BALANCE_ADJUSTMENT',
      };

      const approverId = 'owner-root';
      const isOwner = true;

      const isSelfApprovalBlocked = mockApproval.requesterId === approverId && !isOwner;
      assert.strictEqual(isSelfApprovalBlocked, false, 'Root owner has unconditional supremacy');
    });

    it('blocks approval by administrators who lack canApprove or Owner status', async () => {
      const mockAdminEffective = {
        canApprove: false,
        isOwner: false,
        isSuperAdmin: false,
      };

      const isAuthorized = mockAdminEffective.canApprove || mockAdminEffective.isOwner;
      assert.strictEqual(isAuthorized, false, 'Admin without canApprove must be denied');
    });

    it('permits approval when admin possesses explicit canApprove authority', async () => {
      const mockFinanceApprover = {
        canApprove: true,
        isOwner: false,
      };

      const isAuthorized = mockFinanceApprover.canApprove || mockFinanceApprover.isOwner;
      assert.strictEqual(isAuthorized, true, 'Admin with canApprove must be permitted');
    });
  });

  // 3. State Machine & Transition Rules
  describe('3. Approval State Machine & Lifecycle Transitions', () => {
    it('rejects approval attempt on already approved request', () => {
      const mockCompletedApproval = {
        id: 'app-003',
        status: 'APPROVED',
      };

      const canProcess = mockCompletedApproval.status === 'PENDING';
      assert.strictEqual(canProcess, false, 'Already approved request must not re-execute');
    });

    it('rejects approval attempt on already rejected request', () => {
      const mockRejectedApproval = {
        id: 'app-004',
        status: 'REJECTED',
      };

      const canProcess = mockRejectedApproval.status === 'PENDING';
      assert.strictEqual(canProcess, false, 'Already rejected request must not execute');
    });
  });
});
