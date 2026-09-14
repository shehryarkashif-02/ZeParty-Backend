import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PKService } from '../src/services/pk.service.js';

describe('Phase 19 PK Battles Subsystem Suite', () => {
  // Mock In-Memory PK Repository
  const mockDb = new Map();

  const mockPkRepository = {
    async createPKEvent(data) {
      const event = {
        id: `pk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        roomAId: data.roomAId,
        roomBId: data.roomBId,
        hostAUserId: data.hostAUserId,
        hostBUserId: data.hostBUserId,
        durationSeconds: data.durationSeconds || 300,
        hostAScore: 0n,
        hostBScore: 0n,
        winnerHostUserId: null,
        status: 'COUNTDOWN',
        createdAt: new Date(),
        endedAt: null,
      };
      mockDb.set(event.id, event);
      return { ...event };
    },

    async findPKEventById(id) {
      const ev = mockDb.get(id);
      return ev ? { ...ev } : null;
    },

    async findActivePKForRoom(roomId) {
      for (const ev of mockDb.values()) {
        if ((ev.roomAId === roomId || ev.roomBId === roomId) && ['COUNTDOWN', 'ACTIVE'].includes(ev.status)) {
          return { ...ev };
        }
      }
      return null;
    },

    async updatePKStatus(id, { status, winnerHostUserId, endedAt }) {
      const ev = mockDb.get(id);
      if (!ev) throw new Error('Not found');
      if (status) ev.status = status;
      if (winnerHostUserId !== undefined) ev.winnerHostUserId = winnerHostUserId;
      if (endedAt !== undefined) ev.endedAt = endedAt;
      mockDb.set(id, ev);
      return { ...ev };
    },

    async incrementHostScore(id, hostKey, scoreDelta) {
      const ev = mockDb.get(id);
      if (!ev) throw new Error('Not found');
      if (hostKey === 'hostA') {
        ev.hostAScore += BigInt(scoreDelta);
      } else {
        ev.hostBScore += BigInt(scoreDelta);
      }
      mockDb.set(id, ev);
      return { ...ev };
    },
  };

  const pkService = new PKService(mockPkRepository);

  test('validates PK participants and initiates countdown', async () => {
    const pkEvent = await pkService.startPK({
      roomAId: 'room_101',
      roomBId: 'room_202',
      hostAUserId: 'host_user_1',
      hostBUserId: 'host_user_2',
      durationSeconds: 300,
    });

    assert.ok(pkEvent.id);
    assert.equal(pkEvent.roomAId, 'room_101');
    assert.equal(pkEvent.roomBId, 'room_202');
    assert.equal(pkEvent.status, 'COUNTDOWN');
    assert.equal(pkEvent.hostAScore, 0n);
    assert.equal(pkEvent.hostBScore, 0n);
  });

  test('rejects PK battle when room attempts PK with itself', async () => {
    await assert.rejects(
      async () => {
        await pkService.startPK({
          roomAId: 'room_505',
          roomBId: 'room_505',
          hostAUserId: 'host_1',
          hostBUserId: 'host_2',
        });
      },
      (err) => err.code === 'SAME_ROOM_PK' && err.status === 400
    );
  });

  test('transitions PK battle from COUNTDOWN to ACTIVE', async () => {
    const activePK = await pkService.getRoomPKStatus('room_101');
    assert.ok(activePK);

    const activated = await pkService.activatePK(activePK.id);
    assert.equal(activated.status, 'ACTIVE');
  });

  test('accumulates live gift scores correctly for Host A and Host B', async () => {
    // Gift sent in Room A (Host A)
    const scoreA = await pkService.addPKScore({
      roomId: 'room_101',
      giftCoinValue: 5000,
    });
    assert.equal(scoreA.hostAScore, 5000n);
    assert.equal(scoreA.hostBScore, 0n);

    // Gift sent in Room B (Host B)
    const scoreB = await pkService.addPKScore({
      roomId: 'room_202',
      giftCoinValue: 8000,
    });
    assert.equal(scoreB.hostAScore, 5000n);
    assert.equal(scoreB.hostBScore, 8000n);
  });

  test('concludes PK battle and determines Host B as winner', async () => {
    const activePK = await pkService.getRoomPKStatus('room_101');
    assert.ok(activePK);

    const ended = await pkService.endPK(activePK.id);
    assert.equal(ended.status, 'ENDED');
    assert.equal(ended.winnerHostUserId, 'host_user_2'); // Host B had 8000 > 5000
    assert.ok(ended.endedAt);
  });

  test('correctly identifies a tie when scores are equal', async () => {
    const pkTie = await pkService.startPK({
      roomAId: 'room_303',
      roomBId: 'room_404',
      hostAUserId: 'host_user_3',
      hostBUserId: 'host_user_4',
    });

    await pkService.activatePK(pkTie.id);

    // Give equal scores
    await pkService.addPKScore({ roomId: 'room_303', giftCoinValue: 2000 });
    await pkService.addPKScore({ roomId: 'room_404', giftCoinValue: 2000 });

    const ended = await pkService.endPK(pkTie.id);
    assert.equal(ended.status, 'ENDED');
    assert.equal(ended.winnerHostUserId, null); // Tie
  });
});
