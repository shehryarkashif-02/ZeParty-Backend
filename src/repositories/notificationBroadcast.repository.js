import prisma from '../config/database.js';

/**
 * Creates a notification broadcast record.
 */
export async function createBroadcast(
  {
    adminId = null,
    title,
    body,
    type = 'Push',
    audience = 'All Users',
    recipientCount = 0,
    status = 'SENT',
    metadataJson = null,
  },
  db = prisma
) {
  return await db.notificationBroadcast.create({
    data: {
      adminId,
      title,
      body,
      type,
      audience,
      recipientCount,
      status,
      metadataJson: metadataJson || null,
      sentAt: new Date(),
    },
  });
}

/**
 * Lists broadcast history for Admin Portal.
 */
export async function findBroadcasts(
  { page = 1, limit = 20, search = null, type = null, audience = null } = {},
  db = prisma
) {
  const take = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const where = {
    ...(type ? { type } : {}),
    ...(audience ? { audience } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { body: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    db.notificationBroadcast.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        admin: {
          select: { id: true, name: true, username: true },
        },
      },
    }),
    db.notificationBroadcast.count({ where }),
  ]);

  return {
    items,
    pagination: {
      total,
      page: Number(page) || 1,
      limit: take,
      totalPages: Math.ceil(total / take) || 1,
    },
  };
}

/**
 * Finds a broadcast by ID.
 */
export async function findBroadcastById(id, db = prisma) {
  if (!id) return null;
  return await db.notificationBroadcast.findUnique({
    where: { id },
    include: {
      admin: {
        select: { id: true, name: true, username: true },
      },
    },
  });
}

export default {
  createBroadcast,
  findBroadcasts,
  findBroadcastById,
};
