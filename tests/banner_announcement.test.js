import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  createBannerSchema,
  updateBannerSchema,
} from '../src/validators/banner.validator.js';
import {
  createBanner,
  getActiveBanners,
  updateBanner,
  deleteBanner,
} from '../src/services/banner.service.js';
import {
  createAnnouncementSchema,
  updateAnnouncementSchema,
} from '../src/validators/announcement.validator.js';
import {
  createAnnouncement,
  getActiveAnnouncements,
  updateAnnouncement,
  deleteAnnouncement,
} from '../src/services/announcement.service.js';

describe('Phase 2 Banners & Announcements Specification Suite', () => {
  // 1. Banner Validation & Business Rules
  describe('1. Banner Validation & Filtering', () => {
    it('validates banner creation with proper image and destination URLs', () => {
      const valid = createBannerSchema.parse({
        title: 'Spring Festival',
        imageUrl: 'https://cdn.zeparty.app/banners/spring.png',
        destinationUrl: 'https://zeparty.app/events/spring',
        position: 1,
        isActive: true,
      });
      assert.strictEqual(valid.title, 'Spring Festival');
      assert.strictEqual(valid.position, 1);
    });

    it('enforces date ordering on banner: startsAt must be <= endsAt', () => {
      // Valid date range
      const valid = createBannerSchema.parse({
        title: 'Event Banner',
        imageUrl: 'https://cdn.zeparty.app/banners/event.png',
        startsAt: '2026-06-01T00:00:00.000Z',
        endsAt: '2026-06-10T00:00:00.000Z',
      });
      assert.ok(valid);

      // Invalid date range: startsAt after endsAt
      assert.throws(() => {
        createBannerSchema.parse({
          title: 'Invalid Banner',
          imageUrl: 'https://cdn.zeparty.app/banners/event.png',
          startsAt: '2026-06-15T00:00:00.000Z',
          endsAt: '2026-06-10T00:00:00.000Z',
        });
      });
    });

    it('getActiveBanners excludes inactive, future, and expired banners', async () => {
      const now = new Date('2026-06-05T12:00:00.000Z');
      const allBanners = [
        {
          id: 'b-active-1',
          title: 'Active Ongoing',
          imageUrl: 'https://cdn.zeparty.app/1.png',
          isActive: true,
          startsAt: new Date('2026-06-01T00:00:00.000Z'),
          endsAt: new Date('2026-06-10T00:00:00.000Z'),
          position: 1,
        },
        {
          id: 'b-active-2',
          title: 'Active No Dates',
          imageUrl: 'https://cdn.zeparty.app/2.png',
          isActive: true,
          startsAt: null,
          endsAt: null,
          position: 2,
        },
        {
          id: 'b-future',
          title: 'Future Banner',
          imageUrl: 'https://cdn.zeparty.app/3.png',
          isActive: true,
          startsAt: new Date('2026-06-20T00:00:00.000Z'),
          endsAt: new Date('2026-06-25T00:00:00.000Z'),
          position: 3,
        },
        {
          id: 'b-expired',
          title: 'Expired Banner',
          imageUrl: 'https://cdn.zeparty.app/4.png',
          isActive: true,
          startsAt: new Date('2026-05-01T00:00:00.000Z'),
          endsAt: new Date('2026-05-10T00:00:00.000Z'),
          position: 4,
        },
        {
          id: 'b-inactive',
          title: 'Disabled Banner',
          imageUrl: 'https://cdn.zeparty.app/5.png',
          isActive: false,
          startsAt: null,
          endsAt: null,
          position: 5,
        },
      ];

      const mockDb = {
        banner: {
          findMany: async () => {
            // Emulate database query with where clause
            return allBanners.filter((b) => {
              if (!b.isActive) return false;
              if (b.startsAt && b.startsAt > now) return false;
              if (b.endsAt && b.endsAt < now) return false;
              return true;
            });
          },
        },
      };

      const active = await getActiveBanners(mockDb);
      assert.strictEqual(active.length, 2);
      assert.strictEqual(active[0].id, 'b-active-1');
      assert.strictEqual(active[1].id, 'b-active-2');
    });

    it('createBanner, updateBanner, and deleteBanner write audit log', async () => {
      const audits = [];
      const mockDb = {
        banner: {
          create: async ({ data }) => ({ id: 'ban-new', ...data }),
          findUnique: async () => ({ id: 'ban-new', title: 'Banner 1' }),
          update: async ({ data }) => ({ id: 'ban-new', ...data }),
          delete: async () => ({ id: 'ban-new' }),
        },
        auditLog: {
          create: async ({ data }) => {
            audits.push(data);
            return { id: 'aud-1', ...data };
          },
        },
      };

      await createBanner(
        { title: 'Promo', imageUrl: 'https://cdn.zeparty.app/p.png' },
        { adminId: 'adm-1', adminName: 'Admin', ipAddress: '127.0.0.1' },
        mockDb
      );
      assert.strictEqual(audits[0].action, 'BANNER_CREATED');

      await updateBanner(
        'ban-new',
        { title: 'Updated Promo' },
        { adminId: 'adm-1', adminName: 'Admin', ipAddress: '127.0.0.1' },
        mockDb
      );
      assert.strictEqual(audits[1].action, 'BANNER_UPDATED');

      await deleteBanner(
        'ban-new',
        { adminId: 'adm-1', adminName: 'Admin', ipAddress: '127.0.0.1' },
        mockDb
      );
      assert.strictEqual(audits[2].action, 'BANNER_DELETED');
    });
  });

  // 2. Announcement Validation & Business Rules
  describe('2. Announcement Validation & Target Audience Filtering', () => {
    it('validates announcement creation and default targetAudience ALL', () => {
      const valid = createAnnouncementSchema.parse({
        title: 'Server Maintenance Notice',
        body: 'Scheduled downtime tonight at 02:00 UTC.',
      });
      assert.strictEqual(valid.title, 'Server Maintenance Notice');
      assert.strictEqual(valid.targetAudience, 'ALL');
      assert.strictEqual(valid.isActive, true);
    });

    it('accepts specific target audience enums', () => {
      const validHost = createAnnouncementSchema.parse({
        title: 'Host Rewards Program',
        body: 'New diamond conversion incentives for hosts.',
        targetAudience: 'HOSTS',
      });
      assert.strictEqual(validHost.targetAudience, 'HOSTS');

      assert.throws(() => {
        createAnnouncementSchema.parse({
          title: 'Invalid Target',
          body: 'Content',
          targetAudience: 'NON_EXISTENT_GROUP',
        });
      });
    });

    it('getActiveAnnouncements filters by audience correctly', async () => {
      let queriedWhere = null;
      const mockDb = {
        announcement: {
          findMany: async ({ where }) => {
            queriedWhere = where;
            return [
              { id: 'ann-1', title: 'Global', targetAudience: 'ALL', isActive: true },
              { id: 'ann-2', title: 'Host Only', targetAudience: 'HOSTS', isActive: true },
            ];
          },
        },
      };

      const result = await getActiveAnnouncements({ targetAudience: 'HOSTS' }, mockDb);
      assert.strictEqual(result.length, 2);
      assert.deepStrictEqual(queriedWhere.targetAudience, { in: ['ALL', 'HOSTS'] });
    });

    it('announcement CRUD records audit logs', async () => {
      const audits = [];
      const mockDb = {
        announcement: {
          create: async ({ data }) => ({ id: 'ann-1', ...data }),
          findUnique: async () => ({ id: 'ann-1', title: 'Notice' }),
          update: async ({ data }) => ({ id: 'ann-1', ...data }),
          delete: async () => ({ id: 'ann-1' }),
        },
        auditLog: {
          create: async ({ data }) => {
            audits.push(data);
            return { id: 'aud-ann-1', ...data };
          },
        },
      };

      await createAnnouncement(
        { title: 'Notice', body: 'Maintenance' },
        { adminId: 'adm-1', adminName: 'Admin', ipAddress: '127.0.0.1' },
        mockDb
      );
      assert.strictEqual(audits[0].action, 'ANNOUNCEMENT_CREATED');

      await updateAnnouncement(
        'ann-1',
        { title: 'Updated Notice' },
        { adminId: 'adm-1', adminName: 'Admin', ipAddress: '127.0.0.1' },
        mockDb
      );
      assert.strictEqual(audits[1].action, 'ANNOUNCEMENT_UPDATED');

      await deleteAnnouncement(
        'ann-1',
        { adminId: 'adm-1', adminName: 'Admin', ipAddress: '127.0.0.1' },
        mockDb
      );
      assert.strictEqual(audits[2].action, 'ANNOUNCEMENT_DELETED');
    });
  });
});
