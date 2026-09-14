import express from 'express';
import adminNotificationController from '../controllers/adminNotification.controller.js';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';

const router = express.Router();

// All admin notification routes require admin authentication
router.use(authenticate);

router.get('/', requirePermission('view_notifications'), adminNotificationController.listBroadcasts);
router.post('/broadcast', requirePermission('manage_notifications'), adminNotificationController.broadcastNotification);
router.get('/:id', requirePermission('view_notifications'), adminNotificationController.getBroadcastDetails);

export default router;
