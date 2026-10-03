import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  computeGroupBalances,
  computeGroupBalancesInTransaction,
} from '../utils/balanceEngine';
import { computeGroupDebts, computeGroupDebtsInTransaction } from '../utils/debtEngine';
import {
  lockSettlementPair,
  settleDebtBetweenUsersInTransaction,
} from '../models/settlement.model';
import { parseUsdCents } from '../utils/money';
import {
  requireCurrentGroupMember,
} from '../models/groupAccess.model';
import {
  beginIdempotentOperation,
  completeIdempotentOperation,
} from '../models/idempotency.model';
import { emitBalanceUpdateToGroup, emitGroupDataUpdated } from '../sockets/balanceEmitter';
import { withTransaction } from '../utils/db';

const settleSchema = z.object({
  fromUserId: z.string().uuid(),
  toUserId: z.string().uuid(),
  amount: z.union([z.number().finite().positive(), z.string().min(1)]),
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
  const access = await requireCurrentGroupMember(groupId, userId);
  if (!access.ok) {
    res.status(access.status).json({ error: access.error });
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
  const idempotencyKey =
    typeof req.headers['idempotency-key'] === 'string'
      ? req.headers['idempotency-key'].trim()
      : '';
  if (!idempotencyKey) {
    res.status(428).json({
      error: 'Idempotency-Key header is required for settlement retries.',
    });
    return;
  }
  let settlementCents: number;
  try {
    settlementCents = parseUsdCents(parsed.data.amount, 'settlement amount');
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid amount' });
    return;
  }
  const outcome = await withTransaction(async (client) => {
    const idem = await beginIdempotentOperation<{
      settled: boolean;
      balances?: unknown;
      debts?: unknown;
    }>({
      client,
      actorUserId: userId,
      groupId,
      operation: 'manual_settlement',
      idempotencyKey,
      requestBody: {
        fromUserId: parsed.data.fromUserId,
        toUserId: parsed.data.toUserId,
        amountCents: settlementCents,
        method: parsed.data.method,
        note: parsed.data.note ?? null,
        paymentDate: parsed.data.paymentDate ?? null,
      },
    });
    if (idem.kind === 'replay' || idem.kind === 'conflict') {
      return {
        httpStatus: idem.httpStatus,
        body: idem.body,
        emit: false,
      };
    }
    const complete = async (
      httpStatus: number,
      body: { error: string } | { settled: boolean; balances?: unknown; debts?: unknown },
      emit = false
    ): Promise<{ httpStatus: number; body: typeof body; emit: boolean }> => {
      await completeIdempotentOperation({
        client,
        recordId: idem.recordId,
        httpStatus,
        responseBody: body,
      });
      return { httpStatus, body, emit };
    };

    await lockSettlementPair(client, {
      groupId,
      fromUserId: parsed.data.fromUserId,
      toUserId: parsed.data.toUserId,
    });

    const memberRows = await client.query<{ user_id: string; removed_at: Date | null }>(
      `SELECT user_id, removed_at
       FROM group_members
       WHERE group_id = $1 AND user_id = ANY($2::uuid[])
       FOR UPDATE`,
      [groupId, [parsed.data.fromUserId, parsed.data.toUserId]]
    );
    const byUser = new Map(memberRows.rows.map((row) => [row.user_id, row]));
    const debtor = byUser.get(parsed.data.fromUserId);
    const receiver = byUser.get(parsed.data.toUserId);
    if (!debtor) {
      return complete(404, { error: 'Group not found' });
    }
    if (!receiver) {
      return complete(403, { error: 'User is not a participant in this group.' });
    }

    const debts = await computeGroupDebtsInTransaction(client, groupId);
    const debtLine = debts.find(
      (debt) =>
        debt.fromUserId === parsed.data.fromUserId && debt.toUserId === parsed.data.toUserId
    );
    if (!debtLine) {
      return complete(400, { error: 'No unsettled debt found for this pair' });
    }
    if (settlementCents > parseUsdCents(debtLine.amount, 'debt amount')) {
      return complete(400, { error: 'Settlement amount exceeds available unsettled debt' });
    }

    if (parsed.data.method === 'pay') {
      if (debtor.removed_at !== null) {
        return complete(403, { error: 'Bank payments require current group membership' });
      }
      const accountCount = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM accounts WHERE user_id = $1`,
        [userId]
      );
      if (Number(accountCount.rows[0]?.count ?? 0) === 0) {
        return complete(400, { error: 'Connect a bank account before using Pay' });
      }
    }

    await settleDebtBetweenUsersInTransaction(client, {
      groupId,
      fromUserId: parsed.data.fromUserId,
      toUserId: parsed.data.toUserId,
      amount: settlementCents / 100,
      method: parsed.data.method,
      note: parsed.data.note,
      paymentDate: parsed.data.paymentDate,
    });

    const body =
      debtor.removed_at !== null
        ? { settled: true }
        : {
            settled: true,
            balances: await computeGroupBalancesInTransaction(client, groupId),
            debts: await computeGroupDebtsInTransaction(client, groupId),
          };
    await client.query(
      `INSERT INTO balance_update_outbox (group_id, event_type, payload)
       VALUES ($1, 'settlement_recorded', $2::jsonb)`,
      [groupId, JSON.stringify({ fromUserId: parsed.data.fromUserId, toUserId: parsed.data.toUserId })]
    );
    return complete(200, body, true);
  });

  if (outcome.emit) {
    const currentBalances = await computeGroupBalances(groupId);
    await emitBalanceUpdateToGroup(groupId, currentBalances);
    await emitGroupDataUpdated(groupId);
  }
  res.status(outcome.httpStatus).json(outcome.body);
  if (outcome.httpStatus !== 200) {
    return;
  }
}
