import prisma from '../config/database.js';

export async function findAgencyById(id, db = prisma) {
  if (!id) return null;
  return await db.agency.findUnique({
    where: { id },
    include: {
      owner: {
        select: {
          id: true,
          username: true,
          email: true,
          phone: true,
          profile: true,
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
      _count: {
        select: {
          hosts: true,
          members: true,
        },
      },
    },
  });
}

export async function findAgencyByCode(agencyCode, db = prisma) {
  if (!agencyCode) return null;
  return await db.agency.findUnique({
    where: { agencyCode },
    include: {
      owner: {
        select: { id: true, username: true, email: true },
      },
      _count: {
        select: { hosts: true, members: true },
      },
    },
  });
}

export async function findAgencies(
  { page = 1, limit = 20, search = '', status, agencyType, bdCenterId },
  db = prisma
) {
  const where = {};
  if (status) where.status = status;
  if (agencyType) where.agencyType = agencyType;
  if (bdCenterId) where.bdCenterId = bdCenterId;

  if (search) {
    where.OR = [
      { agencyName: { contains: search, mode: 'insensitive' } },
      { agencyCode: { contains: search, mode: 'insensitive' } },
      { owner: { username: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const skip = (page - 1) * limit;
  const [agencies, totalCount] = await Promise.all([
    db.agency.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            email: true,
            profile: true,
          },
        },
        bdCenter: {
          select: {
            id: true,
            centerName: true,
            regionCode: true,
          },
        },
        _count: {
          select: {
            hosts: true,
            members: true,
          },
        },
      },
    }),
    db.agency.count({ where }),
  ]);

  return {
    agencies,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit) || 1,
    },
  };
}

export async function createAgency(data, db = prisma) {
  return await db.agency.create({
    data: {
      agencyName: data.agencyName,
      agencyCode: data.agencyCode,
      agencyType: data.agencyType || 'LIVE_AGENCY',
      ownerUserId: data.ownerUserId,
      commissionRate: data.commissionRate !== undefined ? data.commissionRate : 20.0,
      status: data.status || 'ACTIVE',
      bdCenterId: data.bdCenterId || null,
    },
  });
}

export async function updateAgency(id, data, db = prisma) {
  return await db.agency.update({
    where: { id },
    data,
  });
}

export async function findAgencyMembers(agencyId, { page = 1, limit = 20 } = {}, db = prisma) {
  const skip = (page - 1) * limit;
  const [members, totalCount] = await Promise.all([
    db.agencyMember.findMany({
      where: { agencyId },
      skip,
      take: limit,
      orderBy: { joinedAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            profile: true,
          },
        },
        hostProfile: true,
      },
    }),
    db.agencyMember.count({ where: { agencyId } }),
  ]);

  return {
    members,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit) || 1,
    },
  };
}

export async function findMember(agencyId, userId, db = prisma) {
  return await db.agencyMember.findUnique({
    where: {
      agencyId_userId: {
        agencyId,
        userId,
      },
    },
  });
}

export async function addMember(data, db = prisma) {
  return await db.agencyMember.create({
    data: {
      agencyId: data.agencyId,
      userId: data.userId,
      hostProfileId: data.hostProfileId || null,
    },
  });
}

export async function removeMember(agencyId, userId, db = prisma) {
  return await db.agencyMember.delete({
    where: {
      agencyId_userId: {
        agencyId,
        userId,
      },
    },
  });
}

export async function transferHostMembership(hostProfileId, fromAgencyId, toAgencyId, userId, db = prisma) {
  // Remove old membership if exists
  if (fromAgencyId) {
    await db.agencyMember.deleteMany({
      where: {
        agencyId: fromAgencyId,
        userId,
      },
    });
  }

  // Create new membership in target agency
  const newMember = await db.agencyMember.create({
    data: {
      agencyId: toAgencyId,
      userId,
      hostProfileId,
    },
  });

  // Update HostProfile pointer
  await db.hostProfile.update({
    where: { id: hostProfileId },
    data: { agencyId: toAgencyId },
  });

  return newMember;
}

export default {
  findAgencyById,
  findAgencyByCode,
  findAgencies,
  createAgency,
  updateAgency,
  findAgencyMembers,
  findMember,
  addMember,
  removeMember,
  transferHostMembership,
};
