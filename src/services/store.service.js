import prisma from '../config/database.js';
import assetRepository from '../repositories/asset.repository.js';
import userAssetRepository from '../repositories/userAsset.repository.js';
import walletRepository from '../repositories/wallet.repository.js';
import ledgerService from './ledger.service.js';
import { serializeAsset, serializeUserAsset } from './asset.service.js';
import { generateReference } from '../utils/reference.util.js';

async function logAudit({ adminId, adminName, action, targetEntity, targetEntityId, beforeStateJson, afterStateJson, reason, ipAddress }, db = prisma) {
  try {
    await db.auditLog.create({
      data: {
        adminId: adminId || null,
        adminName: adminName || 'User Action',
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
    console.error('Failed to write audit log in store.service:', err);
  }
}

export async function getStoreCatalog(query, db = prisma) {
  const result = await assetRepository.findStoreCatalog(query, db);
  return {
    assets: result.assets.map(serializeAsset),
    pagination: result.pagination,
  };
}

export async function getVipStoreCatalog(query, db = prisma) {
  const result = await assetRepository.findStoreCatalog({ ...query, isVipExclusive: true }, db);
  return {
    assets: result.assets.map(serializeAsset),
    pagination: result.pagination,
  };
}

export async function purchaseAsset({ userId, assetId }, { ipAddress } = {}, db = prisma) {
  // 1. Load active Asset
  const asset = await assetRepository.findAssetById(assetId, db);
  if (!asset || !asset.isActive) {
    const error = new Error('Asset is not available for purchase or does not exist');
    error.statusCode = 404;
    error.code = 'ASSET_NOT_ACTIVE';
    throw error;
  }

  // 2. Ensure User Wallet exists
  let wallet = await walletRepository.findByUserId(userId, db);
  if (!wallet) {
    wallet = await walletRepository.createWallet(userId, db);
  }

  const priceCoins = BigInt(asset.priceCoins || 0);
  const validDays = Number(asset.validDays) || 30;
  const validDurationMs = validDays * 24 * 60 * 60 * 1000;
  const refId = generateReference('STORE');

  // 3. Execute Atomic Purchase Transaction
  const result = await db.$transaction(async (tx) => {
    // a. Lock wallet row
    const lockedWallet = await walletRepository.findWithLock(wallet.id, tx);
    if (!lockedWallet) {
      const error = new Error('User wallet could not be locked');
      error.statusCode = 500;
      error.code = 'WALLET_LOCK_FAILED';
      throw error;
    }

    if (priceCoins > 0n && BigInt(lockedWallet.coinBalance) < priceCoins) {
      const error = new Error(`Insufficient coins for purchase. Required: ${priceCoins}, Available: ${lockedWallet.coinBalance}`);
      error.statusCode = 400;
      error.code = 'INSUFFICIENT_BALANCE';
      throw error;
    }

    // b. Post double-entry ledger debit if price > 0
    let ledgerPosting = null;
    if (priceCoins > 0n) {
      ledgerPosting = await ledgerService.postTransaction({
        operations: [
          {
            walletId: wallet.id,
            coinDelta: -priceCoins,
            diamondDelta: 0n,
          },
        ],
        referenceId: refId,
        transactionType: 'STORE_PURCHASE',
        db: tx,
      });
    }

    // c. Check if user already owns an active ownership of this asset
    const existingActive = await userAssetRepository.findActiveUserAssetByAssetId(userId, assetId, tx);

    let userAssetRecord;
    if (existingActive) {
      // Extend expiration beyond current active expiration
      const currentExpiry = new Date(existingActive.expiresAt);
      const baseTime = currentExpiry > new Date() ? currentExpiry.getTime() : Date.now();
      const newExpiresAt = new Date(baseTime + validDurationMs);

      userAssetRecord = await userAssetRepository.updateUserAsset(
        existingActive.id,
        { expiresAt: newExpiresAt },
        tx
      );
    } else {
      // Create new UserAsset
      const newExpiresAt = new Date(Date.now() + validDurationMs);
      userAssetRecord = await userAssetRepository.createUserAsset(
        {
          userId,
          assetId,
          isEquipped: false,
          expiresAt: newExpiresAt,
        },
        tx
      );
    }

    return {
      userAsset: userAssetRecord,
      ledgerPosting,
    };
  });

  await logAudit({
    adminId: null,
    adminName: 'User Action',
    action: 'STORE_PURCHASE_EXECUTED',
    targetEntity: 'UserAsset',
    targetEntityId: result.userAsset.id,
    afterStateJson: {
      userId,
      assetId,
      assetName: asset.name,
      priceCoins: priceCoins.toString(),
      validDays,
      expiresAt: result.userAsset.expiresAt,
      referenceId: refId,
    },
    ipAddress,
  }, db);

  return {
    success: true,
    message: `Successfully purchased ${asset.name}!`,
    data: {
      referenceId: refId,
      userAsset: serializeUserAsset(result.userAsset),
      coinsDebited: priceCoins.toString(),
    },
  };
}

export default {
  getStoreCatalog,
  getVipStoreCatalog,
  purchaseAsset,
};
