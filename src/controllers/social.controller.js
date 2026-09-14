import socialService from '../services/social.service.js';
import {
  userIdParamSchema,
  privacySettingsSchema,
} from '../validators/post.validator.js';

// ============================================================
// SOCIAL CONTROLLER (PROFILES, PRIVACY, FOLLOWS, BLOCKS)
// ============================================================

export async function getSocialProfile(req, res, next) {
  try {
    const { id } = userIdParamSchema.parse(req.params);
    const viewerUserId = req.auth?.userId || null;

    const profile = await socialService.getSocialProfile(id, viewerUserId);

    return res.status(200).json({
      success: true,
      message: 'Social profile retrieved successfully',
      data: profile,
    });
  } catch (err) {
    next(err);
  }
}

export async function putPrivacySettings(req, res, next) {
  try {
    const userId = req.auth?.userId;
    const validatedData = privacySettingsSchema.parse(req.body);

    const result = await socialService.updatePrivacySettings(userId, validatedData.isPrivate);

    return res.status(200).json({
      success: true,
      message: `Account privacy updated to ${validatedData.isPrivate ? 'PRIVATE' : 'PUBLIC'} successfully`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function postFollow(req, res, next) {
  try {
    const { id: followingId } = userIdParamSchema.parse(req.params);
    const followerId = req.auth?.userId;

    const result = await socialService.followUser(followerId, followingId);

    return res.status(200).json({
      success: true,
      message: result.alreadyFollowing ? 'Already following user' : 'User followed successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteFollow(req, res, next) {
  try {
    const { id: followingId } = userIdParamSchema.parse(req.params);
    const followerId = req.auth?.userId;

    const result = await socialService.unfollowUser(followerId, followingId);

    return res.status(200).json({
      success: true,
      message: result.alreadyUnfollowed ? 'Already unfollowed user' : 'User unfollowed successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function getFollowers(req, res, next) {
  try {
    const { id } = userIdParamSchema.parse(req.params);
    const viewerUserId = req.auth?.userId || null;
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;

    const result = await socialService.getFollowers(id, { viewerUserId, page, limit });

    return res.status(200).json({
      success: true,
      message: 'Followers retrieved successfully',
      data: result.followers,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function getFollowing(req, res, next) {
  try {
    const { id } = userIdParamSchema.parse(req.params);
    const viewerUserId = req.auth?.userId || null;
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;

    const result = await socialService.getFollowing(id, { viewerUserId, page, limit });

    return res.status(200).json({
      success: true,
      message: 'Following list retrieved successfully',
      data: result.following,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function postBlock(req, res, next) {
  try {
    const { id: blockedId } = userIdParamSchema.parse(req.params);
    const blockerId = req.auth?.userId;

    const result = await socialService.blockUser(blockerId, blockedId);

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteBlock(req, res, next) {
  try {
    const { id: blockedId } = userIdParamSchema.parse(req.params);
    const blockerId = req.auth?.userId;

    const result = await socialService.unblockUser(blockerId, blockedId);

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
}

export default {
  getSocialProfile,
  putPrivacySettings,
  postFollow,
  deleteFollow,
  getFollowers,
  getFollowing,
  postBlock,
  deleteBlock,
};
