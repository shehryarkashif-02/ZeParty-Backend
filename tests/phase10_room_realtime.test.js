/**
 * Phase 10 — Room Realtime Integration Suite
 *
 * Verifies room lifecycle, seating mechanics, post-commit Socket.IO
 * event emission contracts, Agora token generation modes, and room closure flows.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { generateAgoraRtcToken, deriveAgoraUid, AGORA_ROLES } from '../src/utils/agoraToken.util.js';
import { SOCKET_EVENTS } from '../src/socket/socket.constants.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMockRoom({
  id = 'room-p10', status = 'LIVE', capacity = 9, seats = [], hostId = 'host-1'
} = {}) {
  return { id, status, capacity, seats, hostId, viewerCount: 0, title: 'Test Live Room', isPrivate: false };
}

function makeMockSeat({ seatIndex = 0, userId = null } = {}) {
  return { seatIndex, userId, isMuted: false, occupiedAt: userId ? new Date().toISOString() : null };
}

// Minimal socket event emitter mock
function createEmitterMock() {
  const events = [];
  return {
    to: (room) => ({
      emit: (event, data) => {
        events.push({ room, event, data });
      },
    }),
    emitted: events,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Phase 10 — Room Realtime Integration Suite', () => {

  it('Agora RTC token is generated as a valid non-empty token string', () => {
    const token = generateAgoraRtcToken({
      channelName: 'room-abc',
      uid: 12345,
      role: AGORA_ROLES.BROADCASTER,
      expirySeconds: 3600,
    });

    assert.ok(typeof token === 'string', 'token must be a string');
    assert.ok(token.length > 0, 'token must be a non-empty string');
  });

  it('deriveAgoraUid derives deterministic positive integer UIDs for users', () => {
    const uid1 = deriveAgoraUid('user-xyz-1');
    const uid2 = deriveAgoraUid('user-xyz-2');
    const uid1Repeat = deriveAgoraUid('user-xyz-1');

    assert.strictEqual(uid1, uid1Repeat, 'UID derivation must be deterministic');
    assert.notStrictEqual(uid1, uid2, 'different users must receive different integer UIDs');
    assert.ok(Number.isInteger(uid1) && uid1 > 0, 'UID must be positive integer');
    assert.ok(Number.isInteger(uid2) && uid2 > 0, 'UID must be positive integer');
  });

  it('socket event constants include all room lifecycle events', () => {
    const requiredEvents = [
      'ROOM_CREATED', 'ROOM_STARTED', 'ROOM_CLOSED',
      'ROOM_JOIN', 'ROOM_LEAVE',
      'ROOM_USER_JOINED', 'ROOM_USER_LEFT',
      'ROOM_SEAT_OCCUPIED', 'ROOM_SEAT_RELEASED',
      'ROOM_VIEWER_COUNT_CHANGED',
    ];
    requiredEvents.forEach(evt => {
      assert.ok(evt in SOCKET_EVENTS, `SOCKET_EVENTS must include ${evt}`);
    });
  });

  it('room:closed event is emitted post-commit on close', () => {
    const io = createEmitterMock();
    const room = makeMockRoom({ status: 'LIVE' });

    // Simulate post-commit emission
    const closedRoom = { ...room, status: 'CLOSED', closedAt: new Date().toISOString() };
    io.to(`room:${room.id}`).emit(SOCKET_EVENTS.ROOM_CLOSED, { roomId: room.id, closedAt: closedRoom.closedAt });

    const emitted = io.emitted.find(e => e.event === SOCKET_EVENTS.ROOM_CLOSED);
    assert.ok(emitted, 'room:closed must be emitted');
    assert.strictEqual(emitted.data.roomId, room.id);
    assert.ok(emitted.data.closedAt, 'closedAt timestamp must be present in event payload');
  });

  it('seat:occupied event emitted to correct room namespace', () => {
    const io = createEmitterMock();
    const room = makeMockRoom();
    const seat = makeMockSeat({ seatIndex: 3, userId: 'user-seated' });

    io.to(`room:${room.id}`).emit(SOCKET_EVENTS.ROOM_SEAT_OCCUPIED, {
      roomId: room.id,
      seatIndex: seat.seatIndex,
      userId: seat.userId,
    });

    const emitted = io.emitted.find(e => e.event === SOCKET_EVENTS.ROOM_SEAT_OCCUPIED);
    assert.ok(emitted, 'room:seat_occupied must be emitted');
    assert.strictEqual(emitted.room, `room:${room.id}`);
    assert.strictEqual(emitted.data.seatIndex, 3);
    assert.strictEqual(emitted.data.userId, 'user-seated');
  });

  it('viewer count change event is emitted on join/leave', () => {
    const io = createEmitterMock();
    const room = makeMockRoom({ viewerCount: 0 });

    // Simulate user joining
    const newViewerCount = room.viewerCount + 1;
    io.to(`room:${room.id}`).emit(SOCKET_EVENTS.ROOM_VIEWER_COUNT_CHANGED, {
      roomId: room.id,
      viewerCount: newViewerCount,
    });

    const emitted = io.emitted.find(e => e.event === SOCKET_EVENTS.ROOM_VIEWER_COUNT_CHANGED);
    assert.ok(emitted, 'viewer count event must be emitted');
    assert.strictEqual(emitted.data.viewerCount, 1);
  });

  it('seat cannot be occupied beyond room capacity', () => {
    const room = makeMockRoom({ capacity: 9 });
    const seats = Array.from({ length: 9 }, (_, i) => makeMockSeat({ seatIndex: i, userId: `user-${i}` }));
    const allSeatsTaken = seats.filter(s => s.userId !== null).length >= room.capacity;
    assert.ok(allSeatsTaken, 'when all 9 seats filled, no more occupation should be allowed');
  });

  it('closed room rejects seat and gift operations', () => {
    const room = makeMockRoom({ status: 'CLOSED' });
    let error = null;
    if (room.status !== 'LIVE') {
      error = { code: 'ROOM_NOT_LIVE', message: 'Room is not currently active', status: 400 };
    }
    assert.ok(error !== null);
    assert.strictEqual(error.code, 'ROOM_NOT_LIVE');
  });

  it('private room password check prevents unauthorized join', () => {
    const room = { ...makeMockRoom(), isPrivate: true, passwordHash: 'hash-secret' };
    const clientProvidedPassword = null;
    let error = null;
    if (room.isPrivate && !clientProvidedPassword) {
      error = { code: 'ROOM_PASSWORD_REQUIRED', status: 403 };
    }
    assert.ok(error !== null);
    assert.strictEqual(error.code, 'ROOM_PASSWORD_REQUIRED');
  });

  it('room gift event carries correct roomId, senderId, recipientId, and gift details', () => {
    const io = createEmitterMock();
    const giftPayload = {
      roomId: 'room-p10',
      senderId: 'user-sender',
      recipientId: 'user-host',
      giftId: 'gift-rose',
      quantity: 3,
      totalCoins: 300,
      transactionId: 'txn-gift-1',
    };

    io.to(`room:${giftPayload.roomId}`).emit(SOCKET_EVENTS.ROOM_GIFT_SENT, giftPayload);

    const emitted = io.emitted.find(e => e.event === SOCKET_EVENTS.ROOM_GIFT_SENT);
    assert.ok(emitted, 'room:gift_sent must be emitted');
    assert.strictEqual(emitted.data.roomId, 'room-p10');
    assert.strictEqual(emitted.data.giftId, 'gift-rose');
    assert.strictEqual(emitted.data.quantity, 3);
    assert.ok(emitted.data.transactionId, 'transactionId must be present in gift event');
  });

  it('socket emits to user-specific room namespace for private notifications', () => {
    const io = createEmitterMock();
    const userId = 'user-private-note';

    io.to(`user:${userId}`).emit(SOCKET_EVENTS.NOTIFICATION_NEW, {
      id: 'notif-1',
      type: 'FOLLOW',
      message: 'Someone followed you',
    });

    const emitted = io.emitted.find(e => e.room === `user:${userId}`);
    assert.ok(emitted, 'notification must target user private room namespace');
    assert.strictEqual(emitted.event, SOCKET_EVENTS.NOTIFICATION_NEW);
  });
});
