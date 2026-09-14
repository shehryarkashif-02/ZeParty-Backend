import { z } from 'zod';

export const createRoomSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(100),
  coverImageUrl: z.string().url().max(1000).optional().or(z.literal('')),
  roomType: z.enum(['LIVE_VIDEO', 'AUDIO_PARTY']).default('LIVE_VIDEO'),
  category: z.enum(['MUSIC', 'CHAT', 'GAMING']).default('CHAT'),
  isPrivate: z.boolean().default(false),
  roomPin: z.string().max(10).optional().or(z.literal('')),
});

export const queryActiveRoomsSchema = z.object({
  roomType: z.enum(['LIVE_VIDEO', 'AUDIO_PARTY']).optional(),
  category: z.enum(['MUSIC', 'CHAT', 'GAMING']).optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const queryAdminRoomsSchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(['LIVE', 'ENDED', 'CLOSED_BY_ADMIN']).optional(),
  roomType: z.enum(['LIVE_VIDEO', 'AUDIO_PARTY']).optional(),
  isPinnedTop: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const occupySeatParamSchema = z.object({
  id: z.string().min(1, 'Room ID is required'),
  seatIndex: z.coerce.number().int().min(0, 'Seat index must be between 0 and 7').max(7, 'Seat index must be between 0 and 7'),
});

export const pinRoomSchema = z.object({
  pinnedPosition: z.coerce.number().int().min(1).max(3).default(1),
});

export const adminCloseRoomSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const roomIdParamSchema = z.object({
  id: z.string().min(1, 'Room ID is required'),
});

export default {
  createRoomSchema,
  queryActiveRoomsSchema,
  queryAdminRoomsSchema,
  occupySeatParamSchema,
  pinRoomSchema,
  adminCloseRoomSchema,
  roomIdParamSchema,
};
