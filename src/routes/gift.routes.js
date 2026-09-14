import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import idempotency from '../middlewares/idempotency.js';
import giftController from '../controllers/gift.controller.js';

export const adminGiftRouter = express.Router();
adminGiftRouter.use(authenticate);

adminGiftRouter.get('/', requirePermission('view_gifts'), giftController.getAdminGifts);
adminGiftRouter.post('/', requirePermission('manage_gifts'), giftController.createGift);
adminGiftRouter.get('/:id', requirePermission('view_gifts'), giftController.getGiftById);
adminGiftRouter.put('/:id', requirePermission('manage_gifts'), giftController.updateGift);
adminGiftRouter.delete('/:id', requirePermission('manage_gifts'), giftController.deleteGift);

export const userGiftRouter = express.Router();
userGiftRouter.get('/', giftController.getPublicGifts);
userGiftRouter.post('/send', authenticate, idempotency, giftController.sendGift);

export default {
  adminGiftRouter,
  userGiftRouter,
};
