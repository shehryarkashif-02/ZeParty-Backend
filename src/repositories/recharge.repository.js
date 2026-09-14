import prisma from '../config/database.js';

export async function findAllPlans({ includeInactive = false }, db = prisma) {
  const where = includeInactive ? {} : { isActive: true };
  return await db.rechargePlan.findMany({
    where,
    orderBy: { priceUSD: 'asc' },
  });
}

export async function findPlanById(id, db = prisma) {
  if (!id) return null;
  return await db.rechargePlan.findUnique({
    where: { id },
  });
}

export async function createPlan(data, db = prisma) {
  return await db.rechargePlan.create({
    data: {
      coinAmount: BigInt(data.coinAmount),
      priceUSD: data.priceUSD,
      bonusCoins: BigInt(data.bonusCoins || 0),
      badgeText: data.badgeText || null,
      isActive: data.isActive !== undefined ? data.isActive : true,
    },
  });
}

export async function updatePlan(id, data, db = prisma) {
  const updateData = {};
  if (data.coinAmount !== undefined) updateData.coinAmount = BigInt(data.coinAmount);
  if (data.priceUSD !== undefined) updateData.priceUSD = data.priceUSD;
  if (data.bonusCoins !== undefined) updateData.bonusCoins = BigInt(data.bonusCoins);
  if (data.badgeText !== undefined) updateData.badgeText = data.badgeText;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  return await db.rechargePlan.update({
    where: { id },
    data: updateData,
  });
}

export async function createOfflineRecharge(data, db = prisma) {
  return await db.offlineRecharge.create({
    data: {
      userId: data.userId,
      amountUSD: data.amountUSD,
      bankName: data.bankName,
      receiptPhotoUrl: data.receiptPhotoUrl,
      transactionRef: data.transactionRef,
      status: 'PENDING',
    },
  });
}

export async function findOfflineRechargeById(id, db = prisma) {
  if (!id) return null;
  return await db.offlineRecharge.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, username: true, email: true },
      },
    },
  });
}

export async function findOfflineRechargeByRef(transactionRef, db = prisma) {
  if (!transactionRef) return null;
  return await db.offlineRecharge.findUnique({
    where: { transactionRef },
  });
}

export async function findAllOfflineRecharges(
  { status, userId, page = 1, limit = 20 },
  db = prisma
) {
  const where = {};
  if (status) where.status = status;
  if (userId) where.userId = userId;

  const skip = (Math.max(1, page) - 1) * limit;

  return await db.offlineRecharge.findMany({
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

export async function countOfflineRecharges(
  { status, userId },
  db = prisma
) {
  const where = {};
  if (status) where.status = status;
  if (userId) where.userId = userId;

  return await db.offlineRecharge.count({ where });
}

export async function updateOfflineRechargeStatus(
  id,
  { status, reviewerAdminId, reviewedAt = new Date() },
  db = prisma
) {
  return await db.offlineRecharge.update({
    where: { id },
    data: {
      status,
      reviewerAdminId,
      reviewedAt,
    },
  });
}

export async function claimOfflineRechargeStatus(
  id,
  fromStatus,
  toStatus,
  { reviewerAdminId, reviewedAt = new Date() },
  db = prisma
) {
  const result = await db.offlineRecharge.updateMany({
    where: { id, status: fromStatus },
    data: {
      status: toStatus,
      reviewerAdminId,
      reviewedAt,
    },
  });
  return result.count > 0;
}

// ---- Online Recharge Repository Methods ----

export async function createOnlineRecharge(data, db = prisma) {
  return await db.onlineRecharge.create({
    data: {
      userId: data.userId,
      gateway: data.gateway,
      gatewayTxId: data.gatewayTxId,
      amountUSD: data.amountUSD,
      coinsCredited: BigInt(data.coinsCredited),
      planId: data.planId || null,
      status: data.status || 'PENDING',
    },
  });
}

export async function findOnlineRechargeById(id, db = prisma) {
  if (!id) return null;
  return await db.onlineRecharge.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, username: true, email: true },
      },
    },
  });
}

export async function findOnlineRechargeByGatewayTxId(gatewayTxId, db = prisma) {
  if (!gatewayTxId) return null;
  return await db.onlineRecharge.findUnique({
    where: { gatewayTxId },
    include: {
      user: {
        select: { id: true, username: true, email: true },
      },
    },
  });
}

export async function updateOnlineRechargeStatus(id, status, db = prisma) {
  return await db.onlineRecharge.update({
    where: { id },
    data: { status },
  });
}

export async function claimOnlineRechargeSuccess(id, db = prisma) {
  const result = await db.onlineRecharge.updateMany({
    where: { id, status: 'PENDING' },
    data: { status: 'SUCCESS' },
  });
  return result.count > 0;
}

export async function findAllOnlineRecharges(
  { status, userId, gateway, page = 1, limit = 20 },
  db = prisma
) {
  const where = {};
  if (status) where.status = status;
  if (userId) where.userId = userId;
  if (gateway) where.gateway = gateway;

  const skip = (Math.max(1, page) - 1) * limit;

  return await db.onlineRecharge.findMany({
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

export async function countOnlineRecharges(
  { status, userId, gateway },
  db = prisma
) {
  const where = {};
  if (status) where.status = status;
  if (userId) where.userId = userId;
  if (gateway) where.gateway = gateway;

  return await db.onlineRecharge.count({ where });
}

export default {
  findAllPlans,
  findPlanById,
  createPlan,
  updatePlan,
  createOfflineRecharge,
  findOfflineRechargeById,
  findOfflineRechargeByRef,
  findAllOfflineRecharges,
  countOfflineRecharges,
  updateOfflineRechargeStatus,
  claimOfflineRechargeStatus,
  createOnlineRecharge,
  findOnlineRechargeById,
  findOnlineRechargeByGatewayTxId,
  updateOnlineRechargeStatus,
  claimOnlineRechargeSuccess,
  findAllOnlineRecharges,
  countOnlineRecharges,
};
