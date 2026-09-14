import { z } from 'zod';

export const requestOtpSchema = z.object({
  phone: z
    .string({ required_error: 'Phone number is required' })
    .min(6, 'Phone number must be at least 6 characters')
    .max(20, 'Phone number must be at most 20 characters'),
  purpose: z.enum(['REGISTRATION', 'LOGIN', 'PASSWORD_RESET']).optional().default('LOGIN'),
});

export const verifyOtpSchema = z.object({
  phone: z
    .string({ required_error: 'Phone number is required' })
    .min(6, 'Phone number must be at least 6 characters'),
  code: z
    .string({ required_error: 'OTP code is required' })
    .length(6, 'OTP code must be exactly 6 digits'),
  purpose: z.enum(['REGISTRATION', 'LOGIN', 'PASSWORD_RESET']).optional().default('LOGIN'),
  device: z
    .object({
      deviceToken: z.string().optional(),
      platform: z.enum(['ANDROID', 'IOS', 'WEB']).optional().default('ANDROID'),
      macAddress: z.string().optional(),
      deviceModel: z.string().optional(),
      appVersion: z.string().optional(),
    })
    .optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string({ required_error: 'Refresh token is required' }).min(1),
});

export const adminLoginSchema = z.object({
  usernameOrEmail: z.string({ required_error: 'Username or email is required' }).min(1),
  password: z.string({ required_error: 'Password is required' }).min(1),
});

export default {
  requestOtpSchema,
  verifyOtpSchema,
  refreshTokenSchema,
  adminLoginSchema,
};
