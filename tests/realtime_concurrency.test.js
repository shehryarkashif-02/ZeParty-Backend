import { describe, it } from 'node:test';
import assert from 'node:assert';
import { occupySeat } from '../src/services/room.service.js';

describe('Phase 4 — Realtime Concurrency & Seat Contention Suite', () => {
  it('ensures only one user can occupy a seat when two users race for the same seat', async () => {
    let seatHolder = null;

    const mockDb = {
      room: {
        findUnique: async () => ({
          id: 'room_race_1',
          status: 'LIVE',
          seats: [
            { seatIndex: 4, occupiedUserId: seatHolder, isLocked: false, isMuted: false },
          ],
        }),
      },
      roomSeat: {
        findFirst: async () => null,
        findUnique: async () => ({
          roomId: 'room_race_1',
          seatIndex: 4,
          occupiedUserId: seatHolder,
          isLocked: false,
        }),
        update: async ({ data }) => {
          if (seatHolder !== null) {
            const err = new Error('Seat is already occupied by another user');
            err.statusCode = 409;
            err.code = 'SEAT_ALREADY_OCCUPIED';
            throw err;
          }
          seatHolder = data.occupiedUserId;
          return {
            roomId: 'room_race_1',
            seatIndex: 4,
            occupiedUserId: seatHolder,
            isLocked: false,
            isMuted: false,
            occupiedUser: { id: seatHolder, username: 'racer', avatarUrl: null },
          };
        },
      },
      $transaction: async (cb) => {
        return await cb(mockDb);
      },
    };

    // User A and User B race for Seat 4
    const userA = 'user_race_A';
    const userB = 'user_race_B';

    const [resA, resB] = await Promise.allSettled([
      occupySeat('room_race_1', 4, userA, mockDb),
      occupySeat('room_race_1', 4, userB, mockDb),
    ]);

    // Exactly one should be fulfilled and one rejected with SEAT_ALREADY_OCCUPIED
    const fulfilled = [resA, resB].filter((r) => r.status === 'fulfilled');
    const rejected = [resA, resB].filter((r) => r.status === 'rejected');

    assert.strictEqual(fulfilled.length, 1);
    assert.strictEqual(rejected.length, 1);

    const winnerUserId = fulfilled[0].value.occupiedUserId;
    assert.ok(winnerUserId === userA || winnerUserId === userB);
    assert.strictEqual(rejected[0].reason.code, 'SEAT_ALREADY_OCCUPIED');
  });
});
