import { z } from 'zod';

export const applyHostSchema = z.object({
  hostType: z.enum(['LIVE_HOST', 'AUDIO_HOST', 'BOTH'], {
    required_error: 'Host type is required (LIVE_HOST, AUDIO_HOST, BOTH)',
  }),
  idCardFrontUrl: z.string().url('idCardFrontUrl must be a valid URL'),
  idCardBackUrl: z.string().url('idCardBackUrl must be a valid URL'),
  videoSampleUrl: z.string().url('videoSampleUrl must be a valid URL').optional().nullable(),
});

export const reviewHostApplicationSchema = z.object({
  status: z.enum(['ACTIVE', 'REJECTED'], {
    required_error: 'Status must be ACTIVE or REJECTED',
  }),
  rejectionReason: z.string().max(500).optional().nullable(),
}).refine(
  (data) => {
    if (data.status === 'REJECTED' && (!data.rejectionReason || data.rejectionReason.trim().length < 3)) {
      return false;
    }
    return true;
  },
  {
    message: 'rejectionReason is required with at least 3 characters when status is REJECTED',
    path: ['rejectionReason'],
  }
);

export const updateHostStatusSchema = z.object({
  hostStatus: z.enum(['APPLIED', 'ACTIVE', 'SUSPENDED', 'REJECTED'], {
    required_error: 'Valid host status is required',
  }),
  reason: z.string().max(500).optional().nullable(),
});

export const updateHostPerformanceSchema = z.object({
  liveHoursDelta: z.number().min(0, 'liveHoursDelta must be non-negative').optional(),
  diamondsDelta: z.union([z.string(), z.number(), z.bigint()]).refine(
    (val) => {
      try {
        const bi = BigInt(val);
        return bi >= 0n;
      } catch {
        return false;
      }
    },
    { message: 'diamondsDelta must be a non-negative integer amount' }
  ).optional(),
  targetDaysDelta: z.number().int().min(0, 'targetDaysDelta must be non-negative').optional(),
});

export const queryHostsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional().default(''),
  status: z.enum(['APPLIED', 'ACTIVE', 'SUSPENDED', 'REJECTED']).optional(),
  hostType: z.enum(['LIVE_HOST', 'AUDIO_HOST', 'BOTH']).optional(),
  agencyId: z.string().optional(),
  bdCenterId: z.string().optional(),
});
