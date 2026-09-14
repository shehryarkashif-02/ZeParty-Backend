import prisma from '../config/database.js';

export class PKRepository {
  async createPKEvent({ roomAId, roomBId, hostAUserId, hostBUserId, durationSeconds = 300 }, db = prisma) {
    return db.pKEvent.create({
      data: {
        roomAId,
        roomBId,
        hostAUserId,
        hostBUserId,
        durationSeconds,
        hostAScore: 0n,
        hostBScore: 0n,
        status: 'COUNTDOWN',
      },
      include: {
        roomA: true,
        roomB: true,
        hostA: true,
        hostB: true,
      },
    });
  }

  async findPKEventById(id, db = prisma) {
    return db.pKEvent.findUnique({
      where: { id },
      include: {
        roomA: true,
        roomB: true,
        hostA: true,
        hostB: true,
      },
    });
  }

  async findActivePKForRoom(roomId, db = prisma) {
    return db.pKEvent.findFirst({
      where: {
        OR: [{ roomAId: roomId }, { roomBId: roomId }],
        status: { in: ['COUNTDOWN', 'ACTIVE'] },
      },
      include: {
        roomA: true,
        roomB: true,
        hostA: true,
        hostB: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updatePKStatus(id, { status, winnerHostUserId, endedAt }, db = prisma) {
    return db.pKEvent.update({
      where: { id },
      data: {
        status,
        ...(winnerHostUserId !== undefined ? { winnerHostUserId } : {}),
        ...(endedAt !== undefined ? { endedAt } : {}),
      },
      include: {
        roomA: true,
        roomB: true,
        hostA: true,
        hostB: true,
      },
    });
  }

  async incrementHostScore(id, hostKey, scoreDelta, db = prisma) {
    const field = hostKey === 'hostA' ? 'hostAScore' : 'hostBScore';
    return db.pKEvent.update({
      where: { id },
      data: {
        [field]: {
          increment: BigInt(scoreDelta),
        },
      },
    });
  }

  async listPKEvents({ page = 1, limit = 20, status }, db = prisma) {
    const skip = (Number(page) - 1) * Number(limit);
    const where = status ? { status } : {};

    const [total, events] = await Promise.all([
      db.pKEvent.count({ where }),
      db.pKEvent.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          roomA: true,
          roomB: true,
          hostA: true,
          hostB: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { total, events, page: Number(page), limit: Number(limit) };
  }
}

export const pkRepository = new PKRepository();
export default pkRepository;
