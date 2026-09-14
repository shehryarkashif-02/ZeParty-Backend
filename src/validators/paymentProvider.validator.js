import { z } from 'zod';

export const createPaymentProviderSchema = z.object({
  name: z.enum(['STRIPE', 'BRAINTREE', 'PAYPAL', 'BINANCE_PAY', 'EASYPAISA', 'JAZZCASH', 'MOCK'], {
    errorMap: () => ({ message: 'Invalid payment provider name' }),
  }),
  apiKey: z.string().optional().nullable(),
  apiSecret: z.string().optional().nullable(),
  webhookUrl: z.string().url('Webhook URL must be a valid URL').optional().nullable(),
  webhookSecret: z.string().optional().nullable(),
  isSandbox: z.boolean().default(true),
  isActive: z.boolean().default(true),
  feeDescription: z.string().max(100).optional().nullable(),
  limitsDescription: z.string().max(100).optional().nullable(),
});

export const updatePaymentProviderSchema = z.object({
  apiKey: z.string().optional().nullable(),
  apiSecret: z.string().optional().nullable(),
  webhookUrl: z.string().url('Webhook URL must be a valid URL').optional().nullable(),
  webhookSecret: z.string().optional().nullable(),
  isSandbox: z.boolean().optional(),
  isActive: z.boolean().optional(),
  feeDescription: z.string().max(100).optional().nullable(),
  limitsDescription: z.string().max(100).optional().nullable(),
});

export const providerIdParamSchema = z.object({
  id: z.string().uuid({ message: 'Provider ID must be a valid UUID' }),
});

export default {
  createPaymentProviderSchema,
  updatePaymentProviderSchema,
  providerIdParamSchema,
};
