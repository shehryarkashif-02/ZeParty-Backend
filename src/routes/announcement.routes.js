import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import announcementController from '../controllers/announcement.controller.js';

export const adminAnnouncementRouter = express.Router();
export const userAnnouncementRouter = express.Router();

// Admin Announcement Management Routes
adminAnnouncementRouter.use(authenticate);
adminAnnouncementRouter.get('/', requirePermission('view_announcements'), announcementController.getAdminAnnouncements);
adminAnnouncementRouter.get('/:id', requirePermission('view_announcements'), announcementController.getAdminAnnouncementById);
adminAnnouncementRouter.post('/', requirePermission('manage_announcements'), announcementController.postAdminAnnouncement);
adminAnnouncementRouter.put('/:id', requirePermission('manage_announcements'), announcementController.putAdminAnnouncement);
adminAnnouncementRouter.delete('/:id', requirePermission('manage_announcements'), announcementController.deleteAdminAnnouncement);

// Public / Mobile Announcement Routes
userAnnouncementRouter.get('/active', announcementController.getActiveAnnouncements);

export default {
  adminAnnouncementRouter,
  userAnnouncementRouter,
};
