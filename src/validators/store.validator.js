import { z } from 'zod';
import { assetTypeEnum, roomAvailabilityEnum } from './asset.validator.js';

export const queryStoreCatalogSchema = z.object({
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
  roomAvailability: z
    .string()
    .transform((val) => val.toUpperCase())
    .pipe(roomAvailabilityEnum)
    .optional(),
  isVipExclusive: z
    .union([z.boolean(), z.string()])
    .transform((val) => (typeof val === 'string' ? val.toLowerCase() === 'true' : Boolean(val)))
    .optional(),
  minVipLevel: z
    .union([z.string(), z.number()])
    .transform((val) => Number(val))
    .optional(),
  search: z.string().optional().default(''),
});

export default {
  queryStoreCatalogSchema,
};
