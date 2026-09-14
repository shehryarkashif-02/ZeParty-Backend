import prisma from '../config/database.js';
import postRepository from '../repositories/post.repository.js';
import socialRepository from '../repositories/social.repository.js';
import socketEmitter from '../socket/socket.emitter.js';
import { SOCKET_EVENTS } from '../socket/socket.constants.js';

/**
 * Social & Engagement Service
 * Master coordinator for Posts, Feeds, Likes, Comments, Follows, Blocks, Privacy, and Reporting.
 */

async function logAudit(
  { adminId, adminName, action, targetEntity, targetEntityId, beforeStateJson, afterStateJson, reason, ipAddress },
  db = prisma
) {
  try {
    await db.auditLog.create({
      data: {
        adminId: adminId || null,
        adminName: adminName || (adminId ? 'Administrator' : 'System Automation'),
        action,
        targetEntity,
        targetEntityId: targetEntityId || null,
        beforeStateJson: beforeStateJson || null,
        afterStateJson: afterStateJson || null,
        reason: reason || null,
        ipAddress: ipAddress || '127.0.0.1',
      },
    });
  } catch (err) {
    console.error('Failed to write audit log in social.service:', err);
  }
}

// ============================================================
// 1. POSTS & FEED
// ============================================================

export async function createPost(
  { userId, content, mediaUrls = [], visibility = 'PUBLIC' },
  db = prisma
) {
  if (!userId) {
    const error = new Error('User authentication is required');
    error.statusCode = 401;
    error.code = 'UNAUTHORIZED';
    throw error;
  }

  // Create post record
  const post = await postRepository.createPost(
    {
      userId,
      content,
      mediaUrls,
      visibility,
    },
    db
  );

  // Increment user profile posts count
  await socialRepository.incrementPostsCount(userId, db);

  // Emit post:created realtime event strictly after creation
  if (visibility === 'PUBLIC') {
    socketEmitter.broadcastGlobal(SOCKET_EVENTS.POST_CREATED, {
      postId: post.id,
      authorId: userId,
      authorUsername: post.user?.username,
      content: post.content,
      createdAt: post.createdAt,
    });
  } else {
    // For followers/private, notify specific user/author
    socketEmitter.emitToUser(userId, SOCKET_EVENTS.POST_CREATED, {
      postId: post.id,
      authorId: userId,
      visibility,
      createdAt: post.createdAt,
    });
  }

  return post;
}

export async function getPostById(postId, viewerUserId = null, { isAdmin = false } = {}, db = prisma) {
  const post = await postRepository.findPostById(postId, db);
  if (!post) {
    const error = new Error('Post not found');
    error.statusCode = 404;
    error.code = 'POST_NOT_FOUND';
    throw error;
  }

  // If Admin, full access
  if (isAdmin) {
    return post;
  }

  // Author can always view own post
  if (viewerUserId && post.userId === viewerUserId) {
    return post;
  }

  // Check block relationship
  if (viewerUserId) {
    const blocked = await socialRepository.isBlocked(viewerUserId, post.userId, db);
    if (blocked) {
      const error = new Error('Post not found');
      error.statusCode = 404;
      error.code = 'POST_NOT_FOUND';
      throw error;
    }
  }

  // Check visibility
  if (post.visibility === 'PRIVATE') {
    const error = new Error('This post is private');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_PRIVATE_POST';
    throw error;
  }

  if (post.visibility === 'FOLLOWERS') {
    if (!viewerUserId) {
      const error = new Error('Authentication required to view followers-only post');
      error.statusCode = 401;
      error.code = 'UNAUTHORIZED';
      throw error;
    }

    const follow = await socialRepository.findFollow({ followerId: viewerUserId, followingId: post.userId }, db);
    if (!follow || follow.status !== 'ACCEPTED') {
      const error = new Error('Only followers can view this post');
      error.statusCode = 403;
      error.code = 'FORBIDDEN_FOLLOWERS_ONLY';
      throw error;
    }
  }

  // Check if author profile is private
  if (post.user?.profile?.isPrivate && post.userId !== viewerUserId) {
    if (!viewerUserId) {
      const error = new Error('Post not found');
      error.statusCode = 404;
      error.code = 'POST_NOT_FOUND';
      throw error;
    }
    const follow = await socialRepository.findFollow({ followerId: viewerUserId, followingId: post.userId }, db);
    if (!follow || follow.status !== 'ACCEPTED') {
      const error = new Error('Post not found');
      error.statusCode = 404;
      error.code = 'POST_NOT_FOUND';
      throw error;
    }
  }

  // Attach isLiked flag if viewerUserId provided
  let isLiked = false;
  if (viewerUserId) {
    isLiked = await socialRepository.isPostLikedByUser(postId, viewerUserId, db);
  }

  return {
    ...post,
    isLiked,
  };
}

export async function getFeed(
  {
    viewerUserId = null,
    feedType = 'PUBLIC',
    authorUserId = null,
    cursor = null,
    limit = 20,
    page = null,
  } = {},
  db = prisma
) {
  let followingUserIds = [];
  let blockedUserIds = [];

  if (viewerUserId) {
    [followingUserIds, blockedUserIds] = await Promise.all([
      socialRepository.findFollowingUserIds(viewerUserId, db),
      socialRepository.findBlockedUserIds(viewerUserId, db),
    ]);
  }

  // If requesting posts of a specific target author, verify privacy
  if (authorUserId && authorUserId !== viewerUserId) {
    const authorProfile = await socialRepository.findSocialProfile(authorUserId, db);
    if (!authorProfile) {
      const error = new Error('User not found');
      error.statusCode = 404;
      error.code = 'USER_NOT_FOUND';
      throw error;
    }

    if (authorProfile.profile?.isPrivate) {
      const isFollowing = followingUserIds.includes(authorUserId);
      if (!isFollowing) {
        return {
          posts: [],
          meta: { limit, hasMore: false, nextCursor: null, isPrivateProfile: true },
          pagination: page ? { page: 1, limit, total: 0, totalPages: 0 } : undefined,
        };
      }
    }
  }

  const result = await postRepository.findFeedPosts(
    {
      viewerUserId,
      feedType,
      authorUserId,
      followingUserIds,
      blockedUserIds,
      cursor,
      limit,
      page,
    },
    db
  );

  return result;
}

export async function deletePost(
  postId,
  userId,
  { isAdmin = false, adminId = null, adminName = null, reason = null, ipAddress = '127.0.0.1' } = {},
  db = prisma
) {
  const post = await postRepository.findPostById(postId, db);
  if (!post) {
    const error = new Error('Post not found');
    error.statusCode = 404;
    error.code = 'POST_NOT_FOUND';
    throw error;
  }

  if (post.userId !== userId && !isAdmin) {
    const error = new Error('Unauthorized to delete this post');
    error.statusCode = 403;
    error.code = 'FORBIDDEN';
    throw error;
  }

  await postRepository.softDeletePost(postId, db);
  await socialRepository.decrementPostsCount(post.userId, db);

  if (isAdmin) {
    await logAudit(
      {
        adminId,
        adminName,
        action: 'ADMIN_DELETE_POST',
        targetEntity: 'Post',
        targetEntityId: postId,
        beforeStateJson: { id: post.id, userId: post.userId, content: post.content },
        reason,
        ipAddress,
      },
      db
    );
  }

  socketEmitter.broadcastGlobal(SOCKET_EVENTS.POST_DELETED, {
    postId,
    deletedBy: userId || adminId,
  });

  return { success: true, id: postId };
}

// ============================================================
// 2. LIKES & REACTIONS
// ============================================================

export async function likePost(postId, userId, db = prisma) {
  if (!userId) {
    const error = new Error('User authentication is required');
    error.statusCode = 401;
    error.code = 'UNAUTHORIZED';
    throw error;
  }

  const post = await postRepository.findPostById(postId, db);
  if (!post) {
    const error = new Error('Post not found');
    error.statusCode = 404;
    error.code = 'POST_NOT_FOUND';
    throw error;
  }

  const existing = await socialRepository.findLike({ postId, userId }, db);
  if (existing) {
    // Idempotent return
    return { success: true, alreadyLiked: true, likesCount: post.likesCount };
  }

  try {
    await socialRepository.createLike({ postId, userId }, db);
    const updatedPost = await postRepository.incrementLikesCount(postId, db);

    socketEmitter.emitToUser(post.userId, SOCKET_EVENTS.POST_LIKED, {
      postId,
      likedByUserId: userId,
      likesCount: updatedPost.likesCount,
    });

    return { success: true, alreadyLiked: false, likesCount: updatedPost.likesCount };
  } catch (err) {
    if (err.code === 'P2002') {
      // Prisma Unique constraint race condition handled gracefully
      return { success: true, alreadyLiked: true, likesCount: post.likesCount };
    }
    throw err;
  }
}

export async function unlikePost(postId, userId, db = prisma) {
  if (!userId) {
    const error = new Error('User authentication is required');
    error.statusCode = 401;
    error.code = 'UNAUTHORIZED';
    throw error;
  }

  const post = await postRepository.findPostById(postId, db);
  if (!post) {
    const error = new Error('Post not found');
    error.statusCode = 404;
    error.code = 'POST_NOT_FOUND';
    throw error;
  }

  const existing = await socialRepository.findLike({ postId, userId }, db);
  if (!existing) {
    return { success: true, alreadyUnliked: true, likesCount: post.likesCount };
  }

  try {
    await socialRepository.deleteLike({ postId, userId }, db);
    const updatedPost = await postRepository.decrementLikesCount(postId, db);

    socketEmitter.emitToUser(post.userId, SOCKET_EVENTS.POST_UNLIKED, {
      postId,
      unlikedByUserId: userId,
      likesCount: updatedPost.likesCount,
    });

    return { success: true, alreadyUnliked: false, likesCount: updatedPost.likesCount };
  } catch (err) {
    if (err.code === 'P2025') {
      return { success: true, alreadyUnliked: true, likesCount: post.likesCount };
    }
    throw err;
  }
}

// ============================================================
// 3. COMMENTS & REPLIES
// ============================================================

export async function createComment(
  { postId, userId, content, parentId = null },
  db = prisma
) {
  if (!userId) {
    const error = new Error('User authentication is required');
    error.statusCode = 401;
    error.code = 'UNAUTHORIZED';
    throw error;
  }

  const post = await postRepository.findPostById(postId, db);
  if (!post) {
    const error = new Error('Post not found');
    error.statusCode = 404;
    error.code = 'POST_NOT_FOUND';
    throw error;
  }

  // Validate parent comment if nested reply
  if (parentId) {
    const parent = await socialRepository.findCommentById(parentId, db);
    if (!parent || parent.postId !== postId) {
      const error = new Error('Parent comment not found for this post');
      error.statusCode = 400;
      error.code = 'INVALID_PARENT_COMMENT';
      throw error;
    }
  }

  const comment = await socialRepository.createComment(
    { postId, userId, content, parentId },
    db
  );

  await postRepository.incrementCommentsCount(postId, db);

  socketEmitter.emitToUser(post.userId, SOCKET_EVENTS.COMMENT_CREATED, {
    postId,
    commentId: comment.id,
    authorId: userId,
    authorUsername: comment.user?.username,
    content: comment.content,
    parentId,
    createdAt: comment.createdAt,
  });

  return comment;
}

export async function getPostComments(
  postId,
  { viewerUserId = null, page = 1, limit = 20, parentId = null } = {},
  db = prisma
) {
  const post = await postRepository.findPostById(postId, db);
  if (!post) {
    const error = new Error('Post not found');
    error.statusCode = 404;
    error.code = 'POST_NOT_FOUND';
    throw error;
  }

  return await socialRepository.findCommentsByPost(postId, { page, limit, parentId }, db);
}

export async function deleteComment(
  commentId,
  userId,
  { isAdmin = false, adminId = null, adminName = null, ipAddress = '127.0.0.1' } = {},
  db = prisma
) {
  const comment = await socialRepository.findCommentById(commentId, db);
  if (!comment) {
    const error = new Error('Comment not found');
    error.statusCode = 404;
    error.code = 'COMMENT_NOT_FOUND';
    throw error;
  }

  // Author of comment or Author of post or Admin can delete
  const isCommentAuthor = comment.userId === userId;
  const isPostAuthor = comment.post?.userId === userId;

  if (!isCommentAuthor && !isPostAuthor && !isAdmin) {
    const error = new Error('Unauthorized to delete this comment');
    error.statusCode = 403;
    error.code = 'FORBIDDEN';
    throw error;
  }

  await socialRepository.softDeleteComment(commentId, db);
  await postRepository.decrementCommentsCount(comment.postId, db);

  if (isAdmin) {
    await logAudit(
      {
        adminId,
        adminName,
        action: 'ADMIN_DELETE_COMMENT',
        targetEntity: 'Comment',
        targetEntityId: commentId,
        beforeStateJson: { id: comment.id, userId: comment.userId, content: comment.content },
        ipAddress,
      },
      db
    );
  }

  socketEmitter.emitToUser(comment.userId, SOCKET_EVENTS.COMMENT_DELETED, {
    commentId,
    postId: comment.postId,
    deletedBy: userId || adminId,
  });

  return { success: true, id: commentId };
}

// ============================================================
// 4. FOLLOW / UNFOLLOW SYSTEM
// ============================================================

export async function followUser(followerId, followingId, db = prisma) {
  if (!followerId) {
    const error = new Error('User authentication is required');
    error.statusCode = 401;
    error.code = 'UNAUTHORIZED';
    throw error;
  }

  if (followerId === followingId) {
    const error = new Error('You cannot follow yourself');
    error.statusCode = 400;
    error.code = 'CANNOT_FOLLOW_SELF';
    throw error;
  }

  const targetUser = await socialRepository.findSocialProfile(followingId, db);
  if (!targetUser) {
    const error = new Error('Target user not found');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  // Check if blocked
  const blocked = await socialRepository.isBlocked(followerId, followingId, db);
  if (blocked) {
    const error = new Error('Cannot follow this user');
    error.statusCode = 403;
    error.code = 'USER_BLOCKED';
    throw error;
  }

  const existing = await socialRepository.findFollow({ followerId, followingId }, db);
  if (existing) {
    return { success: true, alreadyFollowing: true, status: existing.status };
  }

  const status = targetUser.profile?.isPrivate ? 'PENDING' : 'ACCEPTED';

  try {
    const follow = await socialRepository.createFollow({ followerId, followingId, status }, db);

    if (status === 'ACCEPTED') {
      await Promise.all([
        socialRepository.incrementFollowingCount(followerId, db),
        socialRepository.incrementFollowersCount(followingId, db),
      ]);
    }

    socketEmitter.emitToUser(followingId, SOCKET_EVENTS.FOLLOW_CREATED, {
      followerId,
      status,
      timestamp: new Date().toISOString(),
    });

    return { success: true, alreadyFollowing: false, status: follow.status };
  } catch (err) {
    if (err.code === 'P2002') {
      return { success: true, alreadyFollowing: true, status };
    }
    throw err;
  }
}

export async function unfollowUser(followerId, followingId, db = prisma) {
  if (!followerId) {
    const error = new Error('User authentication is required');
    error.statusCode = 401;
    error.code = 'UNAUTHORIZED';
    throw error;
  }

  const existing = await socialRepository.findFollow({ followerId, followingId }, db);
  if (!existing) {
    return { success: true, alreadyUnfollowed: true };
  }

  try {
    await socialRepository.deleteFollow({ followerId, followingId }, db);

    if (existing.status === 'ACCEPTED') {
      await Promise.all([
        socialRepository.decrementFollowingCount(followerId, db),
        socialRepository.decrementFollowersCount(followingId, db),
      ]);
    }

    socketEmitter.emitToUser(followingId, SOCKET_EVENTS.FOLLOW_REMOVED, {
      followerId,
      timestamp: new Date().toISOString(),
    });

    return { success: true, alreadyUnfollowed: false };
  } catch (err) {
    if (err.code === 'P2025') {
      return { success: true, alreadyUnfollowed: true };
    }
    throw err;
  }
}

export async function getFollowers(userId, { viewerUserId = null, page = 1, limit = 20 } = {}, db = prisma) {
  const profile = await socialRepository.findSocialProfile(userId, db);
  if (!profile) {
    const error = new Error('User not found');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  if (profile.profile?.isPrivate && userId !== viewerUserId) {
    if (!viewerUserId) {
      const error = new Error('User not found');
      error.statusCode = 404;
      error.code = 'USER_NOT_FOUND';
      throw error;
    }
    const follow = await socialRepository.findFollow({ followerId: viewerUserId, followingId: userId }, db);
    if (!follow || follow.status !== 'ACCEPTED') {
      const error = new Error('User not found');
      error.statusCode = 404;
      error.code = 'USER_NOT_FOUND';
      throw error;
    }
  }

  return await socialRepository.findFollowers(userId, { page, limit }, db);
}

export async function getFollowing(userId, { viewerUserId = null, page = 1, limit = 20 } = {}, db = prisma) {
  const profile = await socialRepository.findSocialProfile(userId, db);
  if (!profile) {
    const error = new Error('User not found');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  if (profile.profile?.isPrivate && userId !== viewerUserId) {
    if (!viewerUserId) {
      const error = new Error('User not found');
      error.statusCode = 404;
      error.code = 'USER_NOT_FOUND';
      throw error;
    }
    const follow = await socialRepository.findFollow({ followerId: viewerUserId, followingId: userId }, db);
    if (!follow || follow.status !== 'ACCEPTED') {
      const error = new Error('User not found');
      error.statusCode = 404;
      error.code = 'USER_NOT_FOUND';
      throw error;
    }
  }

  return await socialRepository.findFollowing(userId, { page, limit }, db);
}

// ============================================================
// 5. SOCIAL PROFILE & PRIVACY
// ============================================================

export async function getSocialProfile(targetUserId, viewerUserId = null, db = prisma) {
  const user = await socialRepository.findSocialProfile(targetUserId, db);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  let isFollowing = false;
  let isFollowedBy = false;
  let isBlockedByViewer = false;

  if (viewerUserId && viewerUserId !== targetUserId) {
    const [follow, reverseFollow, blocked] = await Promise.all([
      socialRepository.findFollow({ followerId: viewerUserId, followingId: targetUserId }, db),
      socialRepository.findFollow({ followerId: targetUserId, followingId: viewerUserId }, db),
      socialRepository.isBlocked(viewerUserId, targetUserId, db),
    ]);
    isFollowing = Boolean(follow && follow.status === 'ACCEPTED');
    isFollowedBy = Boolean(reverseFollow && reverseFollow.status === 'ACCEPTED');
    isBlockedByViewer = blocked;
  }

  const isPrivate = Boolean(user.profile?.isPrivate);
  const canViewPosts = !isPrivate || isFollowing || viewerUserId === targetUserId;

  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    displayName: user.profile?.displayName || user.username,
    level: user.profile?.level || 1,
    vipLevel: user.profile?.vipLevel || 0,
    svipLevel: user.profile?.svipLevel || 0,
    nobleRank: user.profile?.nobleRank || null,
    isPrivate,
    followersCount: user.profile?.followersCount || 0,
    followingCount: user.profile?.followingCount || 0,
    postsCount: user.profile?.postsCount || 0,
    isFollowing,
    isFollowedBy,
    isBlocked: isBlockedByViewer,
    canViewPosts,
    createdAt: user.createdAt,
  };
}

export async function updatePrivacySettings(userId, isPrivate, db = prisma) {
  if (!userId) {
    const error = new Error('User authentication is required');
    error.statusCode = 401;
    error.code = 'UNAUTHORIZED';
    throw error;
  }

  const updated = await socialRepository.updateUserPrivacy(userId, isPrivate, db);
  return {
    success: true,
    isPrivate: updated.isPrivate,
  };
}

// ============================================================
// 6. BLOCKS & REPORTING
// ============================================================

export async function blockUser(blockerId, blockedId, db = prisma) {
  if (blockerId === blockedId) {
    const error = new Error('You cannot block yourself');
    error.statusCode = 400;
    error.code = 'CANNOT_BLOCK_SELF';
    throw error;
  }

  // Remove any existing follow relationships
  await Promise.all([
    socialRepository.deleteFollow({ followerId: blockerId, followingId: blockedId }, db).catch(() => {}),
    socialRepository.deleteFollow({ followerId: blockedId, followingId: blockerId }, db).catch(() => {}),
  ]);

  try {
    await socialRepository.createBlock({ blockerId, blockedId }, db);
    return { success: true, message: 'User blocked successfully' };
  } catch (err) {
    if (err.code === 'P2002') {
      return { success: true, message: 'User already blocked' };
    }
    throw err;
  }
}

export async function unblockUser(blockerId, blockedId, db = prisma) {
  try {
    await socialRepository.deleteBlock({ blockerId, blockedId }, db);
    return { success: true, message: 'User unblocked successfully' };
  } catch (err) {
    if (err.code === 'P2025') {
      return { success: true, message: 'User already not blocked' };
    }
    throw err;
  }
}

export async function reportContent(
  { reporterUserId, targetType, targetId, violationType, description, screenshotUrl },
  db = prisma
) {
  if (!reporterUserId) {
    const error = new Error('User authentication is required');
    error.statusCode = 401;
    error.code = 'UNAUTHORIZED';
    throw error;
  }

  let reportedUserId = null;
  let reportedPostId = null;
  let reportedCommentId = null;

  if (targetType === 'USER') {
    reportedUserId = targetId;
  } else if (targetType === 'POST') {
    reportedPostId = targetId;
    const post = await postRepository.findPostById(targetId, db);
    if (!post) {
      const error = new Error('Target post not found');
      error.statusCode = 404;
      error.code = 'POST_NOT_FOUND';
      throw error;
    }
    reportedUserId = post.userId;
  } else if (targetType === 'COMMENT') {
    reportedCommentId = targetId;
    const comment = await socialRepository.findCommentById(targetId, db);
    if (!comment) {
      const error = new Error('Target comment not found');
      error.statusCode = 404;
      error.code = 'COMMENT_NOT_FOUND';
      throw error;
    }
    reportedUserId = comment.userId;
  }

  const report = await socialRepository.createReport(
    {
      reporterUserId,
      reportedUserId,
      reportedPostId,
      reportedCommentId,
      violationType,
      description,
      screenshotUrl,
    },
    db
  );

  return {
    success: true,
    message: 'Report submitted successfully. Our moderation team will review it.',
    reportId: report.id,
  };
}

export default {
  createPost,
  getPostById,
  getFeed,
  deletePost,
  likePost,
  unlikePost,
  createComment,
  getPostComments,
  deleteComment,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  getSocialProfile,
  updatePrivacySettings,
  blockUser,
  unblockUser,
  reportContent,
};
