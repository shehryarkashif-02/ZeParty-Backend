import env from '../config/env.js';
import roomRepository from '../repositories/room.repository.js';
import userRepository from '../repositories/user.repository.js';
import { deriveAgoraUid, generateAgoraRtcToken, AGORA_ROLES } from '../utils/agoraToken.util.js';

/**
 * Issues a short-lived Agora RTC token for a user in a live room after strict authorization.
 * 
 * Authorization Rules:
 * 1. Room must exist and be LIVE / ACTIVE.
 * 2. User must exist and have ACTIVE account status.
 * 3. User must not be banned / restricted in the room.
 * 4. Role derivation:
 *    - Host / Creator -> BROADCASTER (Publisher)
 *    - Current Seat Occupant -> BROADCASTER (Publisher)
 *    - Viewer / Member -> AUDIENCE (Subscriber)
 * 5. Deterministic integer UID derived from user ID.
 * 6. Tokens are short-lived and never stored in database or Redis.
 */
export async function issueRoomAgoraToken({ roomId, userId }, db = prisma) {
  if (!roomId || !userId) {
    const error = new Error('Room ID and User ID are required');
    error.statusCode = 400;
    error.status = 400;
    error.code = 'INVALID_PARAMETERS';
    throw error;
  }

  // 1. Check user status
  const user = await userRepository.findUserById(userId, db);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    error.status = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  if (user.status !== 'ACTIVE') {
    const error = new Error(`Account is ${user.status.toLowerCase()}. Access denied.`);
    error.statusCode = 403;
    error.status = 403;
    error.code = 'USER_NOT_ACTIVE';
    throw error;
  }

  // 2. Check room status
  const room = await roomRepository.findRoomById(roomId, db);
  if (!room) {
    const error = new Error('Live room not found');
    error.statusCode = 404;
    error.status = 404;
    error.code = 'ROOM_NOT_FOUND';
    throw error;
  }

  if (room.status !== 'LIVE') {
    const error = new Error(`Room is not live (current status: ${room.status})`);
    error.statusCode = 400;
    error.status = 400;
    error.code = 'ROOM_NOT_LIVE';
    throw error;
  }

  if (!room.agoraChannelName) {
    const error = new Error('Room does not have an active Agora channel configured');
    error.statusCode = 500;
    error.status = 500;
    error.code = 'AGORA_CHANNEL_MISSING';
    throw error;
  }

  // 3. Derive user role in room from authoritative database state
  const isHost = room.creatorUserId === userId;
  const isOccupant = Array.isArray(room.seats) && room.seats.some((s) => s.userId === userId || s.occupiedUserId === userId);
  const role = isHost || isOccupant ? AGORA_ROLES.BROADCASTER : AGORA_ROLES.AUDIENCE;

  // 4. Derive integer UID
  const uid = deriveAgoraUid(userId);
  const expirySeconds = env.AGORA_TOKEN_EXPIRY_SECONDS || 3600;
  const expiresAt = new Date(Date.now() + expirySeconds * 1000).toISOString();

  // 5. Generate short-lived token
  const token = generateAgoraRtcToken({
    appId: env.AGORA_APP_ID,
    appCertificate: env.AGORA_APP_CERTIFICATE,
    channelName: room.agoraChannelName,
    uid,
    role,
    expirySeconds,
  });

  return {
    token,
    channelName: room.agoraChannelName,
    agoraUid: uid,
    uid,
    role,
    appId: env.AGORA_APP_ID,
    expiresInSeconds: expirySeconds,
    expiresIn: expirySeconds,
    expiresAt,
  };
}

/**
 * Refreshes an Agora RTC token after repeating all authorization checks.
 */
export async function refreshRoomAgoraToken({ roomId, userId }, db = prisma) {
  return await issueRoomAgoraToken({ roomId, userId }, db);
}

export default {
  issueRoomAgoraToken,
  refreshRoomAgoraToken,
};
