import deviceRepository from '../repositories/device.repository.js';
import prisma from '../config/database.js';

/**
 * Registers an active device token for a user.
 */
export async function registerDevice(
  { userId, deviceToken, platform = 'android', appVersion = null, deviceModel = null, macAddress = null },
  db = prisma
) {
  if (!userId) {
    const error = new Error('Authentication required for device registration');
    error.statusCode = 401;
    error.code = 'UNAUTHORIZED';
    throw error;
  }

  if (!deviceToken && !macAddress) {
    const error = new Error('Device token or MAC address is required');
    error.statusCode = 400;
    error.code = 'DEVICE_TOKEN_REQUIRED';
    throw error;
  }

  // Check if device or IP is blocked
  const isBlocked = await deviceRepository.isDeviceBlocked({ deviceToken, macAddress }, db);
  if (isBlocked) {
    const error = new Error('This device is blocked from accessing the service');
    error.statusCode = 403;
    error.code = 'DEVICE_BLOCKED';
    throw error;
  }

  return await deviceRepository.upsertDevice(
    {
      userId,
      deviceToken,
      platform,
      appVersion,
      deviceModel,
      macAddress,
    },
    db
  );
}

/**
 * Refreshes an FCM device registration token.
 */
export async function refreshToken(
  { userId, oldToken = null, newToken, platform = 'android', appVersion = null, deviceModel = null },
  db = prisma
) {
  if (!userId) {
    const error = new Error('Authentication required for token refresh');
    error.statusCode = 401;
    error.code = 'UNAUTHORIZED';
    throw error;
  }

  if (!newToken || typeof newToken !== 'string' || newToken.trim() === '') {
    const error = new Error('New device token is required');
    error.statusCode = 400;
    error.code = 'NEW_TOKEN_REQUIRED';
    throw error;
  }

  return await deviceRepository.refreshToken(
    {
      userId,
      oldToken,
      newToken,
      platform,
      appVersion,
      deviceModel,
    },
    db
  );
}

/**
 * Removes / unregisters a device with IDOR protection.
 */
export async function removeDevice({ userId, deviceToken, deviceId = null }, db = prisma) {
  if (!userId) {
    const error = new Error('Authentication required');
    error.statusCode = 401;
    error.code = 'UNAUTHORIZED';
    throw error;
  }

  const removed = await deviceRepository.removeDevice({ userId, deviceToken, deviceId }, db);
  if (!removed) {
    const error = new Error('Device registration not found or not owned by user');
    error.statusCode = 404;
    error.code = 'DEVICE_NOT_FOUND';
    throw error;
  }

  return { success: true, message: 'Device unregistered successfully' };
}

/**
 * Lists all active devices for a user.
 */
export async function getUserDevices(userId, db = prisma) {
  if (!userId) return [];
  return await deviceRepository.findUserDevices(userId, { activeOnly: true }, db);
}

/**
 * Deactivates invalid / expired tokens returned by FCM.
 */
export async function cleanupInvalidTokens(tokens = [], db = prisma) {
  return await deviceRepository.cleanupInvalidTokens(tokens, db);
}

export default {
  registerDevice,
  refreshToken,
  removeDevice,
  getUserDevices,
  cleanupInvalidTokens,
};
