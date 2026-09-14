import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import hostController from '../controllers/host.controller.js';

export const adminHostRouter = express.Router();
adminHostRouter.use(authenticate);

adminHostRouter.get('/', requirePermission('view_hosts'), hostController.getHosts);
adminHostRouter.get('/applications', requirePermission('review_hosts'), hostController.getHostApplications);
adminHostRouter.put('/applications/:id', requirePermission('approve_reject_hosts'), hostController.reviewHostApplication);
adminHostRouter.get('/:id', requirePermission('view_hosts'), hostController.getHostById);
adminHostRouter.put('/:id/status', requirePermission('approve_reject_hosts'), hostController.updateHostStatus);

export const userHostRouter = express.Router();
userHostRouter.post('/apply', authenticate, hostController.applyHost);
userHostRouter.get('/profile', authenticate, hostController.getMyHostProfile);

export default {
  adminHostRouter,
  userHostRouter,
};
