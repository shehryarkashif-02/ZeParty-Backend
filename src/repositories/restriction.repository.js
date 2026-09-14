import prisma from '../config/database.js';

/**
 * Creates a new restriction record.
 */
export async function createRestriction(data, db = prisma) {
  return await db.restriction.create({
    data,
    include: {
      user: {
        select: {
          id: true,
          username: true,
          status: true,
        },
      },
      createdByAdmin: {
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
 * Finds a restriction by unique ID.
 */
export async function findRestrictionById(id, db = prisma) {
  return await db.restriction.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          status: true,
        },
      },
      createdByAdmin: {
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
 * Finds all currently active restrictions for a user (or device targetId).
 * Enforces dynamic timestamp condition: now >= startsAt AND (expiresAt IS NULL OR expiresAt > now).
 */
export async function findActiveRestrictionsForUser(userId, db = prisma) {
  if (!userId) return [];
  const now = new Date();

  return await db.restriction.findMany({
    where: {
      OR: [
        { userId },
        { targetId: userId },
      ],
      status: 'ACTIVE',
      startsAt: { lte: now },
      AND: [
        {
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } },
          ],
        },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Checks if a specific restriction type is currently active for a user.
 */
export async function findActiveRestrictionByType(userId, type, db = prisma) {
  if (!userId || !type) return null;
  const now = new Date();

  return await db.restriction.findFirst({
    where: {
      OR: [
        { userId },
        { targetId: userId },
      ],
      type,
      status: 'ACTIVE',
      startsAt: { lte: now },
      AND: [
        {
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } },
          ],
        },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Lists restrictions with filtering, search, and pagination.
 */
export async function listRestrictions(
  {
    status = null,
    type = null,
    userId = null,
    search = '',
    page = 1,
    limit = 20,
  } = {},
  db = prisma
) {
  const skip = (Math.max(1, page) - 1) * limit;
  const take = Math.min(100, Math.max(1, limit));

  const where = {};

  if (status && status !== 'ALL') {
    where.status = status;
  }
  if (type && type !== 'ALL') {
    where.type = type;
  }
  if (userId) {
    where.OR = [{ userId }, { targetId: userId }];
  }

  if (search && search.trim()) {
    const s = search.trim();
    where.OR = [
      { id: { contains: s, mode: 'insensitive' } },
      { reason: { contains: s, mode: 'insensitive' } },
      { targetId: { contains: s, mode: 'insensitive' } },
      { user: { username: { contains: s, mode: 'insensitive' } } },
    ];
  }

  const [total, restrictions] = await Promise.all([
    db.restriction.count({ where }),
    db.restriction.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            status: true,
          },
        },
        createdByAdmin: {
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
    restrictions,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / take) || 1,
    },
  };
}

/**
 * Lifts an active restriction.
 */
export async function liftRestriction(id, { liftedByAdminId = null, liftReason = null }, db = prisma) {
  return await db.restriction.update({
    where: { id },
    data: {
      status: 'LIFTED',
      liftedAt: new Date(),
      liftedByAdminId,
      liftReason,
    },
    include: {
      user: {
        select: { id: true, username: true, status: true },
      },
    },
  });
}

export default {
  createRestriction,
  findRestrictionById,
  findActiveRestrictionsForUser,
  findActiveRestrictionByType,
  listRestrictions,
  liftRestriction,
};
