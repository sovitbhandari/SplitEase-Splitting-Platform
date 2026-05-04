import type { Request, Response } from 'express';
import { z } from 'zod';
import { computeGroupBalances } from '../utils/balanceEngine';
import { computeGroupDebts } from '../utils/debtEngine';
import { settleDebtBetweenUsers } from '../models/settlement.model';
import { getAccountsByUser } from '../models/plaid.model';
import { emitBalanceUpdateToGroup, emitGroupDataUpdated } from '../sockets/balanceEmitter';

const settleSchema = z.object({
  fromUserId: z.string().uuid(),
  toUserId: z.string().uuid(),
  amount: z.number().positive(),
  method: z.enum(['cash', 'pay']),
  note: z.string().max(500).optional(),
  paymentDate: z.string().max(32).optional(),
});

function requireUser(req: Request, res: Response): string | null {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return userId;
}

export async function getGroupDebtsHandler(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req, res);
  if (!userId) {
    return;
  }
  const groupId = req.params.groupId;
  if (!groupId) {
    res.status(400).json({ error: 'Group id is required' });
    return;
  }
  const debts = await computeGroupDebts(groupId);
  res.status(200).json({ debts });
}

export async function settleDebtHandler(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req, res);
  if (!userId) {
    return;
  }
  const groupId = req.params.groupId;
  if (!groupId) {
    res.status(400).json({ error: 'Group id is required' });
    return;
  }

  const parsed = settleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  if (parsed.data.fromUserId !== userId) {
    res.status(403).json({ error: 'You can only settle your own debt' });
    return;
  }
  if (parsed.data.method === 'pay') {
    const accounts = await getAccountsByUser(userId);
    if (accounts.length === 0) {
      res.status(400).json({ error: 'Connect a bank account before using Pay' });
      return;
    }
  }

  await settleDebtBetweenUsers({
    groupId,
    fromUserId: parsed.data.fromUserId,
    toUserId: parsed.data.toUserId,
    amount: parsed.data.amount,
    method: parsed.data.method,
    note: parsed.data.note,
    paymentDate: parsed.data.paymentDate,
  });

  const balances = await computeGroupBalances(groupId);
  await emitBalanceUpdateToGroup(groupId, balances);
  await emitGroupDataUpdated(groupId);
  const debts = await computeGroupDebts(groupId);
  res.status(200).json({ settled: true, balances, debts });
}
