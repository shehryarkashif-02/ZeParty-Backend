import prisma from '../config/database.js';

export async function createRoomWithSeats(
  {
    creatorUserId,
    title,
    coverImageUrl = null,
    roomType = 'LIVE_VIDEO',
    category = 'CHAT',
    isPrivate = false,
    roomPin = null,
    agoraChannelName,
  },
  db = prisma
) {
  return await db.$transaction(async (tx) => {
    const room = await tx.room.create({
      data: {
        creatorUserId,
        title,
        coverImageUrl,
        roomType,
        category,
        isPrivate,
        roomPin,
        agoraChannelName,
        status: 'LIVE',
        currentViewersCount: 1, // Creator starts in room
      },
    });

    // Create initial RoomMember record for creator
    await tx.roomMember.create({
      data: {
        roomId: room.id,
        userId: creatorUserId,
      },
    });

    // Initialize 8 seats (indices 0 to 7)
    const seatsData = Array.from({ length: 8 }, (_, i) => ({
      roomId: room.id,
      seatIndex: i,
      occupiedUserId: i === 0 && roomType === 'AUDIO_PARTY' ? creatorUserId : null,
      isMuted: false,
      isLocked: false,
    }));

    await tx.roomSeat.createMany({
      data: seatsData,
    });

    return await tx.room.findUnique({
      where: { id: room.id },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            profile: true,
          },
        },
        seats: {
          orderBy: { seatIndex: 'asc' },
          include: {
            occupiedUser: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
                profile: true,
              },
            },
          },
        },
      },
    });
  });
}

export async function findRoomById(id, db = prisma) {
  if (!id) return null;
  return await db.room.findUnique({
    where: { id },
    include: {
      creator: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          profile: {
            select: {
              displayName: true,
              level: true,
              vipLevel: true,
              svipLevel: true,
              nobleRank: true,
            },
          },
        },
      },
      seats: {
        orderBy: { seatIndex: 'asc' },
        include: {
          occupiedUser: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              profile: {
                select: {
                  displayName: true,
                  level: true,
                  vipLevel: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function findActiveRooms(
  {
    roomType = null,
    category = null,
    search = null,
    page = 1,
    limit = 20,
  } = {},
  db = prisma
) {
  const where = {
    status: 'LIVE',
  };

  if (roomType) where.roomType = roomType;
  if (category) where.category = category;
  if (search && search.trim() !== '') {
    where.title = { contains: search.trim(), mode: 'insensitive' };
  }

  const parsedPage = Math.max(1, Number(page) || 1);
  const parsedLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  const skip = (parsedPage - 1) * parsedLimit;

  const [total, rooms] = await Promise.all([
    db.room.count({ where }),
    db.room.findMany({
      where,
      skip,
      take: parsedLimit,
      orderBy: [
        { isPinnedTop: 'desc' },
        { pinnedPosition: 'asc' },
        { currentViewersCount: 'desc' },
        { createdAt: 'desc' },
      ],
      select: {
        id: true,
        title: true,
        coverImageUrl: true,
        roomType: true,
        category: true,
        isPrivate: true,
        agoraChannelName: true,
        isPinnedTop: true,
        pinnedPosition: true,
        currentViewersCount: true,
        status: true,
        createdAt: true,
        creator: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            profile: {
              select: {
                displayName: true,
                level: true,
              },
            },
          },
        },
        seats: {
          select: {
            seatIndex: true,
            occupiedUserId: true,
            isLocked: true,
            isMuted: true,
          },
          orderBy: { seatIndex: 'asc' },
        },
      },
    }),
  ]);

  return {
    rooms,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit),
    },
  };
}

export async function findAdminRooms(
  {
    search = null,
    status = null,
    roomType = null,
    isPinnedTop = null,
    page = 1,
    limit = 20,
  } = {},
  db = prisma
) {
  const where = {};

  if (status) where.status = status;
  if (roomType) where.roomType = roomType;
  if (isPinnedTop !== null && isPinnedTop !== undefined) {
    where.isPinnedTop = isPinnedTop === 'true' || isPinnedTop === true;
  }

  if (search && search.trim() !== '') {
    const s = search.trim();
    where.OR = [
      { title: { contains: s, mode: 'insensitive' } },
      { creator: { username: { contains: s, mode: 'insensitive' } } },
    ];
  }

  const parsedPage = Math.max(1, Number(page) || 1);
  const parsedLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  const skip = (parsedPage - 1) * parsedLimit;

  const [total, rooms] = await Promise.all([
    db.room.count({ where }),
    db.room.findMany({
      where,
      skip,
      take: parsedLimit,
      orderBy: { createdAt: 'desc' },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            profile: {
              select: {
                displayName: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    rooms,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit),
    },
  };
}

export async function joinRoomTx({ roomId, userId }, db = prisma) {
  return await db.$transaction(async (tx) => {
    const room = await tx.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      const error = new Error('Room not found');
      error.statusCode = 404;
      error.code = 'ROOM_NOT_FOUND';
      throw error;
    }

    if (room.status !== 'LIVE') {
      const error = new Error('Room is not currently live');
      error.statusCode = 400;
      error.code = 'ROOM_NOT_LIVE';
      throw error;
    }

    // Check if user is already an active member
    const existingMember = await tx.roomMember.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId,
        },
      },
    });

    if (!existingMember) {
      await tx.roomMember.create({
        data: {
          roomId,
          userId,
        },
      });
    }

    const memberCount = await tx.roomMember.count({
      where: { roomId },
    });

    return await tx.room.update({
      where: { id: roomId },
      data: {
        currentViewersCount: memberCount,
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });
  });
}

export async function leaveRoomTx({ roomId, userId }, db = prisma) {
  return await db.$transaction(async (tx) => {
    const room = await tx.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      const error = new Error('Room not found');
      error.statusCode = 404;
      error.code = 'ROOM_NOT_FOUND';
      throw error;
    }

    // Delete membership if present
    const existingMember = await tx.roomMember.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId,
        },
      },
    });

    if (existingMember) {
      await tx.roomMember.delete({
        where: {
          roomId_userId: {
            roomId,
            userId,
          },
        },
      });
    }

    // Release any seat occupied by this user
    await tx.roomSeat.updateMany({
      where: {
        roomId,
        occupiedUserId: userId,
      },
      data: {
        occupiedUserId: null,
        isMuted: false,
      },
    });

    const memberCount = await tx.roomMember.count({
      where: { roomId },
    });

    return await tx.room.update({
      where: { id: roomId },
      data: {
        currentViewersCount: memberCount,
      },
    });
  });
}

export async function occupySeatTx({ roomId, seatIndex, userId }, db = prisma) {
  return await db.$transaction(async (tx) => {
    const room = await tx.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      const error = new Error('Room not found');
      error.statusCode = 404;
      error.code = 'ROOM_NOT_FOUND';
      throw error;
    }

    if (room.status !== 'LIVE') {
      const error = new Error('Room is not live');
      error.statusCode = 400;
      error.code = 'ROOM_NOT_LIVE';
      throw error;
    }

    // Check if user already occupies another seat in this room
    const existingUserSeat = await tx.roomSeat.findFirst({
      where: {
        roomId,
        occupiedUserId: userId,
      },
    });

    if (existingUserSeat) {
      if (existingUserSeat.seatIndex === seatIndex) {
        return existingUserSeat; // Idempotent already on this seat
      }
      const error = new Error('User is already occupying another seat in this room');
      error.statusCode = 409;
      error.code = 'ALREADY_OCCUPYING_SEAT';
      throw error;
    }

    // Find target seat
    const targetSeat = await tx.roomSeat.findUnique({
      where: {
        roomId_seatIndex: {
          roomId,
          seatIndex,
        },
      },
    });

    if (!targetSeat) {
      const error = new Error(`Seat index ${seatIndex} does not exist`);
      error.statusCode = 404;
      error.code = 'SEAT_NOT_FOUND';
      throw error;
    }

    if (targetSeat.isLocked) {
      const error = new Error('Seat is locked');
      error.statusCode = 403;
      error.code = 'SEAT_LOCKED';
      throw error;
    }

    if (targetSeat.occupiedUserId && targetSeat.occupiedUserId !== userId) {
      const error = new Error('Seat is already occupied by another user');
      error.statusCode = 409;
      error.code = 'SEAT_ALREADY_OCCUPIED';
      throw error;
    }

    return await tx.roomSeat.update({
      where: {
        roomId_seatIndex: {
          roomId,
          seatIndex,
        },
      },
      data: {
        occupiedUserId: userId,
      },
      include: {
        occupiedUser: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            profile: true,
          },
        },
      },
    });
  });
}

export async function leaveSeatTx({ roomId, seatIndex, userId, force = false }, db = prisma) {
  return await db.$transaction(async (tx) => {
    const seat = await tx.roomSeat.findUnique({
      where: {
        roomId_seatIndex: {
          roomId,
          seatIndex,
        },
      },
      include: {
        room: true,
      },
    });

    if (!seat) {
      const error = new Error('Seat not found');
      error.statusCode = 404;
      error.code = 'SEAT_NOT_FOUND';
      throw error;
    }

    if (!seat.occupiedUserId) {
      return seat; // Already empty
    }

    const isSeatOwner = seat.occupiedUserId === userId;
    const isRoomCreator = seat.room.creatorUserId === userId;

    if (!isSeatOwner && !isRoomCreator && !force) {
      const error = new Error('Unauthorized to release this seat');
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    return await tx.roomSeat.update({
      where: {
        roomId_seatIndex: {
          roomId,
          seatIndex,
        },
      },
      data: {
        occupiedUserId: null,
        isMuted: false,
      },
    });
  });
}

export async function pinRoom({ roomId, isPinnedTop, pinnedPosition = null }, db = prisma) {
  return await db.$transaction(async (tx) => {
    if (isPinnedTop && pinnedPosition) {
      // Unpin any other room occupying the exact same pinned position
      await tx.room.updateMany({
        where: {
          id: { not: roomId },
          isPinnedTop: true,
          pinnedPosition: Number(pinnedPosition),
        },
        data: {
          isPinnedTop: false,
          pinnedPosition: null,
        },
      });
    }

    return await tx.room.update({
      where: { id: roomId },
      data: {
        isPinnedTop,
        pinnedPosition: isPinnedTop ? (Number(pinnedPosition) || 1) : null,
      },
    });
  });
}

export async function closeRoomTx({ roomId, status = 'ENDED', endedAt = new Date() }, db = prisma) {
  return await db.$transaction(async (tx) => {
    // Release all seats
    await tx.roomSeat.updateMany({
      where: { roomId },
      data: {
        occupiedUserId: null,
        isMuted: false,
      },
    });

    // Delete all active memberships
    await tx.roomMember.deleteMany({
      where: { roomId },
    });

    return await tx.room.update({
      where: { id: roomId },
      data: {
        status,
        endedAt,
        currentViewersCount: 0,
      },
    });
  });
}


export default {
  createRoomWithSeats,
  findRoomById,
  findActiveRooms,
  findAdminRooms,
  joinRoomTx,
  leaveRoomTx,
  occupySeatTx,
  leaveSeatTx,
  pinRoom,
  closeRoomTx,
};
