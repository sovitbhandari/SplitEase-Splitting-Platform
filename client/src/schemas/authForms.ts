import { z } from 'zod';

export const loginFormSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;

export const registerFormSchema = z
  .object({
    display_name: z.string().min(1, 'Display name is required').max(120),
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Invalid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string().min(1, 'Confirm your password'),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

export type RegisterFormValues = z.infer<typeof registerFormSchema>;
