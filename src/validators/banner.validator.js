import { z } from 'zod';

export const createBannerSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(100),
    imageUrl: z.string().url('Valid image URL is required').max(1000),
    destinationUrl: z.string().url('Valid destination URL is required').max(1000).optional().or(z.literal('')),
    position: z.coerce.number().int().default(0),
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

export const updateBannerSchema = z
  .object({
    title: z.string().trim().min(1).max(100).optional(),
    imageUrl: z.string().url().max(1000).optional(),
    destinationUrl: z.string().url().max(1000).optional().or(z.literal('')).nullable(),
    position: z.coerce.number().int().optional(),
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

export const queryAdminBannersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  isActive: z.string().optional(),
  search: z.string().trim().optional(),
});

export const bannerIdParamSchema = z.object({
  id: z.string().min(1, 'Banner ID is required'),
});

export default {
  createBannerSchema,
  updateBannerSchema,
  queryAdminBannersSchema,
  bannerIdParamSchema,
};
