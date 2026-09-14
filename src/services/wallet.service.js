import walletRepository from '../repositories/wallet.repository.js';
import ledgerRepository from '../repositories/ledger.repository.js';
import ledgerService from './ledger.service.js';
import approvalService, { requiresApproval } from './approval.service.js';
import { sanitizeFinancial } from '../utils/bigint.util.js';
import prisma from '../config/database.js';

/**
 * Retrieves a user's wallet with BigInt values safely formatted.
 */
export async function getWallet(userId) {
  const wallet = await walletRepository.findByUserId(userId);
  if (!wallet) {
    const error = new Error('Wallet not found for this user');
    error.status = 404;
    error.code = 'WALLET_NOT_FOUND';
    throw error;
  }
  return sanitizeFinancial(wallet);
}

/**
 * Retrieves paginated ledger history for a user's wallet.
 */
export async function getWalletLedger(userId, { page = 1, limit = 20, type = null }) {
  const wallet = await walletRepository.findByUserId(userId);
  if (!wallet) {
    const error = new Error('Wallet not found');
    error.status = 404;
    error.code = 'WALLET_NOT_FOUND';
    throw error;
  }

  const items = await ledgerRepository.findByWalletId(wallet.id, { page, limit, type });
  const total = await ledgerRepository.countByWalletId(wallet.id, { type });

  return {
    items: items.map((item) => sanitizeFinancial(item)),
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Retrieves master transaction ledger for administrative review.
 */
export async function getMasterLedger({ page = 1, limit = 20, type, userId, referenceId, startDate, endDate }) {
  const items = await ledgerRepository.findAll({ page, limit, type, userId, referenceId, startDate, endDate });
  const total = await ledgerRepository.countAll({ type, userId, referenceId, startDate, endDate });

  return {
    items: items.map((item) => sanitizeFinancial(item)),
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Retrieves platform-wide circulation statistics.
 */
export async function getPlatformWalletStats() {
  const stats = await walletRepository.getPlatformStats();
  return sanitizeFinancial(stats);
}

/**
 * Executes or queues an administrative balance adjustment.
 */
export async function adjustBalance({
  requesterId,
  isOwner = false,
  targetUserId,
  asset, // 'COINS' | 'DIAMONDS'
  direction, // 'CREDIT' | 'DEBIT'
  amount,
  reason,
  ipAddress,
}) {
  const targetWallet = await walletRepository.findByUserId(targetUserId);
  if (!targetWallet) {
    const error = new Error('Target user does not have an active wallet.');
    error.status = 404;
    error.code = 'WALLET_NOT_FOUND';
    throw error;
  }

  const bigAmount = BigInt(amount);

  // Check if financial action requires Two-Stage Approval
  const needsApproval = requiresApproval({ asset, amount: bigAmount }) && !isOwner;

  if (needsApproval) {
    const approval = await approvalService.createApprovalRequest({
      requesterId,
      module: 'wallet',
      actionType: 'BALANCE_ADJUSTMENT',
      beforeStateJson: {
        coinBalance: targetWallet.coinBalance.toString(),
        diamondBalance: targetWallet.diamondBalance.toString(),
      },
      payloadStateJson: {
        targetUserId,
        asset,
        direction,
        amount: bigAmount.toString(),
        reason,
      },
    });

    return {
      approvalRequired: true,
      message: 'Adjustment amount exceeds threshold ($100 USD equivalent) and was queued for two-stage approval.',
      approvalId: approval.id,
      status: 'PENDING',
    };
  }

  // Direct Execution for authorized requests below threshold or from Root Owner
  const execution = await ledgerService.executeDirectAdjustment({
    walletId: targetWallet.id,
    asset,
    direction,
    amount: bigAmount,
    reason,
  });

  // Log to AuditLog
  await prisma.auditLog.create({
    data: {
      adminId: requesterId,
      adminName: isOwner ? 'Root Owner' : 'Administrator',
      action: 'BALANCE_ADJUSTED',
      targetEntity: 'Wallet',
      targetEntityId: targetWallet.id,
      afterStateJson: {
        asset,
        direction,
        amount: bigAmount.toString(),
        reason,
      },
      reason,
      ipAddress,
    },
  }).catch(() => {});

  return {
    approvalRequired: false,
    message: 'Balance adjustment executed successfully.',
    referenceId: execution.referenceId,
    results: execution.results,
  };
}

export default {
  getWallet,
  getWalletLedger,
  getMasterLedger,
  getPlatformWalletStats,
  adjustBalance,
};
