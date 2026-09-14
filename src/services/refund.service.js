import refundRepository from '../repositories/refund.repository.js';
import walletRepository from '../repositories/wallet.repository.js';
import ledgerService from './ledger.service.js';
import { sanitizeFinancial } from '../utils/bigint.util.js';
import prisma from '../config/database.js';

export async function submitCoinRefundDispute({ userId, coinAmount, disputeReason }) {
  const wallet = await walletRepository.findByUserId(userId);
  if (!wallet) {
    const error = new Error('User wallet not found');
    error.status = 404;
    error.code = 'WALLET_NOT_FOUND';
    throw error;
  }

  const created = await refundRepository.create({
    userId,
    coinAmount: BigInt(coinAmount),
    disputeReason,
  });

  return sanitizeFinancial(created);
}

export async function getCoinRefunds({ status, userId, page = 1, limit = 20 }) {
  const items = await refundRepository.findAll({ status, userId, page, limit });
  const total = await refundRepository.countAll({ status, userId });

  return {
    items: items.map((r) => sanitizeFinancial(r)),
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function processCoinRefund({ id, adminId, isOwner = false, ipAddress }) {
  const refund = await refundRepository.findById(id);
  if (!refund) {
    const error = new Error('Coin refund dispute not found');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (refund.status !== 'PENDING') {
    const error = new Error(`Refund has already been processed with status: ${refund.status}`);
    error.status = 400;
    error.code = 'ALREADY_PROCESSED';
    throw error;
  }

  const wallet = await walletRepository.findByUserId(refund.userId);
  if (!wallet) {
    const error = new Error('User wallet not found');
    error.status = 404;
    error.code = 'WALLET_NOT_FOUND';
    throw error;
  }

  const coinAmount = BigInt(refund.coinAmount);

  return await prisma.$transaction(async (tx) => {
    // 1. Atomically claim CoinRefund from PENDING -> PROCESSED
    const claimed = await refundRepository.claimRefundStatus(
      id,
      'PENDING',
      'PROCESSED',
      { processedByAdminId: adminId },
      tx
    );

    if (!claimed) {
      const error = new Error('Refund has already been processed or status changed');
      error.status = 400;
      error.code = 'ALREADY_PROCESSED';
      throw error;
    }

    const updated = await refundRepository.findById(id, tx);

    // 2. Post atomic ledger credit
    const ledgerResult = await ledgerService.postTransaction({
      operations: [
        {
          walletId: wallet.id,
          coinDelta: coinAmount,
        },
      ],
      referenceId: `REF-${refund.id}`,
      transactionType: 'REFUND',
      db: tx,
    });

    // 3. Emit AuditLog
    await tx.auditLog.create({
      data: {
        adminId,
        adminName: isOwner ? 'Root Owner' : 'Administrator',
        action: 'COIN_REFUND_PROCESSED',
        targetEntity: 'CoinRefund',
        targetEntityId: id,
        afterStateJson: {
          coinAmount: coinAmount.toString(),
          referenceId: ledgerResult.referenceId,
        },
        reason: `Processed coin refund dispute: ${refund.disputeReason}`,
        ipAddress,
      },
    });

    return {
      success: true,
      message: 'Coin refund processed and coins credited to user wallet successfully.',
      refund: sanitizeFinancial(updated),
      ledger: ledgerResult,
    };
  });
}

export async function rejectCoinRefund({ id, adminId, isOwner = false, reason, ipAddress }) {
  const refund = await refundRepository.findById(id);
  if (!refund) {
    const error = new Error('Coin refund dispute not found');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (refund.status !== 'PENDING') {
    const error = new Error(`Refund has already been processed with status: ${refund.status}`);
    error.status = 400;
    error.code = 'ALREADY_PROCESSED';
    throw error;
  }

  return await prisma.$transaction(async (tx) => {
    const claimed = await refundRepository.claimRefundStatus(
      id,
      'PENDING',
      'REJECTED',
      { processedByAdminId: adminId },
      tx
    );

    if (!claimed) {
      const error = new Error('Refund has already been processed or status changed');
      error.status = 400;
      error.code = 'ALREADY_PROCESSED';
      throw error;
    }

    const updated = await refundRepository.findById(id, tx);

    await tx.auditLog.create({
      data: {
        adminId,
        adminName: isOwner ? 'Root Owner' : 'Administrator',
        action: 'COIN_REFUND_REJECTED',
        targetEntity: 'CoinRefund',
        targetEntityId: id,
        reason: reason || 'Dispute rejected by administrator',
        ipAddress,
      },
    });

    return {
      success: true,
      message: 'Coin refund dispute rejected.',
      refund: sanitizeFinancial(updated),
    };
  });
}

export default {
  submitCoinRefundDispute,
  getCoinRefunds,
  processCoinRefund,
  rejectCoinRefund,
};
