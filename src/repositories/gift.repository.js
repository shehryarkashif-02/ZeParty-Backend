import prisma from '../config/database.js';

export async function findGifts({ page = 1, limit = 20, giftCategory, isActive, search = '' }, db = prisma) {
  const where = {};

  if (giftCategory) {
    where.giftCategory = giftCategory;
  }

  if (typeof isActive === 'boolean') {
    where.isActive = isActive;
  }

  if (search) {
    where.name = { contains: search, mode: 'insensitive' };
  }

  const skip = (page - 1) * limit;

  const [total, gifts] = await Promise.all([
    db.gift.count({ where }),
    db.gift.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    gifts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function findGiftById(id, db = prisma) {
  if (!id) return null;
  return await db.gift.findUnique({
    where: { id },
  });
}

export async function createGift(data, db = prisma) {
  const { coinValue, ...rest } = data;
  return await db.gift.create({
    data: {
      ...rest,
      coinValue: BigInt(coinValue),
    },
  });
}

export async function updateGift(id, data, db = prisma) {
  const updateData = { ...data };
  if (updateData.coinValue !== undefined) {
    updateData.coinValue = BigInt(updateData.coinValue);
  }
  return await db.gift.update({
    where: { id },
    data: updateData,
  });
}

export async function createGiftTransaction(data, db = prisma) {
  const {
    giftId,
    senderUserId,
    recipientUserId,
    roomId = null,
    giftCount = 1,
    totalCoins,
    hostDiamonds,
  } = data;

  return await db.giftTransaction.create({
    data: {
      giftId,
      senderUserId,
      recipientUserId,
      roomId,
      giftCount,
      totalCoins: BigInt(totalCoins),
      hostDiamonds: BigInt(hostDiamonds),
    },
    include: {
      gift: {
        select: { id: true, name: true, iconUrl: true, giftCategory: true },
      },
      sender: {
        select: { id: true, username: true },
      },
      recipient: {
        select: { id: true, username: true },
      },
    },
  });
}

export async function findGiftTransactions(
  { senderUserId, recipientUserId, roomId, page = 1, limit = 20 },
  db = prisma
) {
  const where = {};

  if (senderUserId) where.senderUserId = senderUserId;
  if (recipientUserId) where.recipientUserId = recipientUserId;
  if (roomId) where.roomId = roomId;

  const skip = (page - 1) * limit;

  const [total, transactions] = await Promise.all([
    db.giftTransaction.count({ where }),
    db.giftTransaction.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        gift: {
          select: { id: true, name: true, iconUrl: true, giftCategory: true },
        },
        sender: {
          select: { id: true, username: true },
        },
        recipient: {
          select: { id: true, username: true },
        },
      },
    }),
  ]);

  return {
    transactions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export default {
  findGifts,
  findGiftById,
  createGift,
  updateGift,
  createGiftTransaction,
  findGiftTransactions,
};
