import roomService from '../services/room.service.js';
import { SOCKET_EVENTS, SOCKET_ERRORS } from './socket.constants.js';
import { withRateLimit } from './rateLimiter.socket.js';

export async function onOccupySeat(io, socket, data, callback, db) {
  try {
    const roomId = data?.roomId;
    const seatIndex = Number(data?.seatIndex);

    if (!roomId || isNaN(seatIndex) || seatIndex < 0 || seatIndex > 7) {
      const err = {
        success: false,
        error: { code: SOCKET_ERRORS.INVALID_SEAT_INDEX, message: 'Valid roomId and seatIndex (0-7) are required' },
      };
      if (typeof callback === 'function') return callback(err);
      return socket.emit(SOCKET_EVENTS.ERROR, err);
    }

    const userId = socket.userId;

    // Delegate to authoritative room service for atomic occupancy and concurrency locking
    const updatedSeat = await roomService.occupySeat(roomId, seatIndex, userId, db);

    const payload = {
      roomId,
      seatIndex: updatedSeat.seatIndex,
      user: {
        id: socket.user?.id || userId,
        username: socket.user?.username || 'user',
        displayName: socket.user?.displayName || socket.user?.username || 'User',
        avatarUrl: socket.user?.avatarUrl || null,
      },
    };

    // Broadcast authoritative seat occupied event to the entire room
    if (io && io.to) {
      io.to(`room:${roomId}`).emit(SOCKET_EVENTS.ROOM_SEAT_OCCUPIED, payload);
    }

    if (typeof callback === 'function') {
      return callback({
        success: true,
        message: `Seat ${seatIndex} occupied successfully`,
        data: payload,
      });
    }
  } catch (err) {
    const errorResponse = {
      success: false,
      error: {
        code: err.code || SOCKET_ERRORS.INTERNAL_ERROR,
        message: err.message || 'Failed to occupy seat',
      },
    };
    if (typeof callback === 'function') return callback(errorResponse);
    socket.emit(SOCKET_EVENTS.ERROR, errorResponse);
  }
}

export async function onLeaveSeat(io, socket, data, callback, db) {
  try {
    const roomId = data?.roomId;
    const seatIndex = Number(data?.seatIndex);

    if (!roomId || isNaN(seatIndex) || seatIndex < 0 || seatIndex > 7) {
      const err = {
        success: false,
        error: { code: SOCKET_ERRORS.INVALID_SEAT_INDEX, message: 'Valid roomId and seatIndex (0-7) are required' },
      };
      if (typeof callback === 'function') return callback(err);
      return socket.emit(SOCKET_EVENTS.ERROR, err);
    }

    const userId = socket.userId;
    const isAdmin = socket.user?.isAdmin || socket.user?.isOwner || false;

    // Delegate to authoritative room service for seat release authorization
    const releasedSeat = await roomService.leaveSeat(roomId, seatIndex, userId, isAdmin, db);

    const payload = {
      roomId,
      seatIndex: releasedSeat.seatIndex,
      releasedByUserId: userId,
    };

    // Broadcast authoritative seat released event to the entire room
    if (io && io.to) {
      io.to(`room:${roomId}`).emit(SOCKET_EVENTS.ROOM_SEAT_RELEASED, payload);
    }

    if (typeof callback === 'function') {
      return callback({
        success: true,
        message: `Seat ${seatIndex} released successfully`,
        data: payload,
      });
    }
  } catch (err) {
    const errorResponse = {
      success: false,
      error: {
        code: err.code || SOCKET_ERRORS.INTERNAL_ERROR,
        message: err.message || 'Failed to release seat',
      },
    };
    if (typeof callback === 'function') return callback(errorResponse);
    socket.emit(SOCKET_EVENTS.ERROR, errorResponse);
  }
}

export function registerSeatHandlers(io, socket) {
  socket.on(
    SOCKET_EVENTS.ROOM_SEAT_OCCUPY,
    withRateLimit('SEAT_ACTION', 5, 1000, (s, d, cb) => onOccupySeat(io, s, d, cb))
  );

  socket.on(
    SOCKET_EVENTS.ROOM_SEAT_LEAVE,
    withRateLimit('SEAT_ACTION', 5, 1000, (s, d, cb) => onLeaveSeat(io, s, d, cb))
  );
}

export default {
  onOccupySeat,
  onLeaveSeat,
  registerSeatHandlers,
};
