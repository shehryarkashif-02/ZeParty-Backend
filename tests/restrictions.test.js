import { describe, it } from 'node:test';
import assert from 'node:assert';
import { applyRestriction, liftRestriction, isUserRestricted } from '../src/services/restriction.service.js';

describe('Phase 8 Restriction Management Suite', () => {
  it('applies temporary and permanent restrictions', async () => {
    let createdRst = null;
    const mockDb = {
      restriction: {
        create: async (args) => {
          createdRst = { id: 'rst-test-1', ...args.data };
          return createdRst;
        },
      },
      user: {
        findUnique: async () => ({ id: 'usr-1', status: 'ACTIVE' }),
      },
      auditLog: {
        create: async () => ({ id: 'audit-1' }),
      },
    };

    // Temporary restriction
    const tempRst = await applyRestriction(
      {
        userId: 'usr-1',
        targetId: 'usr-1',
        type: 'MUTE',
        reason: 'Temporary room mute',
        durationDays: 7,
      },
      mockDb
    );

    assert.strictEqual(tempRst.type, 'MUTE');
    assert.strictEqual(tempRst.status, 'ACTIVE');
    assert.ok(tempRst.expiresAt instanceof Date);

    // Permanent restriction
    const permRst = await applyRestriction(
      {
        userId: 'usr-1',
        targetId: 'usr-1',
        type: 'BAN',
        reason: 'Permanent platform ban',
        durationDays: null,
      },
      mockDb
    );

    assert.strictEqual(permRst.type, 'BAN');
    assert.strictEqual(permRst.expiresAt, null);
  });

  it('checks if a user is currently restricted', async () => {
    const mockDb = {
      restriction: {
        findFirst: async ({ where }) => {
          if (where.type === 'CHAT_BLOCK') {
            return {
              id: 'rst-active',
              type: 'CHAT_BLOCK',
              reason: 'Spam in chat',
              status: 'ACTIVE',
              expiresAt: new Date(Date.now() + 86400000),
            };
          }
          return null;
        },
      },
    };

    const resChat = await isUserRestricted('usr-1', 'CHAT_BLOCK', mockDb);
    assert.strictEqual(resChat.isRestricted, true);
    assert.strictEqual(resChat.restriction.type, 'CHAT_BLOCK');

    const resLive = await isUserRestricted('usr-1', 'LIVE_BLOCK', mockDb);
    assert.strictEqual(resLive.isRestricted, false);
    assert.strictEqual(resLive.restriction, null);
  });
});
