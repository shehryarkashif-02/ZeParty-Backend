import prisma from '../config/database.js';

/**
 * Creates an immutable ModerationAction audit record.
 */
export async function createModerationAction(data, db = prisma) {
  return await db.moderationAction.create({
    data,
    include: {
      admin: {
        select: {
          id: true,
          name: true,
          username: true,
        },
      },
    },
  });
}

/**
 * Lists moderation actions with filtering and pagination.
 */
export async function findModerationActions(
  {
    targetType = null,
    targetId = null,
    adminId = null,
    page = 1,
    limit = 20,
  } = {},
  db = prisma
) {
  const skip = (Math.max(1, page) - 1) * limit;
  const take = Math.min(100, Math.max(1, limit));

  const where = {};
  if (targetType) where.targetType = targetType;
  if (targetId) where.targetId = targetId;
  if (adminId) where.adminId = adminId;

  const [total, actions] = await Promise.all([
    db.moderationAction.count({ where }),
    db.moderationAction.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        admin: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    }),
  ]);

  return {
    actions,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / take) || 1,
    },
  };
}

/**
 * Aggregates statistics for moderation actions and restrictions.
 */
export async function getModerationStats(db = prisma) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [
    totalActionsToday,
    totalBannedUsers,
    totalSuspendedUsers,
    activeRestrictions,
  ] = await Promise.all([
    db.moderationAction.count({
      where: {
        createdAt: { gte: startOfDay },
      },
    }),
    db.user.count({ where: { status: 'BANNED' } }),
    db.user.count({ where: { status: 'SUSPENDED' } }),
    db.restriction.count({ where: { status: 'ACTIVE' } }),
  ]);

  return {
    totalActionsToday,
    totalBannedUsers,
    totalSuspendedUsers,
    activeRestrictions,
  };
}

export default {
  createModerationAction,
  findModerationActions,
  getModerationStats,
};
