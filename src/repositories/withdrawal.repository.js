import prisma from '../config/database.js';

export async function findById(id, db = prisma) {
  if (!id) return null;
  return await db.withdrawalRequest.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, username: true, email: true },
      },
    },
  });
}

export async function findAll(
  { status, userId, page = 1, limit = 20 },
  db = prisma
) {
  const where = {};
  if (status) where.status = status;
  if (userId) where.userId = userId;

  const skip = (Math.max(1, page) - 1) * limit;

  return await db.withdrawalRequest.findMany({
    where,
    include: {
      user: {
        select: { id: true, username: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit,
  });
}

export async function countAll(
  { status, userId },
  db = prisma
) {
  const where = {};
  if (status) where.status = status;
  if (userId) where.userId = userId;

  return await db.withdrawalRequest.count({ where });
}

export async function updateStatus(
  id,
  { status, reviewerAdminId, rejectionReason = null, reviewedAt = new Date() },
  db = prisma
) {
  return await db.withdrawalRequest.update({
    where: { id },
    data: {
      status,
      reviewerAdminId,
      rejectionReason,
      reviewedAt,
    },
  });
}

export default {
  findById,
  findAll,
  countAll,
  updateStatus,
};
