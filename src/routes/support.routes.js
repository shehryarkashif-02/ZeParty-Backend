import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import supportController from '../controllers/support.controller.js';
import adminSupportController from '../controllers/adminSupport.controller.js';

export const userSupportRouter = express.Router();
export const adminSupportRouter = express.Router();

// User Support Routes
userSupportRouter.post('/', authenticate, supportController.createTicket);
userSupportRouter.get('/', authenticate, supportController.getUserTickets);
userSupportRouter.get('/:id', authenticate, supportController.getTicketDetails);
userSupportRouter.post('/:id/reply', authenticate, supportController.replyToTicket);

// Admin Support Routes
adminSupportRouter.get('/stats', authenticate, requirePermission('view_support'), adminSupportController.getSupportStats);
adminSupportRouter.get('/', authenticate, requirePermission('view_support'), adminSupportController.listAdminTickets);
adminSupportRouter.get('/:id', authenticate, requirePermission('view_support'), adminSupportController.getTicketDetails);
adminSupportRouter.post('/:id/reply', authenticate, requirePermission('manage_support'), adminSupportController.replyToTicket);
adminSupportRouter.patch('/:id', authenticate, requirePermission('manage_support'), adminSupportController.updateTicketStatus);

export default {
  userSupportRouter,
  adminSupportRouter,
};
