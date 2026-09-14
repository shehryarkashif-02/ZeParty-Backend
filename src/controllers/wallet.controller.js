import walletService from '../services/wallet.service.js';
import { adjustBalanceSchema } from '../validators/finance.validator.js';

export async function getBalance(req, res, next) {
  try {
    const userId = req.auth.userId;
    const wallet = await walletService.getWallet(userId);

    return res.status(200).json({
      success: true,
      message: 'Wallet balance retrieved successfully',
      data: wallet,
    });
  } catch (err) {
    next(err);
  }
}

export async function getLedger(req, res, next) {
  try {
    const userId = req.auth.userId;
    const { page = 1, limit = 20, type } = req.query;

    const ledger = await walletService.getWalletLedger(userId, { page, limit, type });

    return res.status(200).json({
      success: true,
      message: 'Wallet ledger history retrieved successfully',
      data: ledger.items,
      pagination: ledger.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function getPlatformStats(req, res, next) {
  try {
    const stats = await walletService.getPlatformWalletStats();

    return res.status(200).json({
      success: true,
      message: 'Platform wallet circulation statistics retrieved successfully',
      data: stats,
    });
  } catch (err) {
    next(err);
  }
}

export async function adjustBalance(req, res, next) {
  try {
    const validated = adjustBalanceSchema.parse(req.body);
    const requesterId = req.auth.userId;
    const isOwner = Boolean(req.auth.isOwner);
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const result = await walletService.adjustBalance({
      requesterId,
      isOwner,
      targetUserId: validated.targetUserId,
      asset: validated.asset,
      direction: validated.direction,
      amount: validated.amount,
      reason: validated.reason,
      ipAddress,
    });

    const statusCode = result.approvalRequired ? 202 : 200;

    return res.status(statusCode).json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

export default {
  getBalance,
  getLedger,
  getPlatformStats,
  adjustBalance,
};
