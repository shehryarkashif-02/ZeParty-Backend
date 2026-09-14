import prisma from '../config/database.js';

export async function findModuleAccessByAdminId(adminId, db = prisma) {
  if (!adminId) return [];
  return await db.adminModuleAccess.findMany({
    where: { adminId },
  });
}

export async function setModuleAccess(adminId, modules, grantedBy, db = prisma) {
  if (!adminId) return [];
  return await db.$transaction(async (tx) => {
    await tx.adminModuleAccess.deleteMany({
      where: { adminId },
    });
    if (modules && modules.length > 0) {
      await tx.adminModuleAccess.createMany({
        data: modules.map((module) => ({
          adminId,
          module,
          grantedBy,
        })),
      });
    }
    return await tx.adminModuleAccess.findMany({
      where: { adminId },
    });
  });
}

export async function findOwnerGrantsByAdminId(adminId, status = 'ACTIVE', db = prisma) {
  if (!adminId) return [];
  const whereClause = { adminId };
  if (status) {
    whereClause.status = status;
  }
  return await db.ownerGrant.findMany({
    where: whereClause,
  });
}

export async function createOwnerGrant(grantData, db = prisma) {
  return await db.ownerGrant.create({
    data: grantData,
  });
}

export async function revokeOwnerGrant(grantId, revokedBy, db = prisma) {
  return await db.ownerGrant.update({
    where: { id: grantId },
    data: {
      status: 'REVOKED',
      revokedBy,
      revokedAt: new Date(),
    },
  });
}

export default {
  findModuleAccessByAdminId,
  setModuleAccess,
  findOwnerGrantsByAdminId,
  createOwnerGrant,
  revokeOwnerGrant,
};
