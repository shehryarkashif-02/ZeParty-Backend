import { describe, it } from 'node:test';
import assert from 'node:assert';
import { applyRestriction, liftRestriction } from '../src/services/restriction.service.js';
import { resolveReport } from '../src/services/report.service.js';

describe('Phase 8 Moderation Audit Log Suite', () => {
  it('creates immutable audit log on applying penalty restriction', async () => {
    let createdAudit = null;
    const mockDb = {
      restriction: {
        create: async (args) => ({ id: 'rst-aud-1', ...args.data }),
      },
      user: {
        findUnique: async () => ({ id: 'usr-target-1', status: 'ACTIVE' }),
        update: async (args) => ({ id: 'usr-target-1', ...args.data }),
      },
      auditLog: {
        create: async (args) => {
          createdAudit = args.data;
          return { id: 'audit-log-1', ...args.data };
        },
      },
    };

    await applyRestriction(
      {
        userId: 'usr-target-1',
        targetId: 'usr-target-1',
        type: 'BAN',
        reason: 'Severe spam violation',
        durationDays: 30,
        createdByAdminId: 'admin-auditor',
        adminName: 'Lead Auditor',
        ipAddress: '10.0.0.1',
      },
      mockDb
    );

    assert.ok(createdAudit);
    assert.strictEqual(createdAudit.adminId, 'admin-auditor');
    assert.strictEqual(createdAudit.adminName, 'Lead Auditor');
    assert.strictEqual(createdAudit.action, 'USER_BANNED');
    assert.strictEqual(createdAudit.targetEntity, 'Restriction');
    assert.strictEqual(createdAudit.ipAddress, '10.0.0.1');
  });

  it('creates immutable audit log on lifting restriction', async () => {
    let createdAudit = null;
    const mockRestriction = {
      id: 'rst-aud-2',
      userId: 'usr-target-2',
      targetId: 'usr-target-2',
      type: 'MUTE',
      status: 'ACTIVE',
    };

    const mockDb = {
      restriction: {
        findUnique: async () => mockRestriction,
        update: async (args) => ({ ...mockRestriction, ...args.data }),
        findFirst: async () => null,
      },
      user: {
        update: async () => ({ id: 'usr-target-2', status: 'ACTIVE' }),
      },
      auditLog: {
        create: async (args) => {
          createdAudit = args.data;
          return { id: 'audit-log-2', ...args.data };
        },
      },
    };

    await liftRestriction(
      'rst-aud-2',
      {
        liftReason: 'Successful appeal from user',
        adminId: 'admin-auditor',
        adminName: 'Lead Auditor',
        ipAddress: '10.0.0.2',
      },
      mockDb
    );

    assert.ok(createdAudit);
    assert.strictEqual(createdAudit.action, 'USER_RESTRICTION_LIFTED');
    assert.strictEqual(createdAudit.reason, 'Successful appeal from user');
  });
});
