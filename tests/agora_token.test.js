import { describe, it } from 'node:test';
import assert from 'node:assert';
import { deriveAgoraUid, generateAgoraRtcToken } from '../src/utils/agoraToken.util.js';
import { issueRoomAgoraToken, refreshRoomAgoraToken } from '../src/services/agora.service.js';

describe('Phase 4 — Agora RTC Token Engine Specification Suite', () => {
  const mockHostUser = {
    id: 'user_uuid_host_1234',
    username: 'dj_host',
    status: 'ACTIVE',
  };

  const mockSeatedUser = {
    id: 'user_uuid_seated_5678',
    username: 'speaker_guest',
    status: 'ACTIVE',
  };

  const mockAudienceUser = {
    id: 'user_uuid_audience_9012',
    username: 'quiet_listener',
    status: 'ACTIVE',
  };

  const mockSuspendedUser = {
    id: 'user_uuid_suspended_3456',
    username: 'troublemaker',
    status: 'SUSPENDED',
  };

  const mockLiveRoom = {
    id: 'room_agora_live_1',
    creatorUserId: mockHostUser.id,
    agoraChannelName: 'room_c89b2167d3b0',
    status: 'LIVE',
    seats: [
      { seatIndex: 0, userId: mockSeatedUser.id, isLocked: false, isMuted: false },
      { seatIndex: 1, userId: null, isLocked: false, isMuted: false },
    ],
  };

  const mockEndedRoom = {
    ...mockLiveRoom,
    id: 'room_agora_ended_1',
    status: 'ENDED',
  };

  describe('1. UID Derivation & Token Generation Utility', () => {
    it('derives a positive 32-bit integer UID deterministically', () => {
      const uid1 = deriveAgoraUid(mockHostUser.id);
      const uid2 = deriveAgoraUid(mockHostUser.id);

      assert.strictEqual(typeof uid1, 'number');
      assert.strictEqual(uid1, uid2);
      assert.ok(uid1 > 0);
      assert.ok(uid1 <= 0xFFFFFFFF);
    });

    it('generates a valid RTC token string with appId, channelName, and role', () => {
      const tokenString = generateAgoraRtcToken({
        channelName: 'test_channel_101',
        uid: 123456,
        role: 'BROADCASTER',
        expirySeconds: 3600,
      });

      assert.ok(tokenString);
      assert.strictEqual(typeof tokenString, 'string');
      assert.ok(tokenString.length > 20);
    });
  });

  describe('2. Agora Service Role Resolution & Authorization', () => {
    const mockDb = {
      user: {
        findUnique: async ({ where }) => {
          if (where.id === mockHostUser.id) return mockHostUser;
          if (where.id === mockSeatedUser.id) return mockSeatedUser;
          if (where.id === mockAudienceUser.id) return mockAudienceUser;
          if (where.id === mockSuspendedUser.id) return mockSuspendedUser;
          return null;
        },
      },
      room: {
        findUnique: async ({ where }) => {
          if (where.id === mockLiveRoom.id) return mockLiveRoom;
          if (where.id === mockEndedRoom.id) return mockEndedRoom;
          return null;
        },
      },
    };

    it('derives BROADCASTER role for the room host/creator', async () => {
      const result = await issueRoomAgoraToken({
        roomId: mockLiveRoom.id,
        userId: mockHostUser.id,
      }, mockDb);

      assert.strictEqual(result.role, 'BROADCASTER');
      assert.strictEqual(result.channelName, mockLiveRoom.agoraChannelName);
      assert.ok(result.token);
    });

    it('derives BROADCASTER role for a seated guest speaker', async () => {
      const result = await issueRoomAgoraToken({
        roomId: mockLiveRoom.id,
        userId: mockSeatedUser.id,
      }, mockDb);

      assert.strictEqual(result.role, 'BROADCASTER');
      assert.strictEqual(result.channelName, mockLiveRoom.agoraChannelName);
      assert.ok(result.token);
    });

    it('derives AUDIENCE role for standard room audience viewers', async () => {
      const result = await issueRoomAgoraToken({
        roomId: mockLiveRoom.id,
        userId: mockAudienceUser.id,
      }, mockDb);

      assert.strictEqual(result.role, 'AUDIENCE');
      assert.strictEqual(result.channelName, mockLiveRoom.agoraChannelName);
      assert.ok(result.token);
    });

    it('rejects token issuance when room is ENDED or CLOSED', async () => {
      await assert.rejects(
        async () => {
          await issueRoomAgoraToken({
            roomId: mockEndedRoom.id,
            userId: mockAudienceUser.id,
          }, mockDb);
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'ROOM_NOT_LIVE');
          return true;
        }
      );
    });

    it('rejects token issuance when user account is SUSPENDED or BANNED', async () => {
      await assert.rejects(
        async () => {
          await issueRoomAgoraToken({
            roomId: mockLiveRoom.id,
            userId: mockSuspendedUser.id,
          }, mockDb);
        },
        (err) => {
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'USER_NOT_ACTIVE');
          return true;
        }
      );
    });

    it('refreshes token successfully for an active participant', async () => {
      const refreshed = await refreshRoomAgoraToken({
        roomId: mockLiveRoom.id,
        userId: mockHostUser.id,
      }, mockDb);

      assert.strictEqual(refreshed.role, 'BROADCASTER');
      assert.strictEqual(refreshed.channelName, mockLiveRoom.agoraChannelName);
      assert.ok(refreshed.token);
    });
  });
});
