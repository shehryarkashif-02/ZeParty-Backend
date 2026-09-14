import { describe, it } from 'node:test';
import assert from 'node:assert';
import { submitReport } from '../src/services/report.service.js';

describe('Phase 8 Report Deduplication & Idempotency Suite', () => {
  it('deduplicates repeated identical report submissions without creating duplicate records', async () => {
    let createCount = 0;
    const existingReport = {
      id: 'rep-dedup-1',
      reporterUserId: 'usr-reporter-1',
      reportedUserId: 'usr-bad-target',
      status: 'PENDING',
      violationType: 'HARASSMENT',
    };

    const mockDb = {
      report: {
        findFirst: async () => existingReport,
        create: async () => {
          createCount++;
          return { id: 'rep-new' };
        },
      },
    };

    const res = await submitReport(
      {
        reporterUserId: 'usr-reporter-1',
        reportedUserId: 'usr-bad-target',
        violationType: 'HARASSMENT',
        description: 'Duplicate report submission',
      },
      {},
      mockDb
    );

    assert.strictEqual(res.isDuplicate, true);
    assert.strictEqual(res.report.id, 'rep-dedup-1');
    assert.strictEqual(createCount, 0, 'No duplicate report record was inserted into database');
  });
});
