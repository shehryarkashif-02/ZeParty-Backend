import { z } from 'zod';

export const createPaymentIntentSchema = z.object({
  planId: z.string().uuid({ message: 'Plan ID must be a valid UUID' }),
  paymentProvider: z.enum(['STRIPE', 'PAYPAL', 'BRAINTREE', 'BINANCE_PAY', 'MOCK'], {
    errorMap: () => ({ message: 'Payment provider must be one of STRIPE, PAYPAL, BRAINTREE, BINANCE_PAY, or MOCK' }),
  }),
});

export const submitOfflineRechargeSchema = z.object({
  amountUSD: z.coerce.number().positive('Amount USD must be greater than zero'),
  bankName: z.string().min(2, 'Bank name must be at least 2 characters').max(100),
  receiptPhotoUrl: z.string().url('Receipt photo must be a valid URL'),
  transactionRef: z.string().min(3, 'Transaction reference is required').max(100),
});

export default {
  createPaymentIntentSchema,
  submitOfflineRechargeSchema,
};
