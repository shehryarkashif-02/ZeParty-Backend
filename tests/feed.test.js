import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getFeed } from '../src/services/social.service.js';

describe('Phase 6 Social Feed Generation Suite', () => {
  it('generates public feed filtering out blocked users and deleted posts', async () => {
    let capturedWhere = null;

    const mockDb = {
      follow: {
        findMany: async () => [],
      },
      userBlock: {
        findMany: async (args) => {
          if (args.where.blockerId === 'usr-me') {
            return [{ blockedId: 'usr-spammer' }];
          }
          return [{ blockerId: 'usr-hater' }];
        },
      },
      post: {
        findMany: async (args) => {
          capturedWhere = args.where;
          return [
            {
              id: 'p1',
              userId: 'usr-creator',
              content: 'Party post',
              visibility: 'PUBLIC',
              createdAt: new Date(),
              user: { username: 'creator' },
              _count: { comments: 0, likes: 0 },
            },
          ];
        },
      },
    };

    const feed = await getFeed({ viewerUserId: 'usr-me', feedType: 'PUBLIC', limit: 10 }, mockDb);

    assert.strictEqual(feed.posts.length, 1);
    assert.strictEqual(capturedWhere.deletedAt, null);
    // Blocked IDs 'usr-spammer' and 'usr-hater' must be excluded
    assert.deepStrictEqual(capturedWhere.userId.notIn.sort(), ['usr-hater', 'usr-spammer'].sort());
  });

  it('generates FOLLOWING feed strictly containing posts from followed users', async () => {
    let capturedWhere = null;

    const mockDb = {
      follow: {
        findMany: async () => [{ followingId: 'usr-star-1' }, { followingId: 'usr-star-2' }],
      },
      userBlock: {
        findMany: async () => [],
      },
      post: {
        findMany: async (args) => {
          capturedWhere = args.where;
          return [
            {
              id: 'p-f1',
              userId: 'usr-star-1',
              content: 'Followed creator post',
              visibility: 'PUBLIC',
              createdAt: new Date(),
              user: { username: 'star1' },
              _count: { comments: 0, likes: 0 },
            },
          ];
        },
      },
    };

    const feed = await getFeed({ viewerUserId: 'usr-me', feedType: 'FOLLOWING', limit: 20 }, mockDb);

    assert.strictEqual(feed.posts.length, 1);
    assert.deepStrictEqual(capturedWhere.userId, { in: ['usr-star-1', 'usr-star-2'] });
  });

  it('returns empty feed when querying posts of a private account if viewer is not following', async () => {
    const mockDb = {
      user: {
        findUnique: async () => ({
          id: 'usr-target-priv',
          profile: { isPrivate: true },
        }),
      },
      follow: {
        findMany: async () => [], // Viewer follows no one
      },
      userBlock: {
        findMany: async () => [],
      },
    };

    const feed = await getFeed(
      {
        viewerUserId: 'usr-stranger',
        authorUserId: 'usr-target-priv',
      },
      mockDb
    );

    assert.strictEqual(feed.posts.length, 0);
    assert.strictEqual(feed.meta.isPrivateProfile, true);
  });
});
