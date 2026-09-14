import { describe, it } from 'node:test';
import assert from 'node:assert';
import { followUser, getFollowers, getFollowing } from '../src/services/social.service.js';

describe('Phase 6 Follow Privacy & Block Workflow Suite', () => {
  it('creates PENDING follow request when following a private account without mutating counters', async () => {
    let createdFollow = null;
    let counterMutated = false;

    const mockPrivateUser = {
      id: 'usr-priv-1',
      username: 'private_account',
      profile: { isPrivate: true },
    };

    const mockDb = {
      user: {
        findUnique: async () => mockPrivateUser,
      },
      userBlock: {
        findFirst: async () => null,
      },
      follow: {
        findUnique: async () => null,
        create: async (args) => {
          createdFollow = args.data;
          return createdFollow;
        },
      },
      userProfile: {
        updateMany: async () => {
          counterMutated = true;
          return { count: 1 };
        },
      },
    };

    const result = await followUser('usr-requester', 'usr-priv-1', mockDb);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.status, 'PENDING');
    assert.strictEqual(counterMutated, false, 'Pending follow request must not increment follower counts yet');
  });

  it('blocks follow attempt if blocker relationship exists between users', async () => {
    const mockTargetUser = {
      id: 'usr-blocked-target',
      username: 'target',
      profile: { isPrivate: false },
    };

    const mockDb = {
      user: {
        findUnique: async () => mockTargetUser,
      },
      userBlock: {
        findFirst: async () => ({ id: 'blk-1' }), // Block exists
      },
    };

    await assert.rejects(
      async () => {
        await followUser('usr-hater', 'usr-blocked-target', mockDb);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, 'USER_BLOCKED');
        return true;
      }
    );
  });

  it('restricts follower list inspection on private accounts for strangers', async () => {
    const mockPrivateUser = {
      id: 'usr-priv-list',
      profile: { isPrivate: true },
    };

    const mockDb = {
      user: {
        findUnique: async () => mockPrivateUser,
      },
      follow: {
        findUnique: async () => null, // Stranger
      },
    };

    await assert.rejects(
      async () => {
        await getFollowers('usr-priv-list', { viewerUserId: 'usr-stranger' }, mockDb);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 404);
        assert.strictEqual(err.code, 'USER_NOT_FOUND');
        return true;
      }
    );
  });
});
