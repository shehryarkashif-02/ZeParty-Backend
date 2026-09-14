import { z } from 'zod';

export const createAnnouncementSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(150),
    body: z.string().trim().min(1, 'Body is required').max(5000),
    targetAudience: z.enum(['ALL', 'HOSTS', 'AGENCIES', 'VIP_USERS', 'SELLERS']).default('ALL'),
    isActive: z.boolean().default(true),
    startsAt: z.string().datetime().optional().nullable(),
    endsAt: z.string().datetime().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.startsAt && data.endsAt) {
        return new Date(data.startsAt) <= new Date(data.endsAt);
      }
      return true;
    },
    {
      message: 'startsAt must be before or equal to endsAt',
      path: ['endsAt'],
    }
  );

export const updateAnnouncementSchema = z
  .object({
    title: z.string().trim().min(1).max(150).optional(),
    body: z.string().trim().min(1).max(5000).optional(),
    targetAudience: z.enum(['ALL', 'HOSTS', 'AGENCIES', 'VIP_USERS', 'SELLERS']).optional(),
    isActive: z.boolean().optional(),
    startsAt: z.string().datetime().optional().nullable(),
    endsAt: z.string().datetime().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.startsAt && data.endsAt) {
        return new Date(data.startsAt) <= new Date(data.endsAt);
      }
      return true;
    },
    {
      message: 'startsAt must be before or equal to endsAt',
      path: ['endsAt'],
    }
  );

export const queryAdminAnnouncementsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  targetAudience: z.enum(['ALL', 'HOSTS', 'AGENCIES', 'VIP_USERS', 'SELLERS']).optional(),
  isActive: z.string().optional(),
  search: z.string().trim().optional(),
});

export const queryActiveAnnouncementsSchema = z.object({
  targetAudience: z.enum(['ALL', 'HOSTS', 'AGENCIES', 'VIP_USERS', 'SELLERS']).default('ALL').optional(),
});

export const announcementIdParamSchema = z.object({
  id: z.string().min(1, 'Announcement ID is required'),
});

export default {
  createAnnouncementSchema,
  updateAnnouncementSchema,
  queryAdminAnnouncementsSchema,
  queryActiveAnnouncementsSchema,
  announcementIdParamSchema,
};
