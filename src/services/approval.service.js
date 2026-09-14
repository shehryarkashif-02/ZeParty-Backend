import approvalRepository from '../repositories/approval.repository.js';
import effectivePermissionsService from './effectivePermissions.service.js';
import ledgerService from './ledger.service.js';
import walletRepository from '../repositories/wallet.repository.js';
import prisma from '../config/database.js';

// Base Financial Thresholds requiring two-stage approval (Fixed for Phase 6; made dynamic in Phase 7)
export const APPROVAL_THRESHOLDS = {
  COIN_THRESHOLD: 1000000n,    // 1,000,000 Coins ($100 USD equivalent)
  DIAMOND_THRESHOLD: 1000000n, // 1,000,000 Diamonds ($100 USD equivalent)
  USD_THRESHOLD: 100.0,        // $100.00 USD
};

/**
 * Checks if a proposed financial operation exceeds the approval threshold.
 */
export function requiresApproval({ asset, amount, amountUSD = 0 }) {
  if (amountUSD && Number(amountUSD) >= APPROVAL_THRESHOLDS.USD_THRESHOLD) {
    return true;
  }

  const bigAmount = BigInt(amount || 0);
  if (asset === 'COINS' && bigAmount >= APPROVAL_THRESHOLDS.COIN_THRESHOLD) {
    return true;
  }
  if (asset === 'DIAMONDS' && bigAmount >= APPROVAL_THRESHOLDS.DIAMOND_THRESHOLD) {
    return true;
  }

  return false;
}

/**
 * Creates a new pending approval record.
 */
export async function createApprovalRequest(
  {
    requesterId,
    module = 'wallet',
    actionType,
    payloadStateJson,
    beforeStateJson = null,
  },
  db = prisma
) {
  return await approvalRepository.createApproval(
    {
      requesterId,
      module,
      actionType,
      beforeStateJson,
      payloadStateJson,
    },
    db
  );
}

/**
 * Retrieves paginated approval requests.
 */
export async function getApprovals({ status, module, requesterId, page = 1, limit = 20 }) {
  const items = await approvalRepository.findAll({ status, module, requesterId, page, limit });
  const total = await approvalRepository.countAll({ status, module, requesterId });
  return {
    items,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Retrieves a single approval by ID.
 */
export async function getApprovalById(id, db = prisma) {
  const approval = await approvalRepository.findById(id, db);
  if (!approval) {
    const error = new Error('Approval request not found');
    error.status = 404;
    error.code = 'APPROVAL_NOT_FOUND';
    throw error;
  }
  return approval;
}

/**
 * Processes an approval decision (APPROVE) adhering to Maker-Checker rules.
 */
export async function approveRequest({ approvalId, adminId, isOwner = false, ipAddress }) {
  const approval = await getApprovalById(approvalId);

  if (approval.status !== 'PENDING') {
    const error = new Error(`Cannot approve request in status ${approval.status}`);
    error.status = 400;
    error.code = 'INVALID_APPROVAL_STATE';
    throw error;
  }

  // Maker-Checker Rule 1: Requester cannot self-approve (unless Root Owner)
  if (approval.requesterId === adminId && !isOwner) {
    const error = new Error('Maker-Checker Violation: You cannot approve your own request.');
    error.status = 403;
    error.code = 'SELF_APPROVAL_FORBIDDEN';
    throw error;
  }

  // Maker-Checker Rule 2: Approver must have valid approval authority
  const effective = await effectivePermissionsService.calculateEffectivePermissions(adminId);
  if (!effective.canApprove && !effective.isOwner && !isOwner) {
    const error = new Error('Unauthorized: You do not possess financial approval authority.');
    error.status = 403;
    error.code = 'UNAUTHORIZED_APPROVAL';
    throw error;
  }

  // Execute the underlying financial operation inside a Prisma transaction
  let executionResult;

  await prisma.$transaction(async (tx) => {
    const payload = approval.payloadStateJson;

    if (approval.actionType === 'BALANCE_ADJUSTMENT') {
      const { targetUserId, asset, direction, amount, reason } = payload;
      const targetWallet = await walletRepository.findByUserId(targetUserId, tx);
      if (!targetWallet) {
        throw new Error('Target user wallet not found');
      }

      executionResult = await ledgerService.executeDirectAdjustment({
        walletId: targetWallet.id,
        asset,
        direction,
        amount,
        reason: `[Approved Action: ${approval.id}] ${reason}`,
        referenceId: `APP-${approval.id}`,
        db: tx,
      });
    }

    // Update approval status to APPROVED
    await approvalRepository.updateStatus(
      approval.id,
      {
        status: 'APPROVED',
        approverId: adminId,
      },
      tx
    );

    // Create Audit Log record
    await tx.auditLog.create({
      data: {
        adminId,
        adminName: isOwner ? 'Root Owner' : 'Administrator',
        action: 'APPROVAL_EXECUTED',
        targetEntity: 'AdminApproval',
        targetEntityId: approval.id,
        beforeStateJson: { status: 'PENDING' },
        afterStateJson: { status: 'APPROVED', approverId: adminId },
        reason: `Approved ${approval.actionType} requested by admin ${approval.requesterId}`,
        ipAddress,
        approvalId: approval.id,
      },
    });
  });

  return {
    success: true,
    message: 'Approval executed and financial balance posted successfully.',
    approvalId: approval.id,
    executionResult,
  };
}

/**
 * Rejects an approval request.
 */
export async function rejectRequest({ approvalId, adminId, isOwner = false, reason, ipAddress }) {
  const approval = await getApprovalById(approvalId);

  if (approval.status !== 'PENDING') {
    const error = new Error(`Cannot reject request in status ${approval.status}`);
    error.status = 400;
    error.code = 'INVALID_APPROVAL_STATE';
    throw error;
  }

  // Maker-Checker Rule: Requester cannot reject/close without authority
  const effective = await effectivePermissionsService.calculateEffectivePermissions(adminId);
  if (!effective.canApprove && !effective.isOwner && !isOwner) {
    const error = new Error('Unauthorized: You do not possess financial approval authority.');
    error.status = 403;
    error.code = 'UNAUTHORIZED_APPROVAL';
    throw error;
  }

  return await prisma.$transaction(async (tx) => {
    const updated = await approvalRepository.updateStatus(
      approval.id,
      {
        status: 'REJECTED',
        approverId: adminId,
        rejectionReason: reason,
      },
      tx
    );

    await tx.auditLog.create({
      data: {
        adminId,
        adminName: isOwner ? 'Root Owner' : 'Administrator',
        action: 'APPROVAL_REJECTED',
        targetEntity: 'AdminApproval',
        targetEntityId: approval.id,
        beforeStateJson: { status: 'PENDING' },
        afterStateJson: { status: 'REJECTED', rejectionReason: reason },
        reason: `Rejected ${approval.actionType}: ${reason}`,
        ipAddress,
        approvalId: approval.id,
      },
    });

    return updated;
  });
}

export default {
  requiresApproval,
  createApprovalRequest,
  getApprovals,
  getApprovalById,
  approveRequest,
  rejectRequest,
};
