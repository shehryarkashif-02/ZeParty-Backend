import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import bannerController from '../controllers/banner.controller.js';

export const adminBannerRouter = express.Router();
export const userBannerRouter = express.Router();

// Admin Banner Management Routes
adminBannerRouter.use(authenticate);
adminBannerRouter.get('/', requirePermission('view_banners'), bannerController.getAdminBanners);
adminBannerRouter.get('/:id', requirePermission('view_banners'), bannerController.getAdminBannerById);
adminBannerRouter.post('/', requirePermission('manage_banners'), bannerController.postAdminBanner);
adminBannerRouter.put('/:id', requirePermission('manage_banners'), bannerController.putAdminBanner);
adminBannerRouter.delete('/:id', requirePermission('manage_banners'), bannerController.deleteAdminBanner);

// Public / Mobile Banner Routes
userBannerRouter.get('/active', bannerController.getActiveBanners);

export default {
  adminBannerRouter,
  userBannerRouter,
};
