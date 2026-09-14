import { describe, it } from 'node:test';
import assert from 'node:assert';
import { sendNotification } from '../src/services/notification.service.js';
import fcmAdapter, { setMockDeliveryHandler, clearMockDeliveryLog } from '../src/adapters/fcm.adapter.js';

describe('Phase 9 FCM Delivery Failure Isolation Suite', () => {
  it('ensures underlying database notification persists successfully even when FCM fails', async () => {
    // Force FCM adapter to simulate failure
    setMockDeliveryHandler(async () => {
      return {
        success: false,
        status: 'FAILED',
        error: { code: 'messaging/internal-error', message: 'Simulated network timeout' },
        isInvalidToken: false,
      };
    });

    let savedNotification = null;
    const mockDb = {
      notification: {
        findFirst: async () => null,
        create: async (args) => {
          savedNotification = {
            id: 'notif-resilient-1',
            ...args.data,
            createdAt: new Date(),
          };
          return savedNotification;
        },
      },
      notificationPreference: {
        findUnique: async () => null,
      },
      userDevice: {
        findMany: async () => [
          { id: 'dev-1', deviceToken: 'token-timeout', isActive: true, isBlocked: false },
        ],
      },
    };

    const res = await sendNotification(
      {
        recipientId: 'usr-1',
        title: 'Gift Received',
        body: 'You received 500 coins from User Beta.',
        type: 'GIFT',
        sourceType: 'GIFT_TRANSACTION',
        sourceId: 'tx-999',
      },
      mockDb
    );

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.notification.id, 'notif-resilient-1');
    assert.ok(savedNotification, 'Notification was authoritatively committed to DB despite FCM error');

    clearMockDeliveryLog();
  });
});
