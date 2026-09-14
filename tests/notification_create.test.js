import { describe, it } from 'node:test';
import assert from 'node:assert';
import { sendNotification } from '../src/services/notification.service.js';

describe('Phase 9 Notification Creation & Persistence Suite', () => {
  it('creates and persists notification in PostgreSQL and returns authoritative state', async () => {
    let createdRecord = null;
    const mockDb = {
      notification: {
        findFirst: async () => null,
        create: async (args) => {
          createdRecord = {
            id: 'notif-100',
            ...args.data,
            isRead: false,
            createdAt: new Date(),
          };
          return createdRecord;
        },
      },
      notificationPreference: {
        findUnique: async () => null, // Default all enabled
      },
      userDevice: {
        findMany: async () => [],
      },
    };

    const res = await sendNotification(
      {
        recipientId: 'usr-recipient-1',
        title: 'New Follower',
        body: 'User Alpha started following you.',
        type: 'SOCIAL',
        category: 'Follower',
        data: { followerId: 'usr-alpha' },
        sourceType: 'FOLLOW',
        sourceId: 'fol-123',
      },
      mockDb
    );

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.notification.id, 'notif-100');
    assert.strictEqual(res.notification.type, 'SOCIAL');
    assert.strictEqual(res.notification.category, 'Follower');
    assert.strictEqual(res.notification.isRead, false);
    assert.strictEqual(createdRecord.title, 'New Follower');
  });

  it('rejects invalid payload missing recipientId or title with 400', async () => {
    await assert.rejects(
      async () => {
        await sendNotification({
          recipientId: null,
          title: 'Test',
          body: 'Test body',
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, 'INVALID_NOTIFICATION_PAYLOAD');
        return true;
      }
    );
  });
});
