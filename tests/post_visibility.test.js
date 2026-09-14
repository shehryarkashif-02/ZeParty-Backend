import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getPostById } from '../src/services/social.service.js';

describe('Phase 6 Post Visibility & Access Control Suite', () => {
  it('allows any user to read a PUBLIC post', async () => {
    const mockPublicPost = {
      id: 'post-pub-1',
      userId: 'usr-author-1',
      visibility: 'PUBLIC',
      deletedAt: null,
      user: { id: 'usr-author-1', profile: { isPrivate: false } },
    };

    const mockDb = {
      post: {
        findFirst: async () => mockPublicPost,
      },
    };

    const post = await getPostById('post-pub-1', 'usr-any-stranger', {}, mockDb);
    assert.strictEqual(post.id, 'post-pub-1');
  });

  it('restricts FOLLOWERS-only post to accepted followers and blocks non-followers with 403', async () => {
    const mockFollowersPost = {
      id: 'post-foll-1',
      userId: 'usr-author-1',
      visibility: 'FOLLOWERS',
      deletedAt: null,
      user: { id: 'usr-author-1', profile: { isPrivate: false } },
    };

    const mockDb = {
      post: {
        findFirst: async () => mockFollowersPost,
      },
      follow: {
        findUnique: async ({ where }) => {
          if (where.followerId_followingId.followerId === 'usr-follower') {
            return { status: 'ACCEPTED' };
          }
          return null; // Not following
        },
      },
      userBlock: {
        findFirst: async () => null,
      },
    };

    // 1. Non-follower attempts access -> 403
    await assert.rejects(
      async () => {
        await getPostById('post-foll-1', 'usr-stranger', {}, mockDb);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, 'FORBIDDEN_FOLLOWERS_ONLY');
        return true;
      }
    );

    // 2. Follower attempts access -> 200 OK
    const post = await getPostById('post-foll-1', 'usr-follower', {}, mockDb);
    assert.strictEqual(post.id, 'post-foll-1');
  });

  it('restricts PRIVATE post strictly to author and blocks other users with 403', async () => {
    const mockPrivatePost = {
      id: 'post-priv-1',
      userId: 'usr-author-1',
      visibility: 'PRIVATE',
      deletedAt: null,
      user: { id: 'usr-author-1', profile: { isPrivate: false } },
    };

    const mockDb = {
      post: {
        findFirst: async () => mockPrivatePost,
      },
      userBlock: {
        findFirst: async () => null,
      },
    };

    // Other user rejected
    await assert.rejects(
      async () => {
        await getPostById('post-priv-1', 'usr-other', {}, mockDb);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, 'FORBIDDEN_PRIVATE_POST');
        return true;
      }
    );

    // Author allowed
    const post = await getPostById('post-priv-1', 'usr-author-1', {}, mockDb);
    assert.strictEqual(post.id, 'post-priv-1');
  });

  it('hides post completely (404) if author and viewer have an active block relationship', async () => {
    const mockPost = {
      id: 'post-blocked-1',
      userId: 'usr-author-blocked',
      visibility: 'PUBLIC',
      deletedAt: null,
      user: { id: 'usr-author-blocked', profile: { isPrivate: false } },
    };

    const mockDb = {
      post: {
        findFirst: async () => mockPost,
      },
      userBlock: {
        findFirst: async () => ({ id: 'block-1' }), // Block exists
      },
    };

    await assert.rejects(
      async () => {
        await getPostById('post-blocked-1', 'usr-viewer', {}, mockDb);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 404);
        assert.strictEqual(err.code, 'POST_NOT_FOUND');
        return true;
      }
    );
  });

  it('allows Admin to view any post regardless of visibility or private status', async () => {
    const mockPrivatePost = {
      id: 'post-admin-view',
      userId: 'usr-author-1',
      visibility: 'PRIVATE',
      deletedAt: null,
      user: { id: 'usr-author-1', profile: { isPrivate: true } },
    };

    const mockDb = {
      post: {
        findFirst: async () => mockPrivatePost,
      },
    };

    const post = await getPostById('post-admin-view', 'usr-admin-1', { isAdmin: true }, mockDb);
    assert.strictEqual(post.id, 'post-admin-view');
  });
});
