import { describe, it } from 'node:test';
import assert from 'node:assert';
import { sendNotification } from '../src/services/notification.service.js';
import { updateUserPreferences, getUserPreferences } from '../src/services/notificationPreference.service.js';

describe('Phase 9 Server-Authoritative Notification Preferences Suite', () => {
  it('suppresses notification if user has disabled the category in preferences', async () => {
    let createdCount = 0;
    const userPrefs = {
      userId: 'usr-quiet',
      social: false, // Disabled
      live: true,
      pk: true,
      marketing: false,
    };

    const mockDb = {
      notificationPreference: {
        findUnique: async () => userPrefs,
        upsert: async (args) => args.update,
      },
      notification: {
        findFirst: async () => null,
        create: async () => {
          createdCount++;
          return { id: 'notif-1' };
        },
      },
      userDevice: {
        findMany: async () => [],
      },
    };

    // Attempt to send social follow notification
    const res = await sendNotification(
      {
        recipientId: 'usr-quiet',
        title: 'New Like',
        body: 'Someone liked your post',
        type: 'SOCIAL',
        category: 'Like',
      },
      mockDb
    );

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.suppressed, true);
    assert.strictEqual(res.reason, 'USER_PREFERENCE_DISABLED');
    assert.strictEqual(createdCount, 0, 'No notification inserted into DB when category is disabled');
  });

  it('allows mandatory moderation and system notifications even if preferences are disabled', async () => {
    let createdCount = 0;
    const userPrefs = {
      userId: 'usr-restricted',
      moderation: false, // Even if set to false, moderation is mandatory
      system: false,
    };

    const mockDb = {
      notificationPreference: {
        findUnique: async () => userPrefs,
      },
      notification: {
        findFirst: async () => null,
        create: async (args) => {
          createdCount++;
          return { id: 'notif-mod-1', ...args.data, createdAt: new Date() };
        },
      },
      userDevice: {
        findMany: async () => [],
      },
    };

    const res = await sendNotification(
      {
        recipientId: 'usr-restricted',
        title: 'Account Warning',
        body: 'You received an official violation warning.',
        type: 'MODERATION',
        category: 'Warning',
      },
      mockDb
    );

    assert.strictEqual(res.success, true);
    assert.strictEqual(createdCount, 1);
  });
});
