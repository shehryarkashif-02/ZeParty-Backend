import prisma from '../config/database.js';
import notificationRepository from '../repositories/notification.repository.js';
import deviceRepository from '../repositories/device.repository.js';
import notificationPreferenceService from './notificationPreference.service.js';
import fcmAdapter from '../adapters/fcm.adapter.js';
import socketEmitter from '../socket/socket.emitter.js';
import { SOCKET_EVENTS } from '../socket/socket.constants.js';

/**
 * Creates a durable notification record and dispatches post-commit Socket.IO & FCM push.
 */
export async function sendNotification(
  {
    recipientId,
    title,
    body,
    type = 'SYSTEM',
    category = null,
    data = {},
    sourceType = null,
    sourceId = null,
  },
  db = prisma
) {
  if (!recipientId || !title || !body) {
    const error = new Error('Recipient ID, title, and body are required to create notification');
    error.statusCode = 400;
    error.code = 'INVALID_NOTIFICATION_PAYLOAD';
    throw error;
  }

  // 1. Check User Notification Preferences
  const isEnabled = await notificationPreferenceService.isCategoryEnabled(
    recipientId,
    category || type,
    db
  );

  // If user disabled this category and it's not a mandatory system/moderation notification
  const isMandatory = type.toUpperCase() === 'MODERATION' || type.toUpperCase() === 'SYSTEM';
  if (!isEnabled && !isMandatory) {
    return {
      success: false,
      suppressed: true,
      reason: 'USER_PREFERENCE_DISABLED',
    };
  }

  // 2. Idempotency Check (if sourceType and sourceId are specified)
  if (sourceType && sourceId) {
    const existing = await notificationRepository.findExistingNotification(
      {
        userId: recipientId,
        type,
        sourceType,
        sourceId,
      },
      db
    );

    if (existing) {
      return {
        success: true,
        notification: existing,
        isDuplicate: true,
      };
    }
  }

  // 3. Create Authoritative Notification in Database
  const notification = await notificationRepository.createNotification(
    {
      userId: recipientId,
      title,
      body,
      type,
      category,
      dataJson: data,
      sourceType,
      sourceId,
      deliveryStatus: 'DELIVERED',
    },
    db
  );

  // 4. Emit Post-Commit Realtime Socket.IO Event to User's Room
  try {
    socketEmitter.emitToUser(recipientId, SOCKET_EVENTS.NOTIFICATION_NEW, {
      id: notification.id,
      title: notification.title,
      body: notification.body,
      type: notification.type,
      category: notification.category,
      data: notification.dataJson,
      isRead: false,
      createdAt: notification.createdAt.toISOString(),
    });
  } catch (socketErr) {
    console.error('Failed to emit realtime notification event:', socketErr);
  }

  // 5. Asynchronous FCM Push Dispatch (Safe against failures)
  dispatchFcmPush(
    {
      userId: recipientId,
      title,
      body,
      data,
    },
    db
  ).catch((fcmErr) => {
    console.error('FCM background dispatch error:', fcmErr);
  });

  return {
    success: true,
    notification,
    isDuplicate: false,
  };
}

/**
 * Dispatches FCM push notifications to all active registered devices for a user.
 */
async function dispatchFcmPush({ userId, title, body, data = {} }, db = prisma) {
  try {
    const devices = await deviceRepository.findUserDevices(userId, { activeOnly: true }, db);
    const validTokens = devices
      .map((d) => d.deviceToken)
      .filter((t) => typeof t === 'string' && t.trim() !== '');

    if (validTokens.length === 0) return;

    const pushResult = await fcmAdapter.sendMulticast({
      tokens: validTokens,
      title,
      body,
      data,
    });

    // Cleanup any stale/invalid tokens identified by FCM
    if (pushResult.invalidTokens && pushResult.invalidTokens.length > 0) {
      await deviceRepository.cleanupInvalidTokens(pushResult.invalidTokens, db);
    }
  } catch (err) {
    // Zero coupled failures: Never let push failure crash caller
    console.error('FCM push dispatch exception:', err);
  }
}

/**
 * Retrieves paginated notification history for an authenticated user.
 */
export async function getNotifications(userId, query = {}, db = prisma) {
  if (!userId) {
    const error = new Error('Authentication required');
    error.statusCode = 401;
    error.code = 'UNAUTHORIZED';
    throw error;
  }

  return await notificationRepository.findUserNotifications(userId, query, db);
}

/**
 * Calculates authoritative unread notification count.
 */
export async function getUnreadCount(userId, db = prisma) {
  if (!userId) return 0;
  return await notificationRepository.getUnreadCount(userId, db);
}

/**
 * Marks a notification as read with IDOR protection.
 */
export async function markAsRead(id, userId, db = prisma) {
  if (!userId) {
    const error = new Error('Authentication required');
    error.statusCode = 401;
    error.code = 'UNAUTHORIZED';
    throw error;
  }

  const updated = await notificationRepository.markAsRead(id, userId, db);
  if (!updated) {
    const error = new Error('Notification not found or unauthorized');
    error.statusCode = 404;
    error.code = 'NOTIFICATION_NOT_FOUND';
    throw error;
  }

  // Emit realtime notification:read event
  try {
    socketEmitter.emitToUser(userId, SOCKET_EVENTS.NOTIFICATION_READ, {
      id: updated.id,
      readAt: updated.readAt?.toISOString() || new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to emit notification:read socket event:', err);
  }

  return updated;
}

/**
 * Marks all notifications as read for a user.
 */
export async function markAllAsRead(userId, db = prisma) {
  if (!userId) {
    const error = new Error('Authentication required');
    error.statusCode = 401;
    error.code = 'UNAUTHORIZED';
    throw error;
  }

  const result = await notificationRepository.markAllAsRead(userId, db);

  // Emit realtime notification:read_all event
  try {
    socketEmitter.emitToUser(userId, SOCKET_EVENTS.NOTIFICATION_READ_ALL, {
      readAt: new Date().toISOString(),
      updatedCount: result.count,
    });
  } catch (err) {
    console.error('Failed to emit notification:read_all socket event:', err);
  }

  return result;
}

/**
 * Deletes a notification with IDOR protection.
 */
export async function deleteNotification(id, userId, db = prisma) {
  if (!userId) {
    const error = new Error('Authentication required');
    error.statusCode = 401;
    error.code = 'UNAUTHORIZED';
    throw error;
  }

  const deleted = await notificationRepository.deleteNotification(id, userId, db);
  if (!deleted) {
    const error = new Error('Notification not found or unauthorized');
    error.statusCode = 404;
    error.code = 'NOTIFICATION_NOT_FOUND';
    throw error;
  }

  return { success: true, message: 'Notification deleted successfully' };
}

export default {
  sendNotification,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
