import prisma from '../config/database.js';

/**
 * Social Repository
 * Data access layer for Likes, Comments, Follows, Blocks, Reports, and Profile counters.
 */

// ============================================================
// LIKES
// ============================================================

export async function createLike({ postId, userId }, db = prisma) {
  return await db.like.create({
    data: {
      postId,
      userId,
    },
  });
}

export async function deleteLike({ postId, userId }, db = prisma) {
  return await db.like.delete({
    where: {
      userId_postId: {
        userId,
        postId,
      },
    },
  });
}

export async function findLike({ postId, userId }, db = prisma) {
  return await db.like.findUnique({
    where: {
      userId_postId: {
        userId,
        postId,
      },
    },
  });
}

export async function countLikes(postId, db = prisma) {
  return await db.like.count({
    where: { postId },
  });
}

export async function isPostLikedByUser(postId, userId, db = prisma) {
  if (!postId || !userId || !db.like?.findUnique) return false;
  const like = await db.like.findUnique({
    where: {
      userId_postId: {
        userId,
        postId,
      },
    },
  });
  return Boolean(like);
}

// ============================================================
// COMMENTS
// ============================================================

export async function createComment({ postId, userId, content, parentId = null }, db = prisma) {
  return await db.comment.create({
    data: {
      postId,
      userId,
      content,
      parentId,
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          profile: {
            select: {
              displayName: true,
              level: true,
              vipLevel: true,
              svipLevel: true,
              nobleRank: true,
            },
          },
        },
      },
    },
  });
}

export async function findCommentById(id, db = prisma) {
  if (!id) return null;
  return await db.comment.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
        },
      },
      post: {
        select: {
          id: true,
          userId: true,
          visibility: true,
        },
      },
    },
  });
}

export async function findCommentsByPost(
  postId,
  { page = 1, limit = 20, parentId = null } = {},
  db = prisma
) {
  const parsedLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  const parsedPage = Math.max(1, Number(page) || 1);
  const skip = (parsedPage - 1) * parsedLimit;

  const where = {
    postId,
    deletedAt: null,
    parentId: parentId || null,
  };

  const [total, comments] = await Promise.all([
    db.comment.count({ where }),
    db.comment.findMany({
      where,
      skip,
      take: parsedLimit,
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            profile: {
              select: {
                displayName: true,
                level: true,
                vipLevel: true,
                svipLevel: true,
                nobleRank: true,
              },
            },
          },
        },
        replies: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          take: 5,
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
              },
            },
          },
        },
        _count: {
          select: { replies: { where: { deletedAt: null } } },
        },
      },
    }),
  ]);

  return {
    comments,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit) || 1,
    },
  };
}

export async function softDeleteComment(id, db = prisma) {
  return await db.comment.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export async function countComments(postId, db = prisma) {
  return await db.comment.count({
    where: {
      postId,
      deletedAt: null,
    },
  });
}

// ============================================================
// FOLLOWS
// ============================================================

export async function createFollow({ followerId, followingId, status = 'ACCEPTED' }, db = prisma) {
  return await db.follow.create({
    data: {
      followerId,
      followingId,
      status,
    },
  });
}

export async function deleteFollow({ followerId, followingId }, db = prisma) {
  return await db.follow.delete({
    where: {
      followerId_followingId: {
        followerId,
        followingId,
      },
    },
  });
}

export async function findFollow({ followerId, followingId }, db = prisma) {
  return await db.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId,
        followingId,
      },
    },
  });
}

export async function findFollowingUserIds(followerId, db = prisma) {
  const follows = await db.follow.findMany({
    where: {
      followerId,
      status: 'ACCEPTED',
    },
    select: { followingId: true },
  });
  return follows.map((f) => f.followingId);
}

export async function findFollowers(userId, { page = 1, limit = 20 } = {}, db = prisma) {
  const parsedLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  const parsedPage = Math.max(1, Number(page) || 1);
  const skip = (parsedPage - 1) * parsedLimit;

  const where = {
    followingId: userId,
    status: 'ACCEPTED',
  };

  const [total, follows] = await Promise.all([
    db.follow.count({ where }),
    db.follow.findMany({
      where,
      skip,
      take: parsedLimit,
      orderBy: { createdAt: 'desc' },
      include: {
        follower: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            status: true,
            profile: {
              select: {
                displayName: true,
                level: true,
                isPrivate: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    followers: follows.map((f) => f.follower),
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit) || 1,
    },
  };
}

export async function findFollowing(userId, { page = 1, limit = 20 } = {}, db = prisma) {
  const parsedLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  const parsedPage = Math.max(1, Number(page) || 1);
  const skip = (parsedPage - 1) * parsedLimit;

  const where = {
    followerId: userId,
    status: 'ACCEPTED',
  };

  const [total, follows] = await Promise.all([
    db.follow.count({ where }),
    db.follow.findMany({
      where,
      skip,
      take: parsedLimit,
      orderBy: { createdAt: 'desc' },
      include: {
        following: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            status: true,
            profile: {
              select: {
                displayName: true,
                level: true,
                isPrivate: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    following: follows.map((f) => f.following),
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit) || 1,
    },
  };
}

// ============================================================
// PROFILE COUNTERS
// ============================================================

export async function incrementFollowersCount(userId, db = prisma) {
  return await db.userProfile.updateMany({
    where: { userId },
    data: { followersCount: { increment: 1 } },
  });
}

export async function decrementFollowersCount(userId, db = prisma) {
  const profile = await db.userProfile.findUnique({ where: { userId } });
  if (!profile || profile.followersCount <= 0) return profile;
  return await db.userProfile.update({
    where: { userId },
    data: { followersCount: { decrement: 1 } },
  });
}

export async function incrementFollowingCount(userId, db = prisma) {
  return await db.userProfile.updateMany({
    where: { userId },
    data: { followingCount: { increment: 1 } },
  });
}

export async function decrementFollowingCount(userId, db = prisma) {
  const profile = await db.userProfile.findUnique({ where: { userId } });
  if (!profile || profile.followingCount <= 0) return profile;
  return await db.userProfile.update({
    where: { userId },
    data: { followingCount: { decrement: 1 } },
  });
}

export async function incrementPostsCount(userId, db = prisma) {
  if (!db.userProfile?.updateMany && !db.userProfile?.update) return null;
  return await db.userProfile.updateMany({
    where: { userId },
    data: { postsCount: { increment: 1 } },
  });
}

export async function decrementPostsCount(userId, db = prisma) {
  if (!db.userProfile?.findUnique) return null;
  const profile = await db.userProfile.findUnique({ where: { userId } });
  if (!profile || profile.postsCount <= 0) return profile;
  return await db.userProfile.update({
    where: { userId },
    data: { postsCount: { decrement: 1 } },
  });
}

// ============================================================
// USER BLOCKS
// ============================================================

export async function createBlock({ blockerId, blockedId }, db = prisma) {
  return await db.userBlock.create({
    data: {
      blockerId,
      blockedId,
    },
  });
}

export async function deleteBlock({ blockerId, blockedId }, db = prisma) {
  return await db.userBlock.delete({
    where: {
      blockerId_blockedId: {
        blockerId,
        blockedId,
      },
    },
  });
}

export async function isBlocked(userA, userB, db = prisma) {
  if (!userA || !userB || userA === userB || !db.userBlock?.findFirst) return false;
  const block = await db.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: userA, blockedId: userB },
        { blockerId: userB, blockedId: userA },
      ],
    },
  });
  return Boolean(block);
}

export async function findBlockedUserIds(userId, db = prisma) {
  if (!userId) return [];
  const [blockedByMe, blockedMe] = await Promise.all([
    db.userBlock.findMany({
      where: { blockerId: userId },
      select: { blockedId: true },
    }),
    db.userBlock.findMany({
      where: { blockedId: userId },
      select: { blockerId: true },
    }),
  ]);

  const set = new Set([
    ...blockedByMe.map((b) => b.blockedId),
    ...blockedMe.map((b) => b.blockerId),
  ]);
  return Array.from(set);
}

// ============================================================
// REPORTS & MODERATION HOOKS
// ============================================================

export async function createReport(data, db = prisma) {
  return await db.report.create({
    data: {
      reporterUserId: data.reporterUserId,
      reportedUserId: data.reportedUserId || null,
      reportedPostId: data.reportedPostId || null,
      reportedCommentId: data.reportedCommentId || null,
      reportedRoomId: data.reportedRoomId || null,
      violationType: data.violationType || 'SPAM',
      description: data.description || null,
      screenshotUrl: data.screenshotUrl || null,
      status: 'PENDING',
    },
  });
}

// ============================================================
// SOCIAL PROFILE & PRIVACY
// ============================================================

export async function updateUserPrivacy(userId, isPrivate, db = prisma) {
  return await db.userProfile.update({
    where: { userId },
    data: { isPrivate: Boolean(isPrivate) },
  });
}

export async function findSocialProfile(userId, db = prisma) {
  return await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      avatarUrl: true,
      bio: true,
      status: true,
      createdAt: true,
      profile: {
        select: {
          displayName: true,
          level: true,
          vipLevel: true,
          svipLevel: true,
          nobleRank: true,
          isPrivate: true,
          followersCount: true,
          followingCount: true,
          postsCount: true,
        },
      },
    },
  });
}

export default {
  createLike,
  deleteLike,
  findLike,
  countLikes,
  isPostLikedByUser,
  createComment,
  findCommentById,
  findCommentsByPost,
  softDeleteComment,
  countComments,
  createFollow,
  deleteFollow,
  findFollow,
  findFollowingUserIds,
  findFollowers,
  findFollowing,
  incrementFollowersCount,
  decrementFollowersCount,
  incrementFollowingCount,
  decrementFollowingCount,
  incrementPostsCount,
  decrementPostsCount,
  createBlock,
  deleteBlock,
  isBlocked,
  findBlockedUserIds,
  createReport,
  updateUserPrivacy,
  findSocialProfile,
};
