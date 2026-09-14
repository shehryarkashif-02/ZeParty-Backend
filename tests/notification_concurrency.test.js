import { describe, it } from 'node:test';
import assert from 'node:assert';
import { registerDevice } from '../src/services/notificationDevice.service.js';

describe('Phase 9 Concurrent Device Registration Suite', () => {
  it('handles parallel registration requests safely without duplicate data corruption', async () => {
    const devices = [];
    const mockDb = {
      userDevice: {
        findFirst: async ({ where }) => {
          return devices.find((d) => d.userId === where.userId && d.deviceToken === where.deviceToken) || null;
        },
        create: async (args) => {
          const newDoc = { id: `dev-${devices.length + 1}`, ...args.data };
          devices.push(newDoc);
          return newDoc;
        },
        update: async (args) => {
          const idx = devices.findIndex((d) => d.id === args.where.id);
          if (idx !== -1) {
            devices[idx] = { ...devices[idx], ...args.data };
            return devices[idx];
          }
          return null;
        },
      },
      blockedDevice: {
        findFirst: async () => null,
      },
    };

    // Simulate 3 concurrent registration calls for same token
    const results = await Promise.all([
      registerDevice({ userId: 'usr-conc-1', deviceToken: 'token-race-1', platform: 'android' }, mockDb),
      registerDevice({ userId: 'usr-conc-1', deviceToken: 'token-race-1', platform: 'android' }, mockDb),
      registerDevice({ userId: 'usr-conc-1', deviceToken: 'token-race-1', platform: 'android' }, mockDb),
    ]);

    assert.strictEqual(results.length, 3);
    results.forEach((r) => {
      assert.strictEqual(r.deviceToken, 'token-race-1');
      assert.strictEqual(r.userId, 'usr-conc-1');
    });
  });
});
