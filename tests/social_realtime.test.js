import { describe, it } from 'node:test';
import assert from 'node:assert';
import socketEmitter from '../src/socket/socket.emitter.js';
import { SOCKET_EVENTS } from '../src/socket/socket.constants.js';
import { createPost, likePost, createComment, followUser } from '../src/services/social.service.js';

describe('Phase 6 Social Realtime Socket Events Suite', () => {
  it('emits post:created event globally on public post creation', async () => {
    let emittedEvent = null;
    let emittedPayload = null;

    socketEmitter.setSocketServerInstance({
      emit: (event, payload) => {
        emittedEvent = event;
        emittedPayload = payload;
      },
      to: () => ({ emit: () => {} }),
    });

    const mockDb = {
      post: {
        create: async (args) => ({
          id: 'post-socket-1',
          userId: 'usr-author-socket',
          content: 'Realtime post announcement!',
          visibility: 'PUBLIC',
          createdAt: new Date(),
          user: { username: 'socket_host' },
        }),
      },
      userProfile: {
        updateMany: async () => ({ count: 1 }),
      },
    };

    await createPost(
      {
        userId: 'usr-author-socket',
        content: 'Realtime post announcement!',
        visibility: 'PUBLIC',
      },
      mockDb
    );

    assert.strictEqual(emittedEvent, SOCKET_EVENTS.POST_CREATED);
    assert.strictEqual(emittedPayload.postId, 'post-socket-1');
    assert.strictEqual(emittedPayload.authorUsername, 'socket_host');
  });

  it('emits post:liked event to post author room when post is liked', async () => {
    let emittedEvent = null;
    let targetRoom = null;
    let emittedPayload = null;

    socketEmitter.setSocketServerInstance({
      to: (room) => ({
        emit: (event, payload) => {
          targetRoom = room;
          emittedEvent = event;
          emittedPayload = payload;
        },
      }),
    });

    const mockPost = {
      id: 'post-socket-2',
      userId: 'usr-author-recipient',
      likesCount: 5,
    };

    const mockDb = {
      post: {
        findFirst: async () => mockPost,
        update: async () => ({ ...mockPost, likesCount: 6 }),
      },
      like: {
        findUnique: async () => null,
        create: async (args) => args.data,
      },
    };

    await likePost('post-socket-2', 'usr-liker', mockDb);

    assert.strictEqual(targetRoom, 'user:usr-author-recipient');
    assert.strictEqual(emittedEvent, SOCKET_EVENTS.POST_LIKED);
    assert.strictEqual(emittedPayload.postId, 'post-socket-2');
    assert.strictEqual(emittedPayload.likesCount, 6);
  });

  it('emits follow:created event to followed target user', async () => {
    let targetRoom = null;
    let emittedEvent = null;

    socketEmitter.setSocketServerInstance({
      to: (room) => ({
        emit: (event) => {
          targetRoom = room;
          emittedEvent = event;
        },
      }),
    });

    const mockTargetUser = {
      id: 'usr-star-followed',
      profile: { isPrivate: false },
    };

    const mockDb = {
      user: { findUnique: async () => mockTargetUser },
      userBlock: { findFirst: async () => null },
      follow: {
        findUnique: async () => null,
        create: async (args) => args.data,
      },
      userProfile: { updateMany: async () => ({ count: 1 }) },
    };

    await followUser('usr-follower-fan', 'usr-star-followed', mockDb);

    assert.strictEqual(targetRoom, 'user:usr-star-followed');
    assert.strictEqual(emittedEvent, SOCKET_EVENTS.FOLLOW_CREATED);
  });
});
