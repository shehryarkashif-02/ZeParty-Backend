import { describe, it } from 'node:test';
import assert from 'node:assert';
import { replyToTicket } from '../src/services/support.service.js';

describe('Phase 8 Support Ticket IDOR Reply Defense Suite', () => {
  it('blocks User A from submitting replies to User B support ticket', async () => {
    const mockTicket = {
      id: 'tkt-victim-101',
      userId: 'usr-victim',
      subject: 'Account Issue',
      status: 'OPEN',
    };

    const mockDb = {
      supportTicket: {
        findUnique: async () => mockTicket,
      },
    };

    await assert.rejects(
      async () => {
        await replyToTicket(
          'tkt-victim-101',
          {
            senderType: 'USER',
            senderId: 'usr-attacker-eve',
            message: 'Malicious spoofed message',
          },
          {},
          mockDb
        );
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, 'FORBIDDEN_TICKET_REPLY');
        return true;
      }
    );
  });
});
