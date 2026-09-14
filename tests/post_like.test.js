import { describe, it } from 'node:test';
import assert from 'node:assert';
import { likePost, unlikePost } from '../src/services/social.service.js';

describe('Phase 6 Post Likes & Counter Invariant Suite', () => {
  it('likes a post, creates Like record, and atomically increments like count', async () => {
    let createdLike = null;
    let postLikes = 10;

    const mockPost = {
      id: 'post-like-1',
      userId: 'usr-author',
      likesCount: postLikes,
    };

    const mockDb = {
      post: {
        findFirst: async () => mockPost,
        findUnique: async () => mockPost,
        update: async (args) => {
          postLikes += 1;
          return { ...mockPost, likesCount: postLikes };
        },
      },
      like: {
        findUnique: async () => null, // Not yet liked
        create: async (args) => {
          createdLike = args.data;
          return createdLike;
        },
      },
    };

    const result = await likePost('post-like-1', 'usr-fan-1', mockDb);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.alreadyLiked, false);
    assert.strictEqual(result.likesCount, 11);
    assert.deepStrictEqual(createdLike, { postId: 'post-like-1', userId: 'usr-fan-1' });
  });

  it('handles repeated like idempotently without duplicate records or counter inflation', async () => {
    const mockPost = {
      id: 'post-like-2',
      userId: 'usr-author',
      likesCount: 15,
    };

    const mockDb = {
      post: {
        findFirst: async () => mockPost,
      },
      like: {
        findUnique: async () => ({ postId: 'post-like-2', userId: 'usr-fan-1' }), // Already liked
      },
    };

    const result = await likePost('post-like-2', 'usr-fan-1', mockDb);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.alreadyLiked, true);
    assert.strictEqual(result.likesCount, 15);
  });

  it('unlikes a post and decrements like count', async () => {
    let deleted = false;
    let postLikes = 10;

    const mockPost = {
      id: 'post-like-3',
      userId: 'usr-author',
      likesCount: postLikes,
    };

    const mockDb = {
      post: {
        findFirst: async () => mockPost,
        findUnique: async () => ({ ...mockPost, likesCount: postLikes }),
        update: async () => {
          postLikes -= 1;
          return { ...mockPost, likesCount: postLikes };
        },
      },
      like: {
        findUnique: async () => ({ postId: 'post-like-3', userId: 'usr-fan-1' }),
        delete: async () => {
          deleted = true;
          return { id: 'like-1' };
        },
      },
    };

    const result = await unlikePost('post-like-3', 'usr-fan-1', mockDb);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.alreadyUnliked, false);
    assert.strictEqual(result.likesCount, 9);
    assert.strictEqual(deleted, true);
  });

  it('guarantees that like count never drops below zero', async () => {
    const mockPostZero = {
      id: 'post-zero',
      userId: 'usr-author',
      likesCount: 0,
    };

    const mockDb = {
      post: {
        findFirst: async () => mockPostZero,
        findUnique: async () => mockPostZero,
        update: async () => {
          throw new Error('Should not update if count is 0');
        },
      },
      like: {
        findUnique: async () => ({ postId: 'post-zero', userId: 'usr-fan-1' }),
        delete: async () => ({ id: 'like-zero' }),
      },
    };

    const result = await unlikePost('post-zero', 'usr-fan-1', mockDb);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.likesCount, 0, 'Like count must never become negative');
  });
});
