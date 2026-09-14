import prisma from '../config/database.js';

export async function findSellerById(id, db = prisma) {
  if (!id) return null;
  return await db.coinSeller.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          phone: true,
          status: true,
          profile: true,
          wallet: true,
        },
      },
    },
  });
}

export async function findSellerByUserId(userId, db = prisma) {
  if (!userId) return null;
  return await db.coinSeller.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          profile: true,
          wallet: true,
        },
      },
    },
  });
}

export async function findSellers(
  { page = 1, limit = 20, search = '', sellerStatus },
  db = prisma
) {
  const where = {};
  if (sellerStatus) where.sellerStatus = sellerStatus;

  if (search) {
    where.OR = [
      { businessName: { contains: search, mode: 'insensitive' } },
      { user: { username: { contains: search, mode: 'insensitive' } } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const skip = (page - 1) * limit;
  const [sellers, totalCount] = await Promise.all([
    db.coinSeller.findMany({
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
            wallet: {
              select: {
                sellerBalanceCoins: true,
                coinBalance: true,
              },
            },
          },
        },
      },
    }),
    db.coinSeller.count({ where }),
  ]);

  return {
    sellers,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit) || 1,
    },
  };
}

export async function createSeller(data, db = prisma) {
  return await db.coinSeller.create({
    data: {
      userId: data.userId,
      businessName: data.businessName,
      profitMarginPercent: data.profitMarginPercent !== undefined ? data.profitMarginPercent : 10.0,
      creditLimitUSD: data.creditLimitUSD !== undefined ? data.creditLimitUSD : 1000.00,
      sellerStatus: data.sellerStatus || 'ACTIVE',
      resellerBalanceCoins: BigInt(data.resellerBalanceCoins || 0),
    },
  });
}

export async function updateSeller(id, data, db = prisma) {
  const updateData = { ...data };
  if (updateData.resellerBalanceCoins !== undefined) {
    updateData.resellerBalanceCoins = BigInt(updateData.resellerBalanceCoins);
  }
  return await db.coinSeller.update({
    where: { id },
    data: updateData,
  });
}

export async function updateSellerBalance(id, amountDelta, db = prisma) {
  return await db.coinSeller.update({
    where: { id },
    data: {
      resellerBalanceCoins: { increment: BigInt(amountDelta) },
    },
  });
}

export default {
  findSellerById,
  findSellerByUserId,
  findSellers,
  createSeller,
  updateSeller,
  updateSellerBalance,
};
