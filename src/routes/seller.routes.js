import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import idempotency from '../middlewares/idempotency.js';
import sellerController from '../controllers/seller.controller.js';

export const adminSellerRouter = express.Router();
adminSellerRouter.use(authenticate);

adminSellerRouter.get('/', requirePermission('view_sellers'), sellerController.getSellers);
adminSellerRouter.post('/', requirePermission('manage_sellers'), sellerController.createSeller);
adminSellerRouter.get('/:id', requirePermission('view_sellers'), sellerController.getSellerById);
adminSellerRouter.put('/:id/status', requirePermission('manage_sellers'), sellerController.updateSellerStatus);
adminSellerRouter.post('/:id/allocate', requirePermission('issue_coins'), idempotency, sellerController.allocateCoins);
adminSellerRouter.post('/:id/correct', requirePermission('reseller_corrections'), idempotency, sellerController.correctBalance);

export const userSellerRouter = express.Router();
userSellerRouter.get('/public', sellerController.getPublicSellers);

export default {
  adminSellerRouter,
  userSellerRouter,
};
