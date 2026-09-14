import redisClient from '../config/redis.js';

// Ephemeral in-memory fallback store when Redis is disconnected (e.g. isolated test environments)
const memoryRoomUsers = new Map(); // roomId -> Map<userId, Set<socketId>>
const memorySocketMap = new Map(); // socketId -> { roomId, userId }

/**
 * Realtime Presence Service supporting multi-device / multi-socket connection tracking per user.
 * 
 * Rules:
 * 1. Redis sets track active socket connections: key `room:{roomId}:user:{userId}` -> Set<socketId>
 * 2. Multi-device safety: `isFirstSocket` indicates if user just entered (first connection).
 * 3. Disconnect safety: `isLastSocket` indicates if all devices/connections for this user have disconnected.
 * 4. Distinct user count tracks real active users, not raw socket counts.
 */

export async function addSocketToRoom(roomId, userId, socketId) {
  if (!roomId || !userId || !socketId) return { isFirstSocket: false, activeUserCount: 0 };

  const redisKey = `presence:room:${roomId}:user:${userId}`;
  const roomUsersKey = `presence:room:${roomId}:users`;

  if (redisClient.isOpen) {
    try {
      const added = await redisClient.sAdd(redisKey, socketId);
      await redisClient.expire(redisKey, 86400);
      await redisClient.sAdd(roomUsersKey, userId);
      await redisClient.expire(roomUsersKey, 86400);

      const count = await redisClient.sCard(redisKey);
      const activeUserCount = await redisClient.sCard(roomUsersKey);

      return {
        isFirstSocket: count === 1,
        socketCount: count,
        activeUserCount,
      };
    } catch (err) {
      // Fall through to in-memory fallback
    }
  }

  // In-memory fallback
  if (!memoryRoomUsers.has(roomId)) {
    memoryRoomUsers.set(roomId, new Map());
  }
  const userMap = memoryRoomUsers.get(roomId);
  if (!userMap.has(userId)) {
    userMap.set(userId, new Set());
  }
  const sockets = userMap.get(userId);
  const isFirst = sockets.size === 0;
  sockets.add(socketId);
  memorySocketMap.set(socketId, { roomId, userId });

  return {
    isFirstSocket: isFirst,
    socketCount: sockets.size,
    activeUserCount: userMap.size,
  };
}

export async function removeSocketFromRoom(roomId, userId, socketId) {
  if (!roomId || !userId || !socketId) return { isLastSocket: true, remainingSocketCount: 0, activeUserCount: 0 };

  const redisKey = `presence:room:${roomId}:user:${userId}`;
  const roomUsersKey = `presence:room:${roomId}:users`;

  if (redisClient.isOpen) {
    try {
      await redisClient.sRem(redisKey, socketId);
      const remainingSockets = await redisClient.sCard(redisKey);
      let isLast = false;

      if (remainingSockets === 0) {
        isLast = true;
        await redisClient.del(redisKey);
        await redisClient.sRem(roomUsersKey, userId);
      }

      const activeUserCount = await redisClient.sCard(roomUsersKey);

      return {
        isLastSocket: isLast,
        remainingSocketCount: remainingSockets,
        activeUserCount,
      };
    } catch (err) {
      // Fall through to memory
    }
  }

  // In-memory fallback
  memorySocketMap.delete(socketId);
  const userMap = memoryRoomUsers.get(roomId);
  if (!userMap) return { isLastSocket: true, remainingSocketCount: 0, activeUserCount: 0 };

  const sockets = userMap.get(userId);
  if (!sockets) return { isLastSocket: true, remainingSocketCount: 0, activeUserCount: userMap.size };

  sockets.delete(socketId);
  const remaining = sockets.size;
  const isLast = remaining === 0;

  if (isLast) {
    userMap.delete(userId);
  }
  if (userMap.size === 0) {
    memoryRoomUsers.delete(roomId);
  }

  return {
    isLastSocket: isLast,
    remainingSocketCount: remaining,
    activeUserCount: userMap ? userMap.size : 0,
  };
}

export async function getRoomActiveUserCount(roomId) {
  if (!roomId) return 0;
  const roomUsersKey = `presence:room:${roomId}:users`;

  if (redisClient.isOpen) {
    try {
      return await redisClient.sCard(roomUsersKey);
    } catch (err) {}
  }

  const userMap = memoryRoomUsers.get(roomId);
  return userMap ? userMap.size : 0;
}

export async function clearRoomPresence(roomId) {
  if (!roomId) return;

  if (redisClient.isOpen) {
    try {
      const roomUsersKey = `presence:room:${roomId}:users`;
      const users = await redisClient.sMembers(roomUsersKey);
      for (const uId of users) {
        await redisClient.del(`presence:room:${roomId}:user:${uId}`);
      }
      await redisClient.del(roomUsersKey);
    } catch (err) {}
  }

  memoryRoomUsers.delete(roomId);
}

export default {
  addSocketToRoom,
  removeSocketFromRoom,
  getRoomActiveUserCount,
  clearRoomPresence,
};
