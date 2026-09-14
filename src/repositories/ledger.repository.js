import prisma from '../config/database.js';

/**
 * Creates an immutable append-only ledger entry in WalletLedger.
 */
export async function createEntry(
  {
    walletId,
    transactionType,
    coinDelta = 0n,
    diamondDelta = 0n,
    usdDelta = 0.0,
    balanceBefore,
    balanceAfter,
    referenceId = null,
  },
  db = prisma
) {
  return await db.walletLedger.create({
    data: {
      walletId,
      transactionType,
      coinDelta: BigInt(coinDelta),
      diamondDelta: BigInt(diamondDelta),
      usdDelta,
      balanceBefore,
      balanceAfter,
      referenceId,
    },
  });
}

/**
 * Retrieves paginated ledger history for a specific wallet.
 */
export async function findByWalletId(
  walletId,
  { page = 1, limit = 20, type = null },
  db = prisma
) {
  const where = { walletId };
  if (type) where.transactionType = type;

  const skip = (Math.max(1, page) - 1) * limit;

  return await db.walletLedger.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit,
  });
}

/**
 * Counts ledger records for a specific wallet.
 */
export async function countByWalletId(walletId, { type = null }, db = prisma) {
  const where = { walletId };
  if (type) where.transactionType = type;
  return await db.walletLedger.count({ where });
}

/**
 * Retrieves master transaction ledger for administrative audits.
 */
export async function findAll(
  { page = 1, limit = 20, type, userId, referenceId, startDate, endDate },
  db = prisma
) {
  const where = {};
  if (type) where.transactionType = type;
  if (referenceId) where.referenceId = referenceId;
  if (userId) where.wallet = { userId };

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const skip = (Math.max(1, page) - 1) * limit;

  return await db.walletLedger.findMany({
    where,
    include: {
      wallet: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              userType: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit,
  });
}

/**
 * Counts total entries matching master ledger filters.
 */
export async function countAll(
  { type, userId, referenceId, startDate, endDate },
  db = prisma
) {
  const where = {};
  if (type) where.transactionType = type;
  if (referenceId) where.referenceId = referenceId;
  if (userId) where.wallet = { userId };

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  return await db.walletLedger.count({ where });
}

export default {
  createEntry,
  findByWalletId,
  countByWalletId,
  findAll,
  countAll,
};
