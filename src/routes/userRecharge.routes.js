import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import idempotencyMiddleware from '../middlewares/idempotency.js';
import rechargeService from '../services/recharge.service.js';
import {
  createPaymentIntentSchema,
  submitOfflineRechargeSchema,
} from '../validators/onlineRecharge.validator.js';

const router = express.Router();

// GET /v1/recharge/plans - Public/Mobile active recharge plans
router.get('/plans', async (req, res, next) => {
  try {
    const plans = await rechargeService.getRechargePlans({ includeInactive: false });
    return res.status(200).json({
      success: true,
      data: plans,
    });
  } catch (err) {
    next(err);
  }
});

// POST /v1/recharge/online/create-intent - Authenticated user online payment intent
router.post(
  '/online/create-intent',
  authenticate,
  idempotencyMiddleware,
  async (req, res, next) => {
    try {
      const validated = createPaymentIntentSchema.parse(req.body);
      const userId = req.auth.userId;

      const intent = await rechargeService.createPaymentIntent({
        userId,
        planId: validated.planId,
        paymentProvider: validated.paymentProvider,
      });

      return res.status(200).json({
        success: true,
        message: 'Payment intent created successfully',
        data: intent,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /v1/recharge/offline - Authenticated user offline deposit submission
router.post(
  '/offline',
  authenticate,
  idempotencyMiddleware,
  async (req, res, next) => {
    try {
      const validated = submitOfflineRechargeSchema.parse(req.body);
      const userId = req.auth.userId;

      const result = await rechargeService.submitOfflineRecharge({
        userId,
        amountUSD: validated.amountUSD,
        bankName: validated.bankName,
        receiptPhotoUrl: validated.receiptPhotoUrl,
        transactionRef: validated.transactionRef,
      });

      return res.status(201).json({
        success: true,
        message: 'Offline recharge request submitted successfully. Pending admin review.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
