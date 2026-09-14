import prisma from '../config/database.js';

/**
 * Creates a single persistent notification record in PostgreSQL.
 */
export async function createNotification(
  {
    userId,
    title,
    body,
    type = 'SYSTEM',
    category = null,
    dataJson = null,
    sourceType = null,
    sourceId = null,
    deliveryStatus = 'DELIVERED',
  },
  db = prisma
) {
  return await db.notification.create({
    data: {
      userId,
      title,
      body,
      type: type.toUpperCase(),
      category: category || null,
      dataJson: dataJson || null,
      sourceType: sourceType || null,
      sourceId: sourceId || null,
      deliveryStatus,
    },
  });
}

/**
 * Bulk creates notifications (e.g. for broadcasts or fan-out).
 */
export async function createManyNotifications(records = [], db = prisma) {
  if (!Array.isArray(records) || records.length === 0) return { count: 0 };

  const data = records.map((r) => ({
    userId: r.userId,
    title: r.title,
    body: r.body,
    type: (r.type || 'SYSTEM').toUpperCase(),
    category: r.category || null,
    dataJson: r.dataJson || null,
    sourceType: r.sourceType || null,
    sourceId: r.sourceId || null,
    deliveryStatus: r.deliveryStatus || 'DELIVERED',
  }));

  return await db.notification.createMany({
    data,
  });
}

/**
 * Finds an existing notification matching specific idempotent business event parameters.
 */
export async function findExistingNotification(
  { userId, type, sourceType, sourceId },
  db = prisma
) {
  if (!userId || !type || !sourceType || !sourceId) return null;

  return await db.notification.findFirst({
    where: {
      userId,
      type: type.toUpperCase(),
      sourceType,
      sourceId,
    },
  });
}

/**
 * Finds a single notification by ID.
 */
export async function findNotificationById(id, db = prisma) {
  if (!id) return null;
  return await db.notification.findUnique({
    where: { id },
  });
}

/**
 * Retrieves paginated notifications for a user with cursor pagination support.
 */
export async function findUserNotifications(
  userId,
  { cursor = null, limit = 20, type = null, category = null, unreadOnly = false } = {},
  db = prisma
) {
  const take = Math.min(Math.max(Number(limit) || 20, 1), 100);

  const where = {
    userId,
    ...(type ? { type: type.toUpperCase() } : {}),
    ...(category ? { category } : {}),
    ...(unreadOnly ? { isRead: false } : {}),
  };

  const notifications = await db.notification.findMany({
    where,
    take: take + 1, // Fetch one extra to determine if next page exists
    ...(cursor
      ? {
          cursor: { id: cursor },
          skip: 1,
        }
      : {}),
    orderBy: { createdAt: 'desc' },
  });

  let hasNextPage = false;
  let nextCursor = null;

  if (notifications.length > take) {
    hasNextPage = true;
    const nextItem = notifications.pop();
    nextCursor = notifications[notifications.length - 1]?.id || null;
  }

  return {
    items: notifications,
    pageInfo: {
      hasNextPage,
      nextCursor,
      limit: take,
    },
  };
}

/**
 * Calculates authoritative unread notification count for a user.
 */
export async function getUnreadCount(userId, db = prisma) {
  if (!userId) return 0;
  return await db.notification.count({
    where: {
      userId,
      isRead: false,
    },
  });
}

/**
 * Marks a specific notification as read with IDOR protection.
 */
export async function markAsRead(id, userId, db = prisma) {
  const existing = await db.notification.findFirst({
    where: { id, userId },
  });

  if (!existing) return null;
  if (existing.isRead) return existing;

  return await db.notification.update({
    where: { id },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
}

/**
 * Marks all unread notifications for a user as read.
 */
export async function markAllAsRead(userId, db = prisma) {
  if (!userId) return { count: 0 };

  const now = new Date();
  return await db.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: now,
    },
  });
}

/**
 * Deletes a notification for a user with IDOR protection.
 */
export async function deleteNotification(id, userId, db = prisma) {
  const existing = await db.notification.findFirst({
    where: { id, userId },
  });

  if (!existing) return null;

  return await db.notification.delete({
    where: { id },
  });
}

export default {
  createNotification,
  createManyNotifications,
  findExistingNotification,
  findNotificationById,
  findUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
