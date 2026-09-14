import { z } from 'zod';

export const createPostSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Post content cannot be empty')
    .max(2000, 'Content must not exceed 2000 characters'),
  mediaUrls: z
    .array(z.string().url('Each media item must be a valid URL'))
    .max(9, 'Maximum of 9 media items allowed')
    .optional()
    .default([]),
  visibility: z
    .enum(['PUBLIC', 'FOLLOWERS', 'PRIVATE'])
    .optional()
    .default('PUBLIC'),
});

export const queryFeedSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  userId: z.string().optional(),
  feedType: z.enum(['PUBLIC', 'FOLLOWING']).default('PUBLIC'),
});

export const postIdParamSchema = z.object({
  id: z.string().min(1, 'Post ID is required'),
});

export const createCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Comment content cannot be empty')
    .max(1000, 'Comment must not exceed 1000 characters'),
  parentId: z.string().uuid('Invalid parent comment ID').optional().nullable(),
});

export const commentIdParamSchema = z.object({
  id: z.string().min(1, 'Comment ID is required'),
});

export const userIdParamSchema = z.object({
  id: z.string().min(1, 'User ID is required'),
});

export const reportContentSchema = z.object({
  targetType: z.enum(['USER', 'POST', 'COMMENT']),
  targetId: z.string().min(1, 'Target ID is required'),
  violationType: z.string().min(1, 'Violation type is required'),
  description: z.string().max(1000).optional(),
  screenshotUrl: z.string().url().optional(),
});

export const privacySettingsSchema = z.object({
  isPrivate: z.boolean(),
});

export default {
  createPostSchema,
  queryFeedSchema,
  postIdParamSchema,
  createCommentSchema,
  commentIdParamSchema,
  userIdParamSchema,
  reportContentSchema,
  privacySettingsSchema,
};
