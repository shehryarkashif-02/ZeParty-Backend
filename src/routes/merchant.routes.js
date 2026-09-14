import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import merchantController from '../controllers/merchant.controller.js';

export const adminMerchantRouter = express.Router();
adminMerchantRouter.use(authenticate);

adminMerchantRouter.get('/', requirePermission('view_merchants'), merchantController.getMerchants);
adminMerchantRouter.post('/', requirePermission('manage_merchants'), merchantController.createMerchant);
adminMerchantRouter.get('/:id', requirePermission('view_merchants'), merchantController.getMerchantById);
adminMerchantRouter.put('/:id', requirePermission('manage_merchants'), merchantController.updateMerchant);

export default {
  adminMerchantRouter,
};
