import walletService from '../services/wallet.service.js';
import rechargeService from '../services/recharge.service.js';
import withdrawalService from '../services/withdrawal.service.js';
import refundService from '../services/refund.service.js';
import {
  createRechargePlanSchema,
  updateRechargePlanSchema,
  rejectFinancialItemSchema,
  createCoinRefundSchema,
  queryLedgerSchema,
} from '../validators/finance.validator.js';

// --- Master Ledger & Transactions ---
export async function getMasterLedger(req, res, next) {
  try {
    const validated = queryLedgerSchema.parse(req.query);
    const ledger = await walletService.getMasterLedger(validated);

    return res.status(200).json({
      success: true,
      message: 'Master transaction ledger retrieved successfully',
      data: ledger.items,
      pagination: ledger.pagination,
    });
  } catch (err) {
    next(err);
  }
}

// --- Recharge Packages ---
export async function getRechargePlans(req, res, next) {
  try {
    const plans = await rechargeService.getRechargePlans({ includeInactive: true });
    return res.status(200).json({
      success: true,
      data: plans,
    });
  } catch (err) {
    next(err);
  }
}

export async function createRechargePlan(req, res, next) {
  try {
    const validated = createRechargePlanSchema.parse(req.body);
    const adminId = req.auth.userId;
    const isOwner = Boolean(req.auth.isOwner);
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const plan = await rechargeService.createRechargePlan(validated, adminId, isOwner, ipAddress);

    return res.status(201).json({
      success: true,
      message: 'Recharge plan created successfully',
      data: plan,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateRechargePlan(req, res, next) {
  try {
    const { id } = req.params;
    const validated = updateRechargePlanSchema.parse(req.body);
    const adminId = req.auth.userId;
    const isOwner = Boolean(req.auth.isOwner);
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const plan = await rechargeService.updateRechargePlan(id, validated, adminId, isOwner, ipAddress);

    return res.status(200).json({
      success: true,
      message: 'Recharge plan updated successfully',
      data: plan,
    });
  } catch (err) {
    next(err);
  }
}

// --- Offline Recharge Deposits ---
export async function getOfflineRecharges(req, res, next) {
  try {
    const { status, userId, page = 1, limit = 20 } = req.query;
    const result = await rechargeService.getOfflineRecharges({ status, userId, page, limit });

    return res.status(200).json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function approveOfflineRecharge(req, res, next) {
  try {
    const { id } = req.params;
    const adminId = req.auth.userId;
    const isOwner = Boolean(req.auth.isOwner);
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const result = await rechargeService.approveOfflineRecharge({ id, adminId, isOwner, ipAddress });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function rejectOfflineRecharge(req, res, next) {
  try {
    const { id } = req.params;
    const validated = rejectFinancialItemSchema.parse(req.body);
    const adminId = req.auth.userId;
    const isOwner = Boolean(req.auth.isOwner);
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const result = await rechargeService.rejectOfflineRecharge({
      id,
      adminId,
      isOwner,
      reason: validated.reason,
      ipAddress,
    });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// --- Withdrawals & Cashouts ---
export async function getWithdrawals(req, res, next) {
  try {
    const { status, userId, page = 1, limit = 20 } = req.query;
    const result = await withdrawalService.getWithdrawals({ status, userId, page, limit });

    return res.status(200).json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function approveWithdrawal(req, res, next) {
  try {
    const { id } = req.params;
    const adminId = req.auth.userId;
    const isOwner = Boolean(req.auth.isOwner);
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const result = await withdrawalService.approveWithdrawal({ id, adminId, isOwner, ipAddress });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function rejectWithdrawal(req, res, next) {
  try {
    const { id } = req.params;
    const validated = rejectFinancialItemSchema.parse(req.body);
    const adminId = req.auth.userId;
    const isOwner = Boolean(req.auth.isOwner);
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const result = await withdrawalService.rejectWithdrawal({
      id,
      adminId,
      isOwner,
      reason: validated.reason,
      ipAddress,
    });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// --- Coin Refunds & Disputes ---
export async function getCoinRefunds(req, res, next) {
  try {
    const { status, userId, page = 1, limit = 20 } = req.query;
    const result = await refundService.getCoinRefunds({ status, userId, page, limit });

    return res.status(200).json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function submitCoinRefund(req, res, next) {
  try {
    const validated = createCoinRefundSchema.parse(req.body);
    const userId = req.auth.userId;

    const result = await refundService.submitCoinRefundDispute({
      userId,
      coinAmount: validated.coinAmount,
      disputeReason: validated.disputeReason,
    });

    return res.status(201).json({
      success: true,
      message: 'Coin refund dispute submitted successfully. Pending review.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function processCoinRefund(req, res, next) {
  try {
    const { id } = req.params;
    const adminId = req.auth.userId;
    const isOwner = Boolean(req.auth.isOwner);
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const result = await refundService.processCoinRefund({ id, adminId, isOwner, ipAddress });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function rejectCoinRefund(req, res, next) {
  try {
    const { id } = req.params;
    const validated = rejectFinancialItemSchema.parse(req.body);
    const adminId = req.auth.userId;
    const isOwner = Boolean(req.auth.isOwner);
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const result = await refundService.rejectCoinRefund({
      id,
      adminId,
      isOwner,
      reason: validated.reason,
      ipAddress,
    });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export default {
  getMasterLedger,
  getRechargePlans,
  createRechargePlan,
  updateRechargePlan,
  getOfflineRecharges,
  approveOfflineRecharge,
  rejectOfflineRecharge,
  getWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  getCoinRefunds,
  submitCoinRefund,
  processCoinRefund,
  rejectCoinRefund,
};
