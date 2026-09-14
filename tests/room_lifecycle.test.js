import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { closeMyRoom, adminCloseRoom, adminPinRoom, adminUnpinRoom } from '../src/services/room.service.js';
import socketEmitter from '../src/socket/socket.emitter.js';
import { SOCKET_EVENTS } from '../src/socket/socket.constants.js';

describe('Phase 4 — Room Lifecycle & Admin Realtime Moderation Specification Suite', () => {
  let emittedEvents = [];

  const mockIo = {
    to: (roomName) => ({
      emit: (event, payload) => {
        emittedEvents.push({ target: roomName, event, payload });
      },
    }),
    emit: (event, payload) => {
      emittedEvents.push({ target: 'GLOBAL', event, payload });
    },
  };

  beforeEach(() => {
    emittedEvents = [];
    socketEmitter.setSocketServerInstance(mockIo);
  });

  it('emits room:closed when host closes their room', async () => {
    const roomId = 'room_host_close_1';
    const hostUserId = 'host_user_123';

    const mockDb = {
      room: {
        findUnique: async () => ({
          id: roomId,
          creatorUserId: hostUserId,
          status: 'LIVE',
        }),
        update: async ({ data }) => ({
          id: roomId,
          creatorUserId: hostUserId,
          status: data.status,
          endedAt: new Date(),
        }),
        updateMany: async () => ({ count: 0 }),
      },
      roomMember: {
        deleteMany: async () => ({ count: 5 }),
      },
      roomSeat: {
        updateMany: async () => ({ count: 8 }),
      },
      $transaction: async (cb) => cb(mockDb),
    };

    const result = await closeMyRoom(roomId, hostUserId, mockDb);
    assert.strictEqual(result.status, 'ENDED');

    const closedEvent = emittedEvents.find((e) => e.event === SOCKET_EVENTS.ROOM_CLOSED && e.target === `room:${roomId}`);
    assert.ok(closedEvent);
    assert.strictEqual(closedEvent.payload.roomId, roomId);
    assert.strictEqual(closedEvent.payload.status, 'ENDED');
    assert.strictEqual(closedEvent.payload.reason, 'HOST_CLOSED');
  });

  it('emits room:closed when administrator closes a live room with a reason', async () => {
    const roomId = 'room_admin_close_1';

    const mockDb = {
      room: {
        findUnique: async () => ({
          id: roomId,
          creatorUserId: 'violator_host',
          status: 'LIVE',
        }),
        update: async ({ data }) => ({
          id: roomId,
          status: data.status,
          endedAt: new Date(),
        }),
        updateMany: async () => ({ count: 0 }),
      },
      roomMember: {
        deleteMany: async () => ({ count: 10 }),
      },
      roomSeat: {
        updateMany: async () => ({ count: 8 }),
      },
      auditLog: {
        create: async () => ({ id: 'audit_1' }),
      },
      $transaction: async (cb) => cb(mockDb),
    };

    const result = await adminCloseRoom(
      roomId,
      { reason: 'Terms of Service violation', adminId: 'admin_1', adminName: 'SuperAdmin' },
      mockDb
    );
    assert.strictEqual(result.status, 'CLOSED_BY_ADMIN');

    const closedEvent = emittedEvents.find((e) => e.event === SOCKET_EVENTS.ROOM_CLOSED && e.target === `room:${roomId}`);
    assert.ok(closedEvent);
    assert.strictEqual(closedEvent.payload.status, 'CLOSED_BY_ADMIN');
    assert.strictEqual(closedEvent.payload.reason, 'Terms of Service violation');
  });

  it('emits room:pinned to room and global channel on adminPinRoom', async () => {
    const roomId = 'room_pin_1';

    const mockDb = {
      room: {
        findUnique: async () => ({
          id: roomId,
          isPinnedTop: false,
          pinnedPosition: null,
        }),
        update: async ({ data }) => ({
          id: roomId,
          isPinnedTop: data.isPinnedTop,
          pinnedPosition: data.pinnedPosition,
        }),
        updateMany: async () => ({ count: 0 }),
      },
      auditLog: {
        create: async () => ({ id: 'audit_pin' }),
      },
      $transaction: async (cb) => cb(mockDb),
    };

    const updated = await adminPinRoom(
      roomId,
      { pinnedPosition: 1, adminId: 'admin_1', adminName: 'Admin' },
      mockDb
    );
    assert.strictEqual(updated.isPinnedTop, true);
    assert.strictEqual(updated.pinnedPosition, 1);

    const roomPinEvent = emittedEvents.find((e) => e.event === SOCKET_EVENTS.ROOM_PINNED && e.target === `room:${roomId}`);
    assert.ok(roomPinEvent);
    assert.strictEqual(roomPinEvent.payload.isPinnedTop, true);

    const globalPinEvent = emittedEvents.find((e) => e.event === SOCKET_EVENTS.ROOM_PINNED && e.target === 'GLOBAL');
    assert.ok(globalPinEvent);
    assert.strictEqual(globalPinEvent.payload.roomId, roomId);
  });

  it('emits room:unpinned to room and global channel on adminUnpinRoom', async () => {
    const roomId = 'room_unpin_1';

    const mockDb = {
      room: {
        findUnique: async () => ({
          id: roomId,
          isPinnedTop: true,
          pinnedPosition: 1,
        }),
        update: async ({ data }) => ({
          id: roomId,
          isPinnedTop: data.isPinnedTop,
          pinnedPosition: data.pinnedPosition,
        }),
        updateMany: async () => ({ count: 0 }),
      },
      auditLog: {
        create: async () => ({ id: 'audit_unpin' }),
      },
      $transaction: async (cb) => cb(mockDb),
    };

    const updated = await adminUnpinRoom(
      roomId,
      { adminId: 'admin_1', adminName: 'Admin' },
      mockDb
    );
    assert.strictEqual(updated.isPinnedTop, false);

    const roomUnpinEvent = emittedEvents.find((e) => e.event === SOCKET_EVENTS.ROOM_UNPINNED && e.target === `room:${roomId}`);
    assert.ok(roomUnpinEvent);
    assert.strictEqual(roomUnpinEvent.payload.isPinnedTop, false);

    const globalUnpinEvent = emittedEvents.find((e) => e.event === SOCKET_EVENTS.ROOM_UNPINNED && e.target === 'GLOBAL');
    assert.ok(globalUnpinEvent);
  });
});
