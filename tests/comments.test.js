import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createComment, getPostComments, deleteComment } from '../src/services/social.service.js';

describe('Phase 6 Post Comments & Replies Suite', () => {
  it('creates comment and atomically increments post commentsCount', async () => {
    let createdComment = null;
    let incrementedPost = null;

    const mockPost = {
      id: 'p-comm-1',
      userId: 'usr-author-1',
      commentsCount: 2,
    };

    const mockDb = {
      post: {
        findFirst: async () => mockPost,
        update: async (args) => {
          incrementedPost = args.where.id;
          return { ...mockPost, commentsCount: 3 };
        },
      },
      comment: {
        create: async (args) => {
          createdComment = {
            id: 'c-101',
            ...args.data,
            createdAt: new Date(),
            user: { username: 'commenter_1' },
          };
          return createdComment;
        },
      },
    };

    const comment = await createComment(
      {
        postId: 'p-comm-1',
        userId: 'usr-commenter-1',
        content: 'Awesome live show!',
      },
      mockDb
    );

    assert.strictEqual(comment.id, 'c-101');
    assert.strictEqual(comment.content, 'Awesome live show!');
    assert.strictEqual(incrementedPost, 'p-comm-1');
  });

  it('validates parent comment exists when posting a nested reply', async () => {
    const mockPost = {
      id: 'p-comm-2',
      userId: 'usr-author-1',
    };

    const mockDb = {
      post: {
        findFirst: async () => mockPost,
      },
      comment: {
        findFirst: async () => null, // Parent comment not found
      },
    };

    await assert.rejects(
      async () => {
        await createComment(
          {
            postId: 'p-comm-2',
            userId: 'usr-reply-1',
            content: 'Replying to non-existent comment',
            parentId: 'c-non-existent',
          },
          mockDb
        );
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, 'INVALID_PARENT_COMMENT');
        return true;
      }
    );
  });

  it('allows comment author or post author to delete comment and decrements commentsCount', async () => {
    let softDeletedId = null;
    let decrementedPostId = null;

    const mockComment = {
      id: 'c-del-1',
      postId: 'p-comm-3',
      userId: 'usr-comment-author',
      content: 'Will be deleted',
      deletedAt: null,
      post: { id: 'p-comm-3', userId: 'usr-post-owner' },
    };

    const mockDb = {
      comment: {
        findFirst: async () => mockComment,
        update: async (args) => {
          softDeletedId = args.where.id;
          return { ...mockComment, deletedAt: new Date() };
        },
      },
      post: {
        findUnique: async () => ({ id: 'p-comm-3', commentsCount: 5 }),
        update: async (args) => {
          decrementedPostId = args.where.id;
          return { id: 'p-comm-3', commentsCount: 4 };
        },
      },
    };

    // 1. Comment author deletes own comment -> Success
    const res = await deleteComment('c-del-1', 'usr-comment-author', {}, mockDb);
    assert.strictEqual(res.success, true);
    assert.strictEqual(softDeletedId, 'c-del-1');
    assert.strictEqual(decrementedPostId, 'p-comm-3');

    // 2. Post owner deletes comment on their post -> Success
    softDeletedId = null;
    const resPostOwner = await deleteComment('c-del-1', 'usr-post-owner', {}, mockDb);
    assert.strictEqual(resPostOwner.success, true);

    // 3. Unauthorized stranger tries to delete comment -> 403 Forbidden
    await assert.rejects(
      async () => {
        await deleteComment('c-del-1', 'usr-stranger', {}, mockDb);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, 'FORBIDDEN');
        return true;
      }
    );
  });
});
