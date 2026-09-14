import { z } from 'zod';

export const queryUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']).optional(),
  userType: z.enum(['USER', 'HOST', 'AGENCY_OWNER', 'BD_AGENT', 'COIN_SELLER', 'MERCHANT']).optional(),
  countryCode: z.string().length(2).optional(),
  createdFrom: z.string().optional(),
  createdTo: z.string().optional(),
});

export const updateUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED'], {
    required_error: 'Status is required and must be ACTIVE, SUSPENDED, or BANNED',
  }),
  reason: z.string().trim().max(500).optional(),
});

export const updateUserProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(50).optional(),
  avatarUrl: z.string().max(1000).optional().or(z.literal('')),
  bio: z.string().trim().max(500).optional(),
  gender: z.string().max(20).optional(),
  dob: z.string().optional(),
  signature: z.string().trim().max(100).optional(),
  countryCode: z.string().length(2).optional(),
  // Explicitly disallow protected fields
  role: z.undefined({ invalid_type_error: 'Role cannot be modified through profile' }),
  permissions: z.undefined({ invalid_type_error: 'Permissions cannot be modified through profile' }),
  userType: z.undefined({ invalid_type_error: 'UserType cannot be modified through profile' }),
  wallet: z.undefined({ invalid_type_error: 'Wallet balances cannot be modified through profile' }),
  coinBalance: z.undefined({ invalid_type_error: 'Coin balance cannot be modified through profile' }),
  diamondBalance: z.undefined({ invalid_type_error: 'Diamond balance cannot be modified through profile' }),
  status: z.undefined({ invalid_type_error: 'Status cannot be modified through profile' }),
  level: z.undefined({ invalid_type_error: 'Level cannot be modified through profile' }),
  vipLevel: z.undefined({ invalid_type_error: 'VIP level cannot be modified through profile' }),
  svipLevel: z.undefined({ invalid_type_error: 'SVIP level cannot be modified through profile' }),
});

export const userIdParamSchema = z.object({
  id: z.string().min(1, 'User ID is required'),
});

export default {
  queryUsersSchema,
  updateUserStatusSchema,
  updateUserProfileSchema,
  userIdParamSchema,
};
