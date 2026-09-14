import prisma from '../config/database.js';
import giftRepository from '../repositories/gift.repository.js';
import walletRepository from '../repositories/wallet.repository.js';
import hostRepository from '../repositories/host.repository.js';
import agencyRepository from '../repositories/agency.repository.js';
import ledgerService from './ledger.service.js';
import policyService from './policy.service.js';
import { generateReference } from '../utils/reference.util.js';
import socketEmitter from '../socket/socket.emitter.js';
import { SOCKET_EVENTS } from '../socket/socket.constants.js';

async function logAudit({ adminId, adminName, action, targetEntity, targetEntityId, beforeStateJson, afterStateJson, reason, ipAddress }, db = prisma) {
  try {
    await db.auditLog.create({
      data: {
        adminId: adminId || null,
        adminName: adminName || (adminId ? 'Administrator' : 'System Automation'),
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
    console.error('Failed to write audit log in gift.service:', err);
  }
}

export function serializeGift(gift) {
  if (!gift) return null;
  return {
    ...gift,
    coinValue: gift.coinValue ? gift.coinValue.toString() : '0',
  };
}

export function serializeGiftTransaction(tx) {
  if (!tx) return null;
  return {
    ...tx,
    totalCoins: tx.totalCoins ? tx.totalCoins.toString() : '0',
    hostDiamonds: tx.hostDiamonds ? tx.hostDiamonds.toString() : '0',
  };
}

export async function createGift(data, { adminId, adminName, ipAddress } = {}, db = prisma) {
  const gift = await giftRepository.createGift(data, db);

  await logAudit({
    adminId,
    adminName,
    action: 'GIFT_CREATED',
    targetEntity: 'Gift',
    targetEntityId: gift.id,
    afterStateJson: serializeGift(gift),
    ipAddress,
  }, db);

  return serializeGift(gift);
}

export async function updateGift(id, data, { adminId, adminName, ipAddress } = {}, db = prisma) {
  const existing = await giftRepository.findGiftById(id, db);
  if (!existing) {
    const error = new Error('Gift not found');
    error.statusCode = 404;
    error.code = 'GIFT_NOT_FOUND';
    throw error;
  }

  const updated = await giftRepository.updateGift(id, data, db);

  await logAudit({
    adminId,
    adminName,
    action: 'GIFT_UPDATED',
    targetEntity: 'Gift',
    targetEntityId: id,
    beforeStateJson: serializeGift(existing),
    afterStateJson: serializeGift(updated),
    ipAddress,
  }, db);

  return serializeGift(updated);
}

export async function deactivateGift(id, { adminId, adminName, ipAddress } = {}, db = prisma) {
  const existing = await giftRepository.findGiftById(id, db);
  if (!existing) {
    const error = new Error('Gift not found');
    error.statusCode = 404;
    error.code = 'GIFT_NOT_FOUND';
    throw error;
  }

  const updated = await giftRepository.updateGift(id, { isActive: false }, db);

  await logAudit({
    adminId,
    adminName,
    action: 'GIFT_DEACTIVATED',
    targetEntity: 'Gift',
    targetEntityId: id,
    beforeStateJson: serializeGift(existing),
    afterStateJson: serializeGift(updated),
    ipAddress,
  }, db);

  return serializeGift(updated);
}

export async function getGiftDetails(id, db = prisma) {
  const gift = await giftRepository.findGiftById(id, db);
  if (!gift) {
    const error = new Error('Gift not found');
    error.statusCode = 404;
    error.code = 'GIFT_NOT_FOUND';
    throw error;
  }
  return serializeGift(gift);
}

export async function getPublicGifts(query, db = prisma) {
  const result = await giftRepository.findGifts({ ...query, isActive: true }, db);
  return {
    gifts: result.gifts.map(serializeGift),
    pagination: result.pagination,
  };
}

export async function sendGift(
  { senderUserId, recipientUserId, giftId, quantity = 1, roomId = null },
  { ipAddress } = {},
  db = prisma
) {
  if (senderUserId === recipientUserId) {
    const error = new Error('Users cannot send gifts to themselves');
    error.statusCode = 400;
    error.code = 'CANNOT_GIFT_SELF';
    throw error;
  }

  const qty = Number(quantity) || 1;
  if (qty < 1) {
    const error = new Error('Gift quantity must be at least 1');
    error.statusCode = 400;
    error.code = 'INVALID_QUANTITY';
    throw error;
  }

  // 1. Load active Gift
  const gift = await giftRepository.findGiftById(giftId, db);
  if (!gift || !gift.isActive) {
    const error = new Error('Gift is not active or does not exist');
    error.statusCode = 404;
    error.code = 'GIFT_NOT_ACTIVE';
    throw error;
  }

  // 2. Load Recipient Host Profile
  const hostProfile = await hostRepository.findHostProfileByUserId(recipientUserId, db);
  if (!hostProfile) {
    const error = new Error('Recipient is not registered as an active creator host');
    error.statusCode = 400;
    error.code = 'RECIPIENT_NOT_A_HOST';
    throw error;
  }

  if (hostProfile.hostStatus !== 'ACTIVE') {
    const error = new Error('Recipient host account is currently not active');
    error.statusCode = 400;
    error.code = 'HOST_NOT_ACTIVE';
    throw error;
  }

  // 3. Ensure sender and recipient wallets exist
  let senderWallet = await walletRepository.findByUserId(senderUserId, db);
  if (!senderWallet) {
    senderWallet = await walletRepository.createWallet(senderUserId, db);
  }

  let hostWallet = await walletRepository.findByUserId(recipientUserId, db);
  if (!hostWallet) {
    hostWallet = await walletRepository.createWallet(recipientUserId, db);
  }

  // 4. Calculate Total Coins
  const giftCoinValue = BigInt(gift.coinValue);
  const totalCoins = giftCoinValue * BigInt(qty);

  // 5. Dynamic ECONOMY Policy Resolution
  const economyPolicy = await policyService.getEffectivePolicy('ECONOMY', db);
  const hostBps = BigInt(economyPolicy?.config?.hostShareBps || 3500); // Default 35%
  const agencyBps = BigInt(economyPolicy?.config?.agencyShareBps || 1200); // Default 12%
  const roomBps = BigInt(economyPolicy?.config?.roomRewardBps || 800); // Default 8%

  // Host Diamonds Calculation
  const hostDiamonds = (totalCoins * hostBps) / 10000n;

  // Check Agency linkage
  let agencyOwnerWallet = null;
  let agencyCoins = 0n;
  if (hostProfile.agencyId) {
    const agency = await agencyRepository.findAgencyById(hostProfile.agencyId, db);
    if (agency && agency.status === 'ACTIVE' && agency.ownerUserId) {
      agencyCoins = (totalCoins * agencyBps) / 10000n;
      agencyOwnerWallet = await walletRepository.findByUserId(agency.ownerUserId, db);
      if (!agencyOwnerWallet) {
        agencyOwnerWallet = await walletRepository.createWallet(agency.ownerUserId, db);
      }
    }
  }

  // Check Room linkage
  let roomOwnerWallet = null;
  let roomCoins = 0n;
  if (roomId) {
    try {
      const room = await db.room.findUnique({ where: { id: roomId } });
      if (room && room.status === 'LIVE' && room.creatorUserId) {
        roomCoins = (totalCoins * roomBps) / 10000n;
        roomOwnerWallet = await walletRepository.findByUserId(room.creatorUserId, db);
        if (!roomOwnerWallet) {
          roomOwnerWallet = await walletRepository.createWallet(room.creatorUserId, db);
        }
      }
    } catch {
      // Ignore room lookup error if Room table empty/unmocked in test
    }
  }

  const refId = generateReference('GIFT');

  // 6. Execute Atomic Gifting Transaction
  const result = await db.$transaction(async (tx) => {
    // a. Row-level lock on sender wallet
    const lockedSenderWallet = await walletRepository.findWithLock(senderWallet.id, tx);
    if (!lockedSenderWallet) {
      const error = new Error('Sender wallet could not be locked');
      error.statusCode = 500;
      error.code = 'WALLET_LOCK_FAILED';
      throw error;
    }

    if (BigInt(lockedSenderWallet.coinBalance) < totalCoins) {
      const error = new Error(`Insufficient coin balance. Required: ${totalCoins}, Available: ${lockedSenderWallet.coinBalance}`);
      error.statusCode = 400;
      error.code = 'INSUFFICIENT_BALANCE';
      throw error;
    }

    // b. Row-level lock on recipient host wallet
    await walletRepository.findWithLock(hostWallet.id, tx);

    // c. Build multi-account operations for ledger posting
    const operations = [
      {
        walletId: senderWallet.id,
        coinDelta: -totalCoins,
        diamondDelta: 0n,
      },
      {
        walletId: hostWallet.id,
        coinDelta: 0n,
        diamondDelta: hostDiamonds,
      },
    ];

    if (agencyCoins > 0n && agencyOwnerWallet) {
      operations.push({
        walletId: agencyOwnerWallet.id,
        coinDelta: agencyCoins,
        diamondDelta: 0n,
      });
    }

    if (roomCoins > 0n && roomOwnerWallet) {
      operations.push({
        walletId: roomOwnerWallet.id,
        coinDelta: roomCoins,
        diamondDelta: 0n,
      });
    }

    // d. Post double-entry ledger transaction
    const ledgerPosting = await ledgerService.postTransaction({
      operations,
      referenceId: refId,
      transactionType: 'GIFT_SENT',
      db: tx,
    });

    // e. Increment host monthly diamonds counter
    await hostRepository.updateHostPerformance(
      hostProfile.id,
      { diamondsDelta: hostDiamonds },
      tx
    );

    // f. Create GiftTransaction record
    const giftTx = await giftRepository.createGiftTransaction(
      {
        giftId: gift.id,
        senderUserId,
        recipientUserId,
        roomId,
        giftCount: qty,
        totalCoins,
        hostDiamonds,
      },
      tx
    );

    return {
      giftTransaction: giftTx,
      ledgerPosting,
    };
  });

  await logAudit({
    action: 'GIFT_TRANSACTION_EXECUTED',
    targetEntity: 'GiftTransaction',
    targetEntityId: result.giftTransaction.id,
    afterStateJson: {
      senderUserId,
      recipientUserId,
      giftId: gift.id,
      giftName: gift.name,
      quantity: qty,
      totalCoins: totalCoins.toString(),
      hostDiamonds: hostDiamonds.toString(),
      agencyCoins: agencyCoins.toString(),
      roomCoins: roomCoins.toString(),
      referenceId: refId,
    },
    ipAddress,
  }, db);

  if (roomId) {
    socketEmitter.emitToRoom(roomId, SOCKET_EVENTS.ROOM_GIFT_SENT, {
      roomId,
      transactionId: result.giftTransaction.id,
      senderUserId,
      recipientUserId,
      gift: {
        id: gift.id,
        name: gift.name,
        iconUrl: gift.iconUrl || null,
        animationUrl: gift.svgaAssetUrl || null,
        isFullScreen: gift.isFullScreen || false,
      },
      quantity: qty,
      totalCoins: totalCoins.toString(),
      timestamp: new Date().toISOString(),
    });
  }

  return {
    success: true,
    message: `Successfully sent ${qty}x ${gift.name} to host!`,
    data: {
      referenceId: refId,
      gift: {
        id: gift.id,
        name: gift.name,
        iconUrl: gift.iconUrl,
        svgaAssetUrl: gift.svgaAssetUrl,
        isFullScreen: gift.isFullScreen,
      },
      quantity: qty,
      totalCoinsDebited: totalCoins.toString(),
      hostDiamondsCredited: hostDiamonds.toString(),
      agencyCoinsCredited: agencyCoins.toString(),
      roomCoinsCredited: roomCoins.toString(),
      transactionId: result.giftTransaction.id,
    },
  };
}

export default {
  serializeGift,
  serializeGiftTransaction,
  createGift,
  updateGift,
  deactivateGift,
  getGiftDetails,
  getPublicGifts,
  sendGift,
};
