import restrictionRepository from '../repositories/restriction.repository.js';
import prisma from '../config/database.js';

/**
 * Middleware factory to enforce that a user does NOT have an active restriction of a given type.
 *
 * @param {string} restrictionType - Enum from RestrictionType e.g., 'POST_BLOCK', 'COMMENT_BLOCK', 'CHAT_BLOCK', 'LIVE_BLOCK', 'ROOM_BLOCK'
 */
export function requireNoRestriction(restrictionType) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      // 1. Check account ban or suspension
      if (req.user.status === 'BANNED') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCOUNT_BANNED',
            message: 'Your account has been permanently banned due to policy violations.',
          },
        });
      }

      if (req.user.status === 'SUSPENDED') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCOUNT_SUSPENDED',
            message: 'Your account is temporarily suspended.',
          },
        });
      }

      // 2. Check dynamic active restriction
      const activeRestriction = await restrictionRepository.findActiveRestrictionByType(
        userId,
        restrictionType,
        req.db || prisma
      );

      if (activeRestriction) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN_RESTRICTED',
            message: `You are restricted from performing this action (${restrictionType}). Reason: ${activeRestriction.reason}`,
            restriction: {
              id: activeRestriction.id,
              type: activeRestriction.type,
              reason: activeRestriction.reason,
              expiresAt: activeRestriction.expiresAt,
            },
          },
        });
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };
}

export default {
  requireNoRestriction,
};
