import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  createRoomSchema,
  occupySeatParamSchema,
  pinRoomSchema,
  adminCloseRoomSchema,
} from '../src/validators/room.validator.js';
import {
  createRoom,
  getActiveRooms,
  getRoomDetails,
  joinRoom,
  leaveRoom,
  occupySeat,
  leaveSeat,
  closeMyRoom,
  adminPinRoom,
  adminUnpinRoom,
  adminCloseRoom,
} from '../src/services/room.service.js';

describe('Phase 2 Live Room & Seat Management Specification Suite', () => {
  // 1. Validation Schemas
  describe('1. Room Validation Schemas', () => {
    it('validates room creation payload and sets default roomType and category', () => {
      const valid = createRoomSchema.parse({
        title: 'Friday Night Party',
        coverImageUrl: 'https://cdn.zeparty.app/rooms/party.png',
      });
      assert.strictEqual(valid.title, 'Friday Night Party');
      assert.strictEqual(valid.roomType, 'LIVE_VIDEO');
      assert.strictEqual(valid.category, 'CHAT');
      assert.strictEqual(valid.isPrivate, false);
    });

    it('rejects room creation with empty title', () => {
      assert.throws(() => {
        createRoomSchema.parse({
          title: '',
        });
      });
    });

    it('validates seat index range strictly between 0 and 7', () => {
      assert.strictEqual(occupySeatParamSchema.parse({ id: 'room-1', seatIndex: '0' }).seatIndex, 0);
      assert.strictEqual(occupySeatParamSchema.parse({ id: 'room-1', seatIndex: 7 }).seatIndex, 7);

      assert.throws(() => {
        occupySeatParamSchema.parse({ id: 'room-1', seatIndex: -1 });
      });

      assert.throws(() => {
        occupySeatParamSchema.parse({ id: 'room-1', seatIndex: 8 });
      });

      assert.throws(() => {
        occupySeatParamSchema.parse({ id: 'room-1', seatIndex: 99 });
      });
    });

    it('validates pin position between 1 and 3', () => {
      assert.strictEqual(pinRoomSchema.parse({ pinnedPosition: 1 }).pinnedPosition, 1);
      assert.strictEqual(pinRoomSchema.parse({ pinnedPosition: 3 }).pinnedPosition, 3);

      assert.throws(() => {
        pinRoomSchema.parse({ pinnedPosition: 0 });
      });
      assert.throws(() => {
        pinRoomSchema.parse({ pinnedPosition: 4 });
      });
    });
  });

  // 2. Room Lifecycle & Seat Concurrency
  describe('2. Room Lifecycle & Seat Operations', () => {
    it('createRoom generates unique Agora channel and initializes exactly 8 seats', async () => {
      let createdRoomData = null;
      let createdSeatsData = null;

      const mockDb = {
        $transaction: async (cb) => {
          return await cb({
            room: {
              create: async ({ data }) => {
                createdRoomData = { id: 'room-uuid-1', ...data };
                return createdRoomData;
              },
              findUnique: async () => ({
                ...createdRoomData,
                creator: { id: createdRoomData.creatorUserId, username: 'host_alice' },
                seats: createdSeatsData,
              }),
            },
            roomMember: {
              create: async () => ({ id: 'mem-1' }),
            },
            roomSeat: {
              createMany: async ({ data }) => {
                createdSeatsData = data;
                return { count: data.length };
              },
            },
          });
        },
      };

      const room = await createRoom(
        {
          userId: 'usr-creator',
          title: 'Acoustic Lounge',
          roomType: 'AUDIO_PARTY',
          category: 'MUSIC',
        },
        mockDb
      );

      assert.ok(room.agoraChannelName.startsWith('room_'), 'Agora channel name must start with room_');
      assert.strictEqual(room.agoraToken, undefined, 'Agora access tokens must NEVER be stored in the database');
      assert.strictEqual(createdSeatsData.length, 8, 'Exactly 8 seats must be initialized');
      assert.strictEqual(createdSeatsData[0].seatIndex, 0);
      assert.strictEqual(createdSeatsData[7].seatIndex, 7);
      // For audio party, seat 0 is assigned to creator
      assert.strictEqual(createdSeatsData[0].occupiedUserId, 'usr-creator');
      assert.strictEqual(createdSeatsData[1].occupiedUserId, null);
    });

    it('occupySeat prevents double-occupancy and prevents occupying multiple seats', async () => {
      const seatsState = [
        { roomId: 'room-1', seatIndex: 0, occupiedUserId: 'usr-user1', isLocked: false },
        { roomId: 'room-1', seatIndex: 1, occupiedUserId: null, isLocked: false },
        { roomId: 'room-1', seatIndex: 2, occupiedUserId: null, isLocked: true },
      ];

      const mockDb = {
        $transaction: async (cb) => {
          return await cb({
            room: {
              findUnique: async () => ({ id: 'room-1', status: 'LIVE' }),
            },
            roomSeat: {
              findFirst: async ({ where }) => {
                return seatsState.find((s) => s.occupiedUserId === where.occupiedUserId) || null;
              },
              findUnique: async ({ where }) => {
                const idx = where.roomId_seatIndex.seatIndex;
                return seatsState.find((s) => s.seatIndex === idx) || null;
              },
              update: async ({ where, data }) => {
                const target = seatsState.find((s) => s.seatIndex === where.roomId_seatIndex.seatIndex);
                target.occupiedUserId = data.occupiedUserId;
                return { ...target, occupiedUser: { id: data.occupiedUserId, username: 'test_user' } };
              },
            },
          });
        },
      };

      // 1. User 2 takes empty seat 1
      const seat1 = await occupySeat('room-1', 1, 'usr-user2', mockDb);
      assert.strictEqual(seat1.occupiedUserId, 'usr-user2');

      // 2. User 3 tries to take already occupied seat 0 -> 409
      await assert.rejects(
        async () => {
          await occupySeat('room-1', 0, 'usr-user3', mockDb);
        },
        (err) => err.statusCode === 409 && err.code === 'SEAT_ALREADY_OCCUPIED'
      );

      // 3. User 1 (already in seat 0) tries to take seat 1 -> 409
      await assert.rejects(
        async () => {
          await occupySeat('room-1', 1, 'usr-user1', mockDb);
        },
        (err) => err.statusCode === 409 && err.code === 'ALREADY_OCCUPYING_SEAT'
      );

      // 4. User tries to take locked seat 2 -> 403
      await assert.rejects(
        async () => {
          await occupySeat('room-1', 2, 'usr-user4', mockDb);
        },
        (err) => err.statusCode === 403 && err.code === 'SEAT_LOCKED'
      );
    });

    it('leaveRoom atomically decrements viewer count and frees any seat held by the user', async () => {
      let seatReleased = false;
      let viewerCountResult = 0;

      const mockDb = {
        $transaction: async (cb) => {
          return await cb({
            room: {
              findUnique: async () => ({ id: 'room-1', currentViewersCount: 5 }),
              update: async ({ data }) => {
                viewerCountResult = data.currentViewersCount;
                return { id: 'room-1', currentViewersCount: viewerCountResult };
              },
            },
            roomMember: {
              findUnique: async () => ({ id: 'mem-1' }),
              delete: async () => ({ id: 'mem-1' }),
              count: async () => 4,
            },
            roomSeat: {
              updateMany: async ({ where }) => {
                if (where.occupiedUserId === 'usr-leaving') {
                  seatReleased = true;
                }
                return { count: 1 };
              },
            },
          });
        },
      };

      const res = await leaveRoom('room-1', 'usr-leaving', mockDb);
      assert.strictEqual(res.currentViewersCount, 4);
      assert.strictEqual(seatReleased, true, 'User seat must be automatically freed upon room leave');
    });

    it('joinRoom and leaveRoom maintain authoritative viewer count and prevent JOIN/LEAVE count corruption', async () => {
      const members = new Set();
      const mockDb = {
        $transaction: async (cb) => {
          return await cb({
            room: {
              findUnique: async () => ({ id: 'room-1', status: 'LIVE' }),
              update: async ({ data }) => ({ id: 'room-1', currentViewersCount: data.currentViewersCount, creator: { id: 'usr-creator', username: 'creator' } }),
            },
            roomMember: {
              findUnique: async ({ where }) => {
                const key = `${where.roomId_userId.roomId}:${where.roomId_userId.userId}`;
                return members.has(key) ? { id: 'mem-1', ...where.roomId_userId } : null;
              },
              create: async ({ data }) => {
                members.add(`${data.roomId}:${data.userId}`);
                return { id: 'mem-1', ...data };
              },
              delete: async ({ where }) => {
                members.delete(`${where.roomId_userId.roomId}:${where.roomId_userId.userId}`);
                return { id: 'mem-1' };
              },
              count: async () => members.size,
            },
            roomSeat: {
              updateMany: async () => ({ count: 0 }),
            },
          });
        },
      };

      // 1. User Alice joins room -> count becomes 1
      const join1 = await joinRoom('room-1', 'usr-alice', mockDb);
      assert.strictEqual(join1.currentViewersCount, 1);

      // 2. User Alice joins AGAIN (duplicate join) -> count stays 1 (NO INFLATION)
      const join2 = await joinRoom('room-1', 'usr-alice', mockDb);
      assert.strictEqual(join2.currentViewersCount, 1);

      // 3. User Bob joins -> count becomes 2
      const join3 = await joinRoom('room-1', 'usr-bob', mockDb);
      assert.strictEqual(join3.currentViewersCount, 2);

      // 4. User Charlie (who never joined) leaves -> count stays 2 (NO CORRUPT DECREMENT)
      const leaveCharlie = await leaveRoom('room-1', 'usr-charlie', mockDb);
      assert.strictEqual(leaveCharlie.currentViewersCount, 2);

      // 5. User Alice leaves -> count becomes 1
      const leaveAlice = await leaveRoom('room-1', 'usr-alice', mockDb);
      assert.strictEqual(leaveAlice.currentViewersCount, 1);

      // 6. User Alice leaves AGAIN (duplicate leave) -> count stays 1 (NO NEGATIVE/DOUBLE DECREMENT)
      const leaveAlice2 = await leaveRoom('room-1', 'usr-alice', mockDb);
      assert.strictEqual(leaveAlice2.currentViewersCount, 1);
    });

    it('leaveSeat enforces authorization: non-occupant cannot release another user seat unless creator', async () => {
      const mockDb = {
        $transaction: async (cb) => {
          return await cb({
            roomSeat: {
              findUnique: async () => ({
                id: 'seat-3',
                roomId: 'room-1',
                seatIndex: 3,
                occupiedUserId: 'usr-seated',
                room: { id: 'room-1', creatorUserId: 'usr-host' },
              }),
              update: async ({ data }) => ({
                id: 'seat-3',
                seatIndex: 3,
                occupiedUserId: data.occupiedUserId,
              }),
            },
          });
        },
      };

      // 1. Random user tries to kick seated user -> 403
      await assert.rejects(
        async () => {
          await leaveSeat('room-1', 3, 'usr-stranger', { force: false }, mockDb);
        },
        (err) => err.statusCode === 403 && err.code === 'FORBIDDEN'
      );

      // 2. Seated user releases their own seat -> succeeds
      const releasedBySelf = await leaveSeat('room-1', 3, 'usr-seated', { force: false }, mockDb);
      assert.strictEqual(releasedBySelf.occupiedUserId, null);

      // 3. Room host/creator forces release -> succeeds
      const releasedByHost = await leaveSeat('room-1', 3, 'usr-host', { force: false }, mockDb);
      assert.strictEqual(releasedByHost.occupiedUserId, null);
    });

    it('adminPinRoom and adminCloseRoom apply mutations and record audit logs', async () => {
      const auditLogs = [];
      const mockDb = {
        room: {
          findUnique: async () => ({ id: 'room-admin-1', isPinnedTop: false, status: 'LIVE' }),
          update: async ({ data }) => ({ id: 'room-admin-1', ...data }),
        },
        $transaction: async (cb) => {
          return await cb({
            roomSeat: {
              updateMany: async () => ({ count: 8 }),
            },
            roomMember: {
              deleteMany: async () => ({ count: 0 }),
            },
            room: {
              update: async ({ data }) => ({ id: 'room-admin-1', ...data }),
              updateMany: async () => ({ count: 0 }),
            },
          });
        },
        auditLog: {
          create: async ({ data }) => {
            auditLogs.push(data);
            return { id: 'audit-' + auditLogs.length, ...data };
          },
        },
      };

      // Admin pins room
      const pinned = await adminPinRoom(
        'room-admin-1',
        { pinnedPosition: 1, adminId: 'adm-1', adminName: 'Admin', ipAddress: '127.0.0.1' },
        mockDb
      );
      assert.strictEqual(pinned.isPinnedTop, true);
      assert.strictEqual(pinned.pinnedPosition, 1);
      assert.strictEqual(auditLogs[0].action, 'ROOM_PINNED_TOP');

      // Admin forced closes room
      const closed = await adminCloseRoom(
        'room-admin-1',
        { reason: 'Violated broadcast guidelines', adminId: 'adm-1', adminName: 'Admin', ipAddress: '127.0.0.1' },
        mockDb
      );
      assert.strictEqual(closed.status, 'CLOSED_BY_ADMIN');
      assert.strictEqual(auditLogs[1].action, 'ROOM_CLOSED_BY_ADMIN');
      assert.strictEqual(auditLogs[1].reason, 'Violated broadcast guidelines');
    });
  });
});
