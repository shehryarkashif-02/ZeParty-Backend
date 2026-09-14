import crypto from 'crypto';
import prisma from '../config/database.js';
import merchantRepository from '../repositories/merchant.repository.js';

function hashSecret(secret) {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

async function logAudit({ adminId, adminName, action, targetEntity, targetEntityId, beforeStateJson, afterStateJson, reason, ipAddress }, db = prisma) {
  try {
    await db.auditLog.create({
      data: {
        adminId: adminId || 'SYSTEM',
        adminName: adminName || 'System',
        action,
        targetEntity,
        targetEntityId: targetEntityId || null,
        beforeStateJson: beforeStateJson ? JSON.parse(JSON.stringify(beforeStateJson)) : null,
        afterStateJson: afterStateJson ? JSON.parse(JSON.stringify(afterStateJson)) : null,
        reason: reason || null,
        ipAddress: ipAddress || '127.0.0.1',
      },
    });
  } catch (err) {
    console.error('Failed to write audit log in merchant.service:', err);
  }
}

export function sanitizeMerchant(merchant) {
  if (!merchant) return null;
  const { apiKeyHash, apiSecretHash, ...rest } = merchant;
  return {
    ...rest,
    monthlyQuotaCoins: merchant.monthlyQuotaCoins ? merchant.monthlyQuotaCoins.toString() : '0',
    totalSpentUSD: merchant.totalSpentUSD ? merchant.totalSpentUSD.toString() : '0.00',
  };
}

export async function createMerchant(data, { adminId, adminName, ipAddress } = {}, db = prisma) {
  const existing = await merchantRepository.findMerchantByUserId(data.userId, db);
  if (existing) {
    const error = new Error('User is already registered as a merchant');
    error.statusCode = 409;
    error.code = 'MERCHANT_ALREADY_EXISTS';
    throw error;
  }

  // Generate secure API credentials server-side
  const rawApiKey = `zp_live_${crypto.randomBytes(16).toString('hex')}`;
  const rawApiSecret = `zp_sec_${crypto.randomBytes(32).toString('hex')}`;
  const apiKeyHash = hashSecret(rawApiKey);
  const apiSecretHash = hashSecret(rawApiSecret);

  const merchant = await db.$transaction(async (tx) => {
    const newMerchant = await merchantRepository.createMerchant({
      userId: data.userId,
      companyName: data.companyName,
      apiKeyHash,
      apiSecretHash,
      monthlyQuotaCoins: BigInt(data.monthlyQuotaCoins || 1000000),
      status: data.status || 'ACTIVE',
    }, tx);

    await tx.user.update({
      where: { id: data.userId },
      data: { userType: 'MERCHANT' },
    });

    return newMerchant;
  });

  await logAudit({
    adminId,
    adminName,
    action: 'MERCHANT_CREATED',
    targetEntity: 'Merchant',
    targetEntityId: merchant.id,
    afterStateJson: {
      userId: merchant.userId,
      companyName: merchant.companyName,
      monthlyQuotaCoins: merchant.monthlyQuotaCoins.toString(),
    },
    ipAddress,
  }, db);

  return {
    ...sanitizeMerchant(merchant),
    rawCredentials: {
      apiKey: rawApiKey,
      apiSecret: rawApiSecret,
      warning: 'Store these API credentials securely. The secret cannot be retrieved again.',
    },
  };
}

export async function updateMerchant(id, updates, { adminId, adminName, ipAddress } = {}, db = prisma) {
  const merchant = await merchantRepository.findMerchantById(id, db);
  if (!merchant) {
    const error = new Error('Merchant not found');
    error.statusCode = 404;
    error.code = 'MERCHANT_NOT_FOUND';
    throw error;
  }

  const updated = await merchantRepository.updateMerchant(id, updates, db);

  await logAudit({
    adminId,
    adminName,
    action: 'MERCHANT_UPDATED',
    targetEntity: 'Merchant',
    targetEntityId: id,
    beforeStateJson: {
      companyName: merchant.companyName,
      status: merchant.status,
      monthlyQuotaCoins: merchant.monthlyQuotaCoins.toString(),
    },
    afterStateJson: updates,
    ipAddress,
  }, db);

  return sanitizeMerchant(updated);
}

export async function getMerchantDetails(id, db = prisma) {
  const merchant = await merchantRepository.findMerchantById(id, db);
  if (!merchant) {
    const error = new Error('Merchant not found');
    error.statusCode = 404;
    error.code = 'MERCHANT_NOT_FOUND';
    throw error;
  }
  return sanitizeMerchant(merchant);
}

export default {
  createMerchant,
  updateMerchant,
  getMerchantDetails,
  sanitizeMerchant,
};
