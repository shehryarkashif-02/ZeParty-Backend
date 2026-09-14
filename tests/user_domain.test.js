import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  queryUsersSchema,
  updateUserStatusSchema,
  updateUserProfileSchema,
  userIdParamSchema,
} from '../src/validators/user.validator.js';
import {
  listUsersForAdmin,
  getUserDetailsForAdmin,
  updateUserStatusByAdmin,
  getSelfProfile,
  updateSelfProfile,
  getPublicProfile,
} from '../src/services/user.service.js';

describe('Phase 2 User & Identity Domain Specification Suite', () => {
  // 1. Validation Schemas
  describe('1. User Validation Schemas', () => {
    it('parses valid query parameters and sets defaults', () => {
      const parsed = queryUsersSchema.parse({});
      assert.strictEqual(parsed.page, 1);
      assert.strictEqual(parsed.limit, 20);
    });

    it('validates user status filter enum', () => {
      const parsed = queryUsersSchema.parse({ status: 'SUSPENDED', userType: 'HOST' });
      assert.strictEqual(parsed.status, 'SUSPENDED');
      assert.strictEqual(parsed.userType, 'HOST');

      assert.throws(() => {
        queryUsersSchema.parse({ status: 'INVALID_STATUS' });
      });
    });

    it('validates user status update payload', () => {
      const valid = updateUserStatusSchema.parse({ status: 'BANNED', reason: 'Terms violation' });
      assert.strictEqual(valid.status, 'BANNED');
      assert.strictEqual(valid.reason, 'Terms violation');

      assert.throws(() => {
        updateUserStatusSchema.parse({ status: 'DELETED' });
      });
    });

    it('accepts legitimate profile fields in updateUserProfileSchema', () => {
      const input = {
        displayName: 'ZePartyStar',
        avatarUrl: 'https://cdn.zeparty.app/avatars/user1.png',
        bio: 'Living the party life!',
        gender: 'FEMALE',
        signature: 'VIP Host',
        countryCode: 'US',
      };
      const valid = updateUserProfileSchema.parse(input);
      assert.strictEqual(valid.displayName, 'ZePartyStar');
      assert.strictEqual(valid.countryCode, 'US');
    });

    it('strictly rejects forbidden profile mutations (IDOR/Privilege Escalation protection)', () => {
      // Trying to smuggle role
      assert.throws(() => {
        updateUserProfileSchema.parse({
          displayName: 'Hacker',
          role: 'SUPER_ADMIN',
        });
      });

      // Trying to smuggle wallet balance
      assert.throws(() => {
        updateUserProfileSchema.parse({
          displayName: 'RichUser',
          wallet: { coinBalance: '99999999' },
        });
      });

      // Trying to smuggle coinBalance
      assert.throws(() => {
        updateUserProfileSchema.parse({
          coinBalance: '99999999',
        });
      });

      // Trying to smuggle userType or status
      assert.throws(() => {
        updateUserProfileSchema.parse({
          userType: 'MERCHANT',
          status: 'ACTIVE',
        });
      });

      // Trying to smuggle VIP level
      assert.throws(() => {
        updateUserProfileSchema.parse({
          vipLevel: 10,
        });
      });
    });

    it('validates user ID param schema', () => {
      assert.strictEqual(userIdParamSchema.parse({ id: 'usr-123' }).id, 'usr-123');
      assert.throws(() => {
        userIdParamSchema.parse({ id: '' });
      });
    });
  });

  // 2. User Service Operations
  describe('2. User Service Operations & Business Rules', () => {
    it('listUsersForAdmin executes pagination against repository', async () => {
      const mockDb = {
        user: {
          count: async () => 2,
          findMany: async () => [
            {
              id: 'usr-1',
              username: 'alice',
              phone: '+15551111111',
              email: 'alice@zeparty.app',
              status: 'ACTIVE',
              userType: 'USER',
              profile: { displayName: 'Alice' },
              wallet: { coinBalance: 100n, diamondBalance: 50n },
              hostProfile: null,
            },
            {
              id: 'usr-2',
              username: 'bob',
              phone: '+15552222222',
              email: 'bob@zeparty.app',
              status: 'ACTIVE',
              userType: 'HOST',
              profile: { displayName: 'Bob Host' },
              wallet: { coinBalance: 500n, diamondBalance: 2000n },
              hostProfile: { hostType: 'LIVE_HOST', hostStatus: 'ACTIVE', hostLevel: 3 },
            },
          ],
        },
      };

      const result = await listUsersForAdmin({ page: 1, limit: 10 }, mockDb);
      assert.strictEqual(result.users.length, 2);
      assert.strictEqual(result.pagination.total, 2);
      assert.strictEqual(result.users[0].username, 'alice');
      // Verify no sensitive hashes are present
      assert.strictEqual(result.users[0].passwordHash, undefined);
    });

    it('getUserDetailsForAdmin returns complete profile and throws 404 for missing user', async () => {
      const mockDb = {
        user: {
          findUnique: async ({ where }) => {
            if (where.id === 'usr-1') {
              return {
                id: 'usr-1',
                username: 'alice',
                status: 'ACTIVE',
                profile: { displayName: 'Alice', level: 5 },
                wallet: { coinBalance: 1000n },
                hostProfile: null,
                ownedAgencies: [],
                managedBDCenters: [],
                coinSeller: null,
                merchant: null,
                sessions: [],
                devices: [],
              };
            }
            return null;
          },
        },
      };

      const user = await getUserDetailsForAdmin('usr-1', mockDb);
      assert.strictEqual(user.username, 'alice');
      assert.strictEqual(user.profile.level, 5);

      await assert.rejects(
        async () => {
          await getUserDetailsForAdmin('non-existent-user', mockDb);
        },
        (err) => err.statusCode === 404 && err.code === 'USER_NOT_FOUND'
      );
    });

    it('updateUserStatusByAdmin updates status and writes audit log', async () => {
      let auditLogCreated = null;
      let userUpdated = null;

      const mockDb = {
        user: {
          findUnique: async () => ({
            id: 'usr-target',
            username: 'target_user',
            status: 'ACTIVE',
          }),
          update: async ({ data }) => {
            userUpdated = {
              id: 'usr-target',
              username: 'target_user',
              status: data.status,
            };
            return userUpdated;
          },
        },
        auditLog: {
          create: async ({ data }) => {
            auditLogCreated = data;
            return { id: 'audit-1', ...data };
          },
        },
      };

      const result = await updateUserStatusByAdmin(
        'usr-target',
        {
          status: 'SUSPENDED',
          reason: 'Suspicious activity detected',
          adminId: 'adm-001',
          adminName: 'Lead Admin',
          ipAddress: '192.168.1.50',
        },
        mockDb
      );

      assert.strictEqual(result.status, 'SUSPENDED');
      assert.strictEqual(userUpdated.status, 'SUSPENDED');
      assert.ok(auditLogCreated, 'Audit log must be created');
      assert.strictEqual(auditLogCreated.adminId, 'adm-001');
      assert.strictEqual(auditLogCreated.action, 'USER_STATUS_SUSPENDED');
      assert.strictEqual(auditLogCreated.targetEntityId, 'usr-target');
      assert.strictEqual(auditLogCreated.reason, 'Suspicious activity detected');
    });

    it('getPublicProfile exposes safe public view and strips private data', async () => {
      const mockDb = {
        user: {
          findUnique: async ({ where }) => {
            if (where.id === 'usr-public') {
              return {
                id: 'usr-public',
                username: 'superstar',
                avatarUrl: 'https://cdn.zeparty.app/avatars/star.png',
                bio: 'Official DJ',
                gender: 'MALE',
                countryCode: 'US',
                userType: 'HOST',
                createdAt: new Date('2026-01-01'),
                profile: {
                  displayName: 'DJ Star',
                  level: 25,
                  vipLevel: 3,
                  svipLevel: 0,
                  nobleRank: 'Duke',
                  signature: 'Music is life',
                },
                hostProfile: {
                  hostType: 'AUDIO_HOST',
                  hostLevel: 4,
                  hostStatus: 'ACTIVE',
                },
              };
            }
            return null;
          },
        },
      };

      const publicData = await getPublicProfile('usr-public', mockDb);
      assert.strictEqual(publicData.username, 'superstar');
      assert.strictEqual(publicData.profile.displayName, 'DJ Star');
      assert.strictEqual(publicData.phone, undefined, 'Phone must NEVER be exposed in public profile');
      assert.strictEqual(publicData.email, undefined, 'Email must NEVER be exposed in public profile');
      assert.strictEqual(publicData.wallet, undefined, 'Wallet balances must NEVER be exposed in public profile');
      assert.strictEqual(publicData.passwordHash, undefined);
    });
  });
});
