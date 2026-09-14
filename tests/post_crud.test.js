import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createPost, getPostById, deletePost } from '../src/services/social.service.js';

describe('Phase 6 Post CRUD & Ownership Lifecycle Suite', () => {
  it('creates post with author reference, visibility, and increments post count', async () => {
    let createdPost = null;
    let incrementedUser = null;

    const mockDb = {
      post: {
        create: async (args) => {
          createdPost = {
            id: 'post-new-1',
            ...args.data,
            createdAt: new Date(),
            user: { id: args.data.userId, username: 'creator_1' },
          };
          return createdPost;
        },
      },
      userProfile: {
        updateMany: async (args) => {
          incrementedUser = args.where.userId;
          return { count: 1 };
        },
      },
    };

    const post = await createPost(
      {
        userId: 'usr-creator-1',
        content: 'Exciting live stream starting soon!',
        mediaUrls: ['https://cdn.zeparty.app/posts/image1.jpg'],
        visibility: 'PUBLIC',
      },
      mockDb
    );

    assert.strictEqual(post.id, 'post-new-1');
    assert.strictEqual(post.userId, 'usr-creator-1');
    assert.strictEqual(post.visibility, 'PUBLIC');
    assert.strictEqual(incrementedUser, 'usr-creator-1');
  });

  it('retrieves post by ID and verifies content and author details', async () => {
    const mockPost = {
      id: 'post-view-1',
      userId: 'usr-author-1',
      content: 'Hello World',
      visibility: 'PUBLIC',
      likesCount: 10,
      commentsCount: 2,
      deletedAt: null,
      user: {
        id: 'usr-author-1',
        username: 'author_1',
        avatarUrl: 'https://cdn.zeparty.app/a.png',
        profile: { isPrivate: false },
      },
    };

    const mockDb = {
      post: {
        findFirst: async () => mockPost,
      },
      like: {
        findUnique: async () => ({ userId: 'usr-viewer', postId: 'post-view-1' }),
      },
    };

    const post = await getPostById('post-view-1', 'usr-viewer', {}, mockDb);

    assert.strictEqual(post.id, 'post-view-1');
    assert.strictEqual(post.content, 'Hello World');
    assert.strictEqual(post.isLiked, true);
  });

  it('soft deletes post and decrements posts count', async () => {
    let softDeletedId = null;
    let decrementedUser = null;

    const mockPost = {
      id: 'post-del-1',
      userId: 'usr-author-1',
      content: 'To be deleted',
      deletedAt: null,
    };

    const mockDb = {
      post: {
        findFirst: async () => mockPost,
        findUnique: async () => mockPost,
        update: async (args) => {
          softDeletedId = args.where.id;
          return { ...mockPost, deletedAt: new Date() };
        },
      },
      userProfile: {
        findUnique: async () => ({ postsCount: 5 }),
        update: async (args) => {
          decrementedUser = args.where.userId;
          return { userId: args.where.userId, postsCount: 4 };
        },
      },
    };

    const result = await deletePost('post-del-1', 'usr-author-1', {}, mockDb);

    assert.strictEqual(result.success, true);
    assert.strictEqual(softDeletedId, 'post-del-1');
    assert.strictEqual(decrementedUser, 'usr-author-1');
  });
});
