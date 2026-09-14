import { describe, it } from 'node:test';
import assert from 'node:assert';
import { onJoinRoom, onLeaveRoom, onRequestSnapshot } from '../src/socket/room.socket.js';
import { SOCKET_EVENTS, SOCKET_ERRORS } from '../src/socket/socket.constants.js';

describe('Phase 4 — Realtime Room Socket Events Specification Suite', () => {
  const mockUser = {
    id: 'user_socket_100',
    username: 'socket_joiner',
    displayName: 'Socket Joiner',
    avatarUrl: 'https://cdn.zeparty.app/avatars/joiner.png',
  };

  const mockLiveRoom = {
    id: 'room_socket_live_1',
    title: 'Live Chill Room',
    coverImageUrl: 'https://cdn.zeparty.app/covers/live.png',
    roomType: 'LIVE_AUDIO',
    category: 'CHILL',
    status: 'LIVE',
    creatorUserId: 'host_user_1',
    agoraChannelName: 'room_channel_123',
    currentViewersCount: 5,
    isPinnedTop: false,
    pinnedPosition: null,
    creator: {
      id: 'host_user_1',
      username: 'host_one',
      displayName: 'Host One',
      avatarUrl: null,
    },
    seats: [
      { seatIndex: 0, isLocked: false, isMuted: false, occupiedUserId: null, user: null },
      { seatIndex: 1, isLocked: false, isMuted: false, occupiedUserId: null, user: null },
    ],
  };

  const mockEndedRoom = {
    ...mockLiveRoom,
    id: 'room_socket_ended_1',
    status: 'ENDED',
  };

  it('rejects room:join if roomId is missing', async () => {
    let callbackResponse = null;

    const mockSocket = {
      id: 'sock_missing_room',
      userId: mockUser.id,
      user: mockUser,
      emit: () => {},
    };

    await onJoinRoom(mockSocket, {}, (res) => {
      callbackResponse = res;
    });

    assert.strictEqual(callbackResponse?.success, false);
    assert.strictEqual(callbackResponse?.error?.code, SOCKET_ERRORS.VALIDATION_ERROR);
  });

  it('rejects room:join if room status is not LIVE', async () => {
    let callbackResponse = null;

    const mockSocket = {
      id: 'sock_ended_room',
      userId: mockUser.id,
      user: mockUser,
      emit: () => {},
    };

    const mockDb = {
      room: {
        findUnique: async () => mockEndedRoom,
      },
    };

    await onJoinRoom(mockSocket, { roomId: mockEndedRoom.id }, (res) => {
      callbackResponse = res;
    }, mockDb);

    assert.strictEqual(callbackResponse?.success, false);
    assert.strictEqual(callbackResponse?.error?.code, SOCKET_ERRORS.ROOM_NOT_LIVE);
  });

  it('successfully joins a LIVE room, registers presence, and returns snapshot', async () => {
    let callbackResponse = null;
    const joinedRooms = new Set();
    const emittedToSocket = [];

    const mockSocket = {
      id: 'sock_live_join',
      userId: mockUser.id,
      user: mockUser,
      join: (roomName) => joinedRooms.add(roomName),
      emit: (event, payload) => {
        emittedToSocket.push({ event, payload });
      },
      to: () => ({
        emit: () => {},
      }),
    };

    const mockDb = {
      room: {
        findUnique: async () => mockLiveRoom,
        update: async () => ({ ...mockLiveRoom, currentViewersCount: 6 }),
      },
      roomMember: {
        findUnique: async () => null,
        create: async () => ({ id: 'member_1', roomId: mockLiveRoom.id, userId: mockUser.id }),
        upsert: async () => ({ id: 'member_1', roomId: mockLiveRoom.id, userId: mockUser.id }),
        count: async () => 6,
      },
      $transaction: async (cb) => cb(mockDb),
    };

    await onJoinRoom(mockSocket, { roomId: mockLiveRoom.id }, (res) => {
      callbackResponse = res;
    }, mockDb);

    assert.strictEqual(callbackResponse?.success, true);
    assert.ok(joinedRooms.has(`room:${mockLiveRoom.id}`));

    // Snapshot was delivered to socket
    const snapshotEvent = emittedToSocket.find((e) => e.event === SOCKET_EVENTS.ROOM_SNAPSHOT);
    assert.ok(snapshotEvent);
    assert.strictEqual(snapshotEvent.payload.room.id, mockLiveRoom.id);
  });

  it('delivers room snapshot on onRequestSnapshot request', async () => {
    const emittedToSocket = [];
    let callbackResponse = null;

    const mockSocket = {
      id: 'sock_snap_req',
      userId: mockUser.id,
      user: mockUser,
      emit: (event, payload) => {
        emittedToSocket.push({ event, payload });
      },
    };

    const mockDb = {
      room: {
        findUnique: async () => mockLiveRoom,
      },
    };

    await onRequestSnapshot(mockSocket, { roomId: mockLiveRoom.id }, (res) => {
      callbackResponse = res;
    }, mockDb);

    assert.strictEqual(callbackResponse?.success, true);
    assert.strictEqual(callbackResponse?.data?.room?.id, mockLiveRoom.id);
  });

  it('handles room:leave cleanly by removing socket and decrementing presence', async () => {
    let callbackResponse = null;
    const leftRooms = new Set();

    const mockSocket = {
      id: 'sock_live_leave',
      userId: mockUser.id,
      user: mockUser,
      leave: (roomName) => leftRooms.add(roomName),
      emit: () => {},
      to: () => ({
        emit: () => {},
      }),
    };

    const mockDb = {
      room: {
        findUnique: async () => mockLiveRoom,
        update: async () => ({ ...mockLiveRoom, currentViewersCount: 4 }),
      },
      roomMember: {
        findUnique: async () => ({ id: 'member_1', roomId: mockLiveRoom.id, userId: mockUser.id }),
        delete: async () => ({ id: 'member_1' }),
        count: async () => 4,
      },
      roomSeat: {
        updateMany: async () => ({ count: 0 }),
      },
      $transaction: async (cb) => cb(mockDb),
    };

    await onLeaveRoom(mockSocket, { roomId: mockLiveRoom.id }, (res) => {
      callbackResponse = res;
    }, mockDb);

    assert.strictEqual(callbackResponse?.success, true);
    assert.ok(leftRooms.has(`room:${mockLiveRoom.id}`));
  });
});
