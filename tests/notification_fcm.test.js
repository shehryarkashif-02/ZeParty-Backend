import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import fcmAdapter, { clearMockDeliveryLog, getMockDeliveryLog } from '../src/adapters/fcm.adapter.js';

describe('Phase 9 FCM Push Delivery & Multicast Suite', () => {
  beforeEach(() => {
    clearMockDeliveryLog();
  });

  it('delivers push to single device in simulated mock mode with explicit status', async () => {
    const result = await fcmAdapter.sendToDevice({
      token: 'valid-fcm-device-token-1',
      title: 'Diamond Payout',
      body: 'Your weekly settlement has been paid.',
      data: { settlementId: 'set-123' },
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.status, 'SIMULATED');
    assert.ok(result.messageId);

    const log = getMockDeliveryLog();
    assert.strictEqual(log.length, 1);
    assert.strictEqual(log[0].token, 'valid-fcm-device-token-1');
  });

  it('delivers multicast push to multiple device tokens', async () => {
    const tokens = ['token-a', 'token-b', 'token-c'];
    const result = await fcmAdapter.sendMulticast({
      tokens,
      title: 'Broadcast Announcement',
      body: 'Special weekend live event starting now!',
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.totalCount, 3);
    assert.strictEqual(result.sentCount, 3);
    assert.strictEqual(result.failureCount, 0);
  });
});
