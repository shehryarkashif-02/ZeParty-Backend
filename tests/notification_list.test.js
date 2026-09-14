import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getNotifications, getUnreadCount } from '../src/services/notification.service.js';

describe('Phase 9 Notification History & Cursor Pagination Suite', () => {
  it('returns paginated notifications and calculates unread count', async () => {
    const mockList = [
      { id: 'notif-3', userId: 'usr-1', title: 'Gift 3', isRead: false, createdAt: new Date('2026-09-08T10:00:00Z') },
      { id: 'notif-2', userId: 'usr-1', title: 'Gift 2', isRead: false, createdAt: new Date('2026-09-08T09:00:00Z') },
      { id: 'notif-1', userId: 'usr-1', title: 'Gift 1', isRead: true, createdAt: new Date('2026-09-08T08:00:00Z') },
    ];

    const mockDb = {
      notification: {
        findMany: async ({ take }) => {
          return mockList.slice(0, take);
        },
        count: async () => 2,
      },
    };

    const res = await getNotifications('usr-1', { limit: 2 }, mockDb);
    assert.strictEqual(res.items.length, 2);
    assert.strictEqual(res.pageInfo.hasNextPage, true);
    assert.strictEqual(res.pageInfo.nextCursor, 'notif-2');

    const unread = await getUnreadCount('usr-1', mockDb);
    assert.strictEqual(unread, 2);
  });
});
