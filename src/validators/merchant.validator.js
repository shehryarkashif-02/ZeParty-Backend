import { z } from 'zod';

export const createMerchantSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  companyName: z.string().min(2, 'Company name must be at least 2 characters').max(100),
  monthlyQuotaCoins: z.union([z.string(), z.number(), z.bigint()]).refine(
    (val) => {
      try {
        const bi = BigInt(val);
        return bi > 0n;
      } catch {
        return false;
      }
    },
    { message: 'monthlyQuotaCoins must be a positive integer value' }
  ).default('1000000'),
});

export const updateMerchantSchema = z.object({
  companyName: z.string().min(2).max(100).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  monthlyQuotaCoins: z.union([z.string(), z.number(), z.bigint()]).refine(
    (val) => {
      try {
        const bi = BigInt(val);
        return bi > 0n;
      } catch {
        return false;
      }
    },
    { message: 'monthlyQuotaCoins must be a positive integer value' }
  ).optional(),
});

export const queryMerchantsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional().default(''),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
});
