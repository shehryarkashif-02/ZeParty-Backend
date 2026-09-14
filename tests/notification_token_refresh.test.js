import { describe, it } from 'node:test';
import assert from 'node:assert';
import { refreshToken } from '../src/services/notificationDevice.service.js';

describe('Phase 9 Notification Token Refresh Suite', () => {
  it('safely refreshes old FCM device token with new token', async () => {
    let storedDevice = {
      id: 'dev-1',
      userId: 'usr-1',
      deviceToken: 'fcm-token-old',
      platform: 'android',
      isActive: true,
    };

    const mockDb = {
      userDevice: {
        findFirst: async ({ where }) => {
          if (where.deviceToken === storedDevice.deviceToken) {
            return storedDevice;
          }
          return null;
        },
        update: async (args) => {
          storedDevice = { ...storedDevice, ...args.data };
          return storedDevice;
        },
      },
    };

    const updated = await refreshToken(
      {
        userId: 'usr-1',
        oldToken: 'fcm-token-old',
        newToken: 'fcm-token-new',
        platform: 'android',
      },
      mockDb
    );

    assert.strictEqual(updated.deviceToken, 'fcm-token-new');
    assert.strictEqual(storedDevice.deviceToken, 'fcm-token-new');
    assert.strictEqual(storedDevice.isActive, true);
  });
});
