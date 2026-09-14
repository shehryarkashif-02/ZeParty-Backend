import prisma from '../config/database.js';

export async function findById(id, db = prisma) {
  if (!id) return null;
  return await db.coinRefund.findUnique({
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

  return await db.coinRefund.findMany({
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

  return await db.coinRefund.count({ where });
}

export async function create(data, db = prisma) {
  return await db.coinRefund.create({
    data: {
      userId: data.userId,
      coinAmount: BigInt(data.coinAmount),
      disputeReason: data.disputeReason,
      status: 'PENDING',
    },
  });
}

export async function updateStatus(
  id,
  { status, processedByAdminId },
  db = prisma
) {
  return await db.coinRefund.update({
    where: { id },
    data: {
      status,
      processedByAdminId,
    },
  });
}

export async function claimRefundStatus(
  id,
  fromStatus,
  toStatus,
  { processedByAdminId },
  db = prisma
) {
  const result = await db.coinRefund.updateMany({
    where: { id, status: fromStatus },
    data: {
      status: toStatus,
      processedByAdminId,
    },
  });
  return result.count > 0;
}

export default {
  findById,
  findAll,
  countAll,
  create,
  updateStatus,
  claimRefundStatus,
};
