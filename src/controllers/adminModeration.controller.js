import moderationService from '../services/moderation.service.js';
import { moderateUserSchema, moderateContentSchema } from '../validators/moderation.validator.js';

export async function moderateUser(req, res, next) {
  try {
    const validated = moderateUserSchema.parse(req.body);
    const result = await moderationService.moderateUser(
      {
        ...validated,
        adminId: req.admin?.id,
        adminName: req.admin?.name || req.admin?.username || 'Super Admin',
        ipAddress: req.ip,
      },
      req.db
    );

    return res.status(200).json({
      success: true,
      data: result,
      meta: {
        message: `Moderation action "${validated.action}" executed on user ${validated.targetUserId}.`,
      },
    });
  } catch (err) {
    return next(err);
  }
}

export async function moderateContent(req, res, next) {
  try {
    const validated = moderateContentSchema.parse(req.body);
    const result = await moderationService.moderateContent(
      {
        ...validated,
        adminId: req.admin?.id,
        adminName: req.admin?.name || req.admin?.username || 'Moderator',
        ipAddress: req.ip,
      },
      req.db
    );

    return res.status(200).json({
      success: true,
      data: result,
      meta: {
        message: `Content moderation action executed on ${validated.targetType} ${validated.targetId}.`,
      },
    });
  } catch (err) {
    return next(err);
  }
}

export async function getModerationHistory(req, res, next) {
  try {
    const { targetType, targetId, adminId, page, limit } = req.query;
    const result = await moderationService.getModerationHistory(
      {
        targetType,
        targetId,
        adminId,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
      },
      req.db
    );

    return res.status(200).json({
      success: true,
      data: result.actions,
      meta: result.pagination,
    });
  } catch (err) {
    return next(err);
  }
}

export async function getModerationStats(req, res, next) {
  try {
    const stats = await moderationService.getModerationStats(req.db);
    return res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (err) {
    return next(err);
  }
}

export default {
  moderateUser,
  moderateContent,
  getModerationHistory,
  getModerationStats,
};
