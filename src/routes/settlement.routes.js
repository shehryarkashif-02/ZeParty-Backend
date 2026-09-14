import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import idempotencyMiddleware from '../middlewares/idempotency.js';
import settlementController from '../controllers/settlement.controller.js';

export const adminSettlementRouter = express.Router();
adminSettlementRouter.use(authenticate);

// Admin Settlement Periods & Calculations
adminSettlementRouter.post(
  '/calculate',
  requirePermission('manage_agency_finance'),
  idempotencyMiddleware,
  settlementController.calculatePeriod
);

adminSettlementRouter.get(
  '/periods',
  requirePermission('view_finance'),
  settlementController.getPeriods
);

adminSettlementRouter.get(
  '/periods/:id',
  requirePermission('view_finance'),
  settlementController.getPeriodById
);

adminSettlementRouter.get(
  '/periods/:id/reconcile',
  requirePermission('view_finance'),
  settlementController.reconcilePeriod
);

// Admin Settlement Records & Statements
adminSettlementRouter.get(
  '/records',
  requirePermission('view_finance'),
  settlementController.getRecords
);

adminSettlementRouter.get(
  '/records/:id',
  requirePermission('view_finance'),
  settlementController.getRecordById
);

adminSettlementRouter.post(
  '/records/:id/submit',
  requirePermission('manage_agency_finance'),
  idempotencyMiddleware,
  settlementController.submitRecordForApproval
);

adminSettlementRouter.post(
  '/records/:id/approve',
  requirePermission('manage_agency_finance'),
  idempotencyMiddleware,
  settlementController.approveRecord
);

adminSettlementRouter.post(
  '/records/:id/pay',
  requirePermission('manage_agency_finance'),
  idempotencyMiddleware,
  settlementController.payRecord
);

adminSettlementRouter.post(
  '/records/:id/adjust',
  requirePermission('manage_agency_finance'),
  idempotencyMiddleware,
  settlementController.adjustRecord
);

// Mobile / User Routers
export const userSettlementRouter = express.Router();
userSettlementRouter.use(authenticate);

userSettlementRouter.get('/hosts/earnings/summary', settlementController.getMyHostEarningsSummary);
userSettlementRouter.get('/hosts/settlements', settlementController.getMyHostSettlements);
userSettlementRouter.get('/hosts/settlements/:id', settlementController.getMyHostSettlementById);
userSettlementRouter.get('/agencies/settlements', settlementController.getMyAgencySettlements);
userSettlementRouter.get('/bd-centers/settlements', settlementController.getMyBDCenterSettlements);

export default {
  adminSettlementRouter,
  userSettlementRouter,
};
