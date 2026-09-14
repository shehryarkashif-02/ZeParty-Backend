import { z } from 'zod';

export const assetTypeEnum = z.enum([
  'FRAME',
  'ENTRY_EFFECT',
  'CHAT_BUBBLE',
  'BADGE',
  'VEHICLE',
  'SOUND_EFFECT',
]);

export const assetSubcategoryEnum = z.enum([
  'STATIC',
  'ANIMATED_SVGA',
  'MP4_VIDEO',
  'MP3_AUDIO',
]);

export const roomAvailabilityEnum = z.enum(['BOTH', 'LIVE_ONLY', 'AUDIO_ONLY']);

const preprocessAssetData = (data) => {
  if (typeof data !== 'object' || data === null) return data;
  return {
    ...data,
    assetType: data.assetType || data.category || (data.assetType === undefined ? undefined : 'FRAME'),
    thumbnailUrl:
      data.thumbnailUrl ||
      data.thumbnail ||
      data.iconUrl ||
      'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=120&auto=format&fit=crop&q=60',
    priceCoins: data.priceCoins ?? data.coinPrice ?? data.price,
    validDays: data.validDays ?? data.durationDays ?? data.duration,
    assetSubcategory: data.assetSubcategory || data.subCategory,
  };
};

const baseAssetObject = z.object({
  name: z.string().trim().min(1, 'Asset name is required').max(100, 'Asset name cannot exceed 100 characters'),
  assetType: z
    .string()
    .transform((val) => val.toUpperCase())
    .pipe(assetTypeEnum),
  assetSubcategory: z
    .string()
    .transform((val) => val.toUpperCase())
    .pipe(assetSubcategoryEnum)
    .default('STATIC'),
  thumbnailUrl: z.string().url('Thumbnail URL must be a valid URL'),
  staticFileUrl: z.string().url('Static file URL must be a valid URL').optional().nullable(),
  animationFileUrl: z.string().url('Animation file URL must be a valid URL').optional().nullable(),
  videoFileUrl: z.string().url('Video file URL must be a valid URL').optional().nullable(),
  audioFileUrl: z.string().url('Audio file URL must be a valid URL').optional().nullable(),
  durationSeconds: z.number().min(0, 'Duration cannot be negative').optional().nullable(),
  defaultVolumePercent: z.number().min(0).max(100).default(100.0),
  priceCoins: z
    .union([z.string(), z.number(), z.bigint()])
    .transform((val) => val.toString())
    .refine((val) => {
      try {
        const b = BigInt(val);
        return b >= 0n;
      } catch {
        return false;
      }
    }, 'Price in coins must be a non-negative integer')
    .default('0'),
  validDays: z
    .union([z.number(), z.string()])
    .transform((val) => Number(val))
    .refine((val) => Number.isInteger(val) && val >= 1 && val <= 3650, {
      message: 'Validity days must be an integer between 1 and 3650 days',
    })
    .default(30),
  roomAvailability: z
    .string()
    .transform((val) => val.toUpperCase())
    .pipe(roomAvailabilityEnum)
    .default('BOTH'),
  isVipExclusive: z.boolean().default(false),
  minVipLevelRequired: z.number().int().min(0).max(12).default(0),
  minNobleRankRequired: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const createAssetSchema = z.preprocess(preprocessAssetData, baseAssetObject);

export const updateAssetSchema = z.preprocess(
  (data) => {
    if (typeof data !== 'object' || data === null) return data;
    return {
      ...data,
      assetType: data.assetType || data.category,
      thumbnailUrl: data.thumbnailUrl || data.thumbnail || data.iconUrl,
      priceCoins: data.priceCoins ?? data.coinPrice ?? data.price,
      validDays: data.validDays ?? data.durationDays ?? data.duration,
      assetSubcategory: data.assetSubcategory || data.subCategory,
    };
  },
  baseAssetObject.partial()
);

export const purchaseAssetSchema = z.object({
  assetId: z.string().min(1, 'Asset ID is required'),
});

export const queryAssetsSchema = z.object({
  page: z
    .union([z.string(), z.number()])
    .transform((val) => Math.max(1, Number(val) || 1))
    .default(1),
  limit: z
    .union([z.string(), z.number()])
    .transform((val) => Math.min(100, Math.max(1, Number(val) || 20)))
    .default(20),
  assetType: z
    .string()
    .transform((val) => val.toUpperCase())
    .pipe(assetTypeEnum)
    .optional(),
  assetSubcategory: z
    .string()
    .transform((val) => val.toUpperCase())
    .pipe(assetSubcategoryEnum)
    .optional(),
  roomAvailability: z
    .string()
    .transform((val) => val.toUpperCase())
    .pipe(roomAvailabilityEnum)
    .optional(),
  isVipExclusive: z
    .union([z.boolean(), z.string()])
    .transform((val) => (typeof val === 'string' ? val.toLowerCase() === 'true' : Boolean(val)))
    .optional(),
  isActive: z
    .union([z.boolean(), z.string()])
    .transform((val) => (typeof val === 'string' ? val.toLowerCase() === 'true' : Boolean(val)))
    .optional(),
  search: z.string().optional().default(''),
});

export default {
  createAssetSchema,
  updateAssetSchema,
  purchaseAssetSchema,
  queryAssetsSchema,
  assetTypeEnum,
  assetSubcategoryEnum,
  roomAvailabilityEnum,
};
