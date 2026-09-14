import supportService from '../services/support.service.js';
import { replyTicketSchema, updateTicketSchema } from '../validators/support.validator.js';

export async function listAdminTickets(req, res, next) {
  try {
    const { status, priority, category, assignedAdminId, search, page, limit } = req.query;
    const result = await supportService.listAdminTickets(
      {
        status,
        priority,
        category,
        assignedAdminId,
        search,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
      },
      req.db
    );

    return res.status(200).json({
      success: true,
      data: result.tickets,
      meta: result.pagination,
    });
  } catch (err) {
    return next(err);
  }
}

export async function getTicketDetails(req, res, next) {
  try {
    const ticket = await supportService.getTicketDetails(
      req.params.id,
      {
        isAdmin: true,
        userId: req.admin?.id,
      },
      req.db
    );

    return res.status(200).json({
      success: true,
      data: ticket,
    });
  } catch (err) {
    return next(err);
  }
}

export async function replyToTicket(req, res, next) {
  try {
    const ticketId = req.params.id;
    const validated = replyTicketSchema.parse(req.body);

    const message = await supportService.replyToTicket(
      ticketId,
      {
        senderType: 'ADMIN',
        senderId: req.admin?.id || 'admin',
        message: validated.message,
        attachmentsJson: validated.attachmentsJson,
        isInternalNote: Boolean(validated.isInternalNote),
      },
      {
        ipAddress: req.ip,
        adminName: req.admin?.name || req.admin?.username || 'Support Admin',
      },
      req.db
    );

    return res.status(201).json({
      success: true,
      data: message,
    });
  } catch (err) {
    return next(err);
  }
}

export async function updateTicketStatus(req, res, next) {
  try {
    const ticketId = req.params.id;
    const validated = updateTicketSchema.parse(req.body);

    const updated = await supportService.updateTicketStatus(
      ticketId,
      validated,
      {
        adminId: req.admin?.id,
        adminName: req.admin?.name || req.admin?.username || 'Support Admin',
        ipAddress: req.ip,
      },
      req.db
    );

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (err) {
    return next(err);
  }
}

export async function getSupportStats(req, res, next) {
  try {
    const stats = await supportService.getSupportStats(req.db);
    return res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (err) {
    return next(err);
  }
}

export default {
  listAdminTickets,
  getTicketDetails,
  replyToTicket,
  updateTicketStatus,
  getSupportStats,
};
