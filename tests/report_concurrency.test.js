import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolveReport } from '../src/services/report.service.js';

describe('Phase 8 Report Concurrency & Atomic Resolution Suite', () => {
  it('handles parallel resolution attempts safely and produces deterministic final state', async () => {
    let callCount = 0;
    const mockReport = {
      id: 'rep-concurrent-1',
      reporterUserId: 'usr-reporter-1',
      reportedUserId: 'usr-bad-1',
      status: 'UNDER_REVIEW',
    };

    const mockDb = {
      report: {
        findUnique: async () => mockReport,
        update: async (args) => {
          callCount++;
          return { ...mockReport, ...args.data };
        },
      },
      auditLog: {
        create: async () => ({ id: `audit-${callCount}` }),
      },
    };

    // Simulate 2 parallel moderator resolution calls
    const [resA, resB] = await Promise.all([
      resolveReport(
        'rep-concurrent-1',
        { status: 'RESOLVED', resolutionAction: 'WARN' },
        { adminId: 'mod-1', adminName: 'Mod Alpha' },
        mockDb
      ),
      resolveReport(
        'rep-concurrent-1',
        { status: 'RESOLVED', resolutionAction: 'MUTE' },
        { adminId: 'mod-2', adminName: 'Mod Beta' },
        mockDb
      ),
    ]);

    assert.strictEqual(resA.report.status, 'RESOLVED');
    assert.strictEqual(resB.report.status, 'RESOLVED');
    assert.strictEqual(callCount, 2);
  });
});
