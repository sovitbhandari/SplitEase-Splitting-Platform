import { z } from 'zod';

export const registerBodySchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email')
    .transform((v) => v.trim().toLowerCase()),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  display_name: z.string().min(1, 'Display name is required').max(120),
});

export type RegisterInput = z.infer<typeof registerBodySchema>;

export const loginBodySchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email')
    .transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginBodySchema>;
