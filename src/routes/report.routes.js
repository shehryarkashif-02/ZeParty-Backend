import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import reportController from '../controllers/report.controller.js';
import adminReportController from '../controllers/adminReport.controller.js';

export const userReportRouter = express.Router();
export const adminReportRouter = express.Router();

// User Report Routes
userReportRouter.post('/', authenticate, reportController.submitReport);
userReportRouter.get('/:id', authenticate, reportController.getReportDetails);

// Admin Report Routes
adminReportRouter.get('/stats', authenticate, requirePermission('view_reports'), adminReportController.getReportStats);
adminReportRouter.get('/', authenticate, requirePermission('view_reports'), adminReportController.listReports);
adminReportRouter.get('/:id', authenticate, requirePermission('view_reports'), adminReportController.getReportDetails);
adminReportRouter.post('/:id/assign', authenticate, requirePermission('action_moderation'), adminReportController.assignReport);
adminReportRouter.post('/:id/resolve', authenticate, requirePermission('action_moderation'), adminReportController.resolveReport);

export default {
  userReportRouter,
  adminReportRouter,
};
