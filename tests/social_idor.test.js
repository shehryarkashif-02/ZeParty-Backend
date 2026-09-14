import { describe, it } from 'node:test';
import assert from 'node:assert';
import { deletePost, deleteComment, getPostById } from '../src/services/social.service.js';

describe('Phase 6 Social IDOR & Multi-Tenant Isolation Suite', () => {
  it('blocks User A from deleting User B post', async () => {
    const mockPost = {
      id: 'p-user-b',
      userId: 'usr-b',
      deletedAt: null,
    };

    const mockDb = {
      post: {
        findFirst: async () => mockPost,
      },
    };

    await assert.rejects(
      async () => {
        await deletePost('p-user-b', 'usr-a', { isAdmin: false }, mockDb);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, 'FORBIDDEN');
        return true;
      }
    );
  });

  it('blocks User A from deleting User B comment on User C post', async () => {
    const mockComment = {
      id: 'c-user-b',
      postId: 'p-user-c',
      userId: 'usr-b', // Written by User B
      deletedAt: null,
      post: { id: 'p-user-c', userId: 'usr-c' }, // Owned by User C
    };

    const mockDb = {
      comment: {
        findFirst: async () => mockComment,
      },
    };

    // User A (neither comment author nor post author) attempts deletion
    await assert.rejects(
      async () => {
        await deleteComment('c-user-b', 'usr-a', { isAdmin: false }, mockDb);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, 'FORBIDDEN');
        return true;
      }
    );
  });

  it('blocks stranger from viewing private post by ID directly (IDOR defense)', async () => {
    const mockPrivatePost = {
      id: 'p-secret-1',
      userId: 'usr-b',
      visibility: 'PRIVATE',
      deletedAt: null,
      user: { id: 'usr-b', profile: { isPrivate: false } },
    };

    const mockDb = {
      post: {
        findFirst: async () => mockPrivatePost,
      },
    };

    await assert.rejects(
      async () => {
        await getPostById('p-secret-1', 'usr-a', { isAdmin: false }, mockDb);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, 'FORBIDDEN_PRIVATE_POST');
        return true;
      }
    );
  });
});
