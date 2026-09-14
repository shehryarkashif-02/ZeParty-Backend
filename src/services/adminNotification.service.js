import prisma from '../config/database.js';
import broadcastRepository from '../repositories/notificationBroadcast.repository.js';
import notificationRepository from '../repositories/notification.repository.js';
import deviceRepository from '../repositories/device.repository.js';
import fcmAdapter from '../adapters/fcm.adapter.js';
import socketEmitter from '../socket/socket.emitter.js';
import { SOCKET_EVENTS } from '../socket/socket.constants.js';

async function logAudit(
  {
    adminId,
    adminName,
    action,
    targetEntity,
    targetEntityId,
    beforeStateJson,
    afterStateJson,
    reason,
    ipAddress,
  },
  db = prisma
) {
  try {
    if (db.auditLog?.create) {
      await db.auditLog.create({
        data: {
          adminId: adminId || null,
          adminName: adminName || (adminId ? 'Administrator' : 'System Automation'),
          action,
          targetEntity,
          targetEntityId,
          beforeStateJson: beforeStateJson || null,
          afterStateJson: afterStateJson || null,
          reason: reason || null,
          ipAddress: ipAddress || '127.0.0.1',
        },
      });
    }
  } catch (err) {
    console.error('Failed to write audit log in adminNotification.service:', err);
  }
}

/**
 * Resolves target recipient user IDs based on audience category.
 */
export async function resolveTargetUserIds(audience, customUserIds = [], db = prisma) {
  if (audience === 'Selected Users' && Array.isArray(customUserIds) && customUserIds.length > 0) {
    return customUserIds;
  }

  const normalized = String(audience || 'All Users').toLowerCase();

  if (normalized.includes('vip')) {
    const vips = await db.userProfile.findMany({
      where: { vipLevel: { gt: 0 } },
      select: { userId: true },
      take: 10000,
    });
    return vips.map((v) => v.userId);
  }

  if (normalized.includes('host')) {
    const hosts = await db.user.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { userType: 'HOST' },
          { hostProfile: { hostStatus: 'ACTIVE' } },
        ],
      },
      select: { id: true },
      take: 10000,
    });
    return hosts.map((h) => h.id);
  }

  if (normalized.includes('active')) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeUsers = await db.user.findMany({
      where: {
        status: 'ACTIVE',
        lastLoginAt: { gte: sevenDaysAgo },
      },
      select: { id: true },
      take: 10000,
    });
    return activeUsers.map((u) => u.id);
  }

  // Default: All active users
  const allUsers = await db.user.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true },
    take: 20000,
  });
  return allUsers.map((u) => u.id);
}

/**
 * Creates and dispatches a broadcast notification campaign.
 */
export async function broadcastNotification(
  {
    title,
    body,
    type = 'Push',
    audience = 'All Users',
    data = {},
    customUserIds = [],
    adminId = null,
    adminName = 'Super Admin',
    ipAddress = '127.0.0.1',
  },
  db = prisma
) {
  if (!title || !body) {
    const error = new Error('Title and body are required for notification broadcast');
    error.statusCode = 400;
    error.code = 'INVALID_BROADCAST_PAYLOAD';
    throw error;
  }

  // 1. Resolve Target Recipients Server-Side
  const recipientIds = await resolveTargetUserIds(audience, customUserIds, db);

  // 2. Persist Broadcast Campaign Record
  const broadcast = await broadcastRepository.createBroadcast(
    {
      adminId,
      title,
      body,
      type,
      audience,
      recipientCount: recipientIds.length,
      status: 'SENT',
      metadataJson: { data, customUserIds: customUserIds.length > 0 ? customUserIds : undefined },
    },
    db
  );

  // 3. Batch Insert In-App Notifications for Recipients (up to 500 per batch)
  if (recipientIds.length > 0) {
    const notificationRecords = recipientIds.map((userId) => ({
      userId,
      title,
      body,
      type: 'MARKETING',
      category: 'System',
      dataJson: data,
      sourceType: 'CAMPAIGN',
      sourceId: broadcast.id,
      deliveryStatus: 'DELIVERED',
    }));

    const BATCH_SIZE = 500;
    for (let i = 0; i < notificationRecords.length; i += BATCH_SIZE) {
      const chunk = notificationRecords.slice(i, i + BATCH_SIZE);
      await notificationRepository.createManyNotifications(chunk, db);
    }
  }

  // 4. Audit Log Entry
  await logAudit(
    {
      adminId,
      adminName,
      action: 'NOTIFICATION_BROADCAST_SENT',
      targetEntity: 'NotificationBroadcast',
      targetEntityId: broadcast.id,
      afterStateJson: {
        id: broadcast.id,
        title,
        audience,
        recipientCount: recipientIds.length,
      },
      reason: `Push broadcast sent to ${recipientIds.length} users (${audience})`,
      ipAddress,
    },
    db
  );

  // 5. Asynchronous Multi-device Push Delivery
  dispatchBroadcastPush(recipientIds, { title, body, data }, db).catch((err) => {
    console.error('Failed to dispatch broadcast FCM push:', err);
  });

  return {
    success: true,
    broadcast,
    recipientCount: recipientIds.length,
  };
}

/**
 * Dispatches broadcast FCM push to target user tokens.
 */
async function dispatchBroadcastPush(recipientIds, { title, body, data }, db = prisma) {
  if (!recipientIds || recipientIds.length === 0) return;

  const devices = await deviceRepository.findTokensByUserIds(recipientIds, db);
  const tokens = devices.map((d) => d.deviceToken).filter(Boolean);

  if (tokens.length === 0) return;

  const pushResult = await fcmAdapter.sendMulticast({
    tokens,
    title,
    body,
    data,
  });

  if (pushResult.invalidTokens && pushResult.invalidTokens.length > 0) {
    await deviceRepository.cleanupInvalidTokens(pushResult.invalidTokens, db);
  }
}

/**
 * Lists broadcast history for Admin Portal.
 */
export async function listBroadcasts(filters, db = prisma) {
  return await broadcastRepository.findBroadcasts(filters, db);
}

/**
 * Retrieves details for a specific broadcast campaign.
 */
export async function getBroadcastDetails(id, db = prisma) {
  const broadcast = await broadcastRepository.findBroadcastById(id, db);
  if (!broadcast) {
    const error = new Error('Broadcast campaign not found');
    error.statusCode = 404;
    error.code = 'BROADCAST_NOT_FOUND';
    throw error;
  }
  return broadcast;
}

export default {
  resolveTargetUserIds,
  broadcastNotification,
  listBroadcasts,
  getBroadcastDetails,
};
