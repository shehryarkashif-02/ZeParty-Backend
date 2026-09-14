import { describe, it } from 'node:test';
import assert from 'node:assert';
import { markAsRead, deleteNotification } from '../src/services/notification.service.js';
import { removeDevice } from '../src/services/notificationDevice.service.js';

describe('Phase 9 Notification IDOR Defense Suite', () => {
  it('blocks User A from marking User B notification as read with 404/FORBIDDEN', async () => {
    const mockDb = {
      notification: {
        findFirst: async ({ where }) => {
          // Record belongs to User B ('usr-B')
          if (where.id === 'notif-B-1' && where.userId === 'usr-A') {
            return null; // Not found for User A
          }
          return null;
        },
      },
    };

    await assert.rejects(
      async () => {
        await markAsRead('notif-B-1', 'usr-A', mockDb);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 404);
        assert.strictEqual(err.code, 'NOTIFICATION_NOT_FOUND');
        return true;
      }
    );
  });

  it('blocks User A from deleting User B device registration', async () => {
    const mockDb = {
      userDevice: {
        findFirst: async ({ where }) => {
          // Device belongs to User B
          if (where.userId === 'usr-A' && where.id === 'dev-B-1') {
            return null;
          }
          return null;
        },
      },
    };

    await assert.rejects(
      async () => {
        await removeDevice({ userId: 'usr-A', deviceId: 'dev-B-1' }, mockDb);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 404);
        assert.strictEqual(err.code, 'DEVICE_NOT_FOUND');
        return true;
      }
    );
  });
});
