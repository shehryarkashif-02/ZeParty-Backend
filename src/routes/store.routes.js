import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import idempotency from '../middlewares/idempotency.js';
import storeController from '../controllers/store.controller.js';

export const adminStoreRouter = express.Router();
adminStoreRouter.use(authenticate);

adminStoreRouter.get('/catalog', requirePermission('view_store'), storeController.getAdminStoreCatalog);
adminStoreRouter.get('/vip', requirePermission('view_vip_store'), storeController.getAdminVipStore);

export const userStoreRouter = express.Router();
userStoreRouter.get('/catalog', storeController.getPublicStoreCatalog);
userStoreRouter.post('/purchase', authenticate, idempotency, storeController.purchaseAsset);

export default {
  adminStoreRouter,
  userStoreRouter,
};
