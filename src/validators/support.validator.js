import { z } from 'zod';

export const createTicketSchema = z.object({
  subject: z.string().min(3, 'Subject must be at least 3 characters').max(200),
  message: z.string().min(5, 'Message must be at least 5 characters').max(5000),
  category: z.enum(['ACCOUNT', 'PAYMENT', 'LIVE_ROOM', 'REPORT_APPEAL', 'BUG', 'GENERAL']).default('GENERAL').optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM').optional(),
});

export const replyTicketSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(5000),
  attachmentsJson: z.any().optional().nullable(),
  isInternalNote: z.boolean().default(false).optional(),
});

export const updateTicketSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING_ON_USER', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  category: z.enum(['ACCOUNT', 'PAYMENT', 'LIVE_ROOM', 'REPORT_APPEAL', 'BUG', 'GENERAL']).optional(),
  assignedAdminId: z.string().uuid().optional().nullable(),
  resolutionNotes: z.string().max(1000).optional().nullable(),
});

export default {
  createTicketSchema,
  replyTicketSchema,
  updateTicketSchema,
};
