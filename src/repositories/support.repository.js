import prisma from '../config/database.js';

/**
 * Creates a new SupportTicket record.
 */
export async function createTicket(data, db = prisma) {
  return await db.supportTicket.create({
    data,
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
  });
}

/**
 * Finds a SupportTicket by unique ID.
 * Respects internal notes privacy: filters out `isInternalNote: true` if `includeInternalNotes` is false.
 */
export async function findTicketById(
  id,
  { includeMessages = true, includeInternalNotes = false } = {},
  db = prisma
) {
  const messageWhere = includeInternalNotes ? {} : { isInternalNote: false };

  return await db.supportTicket.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          avatarUrl: true,
          status: true,
          userType: true,
        },
      },
      assignedAdmin: {
        select: {
          id: true,
          name: true,
          username: true,
        },
      },
      messages: includeMessages
        ? {
            where: messageWhere,
            orderBy: { createdAt: 'asc' },
          }
        : false,
    },
  });
}

/**
 * Lists tickets for a specific user (Mobile API).
 */
export async function listUserTickets(
  userId,
  { status = null, page = 1, limit = 20 } = {},
  db = prisma
) {
  const skip = (Math.max(1, page) - 1) * limit;
  const take = Math.min(100, Math.max(1, limit));

  const where = { userId };
  if (status && status !== 'ALL') {
    where.status = status;
  }

  const [total, tickets] = await Promise.all([
    db.supportTicket.count({ where }),
    db.supportTicket.findMany({
      where,
      skip,
      take,
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          where: { isInternalNote: false },
          orderBy: { createdAt: 'desc' },
          take: 1, // Preview latest message
        },
      },
    }),
  ]);

  return {
    tickets,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / take) || 1,
    },
  };
}

/**
 * Lists tickets for Admin Portal with filtering, search, and pagination.
 */
export async function listAdminTickets(
  {
    status = null,
    priority = null,
    category = null,
    assignedAdminId = null,
    search = '',
    page = 1,
    limit = 20,
  } = {},
  db = prisma
) {
  const skip = (Math.max(1, page) - 1) * limit;
  const take = Math.min(100, Math.max(1, limit));

  const where = {};

  if (status && status !== 'ALL') {
    where.status = status;
  }
  if (priority && priority !== 'ALL') {
    where.priority = priority;
  }
  if (category && category !== 'ALL') {
    where.category = category;
  }
  if (assignedAdminId) {
    if (assignedAdminId === 'UNASSIGNED') {
      where.assignedAdminId = null;
    } else {
      where.assignedAdminId = assignedAdminId;
    }
  }

  if (search && search.trim()) {
    const s = search.trim();
    where.OR = [
      { id: { contains: s, mode: 'insensitive' } },
      { subject: { contains: s, mode: 'insensitive' } },
      { message: { contains: s, mode: 'insensitive' } },
      { user: { username: { contains: s, mode: 'insensitive' } } },
    ];
  }

  const [total, tickets] = await Promise.all([
    db.supportTicket.count({ where }),
    db.supportTicket.findMany({
      where,
      skip,
      take,
      orderBy: [
        { updatedAt: 'desc' },
      ],
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            avatarUrl: true,
          },
        },
        assignedAdmin: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    }),
  ]);

  return {
    tickets,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / take) || 1,
    },
  };
}

/**
 * Updates a SupportTicket (status, assignedAdminId, priority, resolutionNotes, etc.).
 */
export async function updateTicket(id, data, db = prisma) {
  return await db.supportTicket.update({
    where: { id },
    data,
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          avatarUrl: true,
        },
      },
      assignedAdmin: {
        select: {
          id: true,
          name: true,
          username: true,
        },
      },
    },
  });
}

/**
 * Appends a message/reply to a SupportTicket.
 */
export async function createTicketMessage(data, db = prisma) {
  return await db.supportTicketMessage.create({
    data,
  });
}

/**
 * Lists messages for a SupportTicket.
 */
export async function listTicketMessages(
  ticketId,
  { includeInternalNotes = false } = {},
  db = prisma
) {
  const where = { ticketId };
  if (!includeInternalNotes) {
    where.isInternalNote = false;
  }

  return await db.supportTicketMessage.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Aggregates statistics for Support Ticket dashboard.
 */
export async function getSupportStats(db = prisma) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [
    openTickets,
    inProgressTickets,
    waitingTickets,
    highPriority,
    unassigned,
    resolvedToday,
  ] = await Promise.all([
    db.supportTicket.count({ where: { status: 'OPEN' } }),
    db.supportTicket.count({ where: { status: 'IN_PROGRESS' } }),
    db.supportTicket.count({ where: { status: 'WAITING_ON_USER' } }),
    db.supportTicket.count({
      where: {
        priority: { in: ['HIGH', 'URGENT'] },
        status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_ON_USER'] },
      },
    }),
    db.supportTicket.count({
      where: {
        assignedAdminId: null,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
    }),
    db.supportTicket.count({
      where: {
        status: 'RESOLVED',
        resolvedAt: { gte: startOfDay },
      },
    }),
  ]);

  return {
    openTickets: openTickets + inProgressTickets,
    highPriority,
    unassigned,
    waitingForReply: waitingTickets,
    resolvedToday,
  };
}

export default {
  createTicket,
  findTicketById,
  listUserTickets,
  listAdminTickets,
  updateTicket,
  createTicketMessage,
  listTicketMessages,
  getSupportStats,
};
