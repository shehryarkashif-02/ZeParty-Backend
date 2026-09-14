import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import bdCenterController from '../controllers/bdCenter.controller.js';

export const adminBDCenterRouter = express.Router();
adminBDCenterRouter.use(authenticate);

adminBDCenterRouter.get('/', requirePermission('manage_bd_centers'), bdCenterController.getBDCenters);
adminBDCenterRouter.post('/', requirePermission('manage_bd_centers'), bdCenterController.createBDCenter);
adminBDCenterRouter.get('/:id', requirePermission('manage_bd_centers'), bdCenterController.getBDCenterById);
adminBDCenterRouter.put('/:id', requirePermission('manage_bd_centers'), bdCenterController.updateBDCenter);
adminBDCenterRouter.post('/:id/invites', requirePermission('manage_bd_centers'), bdCenterController.sendInvite);
adminBDCenterRouter.get('/:id/invites', requirePermission('manage_bd_centers'), bdCenterController.getBDCenterInvites);

export const userBDCenterRouter = express.Router();
userBDCenterRouter.get('/invite/:code', bdCenterController.validateInvite);
userBDCenterRouter.post('/invite/accept', authenticate, bdCenterController.acceptInvite);

export default {
  adminBDCenterRouter,
  userBDCenterRouter,
};
