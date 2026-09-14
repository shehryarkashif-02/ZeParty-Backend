import prisma from '../config/database.js';

export async function findBDCenterById(id, db = prisma) {
  if (!id) return null;
  return await db.bDCenter.findUnique({
    where: { id },
    include: {
      manager: {
        select: {
          id: true,
          username: true,
          email: true,
          profile: true,
        },
      },
      agencies: {
        select: {
          id: true,
          agencyName: true,
          agencyCode: true,
          status: true,
          _count: {
            select: { hosts: true, members: true },
          },
        },
      },
      _count: {
        select: {
          agencies: true,
          hosts: true,
          invites: true,
        },
      },
    },
  });
}

export async function findBDCenters(
  { page = 1, limit = 20, search = '', regionCode, currentTier },
  db = prisma
) {
  const where = {};
  if (regionCode) where.regionCode = regionCode;
  if (currentTier) where.currentTier = currentTier;

  if (search) {
    where.OR = [
      { centerName: { contains: search, mode: 'insensitive' } },
      { regionCode: { contains: search, mode: 'insensitive' } },
      { manager: { username: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const skip = (page - 1) * limit;
  const [centers, totalCount] = await Promise.all([
    db.bDCenter.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        manager: {
          select: {
            id: true,
            username: true,
            email: true,
            profile: true,
          },
        },
        _count: {
          select: {
            agencies: true,
            hosts: true,
          },
        },
      },
    }),
    db.bDCenter.count({ where }),
  ]);

  return {
    centers,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit) || 1,
    },
  };
}

export async function createBDCenter(data, db = prisma) {
  return await db.bDCenter.create({
    data: {
      centerName: data.centerName,
      regionCode: data.regionCode || 'US',
      managerUserId: data.managerUserId,
      currentTier: data.currentTier || 'BRONZE',
      baseSalaryUSD: data.baseSalaryUSD !== undefined ? data.baseSalaryUSD : 500.00,
    },
  });
}

export async function updateBDCenter(id, data, db = prisma) {
  return await db.bDCenter.update({
    where: { id },
    data,
  });
}

export async function findInviteByCode(invitationCode, db = prisma) {
  if (!invitationCode) return null;
  return await db.bDInvite.findUnique({
    where: { invitationCode },
    include: {
      bdCenter: true,
      targetUser: {
        select: {
          id: true,
          username: true,
          email: true,
        },
      },
    },
  });
}

export async function findInviteById(id, db = prisma) {
  if (!id) return null;
  return await db.bDInvite.findUnique({
    where: { id },
    include: {
      bdCenter: true,
      targetUser: true,
    },
  });
}

export async function findPendingInvite(bdCenterId, targetUserId, db = prisma) {
  return await db.bDInvite.findFirst({
    where: {
      bdCenterId,
      targetUserId,
      status: 'PENDING',
    },
  });
}

export async function createInvite(data, db = prisma) {
  return await db.bDInvite.create({
    data: {
      bdCenterId: data.bdCenterId,
      targetUserId: data.targetUserId,
      invitationCode: data.invitationCode,
      status: 'PENDING',
    },
  });
}

export async function updateInvite(id, data, db = prisma) {
  return await db.bDInvite.update({
    where: { id },
    data,
  });
}

export async function findInvitesByCenter(bdCenterId, { page = 1, limit = 20 } = {}, db = prisma) {
  const skip = (page - 1) * limit;
  const [invites, totalCount] = await Promise.all([
    db.bDInvite.findMany({
      where: { bdCenterId },
      skip,
      take: limit,
      orderBy: { sentAt: 'desc' },
      include: {
        targetUser: {
          select: {
            id: true,
            username: true,
            email: true,
            profile: true,
          },
        },
      },
    }),
    db.bDInvite.count({ where: { bdCenterId } }),
  ]);

  return {
    invites,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit) || 1,
    },
  };
}

export async function calculateGroupDiamonds(bdCenterId, db = prisma) {
  // Sum diamonds from directly bound hosts
  const directHostsSum = await db.hostProfile.aggregate({
    where: { bdCenterId },
    _sum: { totalDiamondsEarnedMonth: true },
  });

  // Sum diamonds from hosts bound to agencies under this BD Center
  const agencyHostsSum = await db.hostProfile.aggregate({
    where: {
      agency: {
        bdCenterId,
      },
      // Exclude hosts directly bound to avoid double count if both set
      NOT: { bdCenterId },
    },
    _sum: { totalDiamondsEarnedMonth: true },
  });

  const direct = directHostsSum._sum.totalDiamondsEarnedMonth || 0n;
  const agency = agencyHostsSum._sum.totalDiamondsEarnedMonth || 0n;
  return direct + agency;
}

export default {
  findBDCenterById,
  findBDCenters,
  createBDCenter,
  updateBDCenter,
  findInviteByCode,
  findInviteById,
  findPendingInvite,
  createInvite,
  updateInvite,
  findInvitesByCenter,
  calculateGroupDiamonds,
};
