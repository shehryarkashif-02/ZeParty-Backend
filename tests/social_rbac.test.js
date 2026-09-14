import { describe, it } from 'node:test';
import assert from 'node:assert';
import { deletePost } from '../src/services/social.service.js';
import requirePermission from '../src/middlewares/requirePermission.js';

describe('Phase 6 Social RBAC & Admin Moderation Suite', () => {
  it('allows administrator holding delete_user_posts permission to delete any post', async () => {
    let auditWritten = false;
    let postDeleted = false;

    const mockPost = {
      id: 'p-toxic-1',
      userId: 'usr-bad-actor',
      content: 'Inappropriate content',
      deletedAt: null,
    };

    const mockDb = {
      post: {
        findFirst: async () => mockPost,
        findUnique: async () => mockPost,
        update: async () => {
          postDeleted = true;
          return { ...mockPost, deletedAt: new Date() };
        },
      },
      userProfile: {
        findUnique: async () => ({ postsCount: 1 }),
        update: async () => ({ postsCount: 0 }),
      },
      auditLog: {
        create: async (args) => {
          auditWritten = true;
          assert.strictEqual(args.data.action, 'ADMIN_DELETE_POST');
          assert.strictEqual(args.data.targetEntityId, 'p-toxic-1');
          return { id: 'audit-1' };
        },
      },
    };

    const result = await deletePost(
      'p-toxic-1',
      null,
      {
        isAdmin: true,
        adminId: 'admin-mod-1',
        adminName: 'Moderator Alex',
        reason: 'Violated Terms of Service',
      },
      mockDb
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(postDeleted, true);
    assert.strictEqual(auditWritten, true);
  });

  it('enforces requirePermission middleware on admin post deletion route', async () => {
    const middleware = requirePermission('delete_user_posts');

    const reqWithoutPerm = {
      auth: {
        userId: {
          id: 'admin-limited',
          role: { permissions: [{ permissionId: 'view_banners' }] },
        },
        isAdmin: true,
        isOwner: false,
      },
    };

    let statusCode = null;
    let jsonBody = null;
    const res = {
      status(code) {
        statusCode = code;
        return {
          json(body) {
            jsonBody = body;
          },
        };
      },
    };

    await middleware(reqWithoutPerm, res, () => {});

    assert.strictEqual(statusCode, 403);
    assert.strictEqual(jsonBody.error.code, 'FORBIDDEN');
  });
});
