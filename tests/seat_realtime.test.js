import { describe, it } from 'node:test';
import assert from 'node:assert';
import { onOccupySeat, onLeaveSeat } from '../src/socket/seat.socket.js';
import { SOCKET_EVENTS, SOCKET_ERRORS } from '../src/socket/socket.constants.js';

describe('Phase 4 — Realtime 8-Seat Synchronization Specification Suite', () => {
  const mockUser = {
    id: 'user_seat_1',
    username: 'seat_master',
    displayName: 'Seat Master',
    avatarUrl: 'https://cdn.zeparty.app/avatars/seat1.png',
  };

  it('rejects invalid seat index outside [0..7]', async () => {
    let callbackResponse = null;

    const mockSocket = {
      userId: mockUser.id,
      user: mockUser,
      emit: () => {},
    };

    await onOccupySeat(null, mockSocket, { roomId: 'room-1', seatIndex: 8 }, (res) => {
      callbackResponse = res;
    });

    assert.strictEqual(callbackResponse?.success, false);
    assert.strictEqual(callbackResponse?.error?.code, SOCKET_ERRORS.INVALID_SEAT_INDEX);

    await onOccupySeat(null, mockSocket, { roomId: 'room-1', seatIndex: -1 }, (res) => {
      callbackResponse = res;
    });

    assert.strictEqual(callbackResponse?.success, false);
    assert.strictEqual(callbackResponse?.error?.code, SOCKET_ERRORS.INVALID_SEAT_INDEX);
  });

  it('successfully occupies a vacant seat and broadcasts room:seat_occupied', async () => {
    let callbackResponse = null;
    const emittedToRoom = [];

    const mockIo = {
      to: (roomName) => ({
        emit: (event, payload) => {
          emittedToRoom.push({ roomName, event, payload });
        },
      }),
    };

    const mockSocket = {
      userId: mockUser.id,
      user: mockUser,
      emit: () => {},
    };

    const mockDb = {
      room: {
        findUnique: async () => ({
          id: 'room-1',
          status: 'LIVE',
        }),
      },
      roomSeat: {
        findFirst: async () => null, // User is not occupying another seat
        findUnique: async () => ({
          roomId: 'room-1',
          seatIndex: 2,
          occupiedUserId: null,
          isLocked: false,
        }),
        update: async () => ({
          roomId: 'room-1',
          seatIndex: 2,
          occupiedUserId: mockUser.id,
          isLocked: false,
          isMuted: false,
          occupiedUser: mockUser,
        }),
      },
      $transaction: async (cb) => cb(mockDb),
    };

    await onOccupySeat(mockIo, mockSocket, { roomId: 'room-1', seatIndex: 2 }, (res) => {
      callbackResponse = res;
    }, mockDb);

    assert.strictEqual(callbackResponse?.success, true);
    assert.strictEqual(callbackResponse?.data?.seatIndex, 2);

    const seatOccupiedEvent = emittedToRoom.find((e) => e.event === SOCKET_EVENTS.ROOM_SEAT_OCCUPIED);
    assert.ok(seatOccupiedEvent);
    assert.strictEqual(seatOccupiedEvent.payload.seatIndex, 2);
    assert.strictEqual(seatOccupiedEvent.payload.user.id, mockUser.id);
  });

  it('successfully releases an occupied seat and broadcasts room:seat_released', async () => {
    let callbackResponse = null;
    const emittedToRoom = [];

    const mockIo = {
      to: (roomName) => ({
        emit: (event, payload) => {
          emittedToRoom.push({ roomName, event, payload });
        },
      }),
    };

    const mockSocket = {
      userId: mockUser.id,
      user: mockUser,
      emit: () => {},
    };

    const mockDb = {
      room: {
        findUnique: async () => ({
          id: 'room-1',
          status: 'LIVE',
          creatorUserId: 'host_id',
        }),
      },
      roomSeat: {
        findUnique: async () => ({
          roomId: 'room-1',
          seatIndex: 2,
          occupiedUserId: mockUser.id,
          isLocked: false,
          room: {
            creatorUserId: 'host_id',
          },
        }),
        update: async () => ({
          roomId: 'room-1',
          seatIndex: 2,
          occupiedUserId: null,
          isLocked: false,
          isMuted: false,
        }),
      },
      $transaction: async (cb) => cb(mockDb),
    };

    await onLeaveSeat(mockIo, mockSocket, { roomId: 'room-1', seatIndex: 2 }, (res) => {
      callbackResponse = res;
    }, mockDb);

    assert.strictEqual(callbackResponse?.success, true);
    assert.strictEqual(callbackResponse?.data?.seatIndex, 2);

    const seatReleasedEvent = emittedToRoom.find((e) => e.event === SOCKET_EVENTS.ROOM_SEAT_RELEASED);
    assert.ok(seatReleasedEvent);
    assert.strictEqual(seatReleasedEvent.payload.seatIndex, 2);
  });
});
