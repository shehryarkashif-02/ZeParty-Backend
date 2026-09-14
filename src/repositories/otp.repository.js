import prisma from '../config/database.js';

export async function createOtp({ destination, codeHash, purpose, expiresAt }, db = prisma) {
  return await db.oTPVerification.create({
    data: {
      destination,
      codeHash,
      purpose,
      expiresAt,
      isUsed: false,
      attempts: 0,
    },
  });
}

export async function findActiveOtp({ destination, purpose }, db = prisma) {
  return await db.oTPVerification.findFirst({
    where: {
      destination,
      purpose,
      isUsed: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function incrementAttempts(otpId, db = prisma) {
  return await db.oTPVerification.update({
    where: { id: otpId },
    data: { attempts: { increment: 1 } },
  });
}

export async function markConsumed(otpId, db = prisma) {
  return await db.oTPVerification.update({
    where: { id: otpId },
    data: {
      isUsed: true,
      verifiedAt: new Date(),
    },
  });
}

export default {
  createOtp,
  findActiveOtp,
  incrementAttempts,
  markConsumed,
};
