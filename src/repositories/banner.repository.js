import prisma from '../config/database.js';

export async function createBanner(
  { title, imageUrl, destinationUrl = null, position = 0, isActive = true, startsAt = null, endsAt = null },
  db = prisma
) {
  return await db.banner.create({
    data: {
      title,
      imageUrl,
      destinationUrl,
      position: Number(position) || 0,
      isActive: Boolean(isActive),
      startsAt: startsAt ? new Date(startsAt) : null,
      endsAt: endsAt ? new Date(endsAt) : null,
    },
  });
}

export async function findBannerById(id, db = prisma) {
  if (!id) return null;
  return await db.banner.findUnique({
    where: { id },
  });
}

export async function findAdminBanners(
  { page = 1, limit = 20, isActive = null, search = null } = {},
  db = prisma
) {
  const where = {};

  if (isActive !== null && isActive !== undefined && isActive !== '') {
    where.isActive = isActive === 'true' || isActive === true;
  }

  if (search && search.trim() !== '') {
    where.title = { contains: search.trim(), mode: 'insensitive' };
  }

  const parsedPage = Math.max(1, Number(page) || 1);
  const parsedLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  const skip = (parsedPage - 1) * parsedLimit;

  const [total, banners] = await Promise.all([
    db.banner.count({ where }),
    db.banner.findMany({
      where,
      skip,
      take: parsedLimit,
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
    }),
  ]);

  return {
    banners,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit),
    },
  };
}

export async function findActiveBanners(now = new Date(), db = prisma) {
  return await db.banner.findMany({
    where: {
      isActive: true,
      AND: [
        {
          OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        },
        {
          OR: [{ endsAt: null }, { endsAt: { gte: now } }],
        },
      ],
    },
    orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
  });
}

export async function updateBanner(id, data, db = prisma) {
  const updateData = { ...data };
  if (updateData.startsAt !== undefined) {
    updateData.startsAt = updateData.startsAt ? new Date(updateData.startsAt) : null;
  }
  if (updateData.endsAt !== undefined) {
    updateData.endsAt = updateData.endsAt ? new Date(updateData.endsAt) : null;
  }
  if (updateData.position !== undefined) {
    updateData.position = Number(updateData.position) || 0;
  }

  return await db.banner.update({
    where: { id },
    data: updateData,
  });
}

export async function deleteBanner(id, db = prisma) {
  return await db.banner.delete({
    where: { id },
  });
}

export default {
  createBanner,
  findBannerById,
  findAdminBanners,
  findActiveBanners,
  updateBanner,
  deleteBanner,
};
