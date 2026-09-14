import { describe, it } from 'node:test';
import assert from 'node:assert';
import { sendNotification } from '../src/services/notification.service.js';

describe('Phase 9 Notification Idempotency Suite', () => {
  it('prevents duplicate notification generation for identical business event references', async () => {
    let insertCount = 0;
    const existingRecord = {
      id: 'notif-existing-1',
      userId: 'usr-1',
      type: 'GIFT',
      sourceType: 'GIFT_TRANSACTION',
      sourceId: 'tx-1001',
      title: 'Gift Received',
      body: 'Gift message',
    };

    const mockDb = {
      notificationPreference: {
        findUnique: async () => null,
      },
      notification: {
        findFirst: async ({ where }) => {
          if (
            where.userId === 'usr-1' &&
            where.type === 'GIFT' &&
            where.sourceType === 'GIFT_TRANSACTION' &&
            where.sourceId === 'tx-1001'
          ) {
            return existingRecord;
          }
          return null;
        },
        create: async () => {
          insertCount++;
          return { id: 'notif-duplicate' };
        },
      },
      userDevice: {
        findMany: async () => [],
      },
    };

    const res = await sendNotification(
      {
        recipientId: 'usr-1',
        title: 'Gift Received',
        body: 'Gift message',
        type: 'GIFT',
        sourceType: 'GIFT_TRANSACTION',
        sourceId: 'tx-1001',
      },
      mockDb
    );

    assert.strictEqual(res.isDuplicate, true);
    assert.strictEqual(res.notification.id, 'notif-existing-1');
    assert.strictEqual(insertCount, 0, 'No second notification record was created');
  });
});
