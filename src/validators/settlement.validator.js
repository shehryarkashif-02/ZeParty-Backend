import { z } from 'zod';

export const calculateSettlementSchema = z.object({
  periodCode: z.string({ required_error: 'Period code is required' }).min(3).max(64),
  entityType: z.enum(['HOST', 'AGENCY', 'BD_CENTER']).default('HOST'),
  startDate: z.string({ required_error: 'Start date is required' }).datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  endDate: z.string({ required_error: 'End date is required' }).datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
});

export const querySettlementPeriodsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  entityType: z.enum(['HOST', 'AGENCY', 'BD_CENTER']).optional(),
  status: z.enum(['OPEN', 'CALCULATING', 'CALCULATED', 'PENDING_APPROVAL', 'APPROVED', 'PROCESSING', 'PAID', 'CANCELLED', 'REJECTED']).optional(),
});

export const querySettlementRecordsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  settlementPeriodId: z.string().uuid().optional(),
  recipientType: z.enum(['HOST', 'AGENCY', 'BD_CENTER']).optional(),
  recipientId: z.string().optional(),
  userId: z.string().uuid().optional(),
  status: z.enum(['OPEN', 'CALCULATING', 'CALCULATED', 'PENDING_APPROVAL', 'APPROVED', 'PROCESSING', 'PAID', 'CANCELLED', 'REJECTED']).optional(),
});

export const createAdjustmentSchema = z.object({
  amountUSD: z.coerce.number().refine((val) => val !== 0, {
    message: 'Adjustment amount must be a non-zero number',
  }),
  type: z.enum(['BONUS', 'PENALTY', 'CHARGEBACK_DEDUCTION', 'CORRECTION']).default('CORRECTION'),
  reason: z.string({ required_error: 'Reason is required' }).min(3).max(500),
});

export default {
  calculateSettlementSchema,
  querySettlementPeriodsSchema,
  querySettlementRecordsSchema,
  createAdjustmentSchema,
};
