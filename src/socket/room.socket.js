import roomRepository from '../repositories/room.repository.js';
import roomService from '../services/room.service.js';
import presenceService from './presence.service.js';
import { SOCKET_EVENTS, SOCKET_ERRORS } from './socket.constants.js';
import { withRateLimit } from './rateLimiter.socket.js';

/**
 * Builds a safe, public room snapshot containing no sensitive admin or private fields.
 */
export function buildRoomSnapshot(room, viewerCount) {
  if (!room) return null;

  return {
    roomId: room.id,
    title: room.title,
    roomType: room.roomType || 'VIDEO_PARTY',
    category: room.category || 'CHATTING',
    status: room.status,
    isPinned: Boolean(room.isPinned),
    pinPosition: room.pinPosition || null,
    currentViewersCount: typeof viewerCount === 'number' ? viewerCount : room.currentViewersCount || 0,
    agoraChannelName: room.agoraChannelName || null,
    host: room.creator ? {
      id: room.creator.id,
      username: room.creator.username,
      displayName: room.creator.profile?.displayName || room.creator.username,
      avatarUrl: room.creator.profile?.avatarUrl || null,
    } : null,
    seats: (room.seats || []).map((s) => ({
      seatIndex: s.seatIndex,
      isLocked: s.isLocked,
      isMuted: s.isMuted,
      user: s.user ? {
        id: s.user.id,
        username: s.user.username,
        displayName: s.user.profile?.displayName || s.user.username,
        avatarUrl: s.user.profile?.avatarUrl || null,
      } : null,
    })),
    createdAt: room.createdAt,
  };
}

function resolveArgs(arg1, arg2, arg3, arg4, arg5) {
  // Case A: (socket, data, callback, db)
  if (arg1 && (typeof arg1.emit === 'function' || arg1.id || arg1.userId || arg1.handshake)) {
    const socket = arg1;
    const data = arg2;
    const callback = typeof arg3 === 'function' ? arg3 : (typeof arg4 === 'function' ? arg4 : null);
    const db = (arg3 && typeof arg3 === 'object' && typeof arg3 !== 'function') ? arg3 : ((arg4 && typeof arg4 === 'object' && typeof arg4 !== 'function') ? arg4 : (arg5 || null));
    return { io: null, socket, data, callback, db };
  }
  // Case B: (io, socket, data, callback, db)
  const io = arg1;
  const socket = arg2;
  const data = arg3;
  const callback = typeof arg4 === 'function' ? arg4 : (typeof arg5 === 'function' ? arg5 : null);
  const db = (arg4 && typeof arg4 === 'object' && typeof arg4 !== 'function') ? arg4 : (arg5 || null);
  return { io, socket, data, callback, db };
}

export async function onJoinRoom(arg1, arg2, arg3, arg4, arg5) {
  const { io, socket, data, callback, db } = resolveArgs(arg1, arg2, arg3, arg4, arg5);

  try {
    const roomId = data?.roomId;
    if (!roomId || typeof roomId !== 'string') {
      const err = { success: false, error: { code: SOCKET_ERRORS.VALIDATION_ERROR, message: 'Valid roomId is required' } };
      if (typeof callback === 'function') return callback(err);
      return socket.emit(SOCKET_EVENTS.ERROR, err);
    }

    const userId = socket.userId;

    // 1. Authoritative Room Existence and Lifecycle Check
    const room = await roomRepository.findRoomById(roomId, db);
    if (!room) {
      const err = { success: false, error: { code: SOCKET_ERRORS.ROOM_NOT_FOUND, message: 'Room not found' } };
      if (typeof callback === 'function') return callback(err);
      return socket.emit(SOCKET_EVENTS.ERROR, err);
    }

    if (room.status !== 'LIVE') {
      const err = { success: false, error: { code: SOCKET_ERRORS.ROOM_NOT_LIVE, message: `Room is not live (status: ${room.status})` } };
      if (typeof callback === 'function') return callback(err);
      return socket.emit(SOCKET_EVENTS.ERROR, err);
    }

    // 2. Persistent RoomMember registration via authoritative Room Service
    const joinResult = await roomService.joinRoom(roomId, userId, db);

    // 3. Socket subscription to Room
    if (typeof socket.join === 'function') {
      socket.join(`room:${roomId}`);
    }

    // 4. Ephemeral Presence Tracking
    const { isFirstSocket } = await presenceService.addSocketToRoom(roomId, userId, socket.id);

    // 5. Generate and Send Authoritative Room Snapshot
    const currentCount = joinResult?.currentViewersCount || (room.currentViewersCount || room.viewerCount || 0) + 1;
    const snapshot = buildRoomSnapshot(room, currentCount);
    socket.emit(SOCKET_EVENTS.ROOM_SNAPSHOT, { room, seats: room.seats || [] });

    // 6. Broadcast user joined event to room members if this is the user's first active connection
    if (isFirstSocket) {
      const broadcastTarget = io ? io.to(`room:${roomId}`) : (socket.to ? socket.to(`room:${roomId}`) : socket);
      broadcastTarget.emit(SOCKET_EVENTS.ROOM_USER_JOINED, {
        roomId,
        user: {
          id: socket.user?.id || userId,
          username: socket.user?.username || 'user',
          displayName: socket.user?.displayName || socket.user?.username || 'User',
          avatarUrl: socket.user?.avatarUrl || null,
        },
      });

      broadcastTarget.emit(SOCKET_EVENTS.ROOM_VIEWER_COUNT_CHANGED, {
        roomId,
        viewerCount: currentCount,
      });
    }

    if (typeof callback === 'function') {
      return callback({
        success: true,
        data: snapshot,
      });
    }
  } catch (err) {
    const errorResponse = {
      success: false,
      error: {
        code: err.code || SOCKET_ERRORS.INTERNAL_ERROR,
        message: err.message || 'Failed to join room',
      },
    };
    if (typeof callback === 'function') return callback(errorResponse);
    socket.emit(SOCKET_EVENTS.ERROR, errorResponse);
  }
}

export async function onLeaveRoom(arg1, arg2, arg3, arg4, arg5) {
  const { io, socket, data, callback, db } = resolveArgs(arg1, arg2, arg3, arg4, arg5);

  try {
    const roomId = data?.roomId;
    if (!roomId) {
      const err = { success: false, error: { code: SOCKET_ERRORS.VALIDATION_ERROR, message: 'Valid roomId is required' } };
      if (typeof callback === 'function') return callback(err);
      return socket.emit(SOCKET_EVENTS.ERROR, err);
    }

    const userId = socket.userId;

    // 1. Remove socket from room
    if (typeof socket.leave === 'function') {
      socket.leave(`room:${roomId}`);
    }

    // 2. Remove socket from presence tracker
    const { isLastSocket } = await presenceService.removeSocketFromRoom(roomId, userId, socket.id);

    let updatedViewerCount = 0;

    // 3. If this was the user's last remaining connection, execute persistent leave
    if (isLastSocket) {
      try {
        const leaveResult = await roomService.leaveRoom(roomId, userId, db);
        updatedViewerCount = leaveResult?.currentViewersCount || 0;
      } catch (leaveErr) {
        // Safe fallback
      }

      const broadcastTarget = io ? io.to(`room:${roomId}`) : (socket.to ? socket.to(`room:${roomId}`) : socket);
      broadcastTarget.emit(SOCKET_EVENTS.ROOM_USER_LEFT, {
        roomId,
        userId,
      });

      broadcastTarget.emit(SOCKET_EVENTS.ROOM_VIEWER_COUNT_CHANGED, {
        roomId,
        viewerCount: updatedViewerCount,
      });
    }

    if (typeof callback === 'function') {
      return callback({ success: true, message: 'Left room successfully' });
    }
  } catch (err) {
    const errorResponse = {
      success: false,
      error: {
        code: err.code || SOCKET_ERRORS.INTERNAL_ERROR,
        message: err.message || 'Failed to leave room',
      },
    };
    if (typeof callback === 'function') return callback(errorResponse);
    socket.emit(SOCKET_EVENTS.ERROR, errorResponse);
  }
}

export async function onRequestSnapshot(socket, data, callback, db) {
  try {
    const roomId = data?.roomId;
    if (!roomId) {
      const err = { success: false, error: { code: SOCKET_ERRORS.VALIDATION_ERROR, message: 'Valid roomId is required' } };
      if (typeof callback === 'function') return callback(err);
      return socket.emit(SOCKET_EVENTS.ERROR, err);
    }

    const room = await roomRepository.findRoomById(roomId, db);
    if (!room) {
      const err = { success: false, error: { code: SOCKET_ERRORS.ROOM_NOT_FOUND, message: 'Room not found' } };
      if (typeof callback === 'function') return callback(err);
      return socket.emit(SOCKET_EVENTS.ERROR, err);
    }

    const snapshot = {
      room,
      host: room.creator || null,
      seats: room.seats || [],
      timestamp: new Date().toISOString(),
    };

    socket.emit(SOCKET_EVENTS.ROOM_SNAPSHOT, snapshot);

    if (typeof callback === 'function') {
      return callback({ success: true, data: snapshot });
    }
  } catch (err) {
    const errorResponse = {
      success: false,
      error: {
        code: err.code || SOCKET_ERRORS.INTERNAL_ERROR,
        message: err.message || 'Failed to retrieve snapshot',
      },
    };
    if (typeof callback === 'function') return callback(errorResponse);
    socket.emit(SOCKET_EVENTS.ERROR, errorResponse);
  }
}

export async function onSocketDisconnect(socket) {
  const userId = socket.userId;
  if (!userId) return;

  // Inspect all rooms the socket was part of
  const rooms = Array.from(socket.rooms || []).filter((r) => r.startsWith('room:'));

  for (const r of rooms) {
    const roomId = r.replace('room:', '');
    try {
      const { isLastSocket } = await presenceService.removeSocketFromRoom(roomId, userId, socket.id);
      if (isLastSocket) {
        let updatedViewerCount = 0;
        try {
          const leaveResult = await roomService.leaveRoom(roomId, userId);
          updatedViewerCount = leaveResult.currentViewersCount;
        } catch {}

        if (socket.to) {
          socket.to(`room:${roomId}`).emit(SOCKET_EVENTS.ROOM_USER_LEFT, {
            roomId,
            userId,
          });

          socket.to(`room:${roomId}`).emit(SOCKET_EVENTS.ROOM_VIEWER_COUNT_CHANGED, {
            roomId,
            viewerCount: updatedViewerCount,
          });
        }
      }
    } catch {}
  }
}

export function registerRoomHandlers(io, socket) {
  socket.on(
    SOCKET_EVENTS.ROOM_JOIN,
    withRateLimit('ROOM_JOIN', 10, 1000, (s, d, cb) => onJoinRoom(s, d, cb))
  );

  socket.on(
    SOCKET_EVENTS.ROOM_LEAVE,
    withRateLimit('ROOM_LEAVE', 10, 1000, (s, d, cb) => onLeaveRoom(s, d, cb))
  );

  socket.on(
    SOCKET_EVENTS.ROOM_SNAPSHOT,
    withRateLimit('ROOM_SNAPSHOT', 10, 1000, (s, d, cb) => onRequestSnapshot(s, d, cb))
  );

  socket.on(SOCKET_EVENTS.DISCONNECT, () => onSocketDisconnect(socket));
}

export default {
  buildRoomSnapshot,
  onJoinRoom,
  onLeaveRoom,
  onRequestSnapshot,
  onSocketDisconnect,
  registerRoomHandlers,
};
