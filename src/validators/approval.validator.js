import { z } from 'zod';

export const createApprovalSchema = z.object({
  module: z.string().min(1, 'Module is required'),
  actionType: z.string().min(1, 'Action type is required'),
  payloadStateJson: z.record(z.any()),
  beforeStateJson: z.record(z.any()).optional().nullable(),
});

export const reviewApprovalSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT'], {
    errorMap: () => ({ message: 'Action must be either APPROVE or REJECT' }),
  }),
  reason: z.string().max(500).optional(),
}).refine(
  (data) => data.action !== 'REJECT' || (data.reason && data.reason.trim().length >= 3),
  {
    message: 'A rejection reason of at least 3 characters is required when rejecting',
    path: ['reason'],
  }
);

export const queryApprovalSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  module: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export default {
  createApprovalSchema,
  reviewApprovalSchema,
  queryApprovalSchema,
};
