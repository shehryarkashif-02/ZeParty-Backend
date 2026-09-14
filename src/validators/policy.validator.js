import { z } from 'zod';
import { CANONICAL_POLICY_TYPES } from '../constants/policyDefaults.js';

export const createPolicySchema = z.object({
  policyType: z
    .string()
    .min(2, 'Policy type must be at least 2 characters')
    .max(50, 'Policy type must be at most 50 characters')
    .transform((val) => val.toUpperCase().trim()),
  description: z.string().max(500).optional().nullable(),
  version: z.string().regex(/^v\d+\.\d+\.\d+.*$/, 'Version must follow format e.g. v1.0.0').default('v1.0.0'),
  initialConfig: z.record(z.any(), { required_error: 'Initial configuration object is required' }),
});

export const createVersionSchema = z.object({
  version: z.string().regex(/^v\d+\.\d+\.\d+.*$/, 'Version must follow format e.g. v1.1.0'),
  summary: z.string().min(3, 'Summary must be at least 3 characters').max(500),
  configJson: z.record(z.any(), { required_error: 'Configuration payload is required' }),
  effectiveDate: z.string().datetime().optional(),
});

export const rollbackPolicySchema = z.object({
  targetVersion: z.string().min(1, 'Target version tag is required'),
  reason: z.string().min(3, 'Rollback reason must be at least 3 characters').max(500),
});

export const updateConfigSchema = z.object({
  key: z.string().min(2).max(100).transform((val) => val.toUpperCase().trim()),
  valueJson: z.record(z.any(), { required_error: 'Configuration value object is required' }).refine(
    (val) => {
      // Validate percentage boundaries if ratePercent is present
      if (val.ratePercent !== undefined) {
        const p = Number(val.ratePercent);
        if (isNaN(p) || p < 0 || p > 100) return false;
      }
      // Validate positive rate if rate is present
      if (val.rate !== undefined) {
        const r = Number(val.rate);
        if (isNaN(r) || r <= 0) return false;
      }
      // Validate positive amountUSD if present
      if (val.amountUSD !== undefined) {
        const a = Number(val.amountUSD);
        if (isNaN(a) || a <= 0) return false;
      }
      return true;
    },
    {
      message: 'Invalid configuration values: rates must be positive and percentages must be between 0 and 100',
    }
  ),
});

export const toggleConfigSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const queryPolicySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export default {
  createPolicySchema,
  createVersionSchema,
  rollbackPolicySchema,
  updateConfigSchema,
  toggleConfigSchema,
  queryPolicySchema,
};
