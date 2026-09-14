import { describe, it } from 'node:test';
import assert from 'node:assert';
import { likePost, followUser } from '../src/services/social.service.js';

describe('Phase 6 Social Concurrency & Race Condition Suite', () => {
  it('prevents duplicate Likes when multiple concurrent like requests occur from the same user', async () => {
    let likeRecordsCreated = 0;
    let postLikes = 10;
    const existingLikes = new Set();

    const mockPost = {
      id: 'p-conc-like',
      userId: 'usr-author',
      likesCount: postLikes,
    };

    const mockDb = {
      post: {
        findFirst: async () => mockPost,
        update: async () => {
          postLikes++;
          return { ...mockPost, likesCount: postLikes };
        },
      },
      like: {
        findUnique: async ({ where }) => {
          const key = `${where.userId_postId.userId}:${where.userId_postId.postId}`;
          return existingLikes.has(key) ? { id: 'l1' } : null;
        },
        create: async ({ data }) => {
          const key = `${data.userId}:${data.postId}`;
          if (existingLikes.has(key)) {
            const err = new Error('Unique constraint failed');
            err.code = 'P2002';
            throw err;
          }
          existingLikes.add(key);
          likeRecordsCreated++;
          return data;
        },
      },
    };

    // Parallel requests
    const [res1, res2] = await Promise.all([
      likePost('p-conc-like', 'usr-concurrent-user', mockDb),
      likePost('p-conc-like', 'usr-concurrent-user', mockDb),
    ]);

    assert.strictEqual(likeRecordsCreated, 1, 'Only 1 like record must be created');
    assert.strictEqual(res1.success, true);
    assert.strictEqual(res2.success, true);
    assert.strictEqual(postLikes, 11, 'Like counter must be incremented exactly once');
  });

  it('prevents duplicate Follow relationships when parallel follow requests occur', async () => {
    let followRecordsCreated = 0;
    const existingFollows = new Set();

    const mockTargetUser = {
      id: 'usr-target-conc',
      profile: { isPrivate: false },
    };

    const mockDb = {
      user: { findUnique: async () => mockTargetUser },
      userBlock: { findFirst: async () => null },
      follow: {
        findUnique: async ({ where }) => {
          const key = `${where.followerId_followingId.followerId}:${where.followerId_followingId.followingId}`;
          return existingFollows.has(key) ? { id: 'f1', status: 'ACCEPTED' } : null;
        },
        create: async ({ data }) => {
          const key = `${data.followerId}:${data.followingId}`;
          if (existingFollows.has(key)) {
            const err = new Error('Unique constraint failed');
            err.code = 'P2002';
            throw err;
          }
          existingFollows.add(key);
          followRecordsCreated++;
          return data;
        },
      },
      userProfile: { updateMany: async () => ({ count: 1 }) },
    };

    const [f1, f2] = await Promise.all([
      followUser('usr-conc-follower', 'usr-target-conc', mockDb),
      followUser('usr-conc-follower', 'usr-target-conc', mockDb),
    ]);

    assert.strictEqual(followRecordsCreated, 1, 'Only 1 follow record must be created');
    assert.strictEqual(f1.success, true);
    assert.strictEqual(f2.success, true);
  });
});
