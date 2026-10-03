import type { PoolClient } from 'pg';
import { withTransaction } from '../utils/db';
import { centsToDollars, parseUsdCents } from '../utils/money';

export async function settleDebtBetweenUsers(input: {
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  method: 'cash' | 'pay' | 'plaid_transfer';
  note?: string;
  paymentDate?: string;
  paymentTransferId?: string;
}): Promise<{ settledAmount: number }> {
  return withTransaction(async (client: PoolClient) => {
    return settleDebtBetweenUsersInTransaction(client, input);
  });
}

export async function lockSettlementPair(
  client: PoolClient,
  input: { groupId: string; fromUserId: string; toUserId: string }
): Promise<void> {
  const ordered = [input.fromUserId, input.toUserId].sort();
  await client.query(
    `SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`,
    [input.groupId, `${ordered[0]}:${ordered[1]}`]
  );
}

export async function settleDebtBetweenUsersInTransaction(
  client: PoolClient,
  input: {
    groupId: string;
    fromUserId: string;
    toUserId: string;
    amount: number;
    method: 'cash' | 'pay' | 'plaid_transfer';
    note?: string;
    paymentDate?: string;
    paymentTransferId?: string;
  }
): Promise<{ settledAmount: number }> {
    const splits = await client.query<{
      id: string;
      amount_owed_cents: string;
    }>(
      `SELECT es.id, es.amount_owed_cents::text
       FROM expense_splits es
       INNER JOIN expenses e ON e.id = es.expense_id
       WHERE es.group_id = $1
         AND es.user_id = $2
         AND e.paid_by = $3
         AND es.is_settled = false
       ORDER BY es.created_at ASC
       FOR UPDATE OF es`,
      [input.groupId, input.fromUserId, input.toUserId]
    );

    let remaining = parseUsdCents(input.amount, 'settlement amount');
    const originalRequestedCents = remaining;
    const selected: Array<{ splitId: string; amountCents: number; originalAmountCents: number }> = [];

    for (const split of splits.rows) {
      const splitAmount = Number(split.amount_owed_cents);
      if (remaining <= 0) {
        break;
      }
      const applyAmount = Math.min(splitAmount, remaining);
      if (applyAmount > 0) {
        selected.push({
          splitId: split.id,
          amountCents: applyAmount,
          originalAmountCents: splitAmount,
        });
        remaining -= applyAmount;
      }
    }

    if (selected.length === 0) {
      throw new Error('No unsettled debt found for this pair');
    }
    if (remaining !== 0) {
      throw new Error('Settlement amount exceeds available unsettled debt');
    }

    for (const item of selected) {
      const newAmountCents = item.originalAmountCents - item.amountCents;
      const settled = newAmountCents === 0;
      await client.query(
        `UPDATE expense_splits
         SET amount_owed = $2, amount_owed_cents = $3, is_settled = $4
         WHERE id = $1`,
        [item.splitId, centsToDollars(newAmountCents), newAmountCents, settled]
      );
      await client.query(
        `INSERT INTO settlements (
          from_user_id, to_user_id, expense_split_id, amount, amount_cents
        )
         VALUES ($1, $2, $3, $4, $5)`,
        [
          input.fromUserId,
          input.toUserId,
          item.splitId,
          centsToDollars(item.amountCents),
          item.amountCents,
        ]
      );
    }

    await client.query(
      `INSERT INTO ledger_entries (group_id, event_type, entity_id, payload)
       VALUES ($1, 'settlement_created', gen_random_uuid(), $2::jsonb)`,
      [
        input.groupId,
        JSON.stringify({
          fromUserId: input.fromUserId,
          toUserId: input.toUserId,
          amount: centsToDollars(originalRequestedCents),
          amountCents: originalRequestedCents,
          method: input.method,
          note: input.note ?? undefined,
          paymentDate: input.paymentDate ?? undefined,
          paymentTransferId: input.paymentTransferId ?? undefined,
        }),
      ]
    );

    return { settledAmount: centsToDollars(originalRequestedCents) };
}
