import prisma from '../config/database.js';

/**
 * Registers or updates a device record for a user.
 */
export async function upsertDevice(
  {
    userId,
    deviceToken = null,
    platform = 'android',
    macAddress = null,
    deviceModel = null,
    appVersion = null,
  },
  db = prisma
) {
  if (!userId) return null;
  if (!deviceToken && !macAddress) return null;

  // Search existing device record for this user
  const existing = await db.userDevice.findFirst({
    where: {
      userId,
      OR: [
        ...(deviceToken ? [{ deviceToken }] : []),
        ...(macAddress ? [{ macAddress }] : []),
      ],
    },
  });

  if (existing) {
    return await db.userDevice.update({
      where: { id: existing.id },
      data: {
        platform: platform.toLowerCase(),
        deviceToken: deviceToken || existing.deviceToken,
        deviceModel: deviceModel || existing.deviceModel,
        appVersion: appVersion || existing.appVersion,
        isActive: true,
        lastSeenAt: new Date(),
      },
    });
  }

  return await db.userDevice.create({
    data: {
      userId,
      deviceToken,
      platform: platform.toLowerCase(),
      macAddress,
      deviceModel,
      appVersion,
      isActive: true,
      lastSeenAt: new Date(),
    },
  });
}

/**
 * Retrieves all registered devices for a user.
 */
export async function findUserDevices(userId, { activeOnly = true } = {}, db = prisma) {
  return await db.userDevice.findMany({
    where: {
      userId,
      ...(activeOnly ? { isActive: true, isBlocked: false } : {}),
    },
    orderBy: { lastSeenAt: 'desc' },
  });
}

/**
 * Retrieves active device tokens for an array of user IDs.
 */
export async function findTokensByUserIds(userIds = [], db = prisma) {
  if (!Array.isArray(userIds) || userIds.length === 0) return [];

  const devices = await db.userDevice.findMany({
    where: {
      userId: { in: userIds },
      isActive: true,
      isBlocked: false,
      deviceToken: { not: null },
    },
    select: {
      userId: true,
      deviceToken: true,
      platform: true,
    },
  });

  return devices.filter((d) => Boolean(d.deviceToken));
}

/**
 * Replaces or refreshes an FCM token for a user.
 */
export async function refreshToken(
  { userId, oldToken = null, newToken, platform = 'android', appVersion = null, deviceModel = null },
  db = prisma
) {
  if (!userId || !newToken) return null;

  // If old token provided, update the existing record
  if (oldToken) {
    const existing = await db.userDevice.findFirst({
      where: { userId, deviceToken: oldToken },
    });

    if (existing) {
      return await db.userDevice.update({
        where: { id: existing.id },
        data: {
          deviceToken: newToken,
          platform: platform.toLowerCase(),
          deviceModel: deviceModel || existing.deviceModel,
          appVersion: appVersion || existing.appVersion,
          isActive: true,
          lastSeenAt: new Date(),
        },
      });
    }
  }

  // Fallback to upsert
  return await upsertDevice(
    { userId, deviceToken: newToken, platform, appVersion, deviceModel },
    db
  );
}

/**
 * Deletes or unregisters a device for a user with IDOR protection.
 */
export async function removeDevice({ userId, deviceToken, deviceId = null }, db = prisma) {
  const where = {
    userId,
    ...(deviceId ? { id: deviceId } : { deviceToken }),
  };

  const existing = await db.userDevice.findFirst({ where });
  if (!existing) return null;

  return await db.userDevice.delete({
    where: { id: existing.id },
  });
}

/**
 * Deactivates or removes permanently invalid tokens returned by FCM.
 */
export async function cleanupInvalidTokens(tokens = [], db = prisma) {
  if (!Array.isArray(tokens) || tokens.length === 0) return { count: 0 };

  return await db.userDevice.updateMany({
    where: {
      deviceToken: { in: tokens },
    },
    data: {
      isActive: false,
      deviceToken: null,
    },
  });
}

export async function isDeviceBlocked({ deviceToken, macAddress }, db = prisma) {
  if (!deviceToken && !macAddress) return false;

  if (db.blockedDevice) {
    const blocked = await db.blockedDevice.findFirst({
      where: {
        OR: [
          ...(deviceToken ? [{ deviceToken }] : []),
        ],
      },
    });
    if (blocked) return true;
  }

  const userDeviceBlocked = await db.userDevice.findFirst({
    where: {
      isBlocked: true,
      OR: [
        ...(deviceToken ? [{ deviceToken }] : []),
        ...(macAddress ? [{ macAddress }] : []),
      ],
    },
  });

  return Boolean(userDeviceBlocked);
}

export async function isIpBlocked(ipAddress, db = prisma) {
  if (!ipAddress || !db.blockedIP) return false;

  const blocked = await db.blockedIP.findUnique({
    where: { ipAddress },
  });

  return Boolean(blocked);
}

export default {
  upsertDevice,
  findUserDevices,
  findTokensByUserIds,
  refreshToken,
  removeDevice,
  cleanupInvalidTokens,
  isDeviceBlocked,
  isIpBlocked,
};
