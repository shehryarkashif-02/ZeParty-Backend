import prisma from '../config/database.js';

export async function createAnnouncement(
  { title, body, targetAudience = 'ALL', isActive = true, startsAt = null, endsAt = null },
  db = prisma
) {
  return await db.announcement.create({
    data: {
      title,
      body,
      targetAudience,
      isActive: Boolean(isActive),
      startsAt: startsAt ? new Date(startsAt) : null,
      endsAt: endsAt ? new Date(endsAt) : null,
    },
  });
}

export async function findAnnouncementById(id, db = prisma) {
  if (!id) return null;
  return await db.announcement.findUnique({
    where: { id },
  });
}

export async function findAdminAnnouncements(
  { page = 1, limit = 20, targetAudience = null, isActive = null, search = null } = {},
  db = prisma
) {
  const where = {};

  if (targetAudience) {
    where.targetAudience = targetAudience;
  }

  if (isActive !== null && isActive !== undefined && isActive !== '') {
    where.isActive = isActive === 'true' || isActive === true;
  }

  if (search && search.trim() !== '') {
    where.OR = [
      { title: { contains: search.trim(), mode: 'insensitive' } },
      { body: { contains: search.trim(), mode: 'insensitive' } },
    ];
  }

  const parsedPage = Math.max(1, Number(page) || 1);
  const parsedLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  const skip = (parsedPage - 1) * parsedLimit;

  const [total, announcements] = await Promise.all([
    db.announcement.count({ where }),
    db.announcement.findMany({
      where,
      skip,
      take: parsedLimit,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    announcements,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit),
    },
  };
}

export async function findActiveAnnouncements(
  { targetAudience = 'ALL', now = new Date() } = {},
  db = prisma
) {
  const targetFilter =
    targetAudience && targetAudience !== 'ALL'
      ? { in: ['ALL', targetAudience] }
      : 'ALL';

  return await db.announcement.findMany({
    where: {
      isActive: true,
      targetAudience: targetFilter,
      AND: [
        {
          OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        },
        {
          OR: [{ endsAt: null }, { endsAt: { gte: now } }],
        },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateAnnouncement(id, data, db = prisma) {
  const updateData = { ...data };
  if (updateData.startsAt !== undefined) {
    updateData.startsAt = updateData.startsAt ? new Date(updateData.startsAt) : null;
  }
  if (updateData.endsAt !== undefined) {
    updateData.endsAt = updateData.endsAt ? new Date(updateData.endsAt) : null;
  }

  return await db.announcement.update({
    where: { id },
    data: updateData,
  });
}

export async function deleteAnnouncement(id, db = prisma) {
  return await db.announcement.delete({
    where: { id },
  });
}

export default {
  createAnnouncement,
  findAnnouncementById,
  findAdminAnnouncements,
  findActiveAnnouncements,
  updateAnnouncement,
  deleteAnnouncement,
};
