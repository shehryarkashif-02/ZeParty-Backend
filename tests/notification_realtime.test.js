import { describe, it } from 'node:test';
import assert from 'node:assert';
import { sendNotification, markAsRead } from '../src/services/notification.service.js';
import socketEmitter from '../src/socket/socket.emitter.js';
import { SOCKET_EVENTS } from '../src/socket/socket.constants.js';

describe('Phase 9 Notification Realtime Socket Events Suite', () => {
  it('emits notification:new event to user room on notification creation', async () => {
    let emittedEvent = null;
    let emittedPayload = null;
    let emittedTarget = null;

    const mockSocket = {
      to: (room) => ({
        emit: (event, payload) => {
          emittedTarget = room;
          emittedEvent = event;
          emittedPayload = payload;
        },
      }),
    };

    socketEmitter.setSocketServerInstance(mockSocket);

    const mockDb = {
      notificationPreference: {
        findUnique: async () => null,
      },
      notification: {
        findFirst: async () => null,
        create: async (args) => ({
          id: 'notif-rt-1',
          ...args.data,
          createdAt: new Date(),
        }),
      },
      userDevice: {
        findMany: async () => [],
      },
    };

    await sendNotification(
      {
        recipientId: 'usr-realtime-1',
        title: 'PK Challenge',
        body: 'Host Beta challenged you to a PK battle!',
        type: 'PK',
      },
      mockDb
    );

    assert.strictEqual(emittedTarget, 'user:usr-realtime-1');
    assert.strictEqual(emittedEvent, SOCKET_EVENTS.NOTIFICATION_NEW);
    assert.strictEqual(emittedPayload.title, 'PK Challenge');
    assert.strictEqual(emittedPayload.id, 'notif-rt-1');
  });

  it('emits notification:read event when user marks notification as read', async () => {
    let emittedEvent = null;
    let emittedPayload = null;

    const mockSocket = {
      to: () => ({
        emit: (event, payload) => {
          emittedEvent = event;
          emittedPayload = payload;
        },
      }),
    };

    socketEmitter.setSocketServerInstance(mockSocket);

    const mockDb = {
      notification: {
        findFirst: async () => ({
          id: 'notif-rt-2',
          userId: 'usr-realtime-1',
          isRead: false,
        }),
        update: async (args) => ({
          id: 'notif-rt-2',
          userId: 'usr-realtime-1',
          ...args.data,
        }),
      },
    };

    await markAsRead('notif-rt-2', 'usr-realtime-1', mockDb);
    assert.strictEqual(emittedEvent, SOCKET_EVENTS.NOTIFICATION_READ);
    assert.strictEqual(emittedPayload.id, 'notif-rt-2');
  });
});
