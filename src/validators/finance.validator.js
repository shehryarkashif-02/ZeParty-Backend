import { z } from 'zod';

export const adjustBalanceSchema = z.object({
  targetUserId: z.string().uuid({ message: 'Target User ID must be a valid UUID' }),
  asset: z.enum(['COINS', 'DIAMONDS'], {
    errorMap: () => ({ message: 'Asset must be either COINS or DIAMONDS' }),
  }),
  direction: z.enum(['CREDIT', 'DEBIT'], {
    errorMap: () => ({ message: 'Direction must be either CREDIT or DEBIT' }),
  }),
  amount: z
    .union([z.string(), z.number(), z.bigint()])
    .transform((val) => {
      try {
        const b = BigInt(val);
        if (b <= 0n) throw new Error();
        return b;
      } catch {
        throw new Error('Amount must be a positive integer');
      }
    }),
  reason: z
    .string({ required_error: 'Reason is required for balance adjustment' })
    .min(3, 'Reason must be at least 3 characters')
    .max(500, 'Reason must be at most 500 characters'),
});

export const createRechargePlanSchema = z.object({
  coinAmount: z.coerce.number().int().positive('Coin amount must be a positive integer'),
  priceUSD: z.coerce.number().positive('Price USD must be greater than 0'),
  bonusCoins: z.coerce.number().int().nonnegative('Bonus coins cannot be negative').default(0),
  badgeText: z.string().max(50).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const updateRechargePlanSchema = z.object({
  coinAmount: z.coerce.number().int().positive().optional(),
  priceUSD: z.coerce.number().positive().optional(),
  bonusCoins: z.coerce.number().int().nonnegative().optional(),
  badgeText: z.string().max(50).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const rejectFinancialItemSchema = z.object({
  reason: z
    .string({ required_error: 'Rejection reason is required' })
    .min(3, 'Rejection reason must be at least 3 characters')
    .max(500, 'Rejection reason must be at most 500 characters'),
});

export const createCoinRefundSchema = z.object({
  coinAmount: z.coerce.number().int().positive('Coin amount must be a positive integer'),
  disputeReason: z.string().min(3, 'Dispute reason must be at least 3 characters').max(500),
});

export const queryLedgerSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum([
    'RECHARGE',
    'GIFT_SENT',
    'GIFT_RECEIVED',
    'WITHDRAWAL',
    'P2P_ESCROW_LOCK',
    'P2P_ESCROW_RELEASE',
    'ADMIN_ADJUSTMENT',
    'SWAP',
    'RESELLER_ALLOCATION',
    'REFUND',
    'CHARGEBACK_REVERSAL',
  ]).optional(),
  userId: z.string().uuid().optional(),
  referenceId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export default {
  adjustBalanceSchema,
  createRechargePlanSchema,
  updateRechargePlanSchema,
  rejectFinancialItemSchema,
  createCoinRefundSchema,
  queryLedgerSchema,
};
