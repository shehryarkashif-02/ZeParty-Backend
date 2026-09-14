import { describe, it } from 'node:test';
import assert from 'node:assert';
import { moderateUser, moderateContent } from '../src/services/moderation.service.js';

describe('Phase 8 Moderation Actions Suite', () => {
  it('executes user warning, muting, and banning actions', async () => {
    const mockUser = {
      id: 'usr-mod-target-1',
      username: 'toxic_user',
      status: 'ACTIVE',
    };

    let updatedStatus = null;
    let createdRestriction = null;
    let recordedAction = null;

    const mockDb = {
      user: {
        findUnique: async () => mockUser,
        update: async (args) => {
          updatedStatus = args.data.status;
          return { ...mockUser, status: updatedStatus };
        },
      },
      restriction: {
        create: async (args) => {
          createdRestriction = { id: 'rst-001', ...args.data };
          return createdRestriction;
        },
      },
      moderationAction: {
        create: async (args) => {
          recordedAction = { id: 'act-001', ...args.data };
          return recordedAction;
        },
      },
      auditLog: {
        create: async () => ({ id: 'audit-001' }),
      },
    };

    // 1. Issue Warning
    const warnRes = await moderateUser(
      {
        targetUserId: 'usr-mod-target-1',
        action: 'WARN',
        reason: 'Violation of live room chat rules',
        adminId: 'admin-mod-1',
        adminName: 'Mod Chief',
      },
      mockDb
    );
    assert.strictEqual(warnRes.success, true);
    assert.strictEqual(recordedAction.action, 'WARN');

    // 2. Apply Permanent Ban
    const banRes = await moderateUser(
      {
        targetUserId: 'usr-mod-target-1',
        action: 'PERM_BAN',
        reason: 'Severe TOS violation - malicious automation',
        adminId: 'admin-mod-1',
        adminName: 'Mod Chief',
      },
      mockDb
    );

    assert.strictEqual(banRes.success, true);
    assert.strictEqual(updatedStatus, 'BANNED');
    assert.strictEqual(createdRestriction.type, 'BAN');
    assert.strictEqual(createdRestriction.expiresAt, null);
  });

  it('executes content moderation removing posts and comments', async () => {
    let postDeletedAt = null;
    let commentDeletedAt = null;

    const mockDb = {
      post: {
        findUnique: async () => ({ id: 'post-mod-1', userId: 'usr-author-1' }),
        update: async (args) => {
          postDeletedAt = args.data.deletedAt;
          return { id: 'post-mod-1', deletedAt: postDeletedAt };
        },
      },
      userProfile: {
        updateMany: async () => ({ count: 1 }),
      },
      comment: {
        findUnique: async () => ({ id: 'cmt-mod-1', postId: 'post-mod-1' }),
        update: async (args) => {
          commentDeletedAt = args.data.deletedAt;
          return { id: 'cmt-mod-1', deletedAt: commentDeletedAt };
        },
      },
      moderationAction: {
        create: async (args) => ({ id: 'act-002', ...args.data }),
      },
      auditLog: {
        create: async () => ({ id: 'audit-002' }),
      },
    };

    const postRes = await moderateContent(
      {
        targetType: 'POST',
        targetId: 'post-mod-1',
        action: 'DELETE_POST',
        reason: 'Inappropriate content',
        adminId: 'admin-1',
      },
      mockDb
    );

    assert.strictEqual(postRes.success, true);
    assert.ok(postDeletedAt instanceof Date);

    const cmtRes = await moderateContent(
      {
        targetType: 'COMMENT',
        targetId: 'cmt-mod-1',
        action: 'DELETE_COMMENT',
        reason: 'Harassing comment',
        adminId: 'admin-1',
      },
      mockDb
    );

    assert.strictEqual(cmtRes.success, true);
    assert.ok(commentDeletedAt instanceof Date);
  });
});
