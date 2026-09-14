import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  createPostSchema,
  queryFeedSchema,
  postIdParamSchema,
} from '../src/validators/post.validator.js';
import {
  createPost,
  getFeed,
  getPostById,
  deletePost,
} from '../src/services/post.service.js';

describe('Phase 2 Social Posts & Feed Specification Suite', () => {
  // 1. Post Validation
  describe('1. Post Validation Schemas', () => {
    it('accepts valid post payload with content and media URLs', () => {
      const valid = createPostSchema.parse({
        content: 'Check out the amazing party live stream tonight!',
        mediaUrls: [
          'https://cdn.zeparty.app/posts/photo1.jpg',
          'https://cdn.zeparty.app/posts/photo2.jpg',
        ],
      });
      assert.strictEqual(valid.content, 'Check out the amazing party live stream tonight!');
      assert.strictEqual(valid.mediaUrls.length, 2);
    });

    it('rejects empty post content', () => {
      assert.throws(() => {
        createPostSchema.parse({
          content: '   ',
        });
      });
    });

    it('rejects more than 9 media items', () => {
      const urls = Array.from({ length: 10 }, (_, i) => `https://cdn.zeparty.app/posts/${i}.jpg`);
      assert.throws(() => {
        createPostSchema.parse({
          content: 'Too many pictures',
          mediaUrls: urls,
        });
      });
    });

    it('rejects invalid media URLs', () => {
      assert.throws(() => {
        createPostSchema.parse({
          content: 'Bad url',
          mediaUrls: ['not-a-valid-url'],
        });
      });
    });

    it('validates feed query parameters and defaults', () => {
      const parsed = queryFeedSchema.parse({});
      assert.strictEqual(parsed.page, 1);
      assert.strictEqual(parsed.limit, 20);
    });
  });

  // 2. Post Service & Ownership Security
  describe('2. Post Operations & IDOR Security', () => {
    it('createPost persists post with author reference and media array', async () => {
      let inserted = null;
      const mockDb = {
        post: {
          create: async ({ data }) => {
            inserted = {
              id: 'post-101',
              userId: data.userId,
              content: data.content,
              mediaUrls: data.mediaUrls,
              likesCount: 0,
              commentsCount: 0,
              createdAt: new Date(),
              user: {
                id: data.userId,
                username: 'alice',
                avatarUrl: 'https://cdn.zeparty.app/avatars/alice.png',
                profile: { displayName: 'Alice' },
              },
            };
            return inserted;
          },
        },
      };

      const post = await createPost(
        {
          userId: 'usr-alice',
          content: 'Hello ZeParty World!',
          mediaUrls: ['https://cdn.zeparty.app/img.png'],
        },
        mockDb
      );

      assert.strictEqual(post.id, 'post-101');
      assert.strictEqual(post.userId, 'usr-alice');
      assert.strictEqual(post.user.username, 'alice');
      assert.strictEqual(inserted.mediaUrls.length, 1);
    });

    it('getFeed returns paginated posts excluding deleted posts', async () => {
      const mockDb = {
        post: {
          count: async () => 1,
          findMany: async () => [
            {
              id: 'post-101',
              userId: 'usr-alice',
              content: 'Live right now!',
              likesCount: 15,
              commentsCount: 3,
              createdAt: new Date(),
              user: {
                id: 'usr-alice',
                username: 'alice',
                avatarUrl: 'https://cdn.zeparty.app/a.png',
                profile: { displayName: 'Alice', level: 10, vipLevel: 2, svipLevel: 0, nobleRank: 'Baron' },
              },
            },
          ],
        },
      };

      const feed = await getFeed({ page: 1, limit: 10 }, mockDb);
      assert.strictEqual(feed.posts.length, 1);
      assert.strictEqual(feed.pagination.total, 1);
      assert.strictEqual(feed.posts[0].user.profile.nobleRank, 'Baron');
    });

    it('deletePost allows author to delete own post and rejects non-author (IDOR defense)', async () => {
      let softDeleted = false;

      const mockDb = {
        post: {
          findFirst: async ({ where }) => {
            if (where.id === 'post-alice') {
              return {
                id: 'post-alice',
                userId: 'usr-alice',
                content: 'Alice Post',
                deletedAt: null,
              };
            }
            return null;
          },
          update: async () => {
            softDeleted = true;
            return { id: 'post-alice', deletedAt: new Date() };
          },
        },
      };

      // 1. Bob attempts to delete Alice's post -> 403 Forbidden
      await assert.rejects(
        async () => {
          await deletePost('post-alice', 'usr-bob', { isAdmin: false }, mockDb);
        },
        (err) => err.statusCode === 403 && err.code === 'FORBIDDEN'
      );
      assert.strictEqual(softDeleted, false);

      // 2. Alice deletes her own post -> Success
      const res = await deletePost('post-alice', 'usr-alice', { isAdmin: false }, mockDb);
      assert.strictEqual(res.success, true);
      assert.strictEqual(softDeleted, true);

      // 3. Admin deletes Alice's post -> Success
      softDeleted = false;
      const adminRes = await deletePost('post-alice', 'usr-random-admin', { isAdmin: true }, mockDb);
      assert.strictEqual(adminRes.success, true);
      assert.strictEqual(softDeleted, true);
    });
  });
});
