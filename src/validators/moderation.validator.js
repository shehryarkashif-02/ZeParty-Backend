import { z } from 'zod';

export const moderateUserSchema = z.object({
  targetUserId: z.string().uuid('Valid user ID required'),
  action: z.enum([
    'WARN',
    'MUTE',
    'TEMP_BAN',
    'PERM_BAN',
    'UNBAN',
    'SUSPEND',
    'UNSUSPEND',
    'CHAT_BLOCK',
    'MIC_BLOCK',
  ]),
  reason: z.string().min(3, 'Reason must be at least 3 characters').max(500),
  durationDays: z.number().int().positive().optional().nullable(),
});

export const moderateContentSchema = z.object({
  targetType: z.enum(['POST', 'COMMENT', 'ROOM']),
  targetId: z.string().min(1, 'Target ID is required'),
  action: z.enum(['DELETE_POST', 'DELETE_COMMENT', 'CLOSE_ROOM', 'WARN']).optional(),
  reason: z.string().min(3, 'Reason must be at least 3 characters').max(500),
});

export default {
  moderateUserSchema,
  moderateContentSchema,
};
