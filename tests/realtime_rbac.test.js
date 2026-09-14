import { describe, it } from 'node:test';
import assert from 'node:assert';
import { closeMyRoom, leaveSeat } from '../src/services/room.service.js';

describe('Phase 4 — Realtime RBAC & Authorization Boundaries Suite', () => {
  const mockHost = { id: 'host_rbac_1' };
  const mockRegularUser = { id: 'user_rbac_2' };
  const mockSeatedUser = { id: 'user_rbac_3' };

  it('prohibits non-creator from closing a live room', async () => {
    const mockDb = {
      room: {
        findUnique: async () => ({
          id: 'room_rbac_1',
          creatorUserId: mockHost.id,
          status: 'LIVE',
        }),
      },
    };

    await assert.rejects(
      async () => {
        await closeMyRoom('room_rbac_1', mockRegularUser.id, mockDb);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, 'FORBIDDEN');
        return true;
      }
    );
  });

  it('prohibits a user from releasing another users seat unless forced by host/admin', async () => {
    const mockDb = {
      room: {
        findUnique: async () => ({
          id: 'room_rbac_1',
          status: 'LIVE',
          creatorUserId: mockHost.id,
        }),
      },
      roomSeat: {
        findUnique: async () => ({
          roomId: 'room_rbac_1',
          seatIndex: 3,
          occupiedUserId: mockSeatedUser.id,
          isLocked: false,
          room: {
            creatorUserId: mockHost.id,
          },
        }),
      },
      $transaction: async (cb) => cb(mockDb),
    };

    await assert.rejects(
      async () => {
        await leaveSeat('room_rbac_1', 3, mockRegularUser.id, { force: false }, mockDb);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, 'FORBIDDEN');
        return true;
      }
    );
  });
});
