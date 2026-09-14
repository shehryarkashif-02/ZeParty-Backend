import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getReportDetails } from '../src/services/report.service.js';

describe('Phase 8 Report Authorization & IDOR Suite', () => {
  it('allows reporter to view their own report', async () => {
    const mockReport = {
      id: 'rep-auth-1',
      reporterUserId: 'usr-reporter-alice',
      reportedUserId: 'usr-bad-bob',
      violationType: 'SPAM',
      status: 'PENDING',
    };

    const mockDb = {
      report: {
        findUnique: async () => mockReport,
      },
    };

    const report = await getReportDetails(
      'rep-auth-1',
      { userId: 'usr-reporter-alice', isAdmin: false },
      mockDb
    );

    assert.strictEqual(report.id, 'rep-auth-1');
    assert.strictEqual(report.reporterUserId, 'usr-reporter-alice');
  });

  it('allows Administrator to inspect any report', async () => {
    const mockReport = {
      id: 'rep-auth-2',
      reporterUserId: 'usr-reporter-alice',
      reportedUserId: 'usr-bad-bob',
      violationType: 'NUDITY',
      status: 'PENDING',
    };

    const mockDb = {
      report: {
        findUnique: async () => mockReport,
      },
    };

    const report = await getReportDetails(
      'rep-auth-2',
      { userId: 'admin-mod-1', isAdmin: true },
      mockDb
    );

    assert.strictEqual(report.id, 'rep-auth-2');
  });

  it('rejects third-party user from inspecting another user report with 403', async () => {
    const mockReport = {
      id: 'rep-auth-3',
      reporterUserId: 'usr-reporter-alice',
      reportedUserId: 'usr-bad-bob',
      violationType: 'FRAUD',
      status: 'PENDING',
    };

    const mockDb = {
      report: {
        findUnique: async () => mockReport,
      },
    };

    await assert.rejects(
      async () => {
        await getReportDetails(
          'rep-auth-3',
          { userId: 'usr-stranger-charlie', isAdmin: false },
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
