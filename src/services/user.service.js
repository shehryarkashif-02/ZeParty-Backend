import prisma from '../config/database.js';
import userRepository from '../repositories/user.repository.js';

async function logAudit(
  { adminId, adminName, action, targetEntity, targetEntityId, beforeStateJson, afterStateJson, reason, ipAddress },
  db = prisma
) {
  try {
    await db.auditLog.create({
      data: {
        adminId: adminId || 'SYSTEM',
        adminName: adminName || 'System',
        action,
        targetEntity,
        targetEntityId: targetEntityId || null,
        beforeStateJson: beforeStateJson ? JSON.parse(JSON.stringify(beforeStateJson)) : null,
        afterStateJson: afterStateJson ? JSON.parse(JSON.stringify(afterStateJson)) : null,
        reason: reason || null,
        ipAddress: ipAddress || '127.0.0.1',
      },
    });
  } catch (err) {
    console.error('Failed to write audit log in user.service:', err);
  }
}

export async function listUsersForAdmin(filters, db = prisma) {
  return await userRepository.findUsersPaginated(filters, db);
}

export async function getUserDetailsForAdmin(userId, db = prisma) {
  const user = await userRepository.findUserDetailsById(userId, db);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }
  return user;
}

export async function updateUserStatusByAdmin(
  userId,
  { status, reason, adminId, adminName, ipAddress },
  db = prisma
) {
  const existingUser = await userRepository.findById(userId, db);
  if (!existingUser) {
    const error = new Error('User not found');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  const beforeState = {
    id: existingUser.id,
    username: existingUser.username,
    status: existingUser.status,
  };

  const updatedUser = await userRepository.updateUserStatus(userId, status, db);

  const afterState = {
    id: updatedUser.id,
    username: updatedUser.username,
    status: updatedUser.status,
  };

  await logAudit(
    {
      adminId,
      adminName,
      action: `USER_STATUS_${status}`,
      targetEntity: 'User',
      targetEntityId: userId,
      beforeStateJson: beforeState,
      afterStateJson: afterState,
      reason,
      ipAddress,
    },
    db
  );

  return updatedUser;
}

export async function getSelfProfile(userId, db = prisma) {
  const user = await userRepository.findById(userId, db);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }
  return user;
}

export async function updateSelfProfile(userId, profileData, db = prisma) {
  const existingUser = await userRepository.findById(userId, db);
  if (!existingUser) {
    const error = new Error('User not found');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  return await userRepository.updateUserProfile(userId, profileData, db);
}

export async function getPublicProfile(userId, db = prisma) {
  const publicUser = await userRepository.findPublicProfileById(userId, db);
  if (!publicUser) {
    const error = new Error('User not found');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }
  return publicUser;
}

export default {
  listUsersForAdmin,
  getUserDetailsForAdmin,
  updateUserStatusByAdmin,
  getSelfProfile,
  updateSelfProfile,
  getPublicProfile,
};
