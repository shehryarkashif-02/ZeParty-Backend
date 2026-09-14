import prisma from '../config/database.js';
import supportRepository from '../repositories/support.repository.js';
import socketEmitter from '../socket/socket.emitter.js';
import { SOCKET_EVENTS } from '../socket/socket.constants.js';

async function logAudit(
  {
    adminId,
    adminName,
    action,
    targetEntity,
    targetEntityId,
    beforeStateJson,
    afterStateJson,
    reason,
    ipAddress,
  },
  db = prisma
) {
  try {
    if (db.auditLog?.create) {
      await db.auditLog.create({
        data: {
          adminId: adminId || null,
          adminName: adminName || (adminId ? 'Administrator' : 'System Automation'),
          action,
          targetEntity,
          targetEntityId,
          beforeStateJson: beforeStateJson || null,
          afterStateJson: afterStateJson || null,
          reason: reason || null,
          ipAddress: ipAddress || '127.0.0.1',
        },
      });
    }
  } catch (err) {
    console.error('Failed to write audit log in support.service:', err);
  }
}

/**
 * Creates a new customer support ticket.
 */
export async function createTicket(
  {
    userId,
    subject,
    message,
    category = 'GENERAL',
    priority = 'MEDIUM',
  },
  { ipAddress = '127.0.0.1' } = {},
  db = prisma
) {
  if (!userId) {
    const error = new Error('Authentication required to create a ticket');
    error.statusCode = 401;
    error.code = 'UNAUTHORIZED';
    throw error;
  }

  if (!subject || !message) {
    const error = new Error('Subject and message are required');
    error.statusCode = 400;
    error.code = 'INVALID_TICKET_DATA';
    throw error;
  }

  // 1. Create Ticket
  const ticket = await supportRepository.createTicket(
    {
      userId,
      subject,
      message,
      category,
      priority,
      status: 'OPEN',
    },
    db
  );

  // 2. Create Initial Message
  if (db.supportTicketMessage?.create) {
    await supportRepository.createTicketMessage(
      {
        ticketId: ticket.id,
        senderType: 'USER',
        senderId: userId,
        message,
        isInternalNote: false,
      },
      db
    );
  }

  // 3. Emit post-commit realtime event
  socketEmitter.emitToAll(SOCKET_EVENTS.TICKET_CREATED, {
    ticketId: ticket.id,
    userId,
    subject: ticket.subject,
    category: ticket.category,
    priority: ticket.priority,
    createdAt: ticket.createdAt.toISOString(),
  });

  return ticket;
}

/**
 * Lists tickets for the authenticated mobile user.
 */
export async function getUserTickets(userId, query = {}, db = prisma) {
  if (!userId) {
    const error = new Error('Authentication required');
    error.statusCode = 401;
    error.code = 'UNAUTHORIZED';
    throw error;
  }
  return await supportRepository.listUserTickets(userId, query, db);
}

/**
 * Retrieves a single ticket with IDOR protection.
 * Mobile users NEVER receive internal administrative notes.
 */
export async function getTicketDetails(ticketId, viewerContext = {}, db = prisma) {
  const isAdmin = viewerContext.isAdmin || false;
  const viewerUserId = viewerContext.userId || null;

  const ticket = await supportRepository.findTicketById(
    ticketId,
    { includeMessages: true, includeInternalNotes: isAdmin },
    db
  );

  if (!ticket) {
    const error = new Error('Support ticket not found');
    error.statusCode = 404;
    error.code = 'TICKET_NOT_FOUND';
    throw error;
  }

  // IDOR check: Non-admin users can ONLY view their own tickets
  if (!isAdmin && ticket.userId !== viewerUserId) {
    const error = new Error('You are not authorized to view this ticket');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_TICKET_ACCESS';
    throw error;
  }

  return ticket;
}

/**
 * Appends a reply message or internal note to a ticket.
 */
export async function replyToTicket(
  ticketId,
  {
    senderType = 'USER', // "USER" or "ADMIN"
    senderId,
    message,
    attachmentsJson = null,
    isInternalNote = false,
  },
  { ipAddress = '127.0.0.1', adminName = 'Support Admin' } = {},
  db = prisma
) {
  if (!ticketId || !senderId || !message) {
    const error = new Error('Ticket ID, sender ID, and message are required');
    error.statusCode = 400;
    error.code = 'INVALID_REPLY_DATA';
    throw error;
  }

  const ticket = await supportRepository.findTicketById(
    ticketId,
    { includeMessages: false, includeInternalNotes: true },
    db
  );

  if (!ticket) {
    const error = new Error('Support ticket not found');
    error.statusCode = 404;
    error.code = 'TICKET_NOT_FOUND';
    throw error;
  }

  // IDOR check: Users can only reply to their own tickets
  if (senderType === 'USER' && ticket.userId !== senderId) {
    const error = new Error('You are not authorized to reply to this ticket');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_TICKET_REPLY';
    throw error;
  }

  // Closed ticket check
  if (ticket.status === 'CLOSED') {
    const error = new Error('Cannot reply to a closed support ticket');
    error.statusCode = 400;
    error.code = 'TICKET_CLOSED';
    throw error;
  }

  // Create message
  const ticketMessage = await supportRepository.createTicketMessage(
    {
      ticketId,
      senderType,
      senderId,
      message,
      attachmentsJson: attachmentsJson || null,
      isInternalNote: Boolean(isInternalNote),
    },
    db
  );

  // Update ticket state based on respondent
  let newStatus = ticket.status;
  if (senderType === 'USER') {
    if (ticket.status === 'WAITING_ON_USER') {
      newStatus = 'IN_PROGRESS';
    }
  } else if (senderType === 'ADMIN' && !isInternalNote) {
    newStatus = 'WAITING_ON_USER';
  }

  if (newStatus !== ticket.status) {
    await supportRepository.updateTicket(ticketId, { status: newStatus }, db);
  }

  // Log Audit if Admin action
  if (senderType === 'ADMIN') {
    await logAudit(
      {
        adminId: senderId,
        adminName,
        action: isInternalNote ? 'TICKET_INTERNAL_NOTE' : 'TICKET_ADMIN_REPLY',
        targetEntity: 'SupportTicket',
        targetEntityId: ticketId,
        beforeStateJson: { status: ticket.status },
        afterStateJson: { status: newStatus, messageId: ticketMessage.id, isInternalNote },
        reason: isInternalNote ? 'Admin added internal note' : 'Admin replied to customer',
        ipAddress,
      },
      db
    );
  }

  // Emit post-commit realtime event
  if (!isInternalNote) {
    // Notify the user
    socketEmitter.emitToUser(ticket.userId, SOCKET_EVENTS.TICKET_MESSAGE, {
      ticketId,
      messageId: ticketMessage.id,
      senderType,
      message,
      timestamp: ticketMessage.createdAt.toISOString(),
    });
  }

  return ticketMessage;
}

/**
 * Admin status, priority, and assignee update for a SupportTicket.
 */
export async function updateTicketStatus(
  ticketId,
  {
    status = null,
    priority = null,
    category = null,
    assignedAdminId = null,
    resolutionNotes = null,
  } = {},
  { adminId = null, adminName = 'Super Admin', ipAddress = '127.0.0.1' } = {},
  db = prisma
) {
  const existing = await supportRepository.findTicketById(
    ticketId,
    { includeMessages: false, includeInternalNotes: true },
    db
  );

  if (!existing) {
    const error = new Error('Support ticket not found');
    error.statusCode = 404;
    error.code = 'TICKET_NOT_FOUND';
    throw error;
  }

  const updateData = {};
  if (status) updateData.status = status;
  if (priority) updateData.priority = priority;
  if (category) updateData.category = category;
  if (assignedAdminId !== undefined) updateData.assignedAdminId = assignedAdminId;
  if (resolutionNotes) updateData.resolutionNotes = resolutionNotes;
  if (status === 'RESOLVED' || status === 'CLOSED') {
    updateData.resolvedAt = new Date();
  }

  const updated = await supportRepository.updateTicket(ticketId, updateData, db);

  await logAudit(
    {
      adminId,
      adminName,
      action: 'TICKET_STATUS_UPDATE',
      targetEntity: 'SupportTicket',
      targetEntityId: ticketId,
      beforeStateJson: existing,
      afterStateJson: updated,
      reason: resolutionNotes || `Status updated to ${status || existing.status} by ${adminName}`,
      ipAddress,
    },
    db
  );

  socketEmitter.emitToUser(existing.userId, SOCKET_EVENTS.TICKET_UPDATED, {
    ticketId,
    status: updated.status,
    priority: updated.priority,
    resolvedAt: updated.resolvedAt?.toISOString() || null,
  });

  return updated;
}

/**
 * Lists tickets for Admin Portal queue.
 */
export async function listAdminTickets(filters, db = prisma) {
  return await supportRepository.listAdminTickets(filters, db);
}

/**
 * Retrieves dashboard statistics.
 */
export async function getSupportStats(db = prisma) {
  return await supportRepository.getSupportStats(db);
}

export default {
  createTicket,
  getUserTickets,
  getTicketDetails,
  replyToTicket,
  updateTicketStatus,
  listAdminTickets,
  getSupportStats,
};
