import { describe, it } from 'node:test';
import assert from 'node:assert';
import { reportContent } from '../src/services/social.service.js';

describe('Phase 6 Social Reporting & Moderation Hooks Suite', () => {
  it('creates Report record when reporting an inappropriate post', async () => {
    let createdReport = null;

    const mockPost = {
      id: 'p-bad-1',
      userId: 'usr-author-reported',
    };

    const mockDb = {
      post: {
        findFirst: async () => mockPost,
        findUnique: async () => mockPost,
      },
      report: {
        create: async (args) => {
          createdReport = { id: 'rep-101', ...args.data };
          return createdReport;
        },
      },
    };

    const result = await reportContent(
      {
        reporterUserId: 'usr-reporter-1',
        targetType: 'POST',
        targetId: 'p-bad-1',
        violationType: 'HARASSMENT',
        description: 'Offensive language targeting user',
      },
      mockDb
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.reportId, 'rep-101');
    assert.strictEqual(createdReport.reportedPostId, 'p-bad-1');
    assert.strictEqual(createdReport.reportedUserId, 'usr-author-reported');
    assert.strictEqual(createdReport.violationType, 'HARASSMENT');
    assert.strictEqual(createdReport.status, 'PENDING');
  });

  it('rejects report on non-existent post with 404 POST_NOT_FOUND', async () => {
    const mockDb = {
      post: {
        findFirst: async () => null,
      },
    };

    await assert.rejects(
      async () => {
        await reportContent(
          {
            reporterUserId: 'usr-reporter-1',
            targetType: 'POST',
            targetId: 'p-non-existent',
            violationType: 'SPAM',
          },
          mockDb
        );
      },
      (err) => {
        assert.strictEqual(err.statusCode, 404);
        assert.strictEqual(err.code, 'POST_NOT_FOUND');
        return true;
      }
    );
  });
});
