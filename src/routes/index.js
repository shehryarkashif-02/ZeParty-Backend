import express from 'express';
import prisma from '../config/database.js';
import redisClient from '../config/redis.js';
import authRoutes from './auth.routes.js';
import ownerRoutes from './owner.routes.js';
import adminRoutes from './admin.routes.js';
import walletRoutes from './wallet.routes.js';
import financeRoutes from './finance.routes.js';
import approvalRoutes from './approval.routes.js';
import policyRoutes from './policy.routes.js';
import economyRoutes from './economy.routes.js';
import jobsRoutes from './jobs.routes.js';
import { adminHostRouter, userHostRouter } from './host.routes.js';
import { adminAgencyRouter, userAgencyRouter } from './agency.routes.js';
import { adminBDCenterRouter, userBDCenterRouter } from './bdCenter.routes.js';
import { adminSellerRouter, userSellerRouter } from './seller.routes.js';
import { adminMerchantRouter } from './merchant.routes.js';
import { adminGiftRouter, userGiftRouter } from './gift.routes.js';
import { adminAssetRouter, userBackpackRouter } from './asset.routes.js';
import { adminStoreRouter, userStoreRouter } from './store.routes.js';
import { adminUserRouter, userProfileRouter } from './user.routes.js';
import { adminRoomRouter, userRoomRouter } from './room.routes.js';
import { adminBannerRouter, userBannerRouter } from './banner.routes.js';
import { adminAnnouncementRouter, userAnnouncementRouter } from './announcement.routes.js';
import { userPostRouter, feedRouter, adminPostRouter } from './post.routes.js';
import socialRouter from './social.routes.js';
import paymentProviderRoutes from './paymentProvider.routes.js';
import chargebackRoutes from './chargeback.routes.js';
import webhookRoutes from './webhook.routes.js';
import userRechargeRoutes from './userRecharge.routes.js';
import { adminSettlementRouter, userSettlementRouter } from './settlement.routes.js';
import { userReportRouter, adminReportRouter } from './report.routes.js';
import adminRestrictionRouter from './restriction.routes.js';
import adminModerationRouter from './moderation.routes.js';
import { userSupportRouter, adminSupportRouter } from './support.routes.js';
import userNotificationRouter from './notification.routes.js';
import adminNotificationRouter from './adminNotification.routes.js';
import { userGameRouter, adminGameRouter } from './game.routes.js';
import mediaRoutes from './media.routes.js';
import { userPKRouter, adminPKRouter } from './pk.routes.js';

const router = express.Router();

// Phase 18 Media & Storage Routes
router.use('/v1/media', mediaRoutes);
router.use('/media', mediaRoutes);

// Phase 19 PK Battles Routes
router.use('/v1/admin/pk-events', adminPKRouter);
router.use('/admin/pk-events', adminPKRouter);
router.use('/v1/pk', userPKRouter);
router.use('/pk', userPKRouter);

// Phase 2 User & Identity Admin routes
router.use('/v1/admin/users', adminUserRouter);
router.use('/admin/users', adminUserRouter);

// Phase 6 Post Admin routes
router.use('/v1/admin/posts', adminPostRouter);
router.use('/admin/posts', adminPostRouter);

// Phase 2 Live Room Admin routes
router.use('/v1/admin/rooms', adminRoomRouter);
router.use('/admin/rooms', adminRoomRouter);

// Phase 2 Banner Admin routes
router.use('/v1/admin/banners', adminBannerRouter);
router.use('/admin/banners', adminBannerRouter);

// Phase 2 Announcement Admin routes
router.use('/v1/admin/announcements', adminAnnouncementRouter);
router.use('/admin/announcements', adminAnnouncementRouter);


// Register authentication, owner & admin routes
router.use('/v1/auth', authRoutes);
router.use('/auth', authRoutes);

router.use('/v1/owner', ownerRoutes);
router.use('/owner', ownerRoutes);

router.use('/v1/admin/approvals', approvalRoutes);
router.use('/admin/approvals', approvalRoutes);

router.use('/v1/admin/policies', policyRoutes);
router.use('/admin/policies', policyRoutes);

router.use('/v1/admin/economy', economyRoutes);
router.use('/admin/economy', economyRoutes);

router.use('/v1/admin/jobs', jobsRoutes);
router.use('/admin/jobs', jobsRoutes);

// Phase 8 Admin routes
router.use('/v1/admin/hosts', adminHostRouter);
router.use('/admin/hosts', adminHostRouter);

router.use('/v1/admin/agencies', adminAgencyRouter);
router.use('/admin/agencies', adminAgencyRouter);

router.use('/v1/admin/bd-centers', adminBDCenterRouter);
router.use('/admin/bd-centers', adminBDCenterRouter);

router.use('/v1/admin/sellers', adminSellerRouter);
router.use('/admin/sellers', adminSellerRouter);

router.use('/v1/admin/merchants', adminMerchantRouter);
router.use('/admin/merchants', adminMerchantRouter);

// Phase 9 Admin routes
router.use('/v1/admin/gifts', adminGiftRouter);
router.use('/admin/gifts', adminGiftRouter);

router.use('/v1/admin/assets', adminAssetRouter);
router.use('/admin/assets', adminAssetRouter);

router.use('/v1/admin/store', adminStoreRouter);
router.use('/admin/store', adminStoreRouter);

router.use('/v1/admin', adminRoutes);
router.use('/admin', adminRoutes);

// Phase 8 User / Mobile routes
router.use('/v1/hosts', userHostRouter);
router.use('/hosts', userHostRouter);

router.use('/v1/agencies', userAgencyRouter);
router.use('/agencies', userAgencyRouter);

router.use('/v1/bd-centers', userBDCenterRouter);
router.use('/bd-centers', userBDCenterRouter);

router.use('/v1/sellers', userSellerRouter);
router.use('/sellers', userSellerRouter);

// Phase 9 User / Mobile routes
router.use('/v1/gifts', userGiftRouter);
router.use('/gifts', userGiftRouter);

router.use('/v1/store', userStoreRouter);
router.use('/store', userStoreRouter);

router.use('/v1/users/me/assets', userBackpackRouter);
router.use('/users/me/assets', userBackpackRouter);

// Phase 2 User / Mobile routes
router.use('/v1/users', userProfileRouter);
router.use('/users', userProfileRouter);

router.use('/v1/rooms', userRoomRouter);
router.use('/rooms', userRoomRouter);

router.use('/v1/banners', userBannerRouter);
router.use('/banners', userBannerRouter);

router.use('/v1/announcements', userAnnouncementRouter);
router.use('/announcements', userAnnouncementRouter);

router.use('/v1/posts', userPostRouter);
router.use('/posts', userPostRouter);

router.use('/v1/feed', feedRouter);
router.use('/feed', feedRouter);

// Phase 6 Social Profile, Follows & Blocks routes
router.use('/v1/social', socialRouter);
router.use('/social', socialRouter);
router.use('/v1', socialRouter);
router.use('/', socialRouter);


// Phase 3 Payment Provider & Chargeback Admin routes
router.use('/v1/admin/payment-providers', paymentProviderRoutes);
router.use('/admin/payment-providers', paymentProviderRoutes);

router.use('/v1/admin/chargebacks', chargebackRoutes);
router.use('/admin/chargebacks', chargebackRoutes);

// Phase 3 User / Mobile Recharge routes
router.use('/v1/recharge', userRechargeRoutes);
router.use('/recharge', userRechargeRoutes);

// Phase 3 Public Payment Webhooks
router.use('/v1/webhooks', webhookRoutes);
router.use('/webhooks', webhookRoutes);

// Register wallet & financial routes
router.use('/v1/wallet', walletRoutes);
router.use('/wallet', walletRoutes);

router.use('/v1/finance', financeRoutes);
router.use('/finance', financeRoutes);

// Phase 5 Settlement Routes
router.use('/v1/admin/settlements', adminSettlementRouter);
router.use('/admin/settlements', adminSettlementRouter);

router.use('/v1/settlements', userSettlementRouter);
router.use('/settlements', userSettlementRouter);

// Phase 8 Moderation, Safety, Reports & Support Routes
router.use('/v1/admin/reports', adminReportRouter);
router.use('/admin/reports', adminReportRouter);

router.use('/v1/reports', userReportRouter);
router.use('/reports', userReportRouter);

router.use('/v1/admin/restrictions', adminRestrictionRouter);
router.use('/admin/restrictions', adminRestrictionRouter);

router.use('/v1/admin/moderation', adminModerationRouter);
router.use('/admin/moderation', adminModerationRouter);

router.use('/v1/admin/support', adminSupportRouter);
router.use('/admin/support', adminSupportRouter);

router.use('/v1/support/tickets', userSupportRouter);
router.use('/support/tickets', userSupportRouter);
router.use('/v1/support', userSupportRouter);
router.use('/support', userSupportRouter);

// Phase 9 Notification & FCM Routes
router.use('/v1/admin/notifications', adminNotificationRouter);
router.use('/admin/notifications', adminNotificationRouter);

router.use('/v1/notifications', userNotificationRouter);
router.use('/notifications', userNotificationRouter);

// Official 10-Game Catalog Routes
router.use('/v1/admin/games', adminGameRouter);
router.use('/admin/games', adminGameRouter);

router.use('/v1/games', userGameRouter);
router.use('/games', userGameRouter);


// Simple ping endpoint for fast process checks
router.get('/health/ping', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'pong',
  });
});

// Comprehensive system health check
router.get('/health', async (req, res) => {
  const services = {
    api: 'up',
    database: 'down',
    redis: 'down',
  };

  let hasError = false;

  // Verify PostgreSQL / Prisma
  try {
    await prisma.$queryRaw`SELECT 1`;
    services.database = 'up';
  } catch (error) {
    req.log.error('Health Check - Database unreachable:', error);
    hasError = true;
  }

  // Verify Redis
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    const pingResult = await redisClient.ping();
    if (pingResult === 'PONG') {
      services.redis = 'up';
    }
  } catch (error) {
    req.log.error('Health Check - Redis unreachable:', error);
    hasError = true;
  }

  const statusCode = hasError ? 503 : 200;

  return res.status(statusCode).json({
    success: !hasError,
    status: hasError ? 'degraded' : 'healthy',
    services,
  });
});

export default router;
