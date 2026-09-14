import { z } from 'zod';

export const registerDeviceSchema = z.object({
  deviceToken: z.string().min(1, 'Device token cannot be empty').max(1024),
  platform: z.enum(['android', 'ios', 'web', 'ANDROID', 'IOS', 'WEB']).default('android'),
  deviceModel: z.string().max(255).optional().nullable(),
  appVersion: z.string().max(50).optional().nullable(),
  macAddress: z.string().max(100).optional().nullable(),
});

export const refreshTokenSchema = z.object({
  oldToken: z.string().max(1024).optional().nullable(),
  newToken: z.string().min(1, 'New token cannot be empty').max(1024),
  platform: z.enum(['android', 'ios', 'web', 'ANDROID', 'IOS', 'WEB']).default('android').optional(),
  deviceModel: z.string().max(255).optional().nullable(),
  appVersion: z.string().max(50).optional().nullable(),
});

export const updatePreferencesSchema = z.object({
  social: z.boolean().optional(),
  live: z.boolean().optional(),
  pk: z.boolean().optional(),
  games: z.boolean().optional(),
  events: z.boolean().optional(),
  finance: z.boolean().optional(),
  moderation: z.boolean().optional(),
  support: z.boolean().optional(),
  marketing: z.boolean().optional(),
  system: z.boolean().optional(),
});

export const notificationQuerySchema = z.object({
  cursor: z.string().uuid().optional().nullable(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  type: z.string().max(50).optional().nullable(),
  category: z.string().max(50).optional().nullable(),
  unreadOnly: z.coerce.boolean().default(false).optional(),
});

export const broadcastNotificationSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty').max(200, 'Title max 200 characters'),
  body: z.string().min(1, 'Body cannot be empty').max(1000, 'Body max 1000 characters'),
  type: z.enum(['Push', 'Promotional', 'Transactional', 'System']).default('Push').optional(),
  audience: z.enum(['All Users', 'Active Users', 'VIP Users', 'Hosts Only', 'Selected Users']).default('All Users').optional(),
  data: z.record(z.any()).optional().nullable(),
  customUserIds: z.array(z.string().uuid()).optional(),
});

export default {
  registerDeviceSchema,
  refreshTokenSchema,
  updatePreferencesSchema,
  notificationQuerySchema,
  broadcastNotificationSchema,
};
