import { z } from 'zod';

export const createBDCenterSchema = z.object({
  centerName: z.string().min(2, 'Center name must be at least 2 characters').max(100),
  regionCode: z.string().min(2).max(10).default('US').transform((val) => val.toUpperCase().trim()),
  managerUserId: z.string().min(1, 'Manager user ID is required'),
  currentTier: z.enum(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND']).default('BRONZE'),
  baseSalaryUSD: z.coerce.number().min(0, 'Base salary must be >= 0').default(500.00),
});

export const updateBDCenterSchema = z.object({
  centerName: z.string().min(2).max(100).optional(),
  regionCode: z.string().min(2).max(10).optional().transform((val) => val ? val.toUpperCase().trim() : undefined),
  currentTier: z.enum(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND']).optional(),
  baseSalaryUSD: z.coerce.number().min(0).optional(),
  managerUserId: z.string().min(1).optional(),
});

export const createBDInviteSchema = z.object({
  bdCenterId: z.string().min(1, 'BD Center ID is required'),
  targetUserId: z.string().min(1, 'Target user ID is required'),
});

export const acceptBDInviteSchema = z.object({
  invitationCode: z.string().min(4, 'Invitation code is required').max(64).transform((val) => val.toUpperCase().trim()),
});

export const queryBDCentersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional().default(''),
  regionCode: z.string().optional(),
  currentTier: z.enum(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND']).optional(),
});
