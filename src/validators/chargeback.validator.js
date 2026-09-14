import { z } from 'zod';

export const createChargebackSchema = z.object({
  disputeId: z.string().min(3, 'Dispute ID is required').max(100),
  userId: z.string().uuid({ message: 'User ID must be a valid UUID' }),
  gateway: z.enum(['STRIPE', 'PAYPAL', 'BRAINTREE', 'BINANCE_PAY', 'MANUAL'], {
    errorMap: () => ({ message: 'Invalid payment gateway' }),
  }),
  amountUSD: z.coerce.number().positive('Amount USD must be greater than zero'),
  coinsInvolved: z.coerce.number().int().nonnegative('Coins involved cannot be negative').default(0),
  reason: z.string().max(500).optional().nullable(),
});

export const resolveChargebackSchema = z.object({
  action: z.enum(['RESOLVE_REVERSE_COINS', 'RESOLVE_DISMISS', 'INVESTIGATING', 'REJECT'], {
    errorMap: () => ({ message: 'Action must be one of RESOLVE_REVERSE_COINS, RESOLVE_DISMISS, INVESTIGATING, or REJECT' }),
  }),
  adminNotes: z.string().max(500).optional().nullable(),
});

export const chargebackIdParamSchema = z.object({
  id: z.string().uuid({ message: 'Chargeback ID must be a valid UUID' }),
});

export const queryChargebacksSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['RECEIVED', 'INVESTIGATING', 'RESOLVED', 'REJECTED']).optional(),
  gateway: z.string().optional(),
  userId: z.string().uuid().optional(),
});

export default {
  createChargebackSchema,
  resolveChargebackSchema,
  chargebackIdParamSchema,
  queryChargebacksSchema,
};
