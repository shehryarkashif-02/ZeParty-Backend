import { z } from 'zod';

export const giftCategoryEnum = z.enum(['POPULAR', 'LUXURY', 'VIP', 'AUDIO']);

export const createGiftSchema = z.object({
  name: z.string().trim().min(1, 'Gift name is required').max(100, 'Gift name cannot exceed 100 characters'),
  coinValue: z
    .union([z.string(), z.number(), z.bigint()])
    .transform((val) => val.toString())
    .refine((val) => {
      try {
        const b = BigInt(val);
        return b > 0n;
      } catch {
        return false;
      }
    }, 'Coin value must be a positive integer'),
  iconUrl: z.string().url('Icon URL must be a valid URL'),
  svgaAssetUrl: z.string().url('SVGA URL must be a valid URL').optional().nullable(),
  giftCategory: z
    .string()
    .transform((val) => val.toUpperCase())
    .pipe(giftCategoryEnum)
    .default('POPULAR'),
  isAnimated: z.boolean().default(false),
  isFullScreen: z.boolean().default(false),
  platformCutPercent: z.number().min(0).max(100).default(45.0),
  hostCutPercent: z.number().min(0).max(100).default(35.0),
  agencyCutPercent: z.number().min(0).max(100).default(12.0),
  roomCutPercent: z.number().min(0).max(100).default(8.0),
  isActive: z.boolean().default(true),
});

export const updateGiftSchema = createGiftSchema.partial();

export const sendGiftSchema = z.object({
  giftId: z.string().min(1, 'Gift ID is required'),
  recipientUserId: z.string().min(1, 'Recipient User ID is required'),
  quantity: z
    .union([z.number(), z.string()])
    .transform((val) => Number(val))
    .refine((val) => Number.isInteger(val) && val >= 1 && val <= 10000, {
      message: 'Quantity must be an integer between 1 and 10,000',
    })
    .default(1),
  roomId: z.string().optional().nullable(),
});

export const queryGiftsSchema = z.object({
  page: z
    .union([z.string(), z.number()])
    .transform((val) => Math.max(1, Number(val) || 1))
    .default(1),
  limit: z
    .union([z.string(), z.number()])
    .transform((val) => Math.min(100, Math.max(1, Number(val) || 20)))
    .default(20),
  giftCategory: z
    .string()
    .transform((val) => val.toUpperCase())
    .pipe(giftCategoryEnum)
    .optional(),
  isActive: z
    .union([z.boolean(), z.string()])
    .transform((val) => (typeof val === 'string' ? val.toLowerCase() === 'true' : Boolean(val)))
    .optional(),
  search: z.string().optional().default(''),
});

export default {
  createGiftSchema,
  updateGiftSchema,
  sendGiftSchema,
  queryGiftsSchema,
  giftCategoryEnum,
};
