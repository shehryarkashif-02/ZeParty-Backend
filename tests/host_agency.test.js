import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  applyHostSchema,
  reviewHostApplicationSchema,
  updateHostStatusSchema,
  updateHostPerformanceSchema,
} from '../src/validators/host.validator.js';
import {
  createAgencySchema,
  updateAgencySchema,
  transferHostSchema,
} from '../src/validators/agency.validator.js';
import {
  applyForHost,
  reviewHostApplication,
  updateHostProfileStatus,
  recordHostPerformance,
} from '../src/services/host.service.js';
import {
  createAgency,
  updateAgency,
  bindHostToAgency,
  transferHostBetweenAgencies,
} from '../src/services/agency.service.js';

describe('Phase 8 Hosts & Agencies Specification Suite', () => {
  describe('1. Host Input Validation Schemas', () => {
    it('accepts valid host application and validates URLs', () => {
      const payload = {
        hostType: 'LIVE_HOST',
        idCardFrontUrl: 'https://cdn.zeparty.app/id/front.jpg',
        idCardBackUrl: 'https://cdn.zeparty.app/id/back.jpg',
        videoSampleUrl: 'https://cdn.zeparty.app/videos/sample.mp4',
      };
      const validated = applyHostSchema.parse(payload);
      assert.strictEqual(validated.hostType, 'LIVE_HOST');
    });

    it('rejects host application with malformed URLs', () => {
      assert.throws(() => {
        applyHostSchema.parse({
          hostType: 'LIVE_HOST',
          idCardFrontUrl: 'not-a-valid-url',
          idCardBackUrl: 'https://cdn.zeparty.app/id/back.jpg',
        });
      });
    });

    it('requires rejectionReason when host application is rejected', () => {
      assert.throws(() => {
        reviewHostApplicationSchema.parse({
          status: 'REJECTED',
          rejectionReason: '', // Invalid: required when REJECTED
        });
      });
    });

    it('accepts valid performance delta with BigInt diamonds', () => {
      const payload = {
        liveHoursDelta: 4.5,
        diamondsDelta: '250000',
        targetDaysDelta: 1,
      };
      const validated = updateHostPerformanceSchema.parse(payload);
      assert.strictEqual(validated.liveHoursDelta, 4.5);
    });
  });

  describe('2. Host Application & Review Lifecycle Service Logic', () => {
    it('successfully submits application when no pending app exists', async () => {
      const mockDb = {
        hostProfile: {
          findUnique: async () => null,
        },
        hostApplication: {
          findFirst: async () => null,
          create: async ({ data }) => ({ id: 'app-001', ...data, status: 'APPLIED', createdAt: new Date() }),
        },
        auditLog: {
          create: async () => ({ id: 'audit-001' }),
        },
      };

      const result = await applyForHost(
        {
          userId: 'usr-101',
          hostType: 'LIVE_HOST',
          idCardFrontUrl: 'https://cdn.zeparty.app/front.jpg',
          idCardBackUrl: 'https://cdn.zeparty.app/back.jpg',
        },
        mockDb
      );

      assert.strictEqual(result.id, 'app-001');
      assert.strictEqual(result.status, 'APPLIED');
    });

    it('rejects duplicate application when a pending app already exists', async () => {
      const mockDb = {
        hostProfile: { findUnique: async () => null },
        hostApplication: {
          findFirst: async () => ({ id: 'existing-pending-app', status: 'APPLIED' }),
        },
      };

      await assert.rejects(
        async () => {
          await applyForHost(
            {
              userId: 'usr-101',
              hostType: 'LIVE_HOST',
              idCardFrontUrl: 'https://cdn.zeparty.app/front.jpg',
              idCardBackUrl: 'https://cdn.zeparty.app/back.jpg',
            },
            mockDb
          );
        },
        (err) => err.code === 'PENDING_APPLICATION_EXISTS'
      );
    });

    it('atomically approves application, provisions HostProfile, and sets userType = HOST', async () => {
      let userTypeUpdated = null;
      let hostProfileCreated = null;

      const mockDb = {
        hostApplication: {
          findUnique: async () => ({
            id: 'app-001',
            userId: 'usr-101',
            hostType: 'LIVE_HOST',
            status: 'APPLIED',
          }),
        },
        $transaction: async (cb) => {
          const tx = {
            hostApplication: {
              update: async ({ data }) => ({ id: 'app-001', ...data }),
            },
            hostProfile: {
              upsert: async ({ create }) => {
                hostProfileCreated = { id: 'hst-001', ...create };
                return hostProfileCreated;
              },
            },
            user: {
              update: async ({ data }) => {
                userTypeUpdated = data.userType;
                return { id: 'usr-101', userType: data.userType };
              },
            },
          };
          return await cb(tx);
        },
        auditLog: { create: async () => ({ id: 'audit-001' }) },
      };

      const result = await reviewHostApplication(
        'app-001',
        {
          status: 'ACTIVE',
          adminId: 'admin-001',
          adminName: 'Super Admin',
        },
        mockDb
      );

      assert.strictEqual(result.application.status, 'ACTIVE');
      assert.strictEqual(hostProfileCreated.hostStatus, 'ACTIVE');
      assert.strictEqual(userTypeUpdated, 'HOST');
    });

    it('records rejection reason on rejection without provisioning HostProfile', async () => {
      const mockDb = {
        hostApplication: {
          findUnique: async () => ({
            id: 'app-002',
            userId: 'usr-102',
            hostType: 'LIVE_HOST',
            status: 'APPLIED',
          }),
          update: async ({ data }) => ({ id: 'app-002', ...data }),
        },
        auditLog: { create: async () => ({ id: 'audit-002' }) },
      };

      const result = await reviewHostApplication(
        'app-002',
        {
          status: 'REJECTED',
          rejectionReason: 'ID card photos are unreadable',
          adminId: 'admin-001',
          adminName: 'Super Admin',
        },
        mockDb
      );

      assert.strictEqual(result.application.status, 'REJECTED');
      assert.strictEqual(result.application.rejectionReason, 'ID card photos are unreadable');
    });
  });

  describe('3. Agency Validation & Membership Management', () => {
    it('validates agency creation and enforces uppercase alphanumeric agency code', () => {
      const input = {
        agencyName: 'StarMedia Entertainment',
        agencyCode: 'star_01',
        ownerUserId: 'usr-owner-001',
        agencyType: 'LIVE_AGENCY',
        commissionRate: 20.0,
      };
      const validated = createAgencySchema.parse(input);
      assert.strictEqual(validated.agencyCode, 'STAR_01');
      assert.strictEqual(validated.commissionRate, 20.0);
    });

    it('rejects transfer when source and destination agencies are identical', () => {
      assert.throws(() => {
        transferHostSchema.parse({
          hostProfileId: 'hst-001',
          fromAgencyId: 'agency-001',
          toAgencyId: 'agency-001', // Invalid: same
          reason: 'Internal reorganization',
        });
      });
    });

    it('atomically transfers host to new agency and updates HostProfile pointer', async () => {
      let deletedFromAgency = null;
      let addedToAgency = null;
      let hostUpdatedAgency = null;

      const mockDb = {
        agency: {
          findUnique: async ({ where }) => {
            if (where.id === 'agency-dest') {
              return { id: 'agency-dest', status: 'ACTIVE', agencyName: 'New Agency' };
            }
            return null;
          },
        },
        hostProfile: {
          findUnique: async () => ({
            id: 'hst-001',
            userId: 'usr-host-001',
            agencyId: 'agency-src',
          }),
        },
        $transaction: async (cb) => {
          const tx = {
            agencyMember: {
              deleteMany: async ({ where }) => {
                deletedFromAgency = where.agencyId;
              },
              create: async ({ data }) => {
                addedToAgency = data.agencyId;
                return { id: 'member-002', ...data };
              },
            },
            hostProfile: {
              update: async ({ data }) => {
                hostUpdatedAgency = data.agencyId;
                return { id: 'hst-001', agencyId: data.agencyId };
              },
            },
          };
          return await cb(tx);
        },
        auditLog: { create: async () => ({ id: 'audit-003' }) },
      };

      const transferred = await transferHostBetweenAgencies(
        {
          hostProfileId: 'hst-001',
          fromAgencyId: 'agency-src',
          toAgencyId: 'agency-dest',
          reason: 'Contract reassignment',
        },
        { adminId: 'admin-001', adminName: 'Admin' },
        mockDb
      );

      assert.strictEqual(deletedFromAgency, 'agency-src');
      assert.strictEqual(addedToAgency, 'agency-dest');
      assert.strictEqual(hostUpdatedAgency, 'agency-dest');
    });
  });
});
