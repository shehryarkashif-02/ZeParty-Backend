import { describe, it } from 'node:test';
import assert from 'node:assert';
import { registerDevice, removeDevice, getUserDevices } from '../src/services/notificationDevice.service.js';

describe('Phase 9 Device Token Registration & Multi-Device Suite', () => {
  it('registers device token and handles multiple active devices per user', async () => {
    const devices = [];
    const mockDb = {
      userDevice: {
        findFirst: async ({ where }) => {
          return devices.find(
            (d) => d.userId === where.userId && (d.deviceToken === where.deviceToken || (where.OR && where.OR.some(o => o.deviceToken === d.deviceToken)))
          ) || null;
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
        findMany: async ({ where }) => {
          return devices.filter((d) => d.userId === where.userId && (!where.isActive || d.isActive));
        },
      },
      blockedDevice: {
        findFirst: async () => null,
      },
    };

    // Register first device (Android)
    const dev1 = await registerDevice(
      {
        userId: 'usr-100',
        deviceToken: 'fcm-token-android-1',
        platform: 'android',
        appVersion: '1.0.0',
        deviceModel: 'Pixel 8',
      },
      mockDb
    );

    assert.ok(dev1.id);
    assert.strictEqual(dev1.platform, 'android');
    assert.strictEqual(dev1.deviceToken, 'fcm-token-android-1');

    // Register second device for same user (iOS iPad)
    const dev2 = await registerDevice(
      {
        userId: 'usr-100',
        deviceToken: 'fcm-token-ios-2',
        platform: 'ios',
        appVersion: '1.0.0',
        deviceModel: 'iPad Pro',
      },
      mockDb
    );

    assert.ok(dev2.id);
    assert.notStrictEqual(dev1.id, dev2.id);
    assert.strictEqual(devices.length, 2);

    // List devices for user
    const userDevices = await getUserDevices('usr-100', mockDb);
    assert.strictEqual(userDevices.length, 2);
  });

  it('rejects registration if device is blocked with 403', async () => {
    const mockDb = {
      blockedDevice: {
        findFirst: async () => ({ id: 'blk-1', reason: 'Abuse' }),
      },
      userDevice: {
        findFirst: async () => null,
      },
    };

    await assert.rejects(
      async () => {
        await registerDevice(
          {
            userId: 'usr-bad',
            deviceToken: 'blocked-device-token',
          },
          mockDb
        );
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, 'DEVICE_BLOCKED');
        return true;
      }
    );
  });
});
