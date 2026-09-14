import { z } from 'zod';

export const createSellerSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  businessName: z.string().min(2, 'Business name must be at least 2 characters').max(100),
  profitMarginPercent: z.coerce.number().min(0, 'Profit margin must be >= 0').max(100, 'Profit margin must be <= 100').default(10.0),
  creditLimitUSD: z.coerce.number().min(0, 'Credit limit must be >= 0').default(1000.00),
});

export const updateSellerStatusSchema = z.object({
  sellerStatus: z.enum(['ACTIVE', 'SUSPENDED'], {
    required_error: 'Valid seller status is required (ACTIVE, SUSPENDED)',
  }),
  reason: z.string().max(500).optional().nullable(),
});

export const allocateSellerCoinsSchema = z.object({
  amountCoins: z.union([z.string(), z.number(), z.bigint()]).refine(
    (val) => {
      try {
        const bi = BigInt(val);
        return bi > 0n;
      } catch {
        return false;
      }
    },
    { message: 'amountCoins must be a positive integer value' }
  ),
  notes: z.string().max(500).optional().nullable(),
});

export const correctSellerBalanceSchema = z.object({
  deltaCoins: z.union([z.string(), z.number(), z.bigint()]).refine(
    (val) => {
      try {
        const bi = BigInt(val);
        return bi !== 0n;
      } catch {
        return false;
      }
    },
    { message: 'deltaCoins must be a non-zero integer amount (positive to credit, negative to debit)' }
  ),
  reason: z.string().min(3, 'Correction reason must be at least 3 characters').max(500),
});

export const querySellersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional().default(''),
  sellerStatus: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
});
