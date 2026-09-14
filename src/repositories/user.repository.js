import prisma from '../config/database.js';

export async function findByPhone(phone, db = prisma) {
  if (!phone) return null;
  return await db.user.findUnique({
    where: { phone },
    include: {
      profile: true,
      wallet: true,
      hostProfile: true,
    },
  });
}

export async function findById(id, db = prisma) {
  if (!id) return null;
  return await db.user.findUnique({
    where: { id },
    include: {
      profile: true,
      wallet: true,
      hostProfile: true,
    },
  });
}

export async function findByEmail(email, db = prisma) {
  if (!email) return null;
  return await db.user.findUnique({
    where: { email },
    include: {
      profile: true,
      wallet: true,
    },
  });
}

export async function findByUsername(username, db = prisma) {
  if (!username) return null;
  return await db.user.findUnique({
    where: { username },
  });
}

/**
 * Creates a new User and associated UserProfile and Wallet in a single transaction.
 */
export async function createUserWithProfile(
  { phone, email = null, username, status = 'ACTIVE', userType = 'USER', countryCode = 'US' },
  db = prisma
) {
  return await db.user.create({
    data: {
      phone,
      email,
      username,
      status,
      userType,
      countryCode,
      profile: {
        create: {
          displayName: username,
        },
      },
      wallet: {
        create: {
          coinBalance: 0n,
          diamondBalance: 0n,
        },
      },
    },
    include: {
      profile: true,
      wallet: true,
    },
  });
}

export async function updateLastLogin(userId, db = prisma) {
  return await db.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });
}

export async function findUsersPaginated(
  {
    page = 1,
    limit = 20,
    search = null,
    status = null,
    userType = null,
    countryCode = null,
    createdFrom = null,
    createdTo = null,
  } = {},
  db = prisma
) {
  const where = {};

  if (status) {
    where.status = status;
  }
  if (userType) {
    where.userType = userType;
  }
  if (countryCode) {
    where.countryCode = countryCode;
  }
  if (createdFrom || createdTo) {
    where.createdAt = {};
    if (createdFrom) where.createdAt.gte = new Date(createdFrom);
    if (createdTo) where.createdAt.lte = new Date(createdTo);
  }

  if (search && search.trim() !== '') {
    const s = search.trim();
    where.OR = [
      { username: { contains: s, mode: 'insensitive' } },
      { phone: { contains: s, mode: 'insensitive' } },
      { email: { contains: s, mode: 'insensitive' } },
      { profile: { displayName: { contains: s, mode: 'insensitive' } } },
    ];
  }

  // Authoritatively exclude Owner and Admin identities from normal User Management
  const allAdmins = await db.admin.findMany({
    select: { id: true, email: true, username: true, isOwner: true },
  });
  const adminIds = allAdmins.map((a) => a.id);
  const adminEmails = allAdmins.map((a) => a.email).filter(Boolean);
  const adminUsernames = allAdmins.map((a) => a.username).filter(Boolean);
  const shadowUsernames = adminUsernames.map((u) => `admin_${u}`);

  where.NOT = [
    ...(where.NOT ? (Array.isArray(where.NOT) ? where.NOT : [where.NOT]) : []),
    { id: { in: adminIds } },
    { email: { in: adminEmails } },
    { username: { in: [...adminUsernames, ...shadowUsernames] } },
    { username: { startsWith: 'admin_' } },
    { username: { startsWith: 'rootowner' } },
    { email: { endsWith: '@zeparty.app', contains: 'owner' } },
  ];

  const parsedPage = Math.max(1, Number(page) || 1);
  const parsedLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  const skip = (parsedPage - 1) * parsedLimit;

  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      skip,
      take: parsedLimit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        firebaseUid: true,
        phone: true,
        email: true,
        username: true,
        status: true,
        userType: true,
        countryCode: true,
        avatarUrl: true,
        bio: true,
        gender: true,
        dob: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        profile: {
          select: {
            id: true,
            displayName: true,
            level: true,
            vipLevel: true,
            svipLevel: true,
            nobleRank: true,
          },
        },
        wallet: {
          select: {
            id: true,
            coinBalance: true,
            diamondBalance: true,
            sellerBalanceCoins: true,
          },
        },
        hostProfile: {
          select: {
            id: true,
            hostType: true,
            hostStatus: true,
            hostLevel: true,
          },
        },
      },
    }),
  ]);

  return {
    users,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit),
    },
  };
}

export async function findUserDetailsById(id, db = prisma) {
  if (!id) return null;

  // Protect Owner and Admin accounts from normal user detail inspection
  const adminRecord = await db.admin.findFirst({
    where: { id },
  });
  if (adminRecord) return null;

  return await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      firebaseUid: true,
      phone: true,
      email: true,
      username: true,
      status: true,
      userType: true,
      countryCode: true,
      avatarUrl: true,
      bio: true,
      gender: true,
      dob: true,
      isUnderageBlocked: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      profile: true,
      wallet: true,
      hostProfile: {
        include: {
          agency: {
            select: {
              id: true,
              agencyName: true,
              agencyCode: true,
              status: true,
            },
          },
        },
      },
      ownedAgencies: {
        select: {
          id: true,
          agencyName: true,
          agencyCode: true,
          status: true,
        },
      },
      managedBDCenters: {
        select: {
          id: true,
          centerName: true,
          regionCode: true,
          currentTier: true,
        },
      },
      coinSeller: true,
      merchant: {
        select: {
          id: true,
          companyName: true,
          monthlyQuotaCoins: true,
          totalSpentUSD: true,
          status: true,
        },
      },
      sessions: {
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          ipAddress: true,
          userAgent: true,
          expiresAt: true,
          revokedAt: true,
          createdAt: true,
        },
      },
      devices: {
        take: 5,
        orderBy: { lastSeenAt: 'desc' },
        select: {
          id: true,
          platform: true,
          deviceModel: true,
          appVersion: true,
          isBlocked: true,
          lastSeenAt: true,
        },
      },
    },
  });
}

export async function updateUserStatus(id, status, db = prisma) {
  return await db.user.update({
    where: { id },
    data: { status },
    select: {
      id: true,
      username: true,
      status: true,
      updatedAt: true,
    },
  });
}

export async function updateUserProfile(
  userId,
  { displayName, bio, gender, dob, avatarUrl, signature, countryCode },
  db = prisma
) {
  const userUpdateData = {};
  if (bio !== undefined) userUpdateData.bio = bio;
  if (gender !== undefined) userUpdateData.gender = gender;
  if (dob !== undefined) userUpdateData.dob = dob ? new Date(dob) : null;
  if (avatarUrl !== undefined) userUpdateData.avatarUrl = avatarUrl;
  if (countryCode !== undefined) userUpdateData.countryCode = countryCode;

  const profileUpdateData = {};
  if (displayName !== undefined) profileUpdateData.displayName = displayName;
  if (signature !== undefined) profileUpdateData.signature = signature;

  return await db.$transaction(async (tx) => {
    if (Object.keys(userUpdateData).length > 0) {
      await tx.user.update({
        where: { id: userId },
        data: userUpdateData,
      });
    }

    if (Object.keys(profileUpdateData).length > 0) {
      await tx.userProfile.upsert({
        where: { userId },
        create: {
          userId,
          displayName: profileUpdateData.displayName || null,
          signature: profileUpdateData.signature || null,
        },
        update: profileUpdateData,
      });
    }

    return await tx.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        wallet: true,
        hostProfile: true,
      },
    });
  });
}

export async function findPublicProfileById(id, db = prisma) {
  if (!id) return null;
  return await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      avatarUrl: true,
      bio: true,
      gender: true,
      countryCode: true,
      userType: true,
      createdAt: true,
      profile: {
        select: {
          displayName: true,
          level: true,
          vipLevel: true,
          svipLevel: true,
          nobleRank: true,
          signature: true,
        },
      },
      hostProfile: {
        select: {
          hostType: true,
          hostLevel: true,
          hostStatus: true,
        },
      },
    },
  });
}

export default {
  findByPhone,
  findById,
  findUserById: findById,
  findByEmail,
  findByUsername,
  createUserWithProfile,
  updateLastLogin,
  findUsersPaginated,
  findUserDetailsById,
  updateUserStatus,
  updateUserProfile,
  findPublicProfileById,
};

