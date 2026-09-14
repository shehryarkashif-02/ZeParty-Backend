import { describe, it } from 'node:test';
import assert from 'node:assert';
import { markAsRead, markAllAsRead } from '../src/services/notification.service.js';

describe('Phase 9 Notification Read State Suite', () => {
  it('marks individual notification as read with readAt timestamp', async () => {
    let storedNotif = {
      id: 'notif-1',
      userId: 'usr-1',
      title: 'Hello',
      isRead: false,
      readAt: null,
    };

    const mockDb = {
      notification: {
        findFirst: async ({ where }) => {
          if (where.id === storedNotif.id && where.userId === storedNotif.userId) {
            return storedNotif;
          }
          return null;
        },
        update: async (args) => {
          storedNotif = { ...storedNotif, ...args.data };
          return storedNotif;
        },
      },
    };

    const updated = await markAsRead('notif-1', 'usr-1', mockDb);
    assert.strictEqual(updated.isRead, true);
    assert.ok(updated.readAt instanceof Date);
  });

  it('marks all unread notifications as read for a user', async () => {
    let updateManyCalled = false;
    const mockDb = {
      notification: {
        updateMany: async ({ where, data }) => {
          assert.strictEqual(where.userId, 'usr-1');
          assert.strictEqual(where.isRead, false);
          assert.strictEqual(data.isRead, true);
          updateManyCalled = true;
          return { count: 5 };
        },
      },
    };

    const result = await markAllAsRead('usr-1', mockDb);
    assert.strictEqual(result.count, 5);
    assert.strictEqual(updateManyCalled, true);
  });
});
