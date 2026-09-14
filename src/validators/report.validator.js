import { z } from 'zod';

export const submitReportSchema = z.object({
  reportedUserId: z.string().uuid().optional().nullable(),
  reportedRoomId: z.string().uuid().optional().nullable(),
  reportedPostId: z.string().uuid().optional().nullable(),
  reportedCommentId: z.string().uuid().optional().nullable(),
  reportedMessageId: z.string().uuid().optional().nullable(),
  violationType: z.string().min(2, 'Violation type must be at least 2 characters').max(100),
  description: z.string().max(1000).optional().nullable(),
  screenshotUrl: z.string().url().max(500).optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM').optional(),
});

export const resolveReportSchema = z.object({
  status: z.enum(['RESOLVED', 'DISMISSED']).default('RESOLVED'),
  resolutionAction: z.string().max(100).optional().nullable(),
  resolutionNotes: z.string().max(1000).optional().nullable(),
  applyRestriction: z.boolean().default(false).optional(),
  restrictionType: z.enum(['BAN', 'MUTE', 'MIC_BLOCK', 'WITHDRAWAL_BLOCK', 'CHAT_BLOCK', 'POST_BLOCK', 'COMMENT_BLOCK', 'LIVE_BLOCK', 'ROOM_BLOCK']).optional(),
  restrictionDays: z.number().int().positive().optional().nullable(),
  reason: z.string().max(500).optional().nullable(),
});

export default {
  submitReportSchema,
  resolveReportSchema,
};
