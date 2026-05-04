import { z } from 'zod';

export const createGroupBodySchema = z.object({
  name: z.string().min(1, 'Group name is required').max(120),
  description: z.string().max(500).optional(),
  currency: z.string().length(3).default('USD'),
});

export type CreateGroupInput = z.infer<typeof createGroupBodySchema>;

export const joinGroupBodySchema = z.object({
  invite_code: z.string().uuid('Invalid invite code'),
});

export type JoinGroupInput = z.infer<typeof joinGroupBodySchema>;

export const updateGroupBodySchema = z.object({
  name: z.string().min(1, 'Trip name is required').max(120),
  description: z.string().max(2000).optional(),
});

export type UpdateGroupInput = z.infer<typeof updateGroupBodySchema>;
