import prisma from '../config/database.js';

export async function findAllChargebacks(
  { status, userId, gateway, page = 1, limit = 20 },
  db = prisma
) {
  const where = {};
  if (status) where.status = status;
  if (userId) where.userId = userId;
  if (gateway) where.gateway = gateway;

  const skip = (Math.max(1, page) - 1) * limit;

  return await db.chargeback.findMany({
    where,
    include: {
      user: {
        select: { id: true, username: true, email: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit,
  });
}

export async function countChargebacks(
  { status, userId, gateway },
  db = prisma
) {
  const where = {};
  if (status) where.status = status;
  if (userId) where.userId = userId;
  if (gateway) where.gateway = gateway;

  return await db.chargeback.count({ where });
}

export async function findChargebackById(id, db = prisma) {
  if (!id) return null;
  return await db.chargeback.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, username: true, email: true },
      },
    },
  });
}

export async function findChargebackByDisputeId(disputeId, db = prisma) {
  if (!disputeId) return null;
  return await db.chargeback.findUnique({
    where: { disputeId },
    include: {
      user: {
        select: { id: true, username: true, email: true },
      },
    },
  });
}

export async function createChargeback(data, db = prisma) {
  return await db.chargeback.create({
    data: {
      disputeId: data.disputeId,
      userId: data.userId,
      gateway: data.gateway,
      amountUSD: data.amountUSD,
      coinsInvolved: BigInt(data.coinsInvolved || 0),
      status: data.status || 'RECEIVED',
      reason: data.reason || null,
      adminNotes: data.adminNotes || null,
    },
  });
}

export async function updateChargeback(id, data, db = prisma) {
  return await db.chargeback.update({
    where: { id },
    data,
  });
}

export async function claimChargebackStatus(id, fromStatuses, toStatus, updateData = {}, db = prisma) {
  const result = await db.chargeback.updateMany({
    where: {
      id,
      status: Array.isArray(fromStatuses) ? { in: fromStatuses } : fromStatuses,
    },
    data: {
      ...updateData,
      status: toStatus,
    },
  });
  return result.count > 0;
}

export default {
  findAllChargebacks,
  countChargebacks,
  findChargebackById,
  findChargebackByDisputeId,
  createChargeback,
  updateChargeback,
  claimChargebackStatus,
};
