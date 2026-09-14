import prisma from '../config/database.js';

export async function findHostProfileById(id, db = prisma) {
  if (!id) return null;
  return await db.hostProfile.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          phone: true,
          userType: true,
          status: true,
          profile: true,
        },
      },
      agency: {
        select: {
          id: true,
          agencyName: true,
          agencyCode: true,
          agencyType: true,
          commissionRate: true,
          status: true,
        },
      },
      bdCenter: {
        select: {
          id: true,
          centerName: true,
          regionCode: true,
          currentTier: true,
        },
      },
    },
  });
}

export async function findHostProfileByUserId(userId, db = prisma) {
  if (!userId) return null;
  return await db.hostProfile.findUnique({
    where: { userId },
    include: {
      agency: true,
      bdCenter: true,
    },
  });
}

export async function findHostProfiles(
  { page = 1, limit = 20, search = '', status, hostType, agencyId, bdCenterId },
  db = prisma
) {
  const where = {};
  if (status) where.hostStatus = status;
  if (hostType) where.hostType = hostType;
  if (agencyId) where.agencyId = agencyId;
  if (bdCenterId) where.bdCenterId = bdCenterId;

  if (search) {
    where.OR = [
      { user: { username: { contains: search, mode: 'insensitive' } } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
      { agency: { agencyName: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const skip = (page - 1) * limit;
  const [hosts, totalCount] = await Promise.all([
    db.hostProfile.findMany({
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
            userType: true,
            status: true,
            profile: true,
          },
        },
        agency: {
          select: {
            id: true,
            agencyName: true,
            agencyCode: true,
          },
        },
        bdCenter: {
          select: {
            id: true,
            centerName: true,
            regionCode: true,
          },
        },
      },
    }),
    db.hostProfile.count({ where }),
  ]);

  return {
    hosts,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit) || 1,
    },
  };
}

export async function createHostProfile(data, db = prisma) {
  return await db.hostProfile.create({
    data: {
      userId: data.userId,
      hostType: data.hostType || 'LIVE_HOST',
      hostStatus: data.hostStatus || 'ACTIVE',
      hostLevel: data.hostLevel || 1,
      agencyId: data.agencyId || null,
      bdCenterId: data.bdCenterId || null,
    },
  });
}

export async function updateHostProfile(id, data, db = prisma) {
  return await db.hostProfile.update({
    where: { id },
    data,
  });
}

export async function updateHostPerformance(
  id,
  { liveHoursDelta = 0, diamondsDelta = 0n, targetDaysDelta = 0 },
  db = prisma
) {
  return await db.hostProfile.update({
    where: { id },
    data: {
      totalLiveHoursMonth: { increment: liveHoursDelta },
      totalDiamondsEarnedMonth: { increment: BigInt(diamondsDelta) },
      targetDaysAchieved: { increment: targetDaysDelta },
    },
  });
}

export async function findApplicationById(id, db = prisma) {
  if (!id) return null;
  return await db.hostApplication.findUnique({
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

export async function findPendingApplicationByUserId(userId, db = prisma) {
  if (!userId) return null;
  return await db.hostApplication.findFirst({
    where: {
      userId,
      status: 'APPLIED',
    },
  });
}

export async function findApplications(
  { page = 1, limit = 20, status, hostType },
  db = prisma
) {
  const where = {};
  if (status) where.status = status;
  if (hostType) where.hostType = hostType;

  const skip = (page - 1) * limit;
  const [applications, totalCount] = await Promise.all([
    db.hostApplication.findMany({
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
    db.hostApplication.count({ where }),
  ]);

  return {
    applications,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit) || 1,
    },
  };
}

export async function createApplication(data, db = prisma) {
  return await db.hostApplication.create({
    data: {
      userId: data.userId,
      hostType: data.hostType,
      idCardFrontUrl: data.idCardFrontUrl,
      idCardBackUrl: data.idCardBackUrl,
      videoSampleUrl: data.videoSampleUrl || null,
      status: 'APPLIED',
    },
  });
}

export async function updateApplication(id, data, db = prisma) {
  return await db.hostApplication.update({
    where: { id },
    data,
  });
}

export async function findHostLevelConfigs(hostType, db = prisma) {
  const where = hostType ? { hostType } : {};
  return await db.hostLevelConfig.findMany({
    where,
    orderBy: { level: 'asc' },
  });
}

export async function findHostLevelConfig(level, hostType, db = prisma) {
  return await db.hostLevelConfig.findUnique({
    where: {
      level_hostType: {
        level,
        hostType,
      },
    },
  });
}

export default {
  findHostProfileById,
  findHostProfileByUserId,
  findHostProfiles,
  createHostProfile,
  updateHostProfile,
  updateHostPerformance,
  findApplicationById,
  findPendingApplicationByUserId,
  findApplications,
  createApplication,
  updateApplication,
  findHostLevelConfigs,
  findHostLevelConfig,
};
