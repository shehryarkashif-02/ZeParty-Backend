import socialService from '../services/social.service.js';
import postRepository from '../repositories/post.repository.js';
import { postIdParamSchema, commentIdParamSchema } from '../validators/post.validator.js';

// ============================================================
// ADMIN SOCIAL & MODERATION CONTROLLER
// ============================================================

export async function getAdminPosts(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
    const userId = req.query.userId || null;

    const result = await postRepository.findFeedPosts({
      page,
      limit,
      authorUserId: userId,
    });

    return res.status(200).json({
      success: true,
      data: result.posts,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function adminDeletePost(req, res, next) {
  try {
    const { id } = postIdParamSchema.parse(req.params);
    const adminId = req.auth?.userId;
    const adminName = req.auth?.username || 'Administrator';
    const reason = req.body?.reason || 'Violated community guidelines';
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    await socialService.deletePost(id, null, {
      isAdmin: true,
      adminId,
      adminName,
      reason,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: 'Post moderated and deleted successfully by administrator',
    });
  } catch (err) {
    next(err);
  }
}

export async function adminDeleteComment(req, res, next) {
  try {
    const { id } = commentIdParamSchema.parse(req.params);
    const adminId = req.auth?.userId;
    const adminName = req.auth?.username || 'Administrator';
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    await socialService.deleteComment(id, null, {
      isAdmin: true,
      adminId,
      adminName,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: 'Comment moderated and deleted successfully by administrator',
    });
  } catch (err) {
    next(err);
  }
}

export default {
  getAdminPosts,
  adminDeletePost,
  adminDeleteComment,
};
