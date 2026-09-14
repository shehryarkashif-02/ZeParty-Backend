import { describe, it } from 'node:test';
import assert from 'node:assert';
import { updateTicketStatus } from '../src/services/support.service.js';

describe('Phase 8 Support Ticket Concurrency Suite', () => {
  it('handles concurrent ticket status transitions deterministically', async () => {
    let updateCount = 0;
    const mockTicket = {
      id: 'tkt-concurrency-1',
      userId: 'usr-1',
      subject: 'Issue',
      status: 'OPEN',
    };

    const mockDb = {
      supportTicket: {
        findUnique: async () => mockTicket,
        update: async (args) => {
          updateCount++;
          return { ...mockTicket, ...args.data };
        },
      },
      auditLog: {
        create: async () => ({ id: `audit-${updateCount}` }),
      },
    };

    const [res1, res2] = await Promise.all([
      updateTicketStatus(
        'tkt-concurrency-1',
        { status: 'IN_PROGRESS', priority: 'HIGH' },
        { adminId: 'agent-1' },
        mockDb
      ),
      updateTicketStatus(
        'tkt-concurrency-1',
        { status: 'RESOLVED', resolutionNotes: 'Resolved on call' },
        { adminId: 'agent-2' },
        mockDb
      ),
    ]);

    assert.strictEqual(updateCount, 2);
    assert.ok(res1 && res2);
  });
});
