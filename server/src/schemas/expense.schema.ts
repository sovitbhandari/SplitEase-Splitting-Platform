import { z } from 'zod';

const splitEntrySchema = z.object({
  userId: z.string().uuid(),
  value: z.number().positive(),
});

export const createExpenseBodySchema = z.object({
  amount: z.number().positive(),
  description: z.string().min(1).max(500),
  category: z.enum([
    'food',
    'transport',
    'housing',
    'utilities',
    'entertainment',
    'travel',
    'other',
  ]),
  date: z.string().min(1),
  paidBy: z.string().uuid(),
  splitMode: z.enum(['equal', 'percentage', 'exact']),
  splits: z.array(splitEntrySchema).min(1),
});

export type CreateExpenseInput = z.infer<typeof createExpenseBodySchema>;
