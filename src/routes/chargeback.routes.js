import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import idempotencyMiddleware from '../middlewares/idempotency.js';
import chargebackController from '../controllers/chargeback.controller.js';

const router = express.Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('view_chargebacks'),
  chargebackController.getChargebacks
);

router.get(
  '/:id',
  requirePermission('view_chargebacks'),
  chargebackController.getChargebackById
);

router.post(
  '/',
  requirePermission('approve_refunds'),
  idempotencyMiddleware,
  chargebackController.createChargeback
);

router.post(
  '/:id/resolve',
  requirePermission('approve_refunds'),
  idempotencyMiddleware,
  chargebackController.resolveChargeback
);

export default router;
