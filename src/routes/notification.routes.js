import express from 'express';
import notificationController from '../controllers/notification.controller.js';
import authenticate from '../middlewares/authenticate.js';

const router = express.Router();

// All consumer notification routes require authentication
router.use(authenticate);

// Device token registration & lifecycle
router.post('/devices', notificationController.registerDevice);
router.post('/devices/refresh', notificationController.refreshDeviceToken);
router.delete('/devices/:id', notificationController.removeDevice);

// Notification preferences
router.get('/preferences', notificationController.getPreferences);
router.put('/preferences', notificationController.updatePreferences);

// Notification list & unread state
router.get('/unread-count', notificationController.getUnreadCount);
router.patch('/read-all', notificationController.markAllAsRead);
router.patch('/:id/read', notificationController.markAsRead);
router.get('/', notificationController.getNotifications);
router.delete('/:id', notificationController.deleteNotification);

export default router;
