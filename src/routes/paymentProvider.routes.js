import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import paymentProviderController from '../controllers/paymentProvider.controller.js';

const router = express.Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('view_settings'),
  paymentProviderController.listProviders
);

router.get(
  '/:id',
  requirePermission('view_settings'),
  paymentProviderController.getProviderById
);

router.post(
  '/',
  requirePermission('manage_settings'),
  paymentProviderController.createProvider
);

router.put(
  '/:id',
  requirePermission('manage_settings'),
  paymentProviderController.updateProvider
);

router.patch(
  '/:id',
  requirePermission('manage_settings'),
  paymentProviderController.updateProvider
);

export default router;
