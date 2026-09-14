import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import presenceService from '../src/socket/presence.service.js';

describe('Phase 4 — Realtime Presence Service Specification Suite', () => {
  beforeEach(async () => {
    // Clear presence state before tests
  });

  it('tracks a single socket for a user joining a room', async () => {
    const roomId = `room_pres_${Date.now()}_1`;
    const userId = 'user_p1';
    const socketId = 'sock_1';

    const result = await presenceService.addSocketToRoom(roomId, userId, socketId);
    assert.strictEqual(result.isFirstSocket, true);
    assert.strictEqual(result.socketCount, 1);
    assert.strictEqual(result.activeUserCount, 1);

    const userCount = await presenceService.getRoomActiveUserCount(roomId);
    assert.strictEqual(userCount, 1);
  });

  it('correctly handles multi-device sessions for the same user without duplicate presence count', async () => {
    const roomId = `room_pres_${Date.now()}_2`;
    const userId = 'user_multi';
    const socketDevice1 = 'sock_phone';
    const socketDevice2 = 'sock_tablet';

    // Device 1 joins
    const r1 = await presenceService.addSocketToRoom(roomId, userId, socketDevice1);
    assert.strictEqual(r1.isFirstSocket, true);
    assert.strictEqual(r1.socketCount, 1);
    assert.strictEqual(r1.activeUserCount, 1);

    // Device 2 joins same room
    const r2 = await presenceService.addSocketToRoom(roomId, userId, socketDevice2);
    assert.strictEqual(r2.isFirstSocket, false);
    assert.strictEqual(r2.socketCount, 2);
    assert.strictEqual(r2.activeUserCount, 1);

    // Unique active users in room is still 1
    const userCount = await presenceService.getRoomActiveUserCount(roomId);
    assert.strictEqual(userCount, 1);

    // Device 1 leaves
    const rem1 = await presenceService.removeSocketFromRoom(roomId, userId, socketDevice1);
    assert.strictEqual(rem1.isLastSocket, false);
    assert.strictEqual(rem1.remainingSocketCount, 1);
    assert.strictEqual(rem1.activeUserCount, 1);

    // Device 2 leaves
    const rem2 = await presenceService.removeSocketFromRoom(roomId, userId, socketDevice2);
    assert.strictEqual(rem2.isLastSocket, true);
    assert.strictEqual(rem2.remainingSocketCount, 0);
    assert.strictEqual(rem2.activeUserCount, 0);
  });

  it('cleans up room presence when clearRoomPresence is called', async () => {
    const roomId = `room_pres_${Date.now()}_clean`;
    const userId = 'user_clean_1';
    const socketId = 'sock_clean_1';

    await presenceService.addSocketToRoom(roomId, userId, socketId);
    assert.strictEqual(await presenceService.getRoomActiveUserCount(roomId), 1);

    await presenceService.clearRoomPresence(roomId);
    assert.strictEqual(await presenceService.getRoomActiveUserCount(roomId), 0);
  });
});
