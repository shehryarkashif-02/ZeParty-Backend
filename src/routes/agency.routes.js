import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import agencyController from '../controllers/agency.controller.js';

export const adminAgencyRouter = express.Router();
adminAgencyRouter.use(authenticate);

adminAgencyRouter.get('/', requirePermission('view_agencies'), agencyController.getAgencies);
adminAgencyRouter.post('/', requirePermission('approve_reject_agencies'), agencyController.createAgency);
adminAgencyRouter.get('/:id', requirePermission('view_agencies'), agencyController.getAgencyById);
adminAgencyRouter.put('/:id', requirePermission('approve_reject_agencies'), agencyController.updateAgency);
adminAgencyRouter.post('/:id/transfer-host', requirePermission('approve_reject_agencies'), agencyController.transferHostAgency);
adminAgencyRouter.get('/:id/members', requirePermission('view_agencies'), agencyController.getAgencyMembers);

export const userAgencyRouter = express.Router();
userAgencyRouter.get('/public', agencyController.getPublicAgencies);
userAgencyRouter.post('/join', authenticate, agencyController.joinAgency);

export default {
  adminAgencyRouter,
  userAgencyRouter,
};
