import { describe, it } from 'node:test';
import assert from 'node:assert';
import { applyRestriction } from '../src/services/restriction.service.js';
import { submitReport } from '../src/services/report.service.js';

describe('Phase 8 Chat & Messaging Moderation Suite', () => {
  it('applies chat mute restriction to a disruptive user in live room', async () => {
    let createdRst = null;
    const mockDb = {
      restriction: {
        create: async (args) => {
          createdRst = { id: 'rst-chat-1', ...args.data };
          return createdRst;
        },
      },
      user: {
        findUnique: async () => ({ id: 'usr-troublemaker', status: 'ACTIVE' }),
      },
      auditLog: {
        create: async () => ({ id: 'audit-1' }),
      },
    };

    const rst = await applyRestriction(
      {
        userId: 'usr-troublemaker',
        targetId: 'usr-troublemaker',
        type: 'CHAT_BLOCK',
        reason: 'Repeated profanity in chat',
        durationDays: 3,
        createdByAdminId: 'admin-mod-1',
      },
      mockDb
    );

    assert.strictEqual(rst.type, 'CHAT_BLOCK');
    assert.strictEqual(rst.reason, 'Repeated profanity in chat');
    assert.ok(rst.expiresAt instanceof Date);
  });

  it('submits a moderation report targeting a direct chat message', async () => {
    const mockDb = {
      report: {
        findFirst: async () => null,
        create: async (args) => ({
          id: 'rep-msg-1',
          ...args.data,
          createdAt: new Date(),
        }),
      },
    };

    const res = await submitReport(
      {
        reporterUserId: 'usr-victim-1',
        reportedUserId: 'usr-offender-1',
        reportedMessageId: 'msg-spam-101',
        violationType: 'SPAM_ADVERTISING',
        description: 'Unauthorized commercial advertising in inbox',
      },
      {},
      mockDb
    );

    assert.strictEqual(res.report.id, 'rep-msg-1');
    assert.strictEqual(res.report.reportedMessageId, 'msg-spam-101');
    assert.strictEqual(res.report.violationType, 'SPAM_ADVERTISING');
  });
});
