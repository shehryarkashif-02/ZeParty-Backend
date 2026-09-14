import { describe, it } from 'node:test';
import assert from 'node:assert';
import { broadcastNotification, listBroadcasts, getBroadcastDetails } from '../src/services/adminNotification.service.js';

describe('Phase 9 Admin Broadcast Notification Lifecycle Suite', () => {
  it('creates broadcast campaign, targets audience, and logs audit action', async () => {
    let auditLogged = false;
    let savedBroadcast = null;
    let createdNotifications = [];

    const mockDb = {
      user: {
        findMany: async () => [
          { id: 'usr-target-1' },
          { id: 'usr-target-2' },
          { id: 'usr-target-3' },
        ],
      },
      notificationBroadcast: {
        create: async (args) => {
          savedBroadcast = {
            id: 'camp-001',
            ...args.data,
            createdAt: new Date(),
          };
          return savedBroadcast;
        },
      },
      notification: {
        createMany: async (args) => {
          createdNotifications.push(...args.data);
          return { count: args.data.length };
        },
      },
      userDevice: {
        findMany: async () => [],
      },
      auditLog: {
        create: async (args) => {
          assert.strictEqual(args.data.action, 'NOTIFICATION_BROADCAST_SENT');
          auditLogged = true;
          return { id: 'audit-comm-1' };
        },
      },
    };

    const res = await broadcastNotification(
      {
        title: 'System Maintenance Alert',
        body: 'Scheduled maintenance will occur tonight at 02:00 UTC.',
        type: 'Push',
        audience: 'All Users',
        adminId: 'admin-comm-1',
        adminName: 'Communications Admin',
      },
      mockDb
    );

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.broadcast.id, 'camp-001');
    assert.strictEqual(res.recipientCount, 3);
    assert.strictEqual(createdNotifications.length, 3);
    assert.strictEqual(auditLogged, true);
  });
});
