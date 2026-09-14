import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import idempotencyMiddleware from '../middlewares/idempotency.js';
import walletController from '../controllers/wallet.controller.js';

const router = express.Router();

router.use(authenticate);

// User-facing endpoints
router.get('/balance', walletController.getBalance);
router.get('/ledger', walletController.getLedger);

// Administrative financial endpoints
router.get('/stats', requirePermission('view_finance'), walletController.getPlatformStats);
router.post(
  '/adjust',
  requirePermission('manage_balances'),
  idempotencyMiddleware,
  walletController.adjustBalance
);

export default router;
