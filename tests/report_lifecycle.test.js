import { describe, it } from 'node:test';
import assert from 'node:assert';
import { submitReport, assignReport, resolveReport, getReportDetails } from '../src/services/report.service.js';

describe('Phase 8 Report Lifecycle Suite', () => {
  it('creates report in PENDING state and rejects self-reporting', async () => {
    const mockDb = {
      report: {
        findFirst: async () => null,
        create: async (args) => ({
          id: 'rep-001',
          ...args.data,
          createdAt: new Date(),
        }),
      },
    };

    // 1. Submit report for another user
    const res = await submitReport(
      {
        reporterUserId: 'usr-reporter-1',
        reportedUserId: 'usr-bad-actor-1',
        violationType: 'HARASSMENT',
        description: 'Target was sending abusive messages.',
      },
      {},
      mockDb
    );

    assert.strictEqual(res.isDuplicate, false);
    assert.strictEqual(res.report.id, 'rep-001');
    assert.strictEqual(res.report.status, 'PENDING');
    assert.strictEqual(res.report.violationType, 'HARASSMENT');

    // 2. Reject self-reporting with 400 CANNOT_REPORT_SELF
    await assert.rejects(
      async () => {
        await submitReport(
          {
            reporterUserId: 'usr-reporter-1',
            reportedUserId: 'usr-reporter-1',
            violationType: 'SPAM',
          },
          {},
          mockDb
        );
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, 'CANNOT_REPORT_SELF');
        return true;
      }
    );
  });

  it('assigns report to moderator and transitions status to UNDER_REVIEW', async () => {
    let updatedData = null;
    const mockReport = {
      id: 'rep-002',
      reporterUserId: 'usr-1',
      reportedUserId: 'usr-2',
      status: 'PENDING',
    };

    const mockDb = {
      report: {
        findUnique: async () => mockReport,
        update: async (args) => {
          updatedData = args.data;
          return { ...mockReport, ...args.data };
        },
      },
      auditLog: {
        create: async () => ({ id: 'audit-1' }),
      },
    };

    const updated = await assignReport(
      'rep-002',
      'admin-mod-1',
      { adminName: 'Officer Mod', ipAddress: '192.168.1.1' },
      mockDb
    );

    assert.strictEqual(updated.status, 'UNDER_REVIEW');
    assert.strictEqual(updated.assignedAdminId, 'admin-mod-1');
    assert.strictEqual(updatedData.assignedAdminId, 'admin-mod-1');
  });

  it('resolves report and transitions status to RESOLVED with resolution notes', async () => {
    const mockReport = {
      id: 'rep-003',
      reporterUserId: 'usr-1',
      reportedUserId: 'usr-bad-2',
      status: 'UNDER_REVIEW',
    };

    let resolvedState = null;
    const mockDb = {
      report: {
        findUnique: async () => mockReport,
        update: async (args) => {
          resolvedState = args.data;
          return { ...mockReport, ...args.data };
        },
      },
      auditLog: {
        create: async () => ({ id: 'audit-2' }),
      },
    };

    const res = await resolveReport(
      'rep-003',
      {
        status: 'RESOLVED',
        resolutionAction: 'WARNING_ISSUED',
        resolutionNotes: 'Violator received official warning.',
      },
      { adminId: 'admin-mod-1', adminName: 'Officer Mod' },
      mockDb
    );

    assert.strictEqual(res.report.status, 'RESOLVED');
    assert.strictEqual(res.report.resolutionAction, 'WARNING_ISSUED');
    assert.strictEqual(resolvedState.status, 'RESOLVED');
    assert.ok(resolvedState.resolvedAt instanceof Date);
  });
});
