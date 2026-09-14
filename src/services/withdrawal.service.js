import withdrawalRepository from '../repositories/withdrawal.repository.js';
import walletRepository from '../repositories/wallet.repository.js';
import ledgerService from './ledger.service.js';
import { sanitizeFinancial } from '../utils/bigint.util.js';
import prisma from '../config/database.js';

export async function getWithdrawals({ status, userId, page = 1, limit = 20 }) {
  const items = await withdrawalRepository.findAll({ status, userId, page, limit });
  const total = await withdrawalRepository.countAll({ status, userId });

  return {
    items: items.map((w) => sanitizeFinancial(w)),
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function approveWithdrawal({ id, adminId, isOwner = false, ipAddress }) {
  const request = await withdrawalRepository.findById(id);
  if (!request) {
    const error = new Error('Withdrawal request not found');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (request.status !== 'PENDING') {
    const error = new Error(`Withdrawal request has already been processed with status: ${request.status}`);
    error.status = 400;
    error.code = 'ALREADY_PROCESSED';
    throw error;
  }

  const wallet = await walletRepository.findByUserId(request.userId);
  if (!wallet) {
    const error = new Error('Host wallet not found');
    error.status = 404;
    error.code = 'WALLET_NOT_FOUND';
    throw error;
  }

  const diamondsDebited = BigInt(request.diamondsDebited);
  const amountUSD = Number(request.amountUSD);

  return await prisma.$transaction(async (tx) => {
    // 1. Update WithdrawalRequest
    const updated = await withdrawalRepository.updateStatus(
      id,
      {
        status: 'APPROVED',
        reviewerAdminId: adminId,
        reviewedAt: new Date(),
      },
      tx
    );

    // 2. Post atomic ledger withdrawal
    const ledgerResult = await ledgerService.postTransaction({
      operations: [
        {
          walletId: wallet.id,
          diamondDelta: -diamondsDebited,
          usdDelta: -amountUSD,
          withdrawnDeltaUSD: amountUSD,
        },
      ],
      referenceId: `WD-${request.id}`,
      transactionType: 'WITHDRAWAL',
      db: tx,
    });

    // 3. Emit AuditLog
    await tx.auditLog.create({
      data: {
        adminId,
        adminName: isOwner ? 'Root Owner' : 'Administrator',
        action: 'WITHDRAWAL_APPROVED',
        targetEntity: 'WithdrawalRequest',
        targetEntityId: id,
        afterStateJson: {
          diamondsDebited: diamondsDebited.toString(),
          amountUSD,
          referenceId: ledgerResult.referenceId,
        },
        reason: `Approved diamond cashout of $${amountUSD} for host ${request.user?.username}`,
        ipAddress,
      },
    });

    return {
      success: true,
      message: 'Withdrawal approved and diamonds debited successfully.',
      withdrawal: sanitizeFinancial(updated),
      ledger: ledgerResult,
    };
  });
}

export async function rejectWithdrawal({ id, adminId, isOwner = false, reason, ipAddress }) {
  const request = await withdrawalRepository.findById(id);
  if (!request) {
    const error = new Error('Withdrawal request not found');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (request.status !== 'PENDING') {
    const error = new Error(`Withdrawal request has already been processed with status: ${request.status}`);
    error.status = 400;
    error.code = 'ALREADY_PROCESSED';
    throw error;
  }

  return await prisma.$transaction(async (tx) => {
    const updated = await withdrawalRepository.updateStatus(
      id,
      {
        status: 'REJECTED',
        reviewerAdminId: adminId,
        rejectionReason: reason,
        reviewedAt: new Date(),
      },
      tx
    );

    await tx.auditLog.create({
      data: {
        adminId,
        adminName: isOwner ? 'Root Owner' : 'Administrator',
        action: 'WITHDRAWAL_REJECTED',
        targetEntity: 'WithdrawalRequest',
        targetEntityId: id,
        reason,
        ipAddress,
      },
    });

    return {
      success: true,
      message: 'Withdrawal request rejected.',
      withdrawal: sanitizeFinancial(updated),
    };
  });
}

export default {
  getWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
};
