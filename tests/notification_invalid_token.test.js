import { describe, it } from 'node:test';
import assert from 'node:assert';
import fcmAdapter from '../src/adapters/fcm.adapter.js';
import { cleanupInvalidTokens } from '../src/services/notificationDevice.service.js';

describe('Phase 9 Invalid Token Auto-Cleanup Suite', () => {
  it('detects invalid/unregistered token error and deactivates stored token in database', async () => {
    // 1. FCM detects invalid token
    const res = await fcmAdapter.sendToDevice({
      token: 'invalid-token-expired-123',
      title: 'Test',
      body: 'Testing cleanup',
    });

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.isInvalidToken, true);

    // 2. Database cleanup
    let deactivatedTokens = null;
    const mockDb = {
      userDevice: {
        updateMany: async ({ where, data }) => {
          deactivatedTokens = where.deviceToken.in;
          assert.strictEqual(data.isActive, false);
          assert.strictEqual(data.deviceToken, null);
          return { count: deactivatedTokens.length };
        },
      },
    };

    const cleanupRes = await cleanupInvalidTokens(['invalid-token-expired-123'], mockDb);
    assert.strictEqual(cleanupRes.count, 1);
    assert.deepStrictEqual(deactivatedTokens, ['invalid-token-expired-123']);
  });
});
