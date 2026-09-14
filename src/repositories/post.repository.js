import prisma from '../config/database.js';

/**
 * Post Repository
 * Data access layer for Posts, Feed queries, Cursor Pagination, and Counters.
 */

export async function createPost(
  { userId, content, mediaUrls = [], visibility = 'PUBLIC' },
  db = prisma
) {
  return await db.post.create({
    data: {
      userId,
      content,
      mediaUrls: Array.isArray(mediaUrls) ? mediaUrls : [],
      visibility,
      likesCount: 0,
      commentsCount: 0,
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
              isPrivate: true,
            },
          },
        },
      },
    },
  });
}

/**
 * Cursor-based feed querying with stable deterministic ordering [createdAt DESC, id DESC].
 */
export async function findFeedPosts(
  {
    viewerUserId = null,
    feedType = 'PUBLIC',
    authorUserId = null,
    followingUserIds = [],
    blockedUserIds = [],
    cursor = null,
    limit = 20,
    page = null,
  } = {},
  db = prisma
) {
  const parsedLimit = Math.max(1, Math.min(100, Number(limit) || 20));

  const where = {
    deletedAt: null,
  };

  // Block filter: exclude posts by blocked users and users who blocked the viewer
  if (blockedUserIds && blockedUserIds.length > 0) {
    where.userId = { notIn: blockedUserIds };
  }

  // Author filter (e.g. Viewing a specific user profile posts)
  if (authorUserId) {
    where.userId = authorUserId;
  } else if (feedType === 'FOLLOWING' && followingUserIds.length > 0) {
    where.userId = { in: followingUserIds };
  }

  // Visibility rules:
  // - If authorUserId === viewerUserId, viewer can see their own PUBLIC, FOLLOWERS, and PRIVATE posts.
  // - If viewing a followed user, viewer can see PUBLIC and FOLLOWERS posts.
  // - Otherwise, viewer only sees PUBLIC posts.
  if (!authorUserId || authorUserId !== viewerUserId) {
    if (followingUserIds.includes(authorUserId)) {
      where.visibility = { in: ['PUBLIC', 'FOLLOWERS'] };
    } else if (feedType !== 'FOLLOWING') {
      where.visibility = 'PUBLIC';
    }
  }

  // Cursor-based pagination vs offset pagination
  if (cursor) {
    // Decode cursor: base64(createdAt:id) or raw ID
    let cursorDate = null;
    let cursorId = null;

    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      const parts = decoded.split(':');
      if (parts.length === 2) {
        cursorDate = new Date(parts[0]);
        cursorId = parts[1];
      } else {
        cursorId = cursor;
      }
    } catch {
      cursorId = cursor;
    }

    if (cursorDate && !isNaN(cursorDate.getTime()) && cursorId) {
      where.OR = [
        { createdAt: { lt: cursorDate } },
        { createdAt: cursorDate, id: { lt: cursorId } },
      ];
    } else if (cursorId) {
      // Fallback: cursor by ID only
      const targetPost = await db.post.findUnique({ where: { id: cursorId } });
      if (targetPost) {
        where.OR = [
          { createdAt: { lt: targetPost.createdAt } },
          { createdAt: targetPost.createdAt, id: { lt: targetPost.id } },
        ];
      }
    }
  }

  const queryArgs = {
    where,
    take: parsedLimit + 1, // Fetch one extra to determine nextCursor
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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
              isPrivate: true,
            },
          },
        },
      },
      _count: {
        select: {
          comments: { where: { deletedAt: null } },
          likes: true,
        },
      },
    },
  };

  // If offset page requested
  if (page && !cursor) {
    const parsedPage = Math.max(1, Number(page) || 1);
    const skip = (parsedPage - 1) * parsedLimit;
    const [total, posts] = await Promise.all([
      db.post.count({ where }),
      db.post.findMany({
        ...queryArgs,
        take: parsedLimit,
        skip,
      }),
    ]);

    return {
      posts,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages: Math.ceil(total / parsedLimit) || 1,
      },
    };
  }

  const rawPosts = await db.post.findMany(queryArgs);
  const hasMore = rawPosts.length > parsedLimit;
  const posts = hasMore ? rawPosts.slice(0, parsedLimit) : rawPosts;

  let nextCursor = null;
  if (hasMore && posts.length > 0) {
    const lastItem = posts[posts.length - 1];
    nextCursor = Buffer.from(`${lastItem.createdAt.toISOString()}:${lastItem.id}`).toString('base64');
  }

  return {
    posts,
    meta: {
      limit: parsedLimit,
      hasMore,
      nextCursor,
    },
  };
}

export async function findPostById(id, db = prisma) {
  if (!id) return null;
  return await db.post.findFirst({
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
          status: true,
          profile: {
            select: {
              displayName: true,
              level: true,
              vipLevel: true,
              svipLevel: true,
              nobleRank: true,
              isPrivate: true,
            },
          },
        },
      },
    },
  });
}

export async function softDeletePost(id, db = prisma) {
  return await db.post.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export async function incrementLikesCount(postId, db = prisma) {
  return await db.post.update({
    where: { id: postId },
    data: { likesCount: { increment: 1 } },
  });
}

export async function decrementLikesCount(postId, db = prisma) {
  // Use raw or guarded update to prevent negative likesCount
  const post = await db.post.findUnique({ where: { id: postId } });
  if (!post || post.likesCount <= 0) {
    return post;
  }
  return await db.post.update({
    where: { id: postId },
    data: { likesCount: { decrement: 1 } },
  });
}

export async function incrementCommentsCount(postId, db = prisma) {
  return await db.post.update({
    where: { id: postId },
    data: { commentsCount: { increment: 1 } },
  });
}

export async function decrementCommentsCount(postId, db = prisma) {
  const post = await db.post.findUnique({ where: { id: postId } });
  if (!post || post.commentsCount <= 0) {
    return post;
  }
  return await db.post.update({
    where: { id: postId },
    data: { commentsCount: { decrement: 1 } },
  });
}

export default {
  createPost,
  findFeedPosts,
  findPostById,
  softDeletePost,
  incrementLikesCount,
  decrementLikesCount,
  incrementCommentsCount,
  decrementCommentsCount,
};
