import { z } from 'zod';

export const applyRestrictionSchema = z.object({
  userId: z.string().optional().nullable(),
  targetId: z.string().min(1, 'Target identifier is required'),
  type: z.enum([
    'BAN',
    'MUTE',
    'MIC_BLOCK',
    'WITHDRAWAL_BLOCK',
    'CHAT_BLOCK',
    'POST_BLOCK',
    'COMMENT_BLOCK',
    'LIVE_BLOCK',
    'ROOM_BLOCK',
  ]),
  reason: z.string().min(3, 'Mandatory audit reason must be at least 3 characters').max(500),
  durationDays: z.number().int().positive().optional().nullable(),
});

export const liftRestrictionSchema = z.object({
  liftReason: z.string().min(3, 'Lift reason must be at least 3 characters').max(500).optional(),
});

export default {
  applyRestrictionSchema,
  liftRestrictionSchema,
};
