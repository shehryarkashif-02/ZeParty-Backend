import prisma from '../config/database.js';

export async function findMerchantById(id, db = prisma) {
  if (!id) return null;
  return await db.merchant.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          profile: true,
        },
      },
    },
  });
}

export async function findMerchantByUserId(userId, db = prisma) {
  if (!userId) return null;
  return await db.merchant.findUnique({
    where: { userId },
  });
}

export async function findMerchantByApiKeyHash(apiKeyHash, db = prisma) {
  if (!apiKeyHash) return null;
  return await db.merchant.findUnique({
    where: { apiKeyHash },
  });
}

export async function findMerchants(
  { page = 1, limit = 20, search = '', status },
  db = prisma
) {
  const where = {};
  if (status) where.status = status;

  if (search) {
    where.OR = [
      { companyName: { contains: search, mode: 'insensitive' } },
      { user: { username: { contains: search, mode: 'insensitive' } } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const skip = (page - 1) * limit;
  const [merchants, totalCount] = await Promise.all([
    db.merchant.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            profile: true,
          },
        },
      },
    }),
    db.merchant.count({ where }),
  ]);

  return {
    merchants,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit) || 1,
    },
  };
}

export async function createMerchant(data, db = prisma) {
  return await db.merchant.create({
    data: {
      userId: data.userId,
      companyName: data.companyName,
      apiKeyHash: data.apiKeyHash,
      apiSecretHash: data.apiSecretHash,
      monthlyQuotaCoins: BigInt(data.monthlyQuotaCoins || 1000000),
      totalSpentUSD: data.totalSpentUSD !== undefined ? data.totalSpentUSD : 0.00,
      status: data.status || 'ACTIVE',
    },
  });
}

export async function updateMerchant(id, data, db = prisma) {
  const updateData = { ...data };
  if (updateData.monthlyQuotaCoins !== undefined) {
    updateData.monthlyQuotaCoins = BigInt(updateData.monthlyQuotaCoins);
  }
  return await db.merchant.update({
    where: { id },
    data: updateData,
  });
}

export default {
  findMerchantById,
  findMerchantByUserId,
  findMerchantByApiKeyHash,
  findMerchants,
  createMerchant,
  updateMerchant,
};
