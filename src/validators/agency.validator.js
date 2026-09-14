import { z } from 'zod';

export const createAgencySchema = z.object({
  agencyName: z.string().min(2, 'Agency name must be at least 2 characters').max(100),
  agencyCode: z
    .string()
    .min(3, 'Agency code must be at least 3 characters')
    .max(30)
    .regex(/^[A-Za-z0-9_-]+$/, 'Agency code must contain only alphanumeric characters, underscores, or hyphens')
    .transform((val) => val.toUpperCase().trim()),
  ownerUserId: z.string().min(1, 'Owner user ID is required'),
  agencyType: z.enum(['LIVE_AGENCY', 'AUDIO_AGENCY', 'HYBRID']).default('LIVE_AGENCY'),
  commissionRate: z.coerce.number().min(0, 'Commission rate must be >= 0').max(100, 'Commission rate must be <= 100').default(20.0),
  bdCenterId: z.string().optional().nullable(),
});

export const updateAgencySchema = z.object({
  agencyName: z.string().min(2).max(100).optional(),
  commissionRate: z.coerce.number().min(0).max(100).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  bdCenterId: z.string().optional().nullable(),
});

export const transferHostSchema = z.object({
  hostProfileId: z.string().min(1, 'Host profile ID is required'),
  fromAgencyId: z.string().min(1, 'Source agency ID is required'),
  toAgencyId: z.string().min(1, 'Destination agency ID is required'),
  reason: z.string().min(3, 'Transfer reason must be at least 3 characters').max(500),
}).refine(
  (data) => data.fromAgencyId !== data.toAgencyId,
  {
    message: 'Source agency and destination agency cannot be the same',
    path: ['toAgencyId'],
  }
);

export const bindHostSchema = z.object({
  hostProfileId: z.string().min(1, 'Host profile ID is required'),
});

export const queryAgenciesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional().default(''),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  agencyType: z.enum(['LIVE_AGENCY', 'AUDIO_AGENCY', 'HYBRID']).optional(),
  bdCenterId: z.string().optional(),
});
