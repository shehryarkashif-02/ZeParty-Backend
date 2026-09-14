import { describe, it } from 'node:test';
import assert from 'node:assert';
import { moderateContent } from '../src/services/moderation.service.js';

describe('Phase 8 Social Content Moderation Suite', () => {
  it('moderator soft deletes offending post and adjusts post counter atomically', async () => {
    let updatedDeletedAt = null;
    let postCountUpdated = false;

    const mockDb = {
      post: {
        findUnique: async () => ({
          id: 'post-violating-1',
          userId: 'usr-author-1',
          content: 'Violating community standards',
        }),
        update: async (args) => {
          updatedDeletedAt = args.data.deletedAt;
          return { id: 'post-violating-1', deletedAt: updatedDeletedAt };
        },
      },
      userProfile: {
        updateMany: async () => {
          postCountUpdated = true;
          return { count: 1 };
        },
      },
      moderationAction: {
        create: async (args) => ({ id: 'act-1', ...args.data }),
      },
      auditLog: {
        create: async () => ({ id: 'audit-1' }),
      },
    };

    const res = await moderateContent(
      {
        targetType: 'POST',
        targetId: 'post-violating-1',
        action: 'DELETE_POST',
        reason: 'Hate speech policy violation',
        adminId: 'admin-mod-1',
        adminName: 'Lead Mod',
      },
      mockDb
    );

    assert.strictEqual(res.success, true);
    assert.ok(updatedDeletedAt instanceof Date);
    assert.strictEqual(postCountUpdated, true);
  });
});
