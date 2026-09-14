import crypto from 'crypto';
import prisma from '../config/database.js';
import roomRepository from '../repositories/room.repository.js';
import socketEmitter from '../socket/socket.emitter.js';
import { SOCKET_EVENTS } from '../socket/socket.constants.js';

async function logAudit(
  { adminId, adminName, action, targetEntity, targetEntityId, beforeStateJson, afterStateJson, reason, ipAddress },
  db = prisma
) {
  try {
    await db.auditLog.create({
      data: {
        adminId: adminId || 'SYSTEM',
        adminName: adminName || 'System',
        action,
        targetEntity,
        targetEntityId: targetEntityId || null,
        beforeStateJson: beforeStateJson ? JSON.parse(JSON.stringify(beforeStateJson)) : null,
        afterStateJson: afterStateJson ? JSON.parse(JSON.stringify(afterStateJson)) : null,
        reason: reason || null,
        ipAddress: ipAddress || '127.0.0.1',
      },
    });
  } catch (err) {
    console.error('Failed to write audit log in room.service:', err);
  }
}

export async function createRoom(
  { userId, title, coverImageUrl, roomType, category, isPrivate, roomPin },
  db = prisma
) {
  const agoraChannelName = `room_${crypto.randomUUID().replace(/-/g, '')}`;

  return await roomRepository.createRoomWithSeats(
    {
      creatorUserId: userId,
      title,
      coverImageUrl,
      roomType,
      category,
      isPrivate,
      roomPin,
      agoraChannelName,
    },
    db
  );
}

export async function getActiveRooms(filters, db = prisma) {
  return await roomRepository.findActiveRooms(filters, db);
}

export async function getRoomDetails(roomId, db = prisma) {
  const room = await roomRepository.findRoomById(roomId, db);
  if (!room) {
    const error = new Error('Room not found');
    error.statusCode = 404;
    error.code = 'ROOM_NOT_FOUND';
    throw error;
  }
  return room;
}

export async function joinRoom(roomId, userId, db = prisma) {
  return await roomRepository.joinRoomTx({ roomId, userId }, db);
}

export async function leaveRoom(roomId, userId, db = prisma) {
  return await roomRepository.leaveRoomTx({ roomId, userId }, db);
}

export async function occupySeat(roomId, seatIndex, userId, db = prisma) {
  return await roomRepository.occupySeatTx({ roomId, seatIndex, userId }, db);
}

export async function leaveSeat(roomId, seatIndex, userId, options = {}, db = prisma) {
  const force = typeof options === 'boolean' ? options : (options?.force || false);
  const targetDb = options && typeof options === 'object' && options.$transaction ? options : db;
  return await roomRepository.leaveSeatTx({ roomId, seatIndex, userId, force }, targetDb);
}

export async function closeMyRoom(roomId, userId, db = prisma) {
  const room = await roomRepository.findRoomById(roomId, db);
  if (!room) {
    const error = new Error('Room not found');
    error.statusCode = 404;
    error.code = 'ROOM_NOT_FOUND';
    throw error;
  }

  if (room.creatorUserId !== userId) {
    const error = new Error('Only the room creator can close this room');
    error.statusCode = 403;
    error.code = 'FORBIDDEN';
    throw error;
  }

  const closedRoom = await roomRepository.closeRoomTx({ roomId, status: 'ENDED' }, db);

  socketEmitter.emitToRoom(roomId, SOCKET_EVENTS.ROOM_CLOSED, {
    roomId,
    status: 'ENDED',
    reason: 'HOST_CLOSED',
  });

  return closedRoom;
}

export async function listRoomsForAdmin(filters, db = prisma) {
  return await roomRepository.findAdminRooms(filters, db);
}

export async function adminPinRoom(
  roomId,
  { pinnedPosition = 1, adminId, adminName, ipAddress },
  db = prisma
) {
  const room = await roomRepository.findRoomById(roomId, db);
  if (!room) {
    const error = new Error('Room not found');
    error.statusCode = 404;
    error.code = 'ROOM_NOT_FOUND';
    throw error;
  }

  const beforeState = { isPinnedTop: room.isPinnedTop, pinnedPosition: room.pinnedPosition };
  const updatedRoom = await roomRepository.pinRoom({ roomId, isPinnedTop: true, pinnedPosition }, db);
  const afterState = { isPinnedTop: updatedRoom.isPinnedTop, pinnedPosition: updatedRoom.pinnedPosition };

  await logAudit(
    {
      adminId,
      adminName,
      action: 'ROOM_PINNED_TOP',
      targetEntity: 'Room',
      targetEntityId: roomId,
      beforeStateJson: beforeState,
      afterStateJson: afterState,
      reason: `Pinned at position ${pinnedPosition}`,
      ipAddress,
    },
    db
  );

  socketEmitter.emitToRoom(roomId, SOCKET_EVENTS.ROOM_PINNED, {
    roomId,
    isPinnedTop: true,
    pinnedPosition,
  });
  socketEmitter.broadcastGlobal(SOCKET_EVENTS.ROOM_PINNED, {
    roomId,
    isPinnedTop: true,
    pinnedPosition,
  });

  return updatedRoom;
}

export async function adminUnpinRoom(
  roomId,
  { adminId, adminName, ipAddress },
  db = prisma
) {
  const room = await roomRepository.findRoomById(roomId, db);
  if (!room) {
    const error = new Error('Room not found');
    error.statusCode = 404;
    error.code = 'ROOM_NOT_FOUND';
    throw error;
  }

  const beforeState = { isPinnedTop: room.isPinnedTop, pinnedPosition: room.pinnedPosition };
  const updatedRoom = await roomRepository.pinRoom({ roomId, isPinnedTop: false, pinnedPosition: null }, db);
  const afterState = { isPinnedTop: false, pinnedPosition: null };

  await logAudit(
    {
      adminId,
      adminName,
      action: 'ROOM_UNPINNED',
      targetEntity: 'Room',
      targetEntityId: roomId,
      beforeStateJson: beforeState,
      afterStateJson: afterState,
      ipAddress,
    },
    db
  );

  socketEmitter.emitToRoom(roomId, SOCKET_EVENTS.ROOM_UNPINNED, {
    roomId,
    isPinnedTop: false,
    pinnedPosition: null,
  });
  socketEmitter.broadcastGlobal(SOCKET_EVENTS.ROOM_UNPINNED, {
    roomId,
    isPinnedTop: false,
    pinnedPosition: null,
  });

  return updatedRoom;
}

export async function adminCloseRoom(
  roomId,
  { reason, adminId, adminName, ipAddress },
  db = prisma
) {
  const room = await roomRepository.findRoomById(roomId, db);
  if (!room) {
    const error = new Error('Room not found');
    error.statusCode = 404;
    error.code = 'ROOM_NOT_FOUND';
    throw error;
  }

  const beforeState = { status: room.status };
  const updatedRoom = await roomRepository.closeRoomTx({ roomId, status: 'CLOSED_BY_ADMIN' }, db);
  const afterState = { status: 'CLOSED_BY_ADMIN' };

  await logAudit(
    {
      adminId,
      adminName,
      action: 'ROOM_CLOSED_BY_ADMIN',
      targetEntity: 'Room',
      targetEntityId: roomId,
      beforeStateJson: beforeState,
      afterStateJson: afterState,
      reason,
      ipAddress,
    },
    db
  );

  socketEmitter.emitToRoom(roomId, SOCKET_EVENTS.ROOM_CLOSED, {
    roomId,
    status: 'CLOSED_BY_ADMIN',
    reason,
  });

  return updatedRoom;
}

export default {
  createRoom,
  getActiveRooms,
  getRoomDetails,
  joinRoom,
  leaveRoom,
  occupySeat,
  leaveSeat,
  closeMyRoom,
  listRoomsForAdmin,
  adminPinRoom,
  adminUnpinRoom,
  adminCloseRoom,
};
