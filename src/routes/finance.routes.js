import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import idempotencyMiddleware from '../middlewares/idempotency.js';
import financeController from '../controllers/finance.controller.js';

const router = express.Router();

router.use(authenticate);

// Master Transactions Ledger
router.get('/transactions', requirePermission('view_ledger'), financeController.getMasterLedger);

// Recharge Plans Management
router.get('/recharge/plans', requirePermission('view_recharge_plans'), financeController.getRechargePlans);
router.post('/recharge/plans', requirePermission('manage_recharge_plans'), financeController.createRechargePlan);
router.patch('/recharge/plans/:id', requirePermission('manage_recharge_plans'), financeController.updateRechargePlan);

// Offline Recharge Verification
router.get('/recharge/offline', requirePermission('view_offline_recharge'), financeController.getOfflineRecharges);
router.post(
  '/recharge/offline/:id/approve',
  requirePermission('approve_offline_recharge'),
  idempotencyMiddleware,
  financeController.approveOfflineRecharge
);
router.post(
  '/recharge/offline/:id/reject',
  requirePermission('approve_offline_recharge'),
  idempotencyMiddleware,
  financeController.rejectOfflineRecharge
);

// Host Diamond Withdrawals
router.get('/withdrawals', requirePermission('view_withdrawals'), financeController.getWithdrawals);
router.post(
  '/withdrawals/:id/approve',
  requirePermission('approve_withdrawals'),
  idempotencyMiddleware,
  financeController.approveWithdrawal
);
router.post(
  '/withdrawals/:id/reject',
  requirePermission('reject_withdrawals'),
  idempotencyMiddleware,
  financeController.rejectWithdrawal
);

// Coin Dispute Refunds
router.get('/refunds/coins', requirePermission('view_refunds'), financeController.getCoinRefunds);
router.post(
  '/refunds/coins',
  idempotencyMiddleware,
  financeController.submitCoinRefund
);
router.post(
  '/refunds/coins/:id/process',
  requirePermission('approve_refunds'),
  idempotencyMiddleware,
  financeController.processCoinRefund
);
router.post(
  '/refunds/coins/:id/reject',
  requirePermission('approve_refunds'),
  idempotencyMiddleware,
  financeController.rejectCoinRefund
);

export default router;
