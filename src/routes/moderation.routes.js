import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import adminModerationController from '../controllers/adminModeration.controller.js';

export const adminModerationRouter = express.Router();

adminModerationRouter.get('/stats', authenticate, requirePermission('view_moderation'), adminModerationController.getModerationStats);
adminModerationRouter.get('/history', authenticate, requirePermission('view_moderation'), adminModerationController.getModerationHistory);
adminModerationRouter.post('/user', authenticate, requirePermission('action_moderation'), adminModerationController.moderateUser);
adminModerationRouter.post('/content', authenticate, requirePermission('action_moderation'), adminModerationController.moderateContent);

export default adminModerationRouter;
