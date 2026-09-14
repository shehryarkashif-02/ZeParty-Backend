import rechargeRepository from '../repositories/recharge.repository.js';
import walletRepository from '../repositories/wallet.repository.js';
import ledgerService from './ledger.service.js';
import policyService from './policy.service.js';
import paymentProviderService from './paymentProvider.service.js';
import { getPaymentAdapter } from '../adapters/payment/paymentAdapter.factory.js';
import { sanitizeFinancial } from '../utils/bigint.util.js';
import { generateReference } from '../utils/reference.util.js';
import prisma from '../config/database.js';

export const COINS_PER_USD = 10000n; // 1 USD = 10,000 Coins baseline default

export async function getRechargePlans({ includeInactive = false } = {}) {
  const plans = await rechargeRepository.findAllPlans({ includeInactive });
  return plans.map((p) => sanitizeFinancial(p));
}

export async function createRechargePlan(data, adminId, isOwner = false, ipAddress) {
  const plan = await rechargeRepository.createPlan(data);

  await prisma.auditLog.create({
    data: {
      adminId,
      adminName: isOwner ? 'Root Owner' : 'Administrator',
      action: 'RECHARGE_PLAN_CREATED',
      targetEntity: 'RechargePlan',
      targetEntityId: plan.id,
      afterStateJson: sanitizeFinancial(plan),
      ipAddress,
    },
  }).catch(() => {});

  return sanitizeFinancial(plan);
}

export async function updateRechargePlan(id, data, adminId, isOwner = false, ipAddress) {
  const plan = await rechargeRepository.updatePlan(id, data);

  await prisma.auditLog.create({
    data: {
      adminId,
      adminName: isOwner ? 'Root Owner' : 'Administrator',
      action: 'RECHARGE_PLAN_UPDATED',
      targetEntity: 'RechargePlan',
      targetEntityId: plan.id,
      afterStateJson: sanitizeFinancial(plan),
      ipAddress,
    },
  }).catch(() => {});

  return sanitizeFinancial(plan);
}

// ---- Offline Recharge Operations ----

export async function submitOfflineRecharge({ userId, amountUSD, bankName, receiptPhotoUrl, transactionRef }) {
  const existing = await rechargeRepository.findOfflineRechargeByRef(transactionRef);
  if (existing) {
    const error = new Error('Transaction reference has already been submitted');
    error.status = 409;
    error.code = 'DUPLICATE_TRANSACTION_REF';
    throw error;
  }

  const userWallet = await walletRepository.findByUserId(userId);
  if (!userWallet) {
    const error = new Error('User wallet not found');
    error.status = 404;
    error.code = 'WALLET_NOT_FOUND';
    throw error;
  }

  const created = await rechargeRepository.createOfflineRecharge({
    userId,
    amountUSD,
    bankName,
    receiptPhotoUrl,
    transactionRef,
  });

  return sanitizeFinancial(created);
}

export async function getOfflineRecharges({ status, userId, page = 1, limit = 20 }) {
  const items = await rechargeRepository.findAllOfflineRecharges({ status, userId, page, limit });
  const total = await rechargeRepository.countOfflineRecharges({ status, userId });

  return {
    items: items.map((i) => sanitizeFinancial(i)),
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function approveOfflineRecharge({ id, adminId, isOwner = false, ipAddress }) {
  const record = await rechargeRepository.findOfflineRechargeById(id);
  if (!record) {
    const error = new Error('Offline recharge request not found');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  // Maker-Checker Invariant: Reviewer cannot approve their own deposit
  if (record.userId === adminId && !isOwner) {
    const error = new Error('Self-approval forbidden: Cannot approve your own recharge request');
    error.status = 403;
    error.code = 'SELF_APPROVAL_FORBIDDEN';
    throw error;
  }

  if (record.status !== 'PENDING') {
    const error = new Error(`Request has already been processed with status: ${record.status}`);
    error.status = 400;
    error.code = 'ALREADY_PROCESSED';
    throw error;
  }

  const wallet = await walletRepository.findByUserId(record.userId);
  if (!wallet) {
    const error = new Error('User wallet not found');
    error.status = 404;
    error.code = 'WALLET_NOT_FOUND';
    throw error;
  }

  const amountUSD = Number(record.amountUSD);
  const effectiveConfig = await policyService.getEffectiveConfig('USD_TO_COIN_RATE');
  const rateRatio = effectiveConfig?.value?.rate ? BigInt(effectiveConfig.value.rate) : COINS_PER_USD;
  const coinsCredited = BigInt(Math.floor(amountUSD)) * rateRatio;

  return await prisma.$transaction(async (tx) => {
    // 1. Atomically claim offline recharge status from PENDING -> APPROVED
    const claimed = await rechargeRepository.claimOfflineRechargeStatus(
      id,
      'PENDING',
      'APPROVED',
      {
        reviewerAdminId: adminId,
        reviewedAt: new Date(),
      },
      tx
    );

    if (!claimed) {
      const error = new Error('Request has already been processed or status changed');
      error.status = 400;
      error.code = 'ALREADY_PROCESSED';
      throw error;
    }

    const updated = await rechargeRepository.findOfflineRechargeById(id, tx);

    // 2. Post atomic ledger credit and increment totalRechargedUSD
    const ledgerResult = await ledgerService.postTransaction({
      operations: [
        {
          walletId: wallet.id,
          coinDelta: coinsCredited,
          usdDelta: amountUSD,
          rechargedDeltaUSD: amountUSD,
        },
      ],
      referenceId: record.transactionRef || `OFF-${record.id}`,
      transactionType: 'RECHARGE',
      db: tx,
    });

    // 3. Emit AuditLog
    await tx.auditLog.create({
      data: {
        adminId,
        adminName: isOwner ? 'Root Owner' : 'Administrator',
        action: 'OFFLINE_RECHARGE_APPROVED',
        targetEntity: 'OfflineRecharge',
        targetEntityId: id,
        afterStateJson: {
          coinsCredited: coinsCredited.toString(),
          amountUSD,
          referenceId: ledgerResult.referenceId,
        },
        reason: `Approved offline deposit for user ${record.userId}`,
        ipAddress,
      },
    });

    return {
      success: true,
      message: 'Offline recharge approved and coins credited successfully.',
      recharge: sanitizeFinancial(updated),
      ledger: ledgerResult,
    };
  });
}

export async function rejectOfflineRecharge({ id, adminId, isOwner = false, reason, ipAddress }) {
  const record = await rechargeRepository.findOfflineRechargeById(id);
  if (!record) {
    const error = new Error('Offline recharge request not found');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (record.status !== 'PENDING') {
    const error = new Error(`Request has already been processed with status: ${record.status}`);
    error.status = 400;
    error.code = 'ALREADY_PROCESSED';
    throw error;
  }

  return await prisma.$transaction(async (tx) => {
    const claimed = await rechargeRepository.claimOfflineRechargeStatus(
      id,
      'PENDING',
      'REJECTED',
      {
        reviewerAdminId: adminId,
        reviewedAt: new Date(),
      },
      tx
    );

    if (!claimed) {
      const error = new Error('Request has already been processed or status changed');
      error.status = 400;
      error.code = 'ALREADY_PROCESSED';
      throw error;
    }

    const updated = await rechargeRepository.findOfflineRechargeById(id, tx);

    await tx.auditLog.create({
      data: {
        adminId,
        adminName: isOwner ? 'Root Owner' : 'Administrator',
        action: 'OFFLINE_RECHARGE_REJECTED',
        targetEntity: 'OfflineRecharge',
        targetEntityId: id,
        reason,
        ipAddress,
      },
    });

    return {
      success: true,
      message: 'Offline recharge request rejected.',
      recharge: sanitizeFinancial(updated),
    };
  });
}

// ---- Online Recharge Intent & Webhook Processing ----

export async function createPaymentIntent({ userId, planId, paymentProvider }) {
  const plan = await rechargeRepository.findPlanById(planId);
  if (!plan || !plan.isActive) {
    const error = new Error('Selected recharge plan is not available or inactive');
    error.status = 404;
    error.code = 'RECHARGE_PLAN_NOT_FOUND';
    throw error;
  }

  const wallet = await walletRepository.findByUserId(userId);
  if (!wallet) {
    const error = new Error('User wallet not found');
    error.status = 404;
    error.code = 'WALLET_NOT_FOUND';
    throw error;
  }

  const totalCoins = BigInt(plan.coinAmount) + BigInt(plan.bonusCoins || 0);
  const amountUSD = Number(plan.priceUSD);
  const providerKey = paymentProvider.toUpperCase();

  // Retrieve provider config
  const providerConfig = await paymentProviderService.getDecryptedProviderConfig(providerKey);
  const adapter = getPaymentAdapter(providerKey, providerConfig || {});

  const orderId = generateReference('RCH');

  // Call provider adapter
  const intentResult = await adapter.createPaymentIntent({
    orderId,
    amountUSD,
    currency: 'USD',
    metadata: {
      userId,
      planId,
      totalCoins: totalCoins.toString(),
    },
  });

  // Persist OnlineRecharge intent in database
  const recharge = await rechargeRepository.createOnlineRecharge({
    userId,
    gateway: providerKey,
    gatewayTxId: intentResult.gatewayTxId,
    amountUSD,
    coinsCredited: totalCoins,
    planId: plan.id,
    status: 'PENDING',
  });

  return {
    rechargeId: recharge.id,
    gatewayTxId: intentResult.gatewayTxId,
    amountUSD,
    coinsToCredit: totalCoins.toString(),
    clientSecret: intentResult.clientSecret || null,
    checkoutUrl: intentResult.checkoutUrl || null,
    gateway: providerKey,
    status: 'PENDING',
  };
}

export async function processPaymentWebhook({ provider, rawBody, signature, headers = {}, ipAddress }) {
  const providerKey = String(provider || '').toUpperCase();
  const providerConfig = await paymentProviderService.getDecryptedProviderConfig(providerKey);

  const webhookSecret = providerConfig?.webhookSecret || process.env.PAYMENT_WEBHOOK_SECRET || 'test_webhook_secret';
  const adapter = getPaymentAdapter(providerKey, providerConfig || {});

  // Cryptographic Signature Verification
  const isValid = await adapter.verifyWebhookSignature({
    rawBody,
    signature,
    webhookSecret,
  });

  if (!isValid) {
    const error = new Error('Invalid webhook signature');
    error.status = 401;
    error.code = 'PAYMENT_SIGNATURE_INVALID';
    throw error;
  }

  // Parse event
  const event = adapter.parseWebhookEvent(rawBody);
  if (!event.isSuccessful || !event.gatewayTxId) {
    return {
      received: true,
      processed: false,
      message: `Event ${event.eventType} is not a successful payment capture.`,
    };
  }

  const record = await rechargeRepository.findOnlineRechargeByGatewayTxId(event.gatewayTxId);
  if (!record) {
    return {
      received: true,
      processed: false,
      message: `Recharge intent not found for gatewayTxId: ${event.gatewayTxId}`,
    };
  }

  // Idempotency: If already credited, return safely without duplicating credit
  if (record.status === 'SUCCESS') {
    return {
      received: true,
      processed: true,
      alreadyProcessed: true,
      message: 'Payment was previously confirmed and credited.',
      rechargeId: record.id,
    };
  }

  const wallet = await walletRepository.findByUserId(record.userId);
  if (!wallet) {
    const error = new Error('User wallet not found for recharge completion');
    error.status = 404;
    error.code = 'WALLET_NOT_FOUND';
    throw error;
  }

  const coinsToCredit = BigInt(record.coinsCredited);
  const amountUSD = Number(record.amountUSD);

  return await prisma.$transaction(async (tx) => {
    // 1. Atomically claim OnlineRecharge from PENDING -> SUCCESS
    const claimed = await rechargeRepository.claimOnlineRechargeSuccess(record.id, tx);

    if (!claimed) {
      // Concurrently claimed and credited by another webhook worker
      return {
        received: true,
        processed: true,
        alreadyProcessed: true,
        message: 'Payment was previously confirmed and credited by a concurrent request.',
        rechargeId: record.id,
      };
    }

    const updated = await rechargeRepository.findOnlineRechargeById(record.id, tx);

    // 2. Post atomic ledger transaction crediting user coins
    const ledgerResult = await ledgerService.postTransaction({
      operations: [
        {
          walletId: wallet.id,
          coinDelta: coinsToCredit,
          usdDelta: amountUSD,
          rechargedDeltaUSD: amountUSD,
        },
      ],
      referenceId: `ONL-${record.gatewayTxId}`,
      transactionType: 'RECHARGE',
      db: tx,
    });

    // 3. Emit AuditLog
    await tx.auditLog.create({
      data: {
        adminId: '00000000-0000-0000-0000-000000000000',
        adminName: `System Webhook [${providerKey}]`,
        action: 'ONLINE_RECHARGE_COMPLETED',
        targetEntity: 'OnlineRecharge',
        targetEntityId: record.id,
        afterStateJson: {
          coinsCredited: coinsToCredit.toString(),
          amountUSD,
          gatewayTxId: record.gatewayTxId,
          referenceId: ledgerResult.referenceId,
        },
        reason: `Verified ${providerKey} webhook capture`,
        ipAddress,
      },
    }).catch(() => {});

    return {
      received: true,
      processed: true,
      rechargeId: updated ? updated.id : record.id,
      coinsCredited: coinsToCredit.toString(),
      ledgerReferenceId: ledgerResult.referenceId,
    };
  });
}

export async function getOnlineRecharges({ status, userId, gateway, page = 1, limit = 20 }) {
  const items = await rechargeRepository.findAllOnlineRecharges({ status, userId, gateway, page, limit });
  const total = await rechargeRepository.countOnlineRecharges({ status, userId, gateway });

  return {
    items: items.map((i) => sanitizeFinancial(i)),
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export default {
  getRechargePlans,
  createRechargePlan,
  updateRechargePlan,
  submitOfflineRecharge,
  getOfflineRecharges,
  approveOfflineRecharge,
  rejectOfflineRecharge,
  createPaymentIntent,
  processPaymentWebhook,
  getOnlineRecharges,
};
