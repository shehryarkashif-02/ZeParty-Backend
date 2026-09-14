import prisma from '../config/database.js';
import assetRepository from '../repositories/asset.repository.js';
import userAssetRepository from '../repositories/userAsset.repository.js';

async function logAudit({ adminId, adminName, action, targetEntity, targetEntityId, beforeStateJson, afterStateJson, reason, ipAddress }, db = prisma) {
  try {
    await db.auditLog.create({
      data: {
        adminId: adminId || null,
        adminName: adminName || (adminId ? 'Administrator' : 'User Action'),
        action,
        targetEntity,
        targetEntityId,
        beforeStateJson: beforeStateJson || null,
        afterStateJson: afterStateJson || null,
        reason: reason || null,
        ipAddress: ipAddress || '127.0.0.1',
      },
    });
  } catch (err) {
    console.error('Failed to write audit log in asset.service:', err);
  }
}

export function serializeAsset(asset) {
  if (!asset) return null;
  return {
    ...asset,
    priceCoins: asset.priceCoins ? asset.priceCoins.toString() : '0',
  };
}

export function serializeUserAsset(userAsset) {
  if (!userAsset) return null;
  const isExpired = userAsset.expiresAt ? new Date(userAsset.expiresAt) <= new Date() : false;
  return {
    ...userAsset,
    isExpired,
    asset: userAsset.asset ? serializeAsset(userAsset.asset) : null,
  };
}

export async function createAsset(data, { adminId, adminName, ipAddress } = {}, db = prisma) {
  const asset = await assetRepository.createAsset(data, db);

  await logAudit({
    adminId,
    adminName,
    action: 'ASSET_CREATED',
    targetEntity: 'Asset',
    targetEntityId: asset.id,
    afterStateJson: serializeAsset(asset),
    ipAddress,
  }, db);

  return serializeAsset(asset);
}

export async function updateAsset(id, data, { adminId, adminName, ipAddress } = {}, db = prisma) {
  const existing = await assetRepository.findAssetById(id, db);
  if (!existing) {
    const error = new Error('Asset not found');
    error.statusCode = 404;
    error.code = 'ASSET_NOT_FOUND';
    throw error;
  }

  const updated = await assetRepository.updateAsset(id, data, db);

  await logAudit({
    adminId,
    adminName,
    action: 'ASSET_UPDATED',
    targetEntity: 'Asset',
    targetEntityId: id,
    beforeStateJson: serializeAsset(existing),
    afterStateJson: serializeAsset(updated),
    ipAddress,
  }, db);

  return serializeAsset(updated);
}

export async function deactivateAsset(id, { adminId, adminName, ipAddress } = {}, db = prisma) {
  const existing = await assetRepository.findAssetById(id, db);
  if (!existing) {
    const error = new Error('Asset not found');
    error.statusCode = 404;
    error.code = 'ASSET_NOT_FOUND';
    throw error;
  }

  const updated = await assetRepository.updateAsset(id, { isActive: false }, db);

  await logAudit({
    adminId,
    adminName,
    action: 'ASSET_DEACTIVATED',
    targetEntity: 'Asset',
    targetEntityId: id,
    beforeStateJson: serializeAsset(existing),
    afterStateJson: serializeAsset(updated),
    ipAddress,
  }, db);

  return serializeAsset(updated);
}

export async function getAssetDetails(id, db = prisma) {
  const asset = await assetRepository.findAssetById(id, db);
  if (!asset) {
    const error = new Error('Asset not found');
    error.statusCode = 404;
    error.code = 'ASSET_NOT_FOUND';
    throw error;
  }
  return serializeAsset(asset);
}

export async function getUserBackpack(userId, db = prisma) {
  const userAssets = await userAssetRepository.findUserAssets(userId, db);
  return userAssets.map(serializeUserAsset);
}

export async function equipAsset(userId, userAssetId, { ipAddress } = {}, db = prisma) {
  const userAsset = await userAssetRepository.findUserAssetById(userAssetId, db);
  if (!userAsset) {
    const error = new Error('User asset not found');
    error.statusCode = 404;
    error.code = 'USER_ASSET_NOT_FOUND';
    throw error;
  }

  // Enforce IDOR protection
  if (userAsset.userId !== userId) {
    const error = new Error('You are not authorized to equip this asset');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_ASSET_ACCESS';
    throw error;
  }

  // Check expiration
  if (new Date(userAsset.expiresAt) <= new Date()) {
    const error = new Error('Cannot equip an expired asset');
    error.statusCode = 400;
    error.code = 'ASSET_EXPIRED';
    throw error;
  }

  const assetType = userAsset.asset?.assetType;

  // Execute in transaction to ensure single-equipped exclusivity per assetType
  const updatedUserAsset = await db.$transaction(async (tx) => {
    if (assetType) {
      await userAssetRepository.unequipAssetsByType(userId, assetType, tx);
    }
    return await userAssetRepository.updateUserAsset(
      userAsset.id,
      { isEquipped: true },
      tx
    );
  });

  await logAudit({
    adminId: null,
    adminName: 'User Action',
    action: 'USER_ASSET_EQUIPPED',
    targetEntity: 'UserAsset',
    targetEntityId: userAsset.id,
    afterStateJson: {
      userId,
      userAssetId: userAsset.id,
      assetId: userAsset.assetId,
      assetName: userAsset.asset?.name,
      assetType,
    },
    ipAddress,
  }, db);

  return serializeUserAsset(updatedUserAsset);
}

export async function unequipAsset(userId, userAssetId, { ipAddress } = {}, db = prisma) {
  const userAsset = await userAssetRepository.findUserAssetById(userAssetId, db);
  if (!userAsset) {
    const error = new Error('User asset not found');
    error.statusCode = 404;
    error.code = 'USER_ASSET_NOT_FOUND';
    throw error;
  }

  // Enforce IDOR protection
  if (userAsset.userId !== userId) {
    const error = new Error('You are not authorized to unequip this asset');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_ASSET_ACCESS';
    throw error;
  }

  const updated = await userAssetRepository.updateUserAsset(
    userAsset.id,
    { isEquipped: false },
    db
  );

  await logAudit({
    adminId: null,
    adminName: 'User Action',
    action: 'USER_ASSET_UNEQUIPPED',
    targetEntity: 'UserAsset',
    targetEntityId: userAsset.id,
    afterStateJson: {
      userId,
      userAssetId: userAsset.id,
      assetId: userAsset.assetId,
      assetName: userAsset.asset?.name,
    },
    ipAddress,
  }, db);

  return serializeUserAsset(updated);
}

export default {
  serializeAsset,
  serializeUserAsset,
  createAsset,
  updateAsset,
  deactivateAsset,
  getAssetDetails,
  getUserBackpack,
  equipAsset,
  unequipAsset,
};
