import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getFeed } from '../src/services/social.service.js';

describe('Phase 6 Feed Cursor-Based Pagination Suite', () => {
  it('generates opaque base64 cursor and sets hasMore = true when additional items exist', async () => {
    const t1 = new Date('2026-09-01T12:00:00Z');
    const t2 = new Date('2026-09-01T11:00:00Z');
    const t3 = new Date('2026-09-01T10:00:00Z');

    const mockPosts = [
      { id: 'post-1', createdAt: t1, userId: 'u1', visibility: 'PUBLIC', user: { username: 'u1' }, _count: { comments: 0, likes: 0 } },
      { id: 'post-2', createdAt: t2, userId: 'u2', visibility: 'PUBLIC', user: { username: 'u2' }, _count: { comments: 0, likes: 0 } },
      { id: 'post-3', createdAt: t3, userId: 'u3', visibility: 'PUBLIC', user: { username: 'u3' }, _count: { comments: 0, likes: 0 } },
    ];

    const mockDb = {
      follow: { findMany: async () => [] },
      userBlock: { findMany: async () => [] },
      post: {
        findMany: async (args) => {
          // Requested limit is 2, repository takes limit + 1 = 3
          assert.strictEqual(args.take, 3);
          return mockPosts; // Returns 3 items -> hasMore: true
        },
      },
    };

    const feed = await getFeed({ limit: 2 }, mockDb);

    assert.strictEqual(feed.posts.length, 2);
    assert.strictEqual(feed.meta.hasMore, true);
    assert.ok(feed.meta.nextCursor);

    // Decoded cursor should correspond to post-2 (last item of page)
    const decoded = Buffer.from(feed.meta.nextCursor, 'base64').toString('utf-8');
    assert.strictEqual(decoded, `${t2.toISOString()}:post-2`);
  });

  it('sets hasMore = false and nextCursor = null when end of feed is reached', async () => {
    const mockPosts = [
      { id: 'post-1', createdAt: new Date(), userId: 'u1', visibility: 'PUBLIC', user: { username: 'u1' }, _count: { comments: 0, likes: 0 } },
    ];

    const mockDb = {
      follow: { findMany: async () => [] },
      userBlock: { findMany: async () => [] },
      post: {
        findMany: async () => mockPosts, // 1 item returned for limit: 2
      },
    };

    const feed = await getFeed({ limit: 2 }, mockDb);

    assert.strictEqual(feed.posts.length, 1);
    assert.strictEqual(feed.meta.hasMore, false);
    assert.strictEqual(feed.meta.nextCursor, null);
  });
});
