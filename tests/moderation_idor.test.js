import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getReportDetails } from '../src/services/report.service.js';
import { getTicketDetails } from '../src/services/support.service.js';

describe('Phase 8 Moderation & Support IDOR Defense Suite', () => {
  it('blocks regular user from accessing another user support ticket', async () => {
    const mockTicket = {
      id: 'tkt-secret-1',
      userId: 'usr-victim',
      subject: 'Private Financial Dispute',
      message: 'My transaction had an issue',
      status: 'OPEN',
      messages: [],
    };

    const mockDb = {
      supportTicket: {
        findUnique: async () => mockTicket,
      },
    };

    await assert.rejects(
      async () => {
        await getTicketDetails(
          'tkt-secret-1',
          { userId: 'usr-attacker', isAdmin: false },
          mockDb
        );
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, 'FORBIDDEN_TICKET_ACCESS');
        return true;
      }
    );
  });

  it('blocks regular user from accessing another user report', async () => {
    const mockReport = {
      id: 'rep-secret-1',
      reporterUserId: 'usr-victim',
      reportedUserId: 'usr-target',
      violationType: 'FRAUD',
    };

    const mockDb = {
      report: {
        findUnique: async () => mockReport,
      },
    };

    await assert.rejects(
      async () => {
        await getReportDetails(
          'rep-secret-1',
          { userId: 'usr-attacker', isAdmin: false },
          mockDb
        );
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, 'FORBIDDEN_REPORT_ACCESS');
        return true;
      }
    );
  });
});
