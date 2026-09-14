import { describe, it } from 'node:test';
import assert from 'node:assert';
import { followUser, unfollowUser, getFollowers, getFollowing } from '../src/services/social.service.js';

describe('Phase 6 User Follow & Graph Invariant Suite', () => {
  it('follows a public user, creates Follow record, and increments follower/following counts', async () => {
    let createdFollow = null;
    let followerIncremented = false;
    let followingIncremented = false;

    const mockTargetUser = {
      id: 'usr-target-1',
      username: 'target_host',
      profile: { isPrivate: false },
    };

    const mockDb = {
      user: {
        findUnique: async () => mockTargetUser,
      },
      userBlock: {
        findFirst: async () => null,
      },
      follow: {
        findUnique: async () => null, // Not yet following
        create: async (args) => {
          createdFollow = args.data;
          return createdFollow;
        },
      },
      userProfile: {
        updateMany: async (args) => {
          if (args.where.userId === 'usr-me') followingIncremented = true;
          if (args.where.userId === 'usr-target-1') followerIncremented = true;
          return { count: 1 };
        },
      },
    };

    const result = await followUser('usr-me', 'usr-target-1', mockDb);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.alreadyFollowing, false);
    assert.strictEqual(result.status, 'ACCEPTED');
    assert.strictEqual(followerIncremented, true);
    assert.strictEqual(followingIncremented, true);
  });

  it('rejects attempt to follow yourself with 400 CANNOT_FOLLOW_SELF', async () => {
    await assert.rejects(
      async () => {
        await followUser('usr-same', 'usr-same');
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, 'CANNOT_FOLLOW_SELF');
        return true;
      }
    );
  });

  it('unfollows a user and decrements follower/following counts', async () => {
    let deletedFollow = false;
    let followerDecremented = false;
    let followingDecremented = false;

    const mockDb = {
      follow: {
        findUnique: async () => ({ followerId: 'usr-me', followingId: 'usr-star', status: 'ACCEPTED' }),
        delete: async () => {
          deletedFollow = true;
          return { followerId: 'usr-me', followingId: 'usr-star' };
        },
      },
      userProfile: {
        findUnique: async () => ({ followingCount: 5, followersCount: 10 }),
        update: async (args) => {
          if (args.where.userId === 'usr-me') followingDecremented = true;
          if (args.where.userId === 'usr-star') followerDecremented = true;
          return { userId: args.where.userId };
        },
      },
    };

    const result = await unfollowUser('usr-me', 'usr-star', mockDb);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.alreadyUnfollowed, false);
    assert.strictEqual(deletedFollow, true);
    assert.strictEqual(followingDecremented, true);
    assert.strictEqual(followerDecremented, true);
  });
});
