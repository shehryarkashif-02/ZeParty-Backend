import prisma from '../config/database.js';
import restrictionRepository from '../repositories/restriction.repository.js';
import socketEmitter from '../socket/socket.emitter.js';
import { SOCKET_EVENTS } from '../socket/socket.constants.js';

async function logAudit(
  {
    adminId,
    adminName,
    action,
    targetEntity,
    targetEntityId,
    beforeStateJson,
    afterStateJson,
    reason,
    ipAddress,
  },
  db = prisma
) {
  try {
    if (db.auditLog?.create) {
      await db.auditLog.create({
        data: {
          adminId: adminId || null,
          adminName: adminName || (adminId ? 'Administrator' : 'System Automation'),
          action,
          targetEntity,
          targetEntityId,
          beforeStateJson: beforeStateJson || null,
          afterStateJson: afterStateJson || null,
          reason: reason || null,
          ipAddress: ipAddress || '127.0.0.1',
        },
      });
    }
  } catch (err) {
    console.error('Failed to write audit log in restriction.service:', err);
  }
}

/**
 * Applies a restriction or ban to a user or target device.
 */
export async function applyRestriction(
  {
    userId = null,
    targetId,
    type,
    reason,
    durationDays = null,
    createdByAdminId = null,
    adminName = 'Super Admin',
    ipAddress = '127.0.0.1',
  },
  db = prisma
) {
  const targetUserIdentifier = userId || targetId;

  const startsAt = new Date();
  let expiresAt = null;
  if (durationDays && Number(durationDays) > 0) {
    expiresAt = new Date(startsAt.getTime() + Number(durationDays) * 86400000);
  }

  // 1. Create Restriction record
  const restriction = await restrictionRepository.createRestriction(
    {
      userId: userId || null,
      targetId: targetId || userId,
      type,
      reason,
      startsAt,
      expiresAt,
      status: 'ACTIVE',
      createdByAdminId: createdByAdminId || null,
    },
    db
  );

  // 2. Synchronize User Account Status if BAN or SUSPEND
  let userBefore = null;
  let userAfter = null;

  if (userId || targetId) {
    const userToUpdate = userId || targetId;
    try {
      if (db.user?.findUnique) {
        userBefore = await db.user.findUnique({
          where: { id: userToUpdate },
          select: { id: true, status: true, username: true },
        });

        if (userBefore) {
          let nextStatus = null;
          if (type === 'BAN') {
            nextStatus = 'BANNED';
          }

          if (nextStatus && nextStatus !== userBefore.status) {
            userAfter = await db.user.update({
              where: { id: userToUpdate },
              data: { status: nextStatus },
              select: { id: true, status: true, username: true },
            });
          }
        }
      }
    } catch {
      // User lookup/update non-critical if target is MAC/device
    }
  }

  // 3. Write Audit Log
  await logAudit(
    {
      adminId: createdByAdminId,
      adminName,
      action: type === 'BAN' ? 'USER_BANNED' : 'USER_RESTRICTION_APPLIED',
      targetEntity: 'Restriction',
      targetEntityId: restriction.id,
      beforeStateJson: userBefore,
      afterStateJson: {
        restrictionId: restriction.id,
        targetId: restriction.targetId,
        type: restriction.type,
        reason: restriction.reason,
        expiresAt: restriction.expiresAt,
        userStatus: userAfter?.status || userBefore?.status,
      },
      reason,
      ipAddress,
    },
    db
  );

  // 4. Emit Post-Commit Realtime Event
  if (targetUserIdentifier) {
    socketEmitter.emitToUser(
      targetUserIdentifier,
      type === 'BAN' ? SOCKET_EVENTS.MODERATION_BAN : SOCKET_EVENTS.MODERATION_RESTRICTION,
      {
        restrictionId: restriction.id,
        type: restriction.type,
        reason: restriction.reason,
        expiresAt: restriction.expiresAt,
        timestamp: startsAt.toISOString(),
      }
    );
  }

  return restriction;
}

/**
 * Lifts an existing restriction.
 */
export async function liftRestriction(
  id,
  {
    liftReason = 'Administrative lifting of restriction',
    adminId = null,
    adminName = 'Super Admin',
    ipAddress = '127.0.0.1',
  } = {},
  db = prisma
) {
  const existing = await restrictionRepository.findRestrictionById(id, db);
  if (!existing) {
    const error = new Error('Restriction not found');
    error.statusCode = 404;
    error.code = 'RESTRICTION_NOT_FOUND';
    throw error;
  }

  const updated = await restrictionRepository.liftRestriction(
    id,
    {
      liftedByAdminId: adminId,
      liftReason,
    },
    db
  );

  // Restore user status if no other active BAN restrictions exist
  const targetUser = existing.userId || existing.targetId;
  if (targetUser && (existing.type === 'BAN')) {
    try {
      const remainingBans = await restrictionRepository.findActiveRestrictionByType(
        targetUser,
        'BAN',
        db
      );

      if (!remainingBans && db.user?.update) {
        await db.user.update({
          where: { id: targetUser },
          data: { status: 'ACTIVE' },
        });
      }
    } catch (err) {
      console.error('Failed to restore user status after lifting ban:', err);
    }
  }

  await logAudit(
    {
      adminId,
      adminName,
      action: 'USER_RESTRICTION_LIFTED',
      targetEntity: 'Restriction',
      targetEntityId: id,
      beforeStateJson: existing,
      afterStateJson: updated,
      reason: liftReason,
      ipAddress,
    },
    db
  );

  if (targetUser) {
    socketEmitter.emitToUser(targetUser, SOCKET_EVENTS.MODERATION_UNBAN, {
      restrictionId: id,
      type: existing.type,
      liftReason,
      timestamp: new Date().toISOString(),
    });
  }

  return updated;
}

/**
 * Dynamically evaluates whether a user has an active restriction of a given type.
 */
export async function isUserRestricted(userId, type, db = prisma) {
  if (!userId || !type) {
    return { isRestricted: false, restriction: null };
  }

  const active = await restrictionRepository.findActiveRestrictionByType(userId, type, db);
  return {
    isRestricted: Boolean(active),
    restriction: active,
  };
}

/**
 * Gets all active restrictions for a user.
 */
export async function getUserActiveRestrictions(userId, db = prisma) {
  return await restrictionRepository.findActiveRestrictionsForUser(userId, db);
}

/**
 * Lists all restrictions with filtering and pagination (Admin Portal).
 */
export async function listRestrictions(filters, db = prisma) {
  return await restrictionRepository.listRestrictions(filters, db);
}

export default {
  applyRestriction,
  liftRestriction,
  isUserRestricted,
  getUserActiveRestrictions,
  listRestrictions,
};
