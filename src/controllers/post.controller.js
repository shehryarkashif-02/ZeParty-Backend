import socialService from '../services/social.service.js';
import {
  createPostSchema,
  queryFeedSchema,
  postIdParamSchema,
  createCommentSchema,
  commentIdParamSchema,
  reportContentSchema,
} from '../validators/post.validator.js';

// ============================================================
// POSTS CONTROLLER
// ============================================================

export async function postCreatePost(req, res, next) {
  try {
    const validatedData = createPostSchema.parse(req.body);
    const userId = req.auth?.userId;

    const post = await socialService.createPost({
      userId,
      ...validatedData,
    });

    return res.status(201).json({
      success: true,
      message: 'Post created successfully',
      data: post,
    });
  } catch (err) {
    next(err);
  }
}

export async function getFeed(req, res, next) {
  try {
    const validatedQuery = queryFeedSchema.parse(req.query);
    const viewerUserId = req.auth?.userId || null;

    const result = await socialService.getFeed({
      viewerUserId,
      ...validatedQuery,
    });

    return res.status(200).json({
      success: true,
      message: 'Feed retrieved successfully',
      data: result.posts,
      meta: result.meta,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function getPostById(req, res, next) {
  try {
    const { id } = postIdParamSchema.parse(req.params);
    const viewerUserId = req.auth?.userId || null;
    const isAdmin = Boolean(req.auth?.isAdmin);

    const post = await socialService.getPostById(id, viewerUserId, { isAdmin });

    return res.status(200).json({
      success: true,
      message: 'Post retrieved successfully',
      data: post,
    });
  } catch (err) {
    next(err);
  }
}

export async function deletePost(req, res, next) {
  try {
    const { id } = postIdParamSchema.parse(req.params);
    const userId = req.auth?.userId;
    const isAdmin = Boolean(req.auth?.isAdmin);
    const adminId = isAdmin ? req.auth?.userId : null;
    const adminName = req.auth?.username || 'Administrator';
    const reason = req.body?.reason || null;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    await socialService.deletePost(id, userId, {
      isAdmin,
      adminId,
      adminName,
      reason,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: 'Post deleted successfully',
    });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// LIKES CONTROLLER
// ============================================================

export async function postLike(req, res, next) {
  try {
    const { id } = postIdParamSchema.parse(req.params);
    const userId = req.auth?.userId;

    const result = await socialService.likePost(id, userId);

    return res.status(200).json({
      success: true,
      message: result.alreadyLiked ? 'Post already liked' : 'Post liked successfully',
      data: {
        likesCount: result.likesCount,
        alreadyLiked: result.alreadyLiked,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteLike(req, res, next) {
  try {
    const { id } = postIdParamSchema.parse(req.params);
    const userId = req.auth?.userId;

    const result = await socialService.unlikePost(id, userId);

    return res.status(200).json({
      success: true,
      message: result.alreadyUnliked ? 'Post already unliked' : 'Post unliked successfully',
      data: {
        likesCount: result.likesCount,
        alreadyUnliked: result.alreadyUnliked,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// COMMENTS CONTROLLER
// ============================================================

export async function postCreateComment(req, res, next) {
  try {
    const { id: postId } = postIdParamSchema.parse(req.params);
    const validatedData = createCommentSchema.parse(req.body);
    const userId = req.auth?.userId;

    const comment = await socialService.createComment({
      postId,
      userId,
      ...validatedData,
    });

    return res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: comment,
    });
  } catch (err) {
    next(err);
  }
}

export async function getComments(req, res, next) {
  try {
    const { id: postId } = postIdParamSchema.parse(req.params);
    const viewerUserId = req.auth?.userId || null;
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;
    const parentId = req.query.parentId || null;

    const result = await socialService.getPostComments(postId, {
      viewerUserId,
      page,
      limit,
      parentId,
    });

    return res.status(200).json({
      success: true,
      message: 'Comments retrieved successfully',
      data: result.comments,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteComment(req, res, next) {
  try {
    const { id: commentId } = commentIdParamSchema.parse(req.params);
    const userId = req.auth?.userId;
    const isAdmin = Boolean(req.auth?.isAdmin);
    const adminId = isAdmin ? req.auth?.userId : null;
    const adminName = req.auth?.username || 'Administrator';
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    await socialService.deleteComment(commentId, userId, {
      isAdmin,
      adminId,
      adminName,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: 'Comment deleted successfully',
    });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// REPORTING CONTROLLER
// ============================================================

export async function postReport(req, res, next) {
  try {
    const reporterUserId = req.auth?.userId;
    const validatedData = reportContentSchema.parse(req.body);

    const result = await socialService.reportContent({
      reporterUserId,
      ...validatedData,
    });

    return res.status(201).json({
      success: true,
      message: result.message,
      data: { reportId: result.reportId },
    });
  } catch (err) {
    next(err);
  }
}

export default {
  postCreatePost,
  getFeed,
  getPostById,
  deletePost,
  postLike,
  deleteLike,
  postCreateComment,
  getComments,
  deleteComment,
  postReport,
};
