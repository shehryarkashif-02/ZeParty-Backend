import prisma from '../config/database.js';
import moderationRepository from '../repositories/moderation.repository.js';
import restrictionService from './restriction.service.js';
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
    console.error('Failed to write audit log in moderation.service:', err);
  }
}

/**
 * Executes an authoritative moderation action on a user account.
 */
export async function moderateUser(
  {
    targetUserId,
    action, // "WARN", "MUTE", "TEMP_BAN", "PERM_BAN", "UNBAN", "SUSPEND", "UNSUSPEND", "CHAT_BLOCK", "MIC_BLOCK"
    reason,
    durationDays = null,
    adminId = null,
    adminName = 'Super Admin',
    ipAddress = '127.0.0.1',
  },
  db = prisma
) {
  if (!targetUserId) {
    const error = new Error('Target user ID is required');
    error.statusCode = 400;
    error.code = 'TARGET_USER_REQUIRED';
    throw error;
  }

  let userBefore = null;
  if (db.user?.findUnique) {
    userBefore = await db.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, username: true, status: true },
    });
  }

  let userAfter = userBefore;
  let createdRestriction = null;

  switch (action) {
    case 'WARN': {
      // Warning does not mutate account status or apply restrictions, but logs warning
      break;
    }

    case 'MUTE':
    case 'CHAT_BLOCK': {
      createdRestriction = await restrictionService.applyRestriction(
        {
          userId: targetUserId,
          targetId: targetUserId,
          type: 'MUTE',
          reason,
          durationDays: durationDays || 7,
          createdByAdminId: adminId,
          adminName,
          ipAddress,
        },
        db
      );
      break;
    }

    case 'MIC_BLOCK': {
      createdRestriction = await restrictionService.applyRestriction(
        {
          userId: targetUserId,
          targetId: targetUserId,
          type: 'MIC_BLOCK',
          reason,
          durationDays: durationDays || 7,
          createdByAdminId: adminId,
          adminName,
          ipAddress,
        },
        db
      );
      break;
    }

    case 'TEMP_BAN': {
      createdRestriction = await restrictionService.applyRestriction(
        {
          userId: targetUserId,
          targetId: targetUserId,
          type: 'BAN',
          reason,
          durationDays: durationDays || 7,
          createdByAdminId: adminId,
          adminName,
          ipAddress,
        },
        db
      );
      if (db.user?.update) {
        userAfter = await db.user.update({
          where: { id: targetUserId },
          data: { status: 'BANNED' },
          select: { id: true, username: true, status: true },
        });
      }
      break;
    }

    case 'PERM_BAN':
    case 'BAN': {
      createdRestriction = await restrictionService.applyRestriction(
        {
          userId: targetUserId,
          targetId: targetUserId,
          type: 'BAN',
          reason,
          durationDays: null,
          createdByAdminId: adminId,
          adminName,
          ipAddress,
        },
        db
      );
      if (db.user?.update) {
        userAfter = await db.user.update({
          where: { id: targetUserId },
          data: { status: 'BANNED' },
          select: { id: true, username: true, status: true },
        });
      }
      break;
    }

    case 'UNBAN': {
      // Find all active BAN restrictions and lift them
      const activeBans = await restrictionRepository.findActiveRestrictionsForUser(targetUserId, db);
      for (const ban of activeBans) {
        if (ban.type === 'BAN') {
          await restrictionService.liftRestriction(
            ban.id,
            { reason, adminId, adminName, ipAddress },
            db
          );
        }
      }
      if (db.user?.update) {
        userAfter = await db.user.update({
          where: { id: targetUserId },
          data: { status: 'ACTIVE' },
          select: { id: true, username: true, status: true },
        });
      }
      break;
    }

    case 'SUSPEND': {
      if (db.user?.update) {
        userAfter = await db.user.update({
          where: { id: targetUserId },
          data: { status: 'SUSPENDED' },
          select: { id: true, username: true, status: true },
        });
      }
      break;
    }

    case 'UNSUSPEND': {
      if (db.user?.update) {
        userAfter = await db.user.update({
          where: { id: targetUserId },
          data: { status: 'ACTIVE' },
          select: { id: true, username: true, status: true },
        });
      }
      break;
    }

    default: {
      const error = new Error(`Unsupported moderation action: ${action}`);
      error.statusCode = 400;
      error.code = 'INVALID_MODERATION_ACTION';
      throw error;
    }
  }

  // Record ModerationAction
  const modAction = await moderationRepository.createModerationAction(
    {
      adminId: adminId || 'system',
      targetType: 'USER',
      targetId: targetUserId,
      action,
      reason,
      metadataJson: {
        durationDays,
        restrictionId: createdRestriction?.id || null,
        beforeStatus: userBefore?.status || null,
        afterStatus: userAfter?.status || null,
      },
    },
    db
  );

  // Write immutable AuditLog
  await logAudit(
    {
      adminId,
      adminName,
      action: `MODERATION_USER_${action}`,
      targetEntity: 'User',
      targetEntityId: targetUserId,
      beforeStateJson: userBefore,
      afterStateJson: {
        action,
        userStatus: userAfter?.status,
        restrictionId: createdRestriction?.id || null,
      },
      reason,
      ipAddress,
    },
    db
  );

  // Emit post-commit realtime event
  socketEmitter.emitToUser(targetUserId, SOCKET_EVENTS.MODERATION_ACTION, {
    action,
    reason,
    durationDays,
    restrictionId: createdRestriction?.id || null,
    timestamp: new Date().toISOString(),
  });

  return {
    success: true,
    action: modAction,
    user: userAfter,
    restriction: createdRestriction,
  };
}

/**
 * Executes an authoritative moderation action on user content (Post, Comment, Room).
 */
export async function moderateContent(
  {
    targetType, // "POST", "COMMENT", "ROOM"
    targetId,
    action, // "DELETE_POST", "DELETE_COMMENT", "CLOSE_ROOM", "WARN"
    reason,
    adminId = null,
    adminName = 'Moderator',
    ipAddress = '127.0.0.1',
  },
  db = prisma
) {
  if (!targetType || !targetId) {
    const error = new Error('Target type and target ID are required');
    error.statusCode = 400;
    error.code = 'TARGET_REQUIRED';
    throw error;
  }

  let entityBefore = null;
  let entityAfter = null;

  switch (targetType.toUpperCase()) {
    case 'POST': {
      if (db.post?.findUnique) {
        entityBefore = await db.post.findUnique({ where: { id: targetId } });
        if (!entityBefore) {
          const error = new Error('Post not found');
          error.statusCode = 404;
          error.code = 'POST_NOT_FOUND';
          throw error;
        }

        entityAfter = await db.post.update({
          where: { id: targetId },
          data: { deletedAt: new Date() },
        });

        // Decrement author's post count
        if (db.userProfile?.updateMany && entityBefore.userId) {
          await db.userProfile.updateMany({
            where: { userId: entityBefore.userId },
            data: { postsCount: { decrement: 1 } },
          });
        }

        socketEmitter.emitToAll(SOCKET_EVENTS.POST_DELETED, {
          postId: targetId,
          authorUserId: entityBefore.userId,
        });
      }
      break;
    }

    case 'COMMENT': {
      if (db.comment?.findUnique) {
        entityBefore = await db.comment.findUnique({ where: { id: targetId } });
        if (!entityBefore) {
          const error = new Error('Comment not found');
          error.statusCode = 404;
          error.code = 'COMMENT_NOT_FOUND';
          throw error;
        }

        entityAfter = await db.comment.update({
          where: { id: targetId },
          data: { deletedAt: new Date() },
        });

        if (db.post?.update && entityBefore.postId) {
          await db.post.update({
            where: { id: entityBefore.postId },
            data: { commentsCount: { decrement: 1 } },
          });
        }

        socketEmitter.emitToAll(SOCKET_EVENTS.COMMENT_DELETED, {
          commentId: targetId,
          postId: entityBefore.postId,
        });
      }
      break;
    }

    case 'ROOM': {
      if (db.room?.findUnique) {
        entityBefore = await db.room.findUnique({ where: { id: targetId } });
        if (!entityBefore) {
          const error = new Error('Room not found');
          error.statusCode = 404;
          error.code = 'ROOM_NOT_FOUND';
          throw error;
        }

        entityAfter = await db.room.update({
          where: { id: targetId },
          data: {
            status: 'CLOSED_BY_ADMIN',
            endedAt: new Date(),
          },
        });

        socketEmitter.emitToRoom(targetId, SOCKET_EVENTS.ROOM_CLOSED, {
          roomId: targetId,
          reason: `Closed by moderation: ${reason}`,
        });
      }
      break;
    }

    default: {
      const error = new Error(`Unsupported content target type: ${targetType}`);
      error.statusCode = 400;
      error.code = 'INVALID_TARGET_TYPE';
      throw error;
    }
  }

  const modAction = await moderationRepository.createModerationAction(
    {
      adminId: adminId || 'system',
      targetType: targetType.toUpperCase(),
      targetId,
      action: action || `DELETE_${targetType.toUpperCase()}`,
      reason,
      metadataJson: {
        targetType,
        targetId,
      },
    },
    db
  );

  await logAudit(
    {
      adminId,
      adminName,
      action: `CONTENT_MODERATION_${action || targetType}`,
      targetEntity: targetType,
      targetEntityId: targetId,
      beforeStateJson: entityBefore,
      afterStateJson: entityAfter,
      reason,
      ipAddress,
    },
    db
  );

  return {
    success: true,
    action: modAction,
    target: entityAfter,
  };
}

/**
 * Lists moderation audit action history.
 */
export async function getModerationHistory(filters, db = prisma) {
  return await moderationRepository.findModerationActions(filters, db);
}

/**
 * Gets dashboard statistics.
 */
export async function getModerationStats(db = prisma) {
  return await moderationRepository.getModerationStats(db);
}

export default {
  moderateUser,
  moderateContent,
  getModerationHistory,
  getModerationStats,
};
