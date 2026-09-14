import prisma from '../config/database.js';

export async function findUserAssets(userId, db = prisma) {
  if (!userId) return [];
  return await db.userAsset.findMany({
    where: { userId },
    include: {
      asset: true,
    },
    orderBy: [
      { isEquipped: 'desc' },
      { createdAt: 'desc' },
    ],
  });
}

export async function findUserAssetById(id, db = prisma) {
  if (!id) return null;
  return await db.userAsset.findUnique({
    where: { id },
    include: {
      asset: true,
    },
  });
}

export async function findActiveUserAssetByAssetId(userId, assetId, db = prisma) {
  if (!userId || !assetId) return null;
  return await db.userAsset.findFirst({
    where: {
      userId,
      assetId,
      expiresAt: { gt: new Date() },
    },
    include: {
      asset: true,
    },
  });
}

export async function findEquippedAssetByType(userId, assetType, db = prisma) {
  if (!userId || !assetType) return null;
  return await db.userAsset.findFirst({
    where: {
      userId,
      isEquipped: true,
      asset: {
        assetType,
      },
      expiresAt: { gt: new Date() },
    },
    include: {
      asset: true,
    },
  });
}

export async function createUserAsset(data, db = prisma) {
  return await db.userAsset.create({
    data: {
      userId: data.userId,
      assetId: data.assetId,
      isEquipped: Boolean(data.isEquipped),
      expiresAt: data.expiresAt,
    },
    include: {
      asset: true,
    },
  });
}

export async function updateUserAsset(id, data, db = prisma) {
  return await db.userAsset.update({
    where: { id },
    data,
    include: {
      asset: true,
    },
  });
}

export async function unequipAssetsByType(userId, assetType, db = prisma) {
  // Find all equipped assets of this assetType for this user
  const equipped = await db.userAsset.findMany({
    where: {
      userId,
      isEquipped: true,
      asset: {
        assetType,
      },
    },
    select: { id: true },
  });

  if (equipped.length > 0) {
    const ids = equipped.map((e) => e.id);
    await db.userAsset.updateMany({
      where: {
        id: { in: ids },
      },
      data: {
        isEquipped: false,
      },
    });
  }

  return equipped.length;
}

export default {
  findUserAssets,
  findUserAssetById,
  findActiveUserAssetByAssetId,
  findEquippedAssetByType,
  createUserAsset,
  updateUserAsset,
  unequipAssetsByType,
};
