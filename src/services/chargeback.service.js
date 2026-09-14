import chargebackRepository from '../repositories/chargeback.repository.js';
import walletRepository from '../repositories/wallet.repository.js';
import ledgerService from './ledger.service.js';
import { sanitizeFinancial } from '../utils/bigint.util.js';
import prisma from '../config/database.js';

export async function getChargebacks({ status, userId, gateway, page = 1, limit = 20 }) {
  const items = await chargebackRepository.findAllChargebacks({ status, userId, gateway, page, limit });
  const total = await chargebackRepository.countChargebacks({ status, userId, gateway });

  return {
    items: items.map((i) => sanitizeFinancial(i)),
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getChargebackById(id) {
  const chargeback = await chargebackRepository.findChargebackById(id);
  if (!chargeback) {
    const error = new Error('Chargeback dispute record not found');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }
  return sanitizeFinancial(chargeback);
}

export async function createChargeback(data, adminId, isOwner = false, ipAddress) {
  const existing = await chargebackRepository.findChargebackByDisputeId(data.disputeId);
  if (existing) {
    const error = new Error(`Dispute "${data.disputeId}" has already been logged`);
    error.status = 409;
    error.code = 'DUPLICATE_DISPUTE_ID';
    throw error;
  }

  const userWallet = await walletRepository.findByUserId(data.userId);
  if (!userWallet) {
    const error = new Error('User wallet not found for target account');
    error.status = 404;
    error.code = 'WALLET_NOT_FOUND';
    throw error;
  }

  const created = await chargebackRepository.createChargeback(data);

  await prisma.auditLog.create({
    data: {
      adminId,
      adminName: isOwner ? 'Root Owner' : 'Administrator',
      action: 'CHARGEBACK_DISPUTE_LOGGED',
      targetEntity: 'Chargeback',
      targetEntityId: created.id,
      afterStateJson: sanitizeFinancial(created),
      reason: `Logged incoming payment dispute ${created.disputeId}`,
      ipAddress,
    },
  }).catch(() => {});

  return sanitizeFinancial(created);
}

export async function resolveChargeback({ id, action, adminNotes, adminId, isOwner = false, ipAddress }) {
  const chargeback = await chargebackRepository.findChargebackById(id);
  if (!chargeback) {
    const error = new Error('Chargeback dispute record not found');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (chargeback.status === 'RESOLVED' || chargeback.status === 'REJECTED') {
    const error = new Error(`Dispute is already closed with status: ${chargeback.status}`);
    error.status = 400;
    error.code = 'ALREADY_CLOSED';
    throw error;
  }

  if (action === 'INVESTIGATING') {
    const updated = await chargebackRepository.updateChargeback(id, {
      status: 'INVESTIGATING',
      adminNotes: adminNotes || chargeback.adminNotes,
    });
    return {
      success: true,
      message: 'Chargeback status updated to INVESTIGATING.',
      chargeback: sanitizeFinancial(updated),
    };
  }

  if (action === 'REJECT') {
    const claimed = await chargebackRepository.claimChargebackStatus(
      id,
      ['RECEIVED', 'INVESTIGATING'],
      'REJECTED',
      {
        adminNotes: adminNotes || chargeback.adminNotes,
        resolvedByAdminId: adminId,
        resolvedAt: new Date(),
      }
    );

    if (!claimed) {
      const error = new Error('Dispute is already closed or modified by another administrator');
      error.status = 400;
      error.code = 'ALREADY_CLOSED';
      throw error;
    }

    const updated = await chargebackRepository.findChargebackById(id);

    await prisma.auditLog.create({
      data: {
        adminId,
        adminName: isOwner ? 'Root Owner' : 'Administrator',
        action: 'CHARGEBACK_REJECTED',
        targetEntity: 'Chargeback',
        targetEntityId: id,
        reason: adminNotes || 'Dispute rejected by administrator',
        ipAddress,
      },
    }).catch(() => {});

    return {
      success: true,
      message: 'Chargeback dispute rejected.',
      chargeback: sanitizeFinancial(updated),
    };
  }

  if (action === 'RESOLVE_DISMISS') {
    const claimed = await chargebackRepository.claimChargebackStatus(
      id,
      ['RECEIVED', 'INVESTIGATING'],
      'RESOLVED',
      {
        adminNotes: adminNotes || chargeback.adminNotes,
        resolvedByAdminId: adminId,
        resolvedAt: new Date(),
      }
    );

    if (!claimed) {
      const error = new Error('Dispute is already closed or modified by another administrator');
      error.status = 400;
      error.code = 'ALREADY_CLOSED';
      throw error;
    }

    const updated = await chargebackRepository.findChargebackById(id);

    await prisma.auditLog.create({
      data: {
        adminId,
        adminName: isOwner ? 'Root Owner' : 'Administrator',
        action: 'CHARGEBACK_RESOLVED_DISMISSED',
        targetEntity: 'Chargeback',
        targetEntityId: id,
        reason: adminNotes || 'Dispute resolved and dismissed without debit',
        ipAddress,
      },
    }).catch(() => {});

    return {
      success: true,
      message: 'Chargeback resolved without balance debit.',
      chargeback: sanitizeFinancial(updated),
    };
  }

  if (action === 'RESOLVE_REVERSE_COINS') {
    const wallet = await walletRepository.findByUserId(chargeback.userId);
    if (!wallet) {
      const error = new Error('Target user wallet not found');
      error.status = 404;
      error.code = 'WALLET_NOT_FOUND';
      throw error;
    }

    const coinsToDebit = BigInt(chargeback.coinsInvolved);

    return await prisma.$transaction(async (tx) => {
      const claimed = await chargebackRepository.claimChargebackStatus(
        id,
        ['RECEIVED', 'INVESTIGATING'],
        'RESOLVED',
        {
          adminNotes: adminNotes || chargeback.adminNotes,
          resolvedByAdminId: adminId,
          resolvedAt: new Date(),
        },
        tx
      );

      if (!claimed) {
        const error = new Error('Dispute is already closed or modified by another administrator');
        error.status = 400;
        error.code = 'ALREADY_CLOSED';
        throw error;
      }

      const updated = await chargebackRepository.findChargebackById(id, tx);

      let ledgerResult = null;
      if (coinsToDebit > 0n) {
        ledgerResult = await ledgerService.postTransaction({
          operations: [
            {
              walletId: wallet.id,
              coinDelta: -coinsToDebit,
            },
          ],
          referenceId: `CBK-${chargeback.disputeId}`,
          transactionType: 'CHARGEBACK_REVERSAL',
          db: tx,
        });
      }

      await tx.auditLog.create({
        data: {
          adminId,
          adminName: isOwner ? 'Root Owner' : 'Administrator',
          action: 'CHARGEBACK_RESOLVED_REVERSED',
          targetEntity: 'Chargeback',
          targetEntityId: id,
          afterStateJson: {
            disputeId: chargeback.disputeId,
            coinsDebited: coinsToDebit.toString(),
            referenceId: ledgerResult?.referenceId || null,
          },
          reason: adminNotes || `Reversed ${coinsToDebit} coins for dispute ${chargeback.disputeId}`,
          ipAddress,
        },
      });

      return {
        success: true,
        message: 'Chargeback resolved and disputed coins reversed from wallet.',
        chargeback: sanitizeFinancial(updated),
        ledger: ledgerResult,
      };
    });
  }
}

export default {
  getChargebacks,
  getChargebackById,
  createChargeback,
  resolveChargeback,
};
