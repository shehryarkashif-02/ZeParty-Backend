import paymentProviderRepository from '../repositories/paymentProvider.repository.js';
import { encrypt, decrypt, maskSecret } from '../utils/encryption.util.js';
import prisma from '../config/database.js';

/**
 * Sanitizes a PaymentProvider record for safe Admin consumption by masking credentials.
 */
export function sanitizeProviderForAdmin(provider) {
  if (!provider) return null;

  let rawApiKey = provider.apiKey;
  if (!rawApiKey && provider.encryptedApiKey) {
    try {
      rawApiKey = decrypt(provider.encryptedApiKey);
    } catch {}
  }

  let rawApiSecret = provider.apiSecret;
  if (!rawApiSecret && provider.encryptedApiSecret) {
    try {
      rawApiSecret = decrypt(provider.encryptedApiSecret);
    } catch {}
  }

  let rawWebhookSecret = provider.webhookSecret;
  if (!rawWebhookSecret && provider.encryptedWebhookSecret) {
    try {
      rawWebhookSecret = decrypt(provider.encryptedWebhookSecret);
    } catch {}
  }

  return {
    id: provider.id,
    name: provider.name,
    isSandbox: provider.isSandbox,
    isActive: provider.isActive,
    webhookUrl: provider.webhookUrl,
    feeDescription: provider.feeDescription || null,
    limitsDescription: provider.limitsDescription || null,
    maskedApiKey: maskSecret(rawApiKey),
    maskedApiSecret: maskSecret(rawApiSecret),
    maskedWebhookSecret: maskSecret(rawWebhookSecret),
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
  };
}

/**
 * Retrieves all payment providers with masked credentials.
 */
export async function listPaymentProviders({ includeInactive = true } = {}) {
  const providers = await paymentProviderRepository.findAllProviders({ includeInactive });
  return providers.map((p) => sanitizeProviderForAdmin(p));
}

/**
 * Retrieves a single payment provider with masked credentials.
 */
export async function getPaymentProviderById(id) {
  const provider = await paymentProviderRepository.findProviderById(id);
  if (!provider) {
    const error = new Error('Payment provider not found');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }
  return sanitizeProviderForAdmin(provider);
}

/**
 * Creates a new payment provider with encrypted credentials.
 */
export async function createPaymentProvider(data, adminId, isOwner = false, ipAddress) {
  const existing = await paymentProviderRepository.findProviderByName(data.name);
  if (existing) {
    const error = new Error(`Payment provider "${data.name}" already exists`);
    error.status = 409;
    error.code = 'PROVIDER_ALREADY_EXISTS';
    throw error;
  }

  const payload = {
    name: data.name.toUpperCase(),
    isSandbox: data.isSandbox ?? true,
    isActive: data.isActive ?? true,
    webhookUrl: data.webhookUrl || null,
    feeDescription: data.feeDescription || null,
    limitsDescription: data.limitsDescription || null,
  };

  if (data.apiKey) {
    payload.encryptedApiKey = encrypt(data.apiKey);
  }
  if (data.apiSecret) {
    payload.encryptedApiSecret = encrypt(data.apiSecret);
  }
  if (data.webhookSecret) {
    payload.encryptedWebhookSecret = encrypt(data.webhookSecret);
  }

  const created = await paymentProviderRepository.createProvider(payload);

  await prisma.auditLog.create({
    data: {
      adminId,
      adminName: isOwner ? 'Root Owner' : 'Administrator',
      action: 'PAYMENT_PROVIDER_CREATED',
      targetEntity: 'PaymentProvider',
      targetEntityId: created.id,
      afterStateJson: sanitizeProviderForAdmin(created),
      reason: `Configured payment provider ${created.name}`,
      ipAddress,
    },
  }).catch(() => {});

  return sanitizeProviderForAdmin(created);
}

/**
 * Updates a payment provider with encrypted credentials.
 */
export async function updatePaymentProvider(id, data, adminId, isOwner = false, ipAddress) {
  const provider = await paymentProviderRepository.findProviderById(id);
  if (!provider) {
    const error = new Error('Payment provider not found');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  const updateData = {};
  if (data.isSandbox !== undefined) updateData.isSandbox = data.isSandbox;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.webhookUrl !== undefined) updateData.webhookUrl = data.webhookUrl;
  if (data.feeDescription !== undefined) updateData.feeDescription = data.feeDescription;
  if (data.limitsDescription !== undefined) updateData.limitsDescription = data.limitsDescription;

  if (data.apiKey) {
    updateData.encryptedApiKey = encrypt(data.apiKey);
  }
  if (data.apiSecret) {
    updateData.encryptedApiSecret = encrypt(data.apiSecret);
  }
  if (data.webhookSecret) {
    updateData.encryptedWebhookSecret = encrypt(data.webhookSecret);
  }

  const updated = await paymentProviderRepository.updateProvider(id, updateData);

  await prisma.auditLog.create({
    data: {
      adminId,
      adminName: isOwner ? 'Root Owner' : 'Administrator',
      action: 'PAYMENT_PROVIDER_UPDATED',
      targetEntity: 'PaymentProvider',
      targetEntityId: updated.id,
      beforeStateJson: sanitizeProviderForAdmin(provider),
      afterStateJson: sanitizeProviderForAdmin(updated),
      reason: `Updated payment provider ${updated.name}`,
      ipAddress,
    },
  }).catch(() => {});

  return sanitizeProviderForAdmin(updated);
}

/**
 * Decrypts provider secrets internally for payment adapter processing.
 */
export async function getDecryptedProviderConfig(name) {
  const provider = await paymentProviderRepository.findProviderByName(name);
  if (!provider || !provider.isActive) {
    return null;
  }

  return {
    id: provider.id,
    name: provider.name,
    isSandbox: provider.isSandbox,
    apiKey: provider.encryptedApiKey ? decrypt(provider.encryptedApiKey) : provider.apiKey,
    apiSecret: provider.encryptedApiSecret ? decrypt(provider.encryptedApiSecret) : provider.apiSecret,
    webhookSecret: provider.encryptedWebhookSecret ? decrypt(provider.encryptedWebhookSecret) : provider.webhookSecret,
    webhookUrl: provider.webhookUrl,
  };
}

export default {
  listPaymentProviders,
  getPaymentProviderById,
  createPaymentProvider,
  updatePaymentProvider,
  getDecryptedProviderConfig,
  sanitizeProviderForAdmin,
};
