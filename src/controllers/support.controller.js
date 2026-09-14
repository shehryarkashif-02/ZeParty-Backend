import supportService from '../services/support.service.js';
import { createTicketSchema, replyTicketSchema } from '../validators/support.validator.js';

export async function createTicket(req, res, next) {
  try {
    const validated = createTicketSchema.parse(req.body);
    const ticket = await supportService.createTicket(
      {
        userId: req.user.id,
        ...validated,
      },
      { ipAddress: req.ip },
      req.db
    );

    return res.status(201).json({
      success: true,
      data: ticket,
    });
  } catch (err) {
    return next(err);
  }
}

export async function getUserTickets(req, res, next) {
  try {
    const { status, page, limit } = req.query;
    const result = await supportService.getUserTickets(
      req.user.id,
      {
        status,
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
        userId: req.user.id,
        isAdmin: false,
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
        senderType: 'USER',
        senderId: req.user.id,
        message: validated.message,
        attachmentsJson: validated.attachmentsJson,
        isInternalNote: false, // Users can never post internal notes
      },
      { ipAddress: req.ip },
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

export default {
  createTicket,
  getUserTickets,
  getTicketDetails,
  replyToTicket,
};
