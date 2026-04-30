import type { Request, Response } from 'express';
import { computeGroupBalances } from '../utils/balanceEngine';
import { calculateSplits } from '../utils/splitCalculator';
import { createExpenseBodySchema } from '../schemas/expense.schema';
import {
  createExpenseWithSplits,
  deleteExpenseById,
  getExpensesByGroup,
} from '../models/expense.model';
import { emitBalanceUpdateToGroup, emitGroupDataUpdated } from '../sockets/balanceEmitter';

function requireUser(req: Request, res: Response): string | null {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return userId;
}

export async function createExpenseHandler(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req, res);
  if (!userId) {
    return;
  }
  const groupId = req.params.groupId;
  if (!groupId) {
    res.status(400).json({ error: 'Group id is required' });
    return;
  }
  const parsed = createExpenseBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  if (parsed.data.paidBy !== userId) {
    res.status(403).json({ error: 'paidBy must match authenticated user' });
    return;
  }

  let splitResults;
  try {
    splitResults = calculateSplits(
      parsed.data.splitMode,
      parsed.data.amount,
      parsed.data.splits
    );
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid splits' });
    return;
  }

  const { expenseId } = await createExpenseWithSplits({
    groupId,
    amount: parsed.data.amount,
    description: parsed.data.description,
    category: parsed.data.category,
    date: parsed.data.date,
    paidBy: parsed.data.paidBy,
    splits: splitResults,
  });
  const balances = await computeGroupBalances(groupId);
  await emitBalanceUpdateToGroup(groupId, balances);
  await emitGroupDataUpdated(groupId);
  res.status(201).json({ expenseId, balances });
}

export async function getGroupExpensesHandler(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req, res);
  if (!userId) {
    return;
  }
  const groupId = req.params.groupId;
  if (!groupId) {
    res.status(400).json({ error: 'Group id is required' });
    return;
  }
  const expenses = await getExpensesByGroup(groupId);
  const balances = await computeGroupBalances(groupId);
  res.status(200).json({ expenses, balances });
}

export async function deleteExpenseHandler(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req, res);
  if (!userId) {
    return;
  }
  const groupId = req.params.groupId;
  const expenseId = req.params.expenseId;
  if (!groupId || !expenseId) {
    res.status(400).json({ error: 'Group id and expense id are required' });
    return;
  }
  const deleted = await deleteExpenseById(expenseId, groupId);
  if (!deleted) {
    res.status(404).json({ error: 'Expense not found' });
    return;
  }
  const balances = await computeGroupBalances(groupId);
  await emitBalanceUpdateToGroup(groupId, balances);
  await emitGroupDataUpdated(groupId);
  res.status(200).json({ deleted: true, balances });
}
