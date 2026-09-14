import { describe, it } from 'node:test';
import assert from 'node:assert';
import { sendNotification } from '../src/services/notification.service.js';

describe('Phase 9 Post-Commit Notification Delivery Suite', () => {
  it('ensures notification database row is created before asynchronous push dispatch', async () => {
    let transactionCommitted = false;
    let pushInvokedAfterCommit = false;

    const mockDb = {
      notificationPreference: {
        findUnique: async () => null,
      },
      notification: {
        findFirst: async () => null,
        create: async (args) => {
          transactionCommitted = true;
          return {
            id: 'notif-commit-1',
            ...args.data,
            createdAt: new Date(),
          };
        },
      },
      userDevice: {
        findMany: async () => {
          // Verify that DB row was already committed before device tokens are looked up for push
          if (transactionCommitted) {
            pushInvokedAfterCommit = true;
          }
          return [];
        },
      },
    };

    const res = await sendNotification(
      {
        recipientId: 'usr-post-commit',
        title: 'Settlement Approved',
        body: 'Your weekly settlement has been approved.',
        type: 'FINANCE',
        category: 'Settlement',
      },
      mockDb
    );

    assert.strictEqual(res.success, true);
    assert.strictEqual(transactionCommitted, true);
    assert.strictEqual(pushInvokedAfterCommit, true);
  });
});
