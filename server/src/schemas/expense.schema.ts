import { z } from 'zod';
import { MAX_SAFE_CENTS, parseUsdCents } from '../utils/money';

const splitEntrySchema = z.object({
  userId: z.string().uuid(),
  value: z.union([z.number().finite().nonnegative(), z.string().min(1)]),
});

export const createExpenseBodySchema = z.object({
  amount: z.union([z.number().finite().positive(), z.string().min(1)]),
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
}).superRefine((value, ctx) => {
  try {
    const cents = parseUsdCents(value.amount, 'amount');
    if (cents <= 0 || cents > MAX_SAFE_CENTS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amount'],
        message: 'Amount must be a positive USD amount within the supported range',
      });
    }
  } catch (error) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['amount'],
      message: error instanceof Error ? error.message : 'Invalid amount',
    });
  }
  const seen = new Set<string>();
  for (const [index, split] of value.splits.entries()) {
    if (seen.has(split.userId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['splits', index, 'userId'],
        message: 'Duplicate split participant',
      });
    }
    seen.add(split.userId);
  }
});

export type CreateExpenseInput = z.infer<typeof createExpenseBodySchema>;
