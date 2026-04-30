import type { PoolClient } from 'pg';
import { withTransaction } from '../utils/db';

export async function settleDebtBetweenUsers(input: {
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  method: 'cash' | 'pay';
}): Promise<{ settledAmount: number }> {
  return withTransaction(async (client: PoolClient) => {
    const splits = await client.query<{
      id: string;
      amount_owed: string;
    }>(
      `SELECT es.id, es.amount_owed::text
       FROM expense_splits es
       INNER JOIN expenses e ON e.id = es.expense_id
       WHERE es.group_id = $1
         AND es.user_id = $2
         AND e.paid_by = $3
         AND es.is_settled = false
       ORDER BY es.created_at ASC`,
      [input.groupId, input.fromUserId, input.toUserId]
    );

    let remaining = Math.round(input.amount * 100) / 100;
    const selected: Array<{ splitId: string; amount: number; originalAmount: number }> = [];

    for (const split of splits.rows) {
      const splitAmount = Math.round(Number(split.amount_owed) * 100) / 100;
      if (remaining <= 0) {
        break;
      }
      const applyAmount = Math.min(splitAmount, remaining);
      if (applyAmount > 0) {
        selected.push({ splitId: split.id, amount: applyAmount, originalAmount: splitAmount });
        remaining = Math.round((remaining - applyAmount) * 100) / 100;
      }
    }

    if (selected.length === 0) {
      throw new Error('No unsettled debt found for this pair');
    }
    if (Math.abs(remaining) > 0.009) {
      throw new Error('Settlement amount exceeds available unsettled debt');
    }

    for (const item of selected) {
      const newAmount = Math.round((item.originalAmount - item.amount) * 100) / 100;
      const settled = newAmount <= 0.009;
      await client.query(
        `UPDATE expense_splits
         SET amount_owed = $2, is_settled = $3
         WHERE id = $1`,
        [item.splitId, settled ? 0 : newAmount, settled]
      );
      await client.query(
        `INSERT INTO settlements (from_user_id, to_user_id, expense_split_id, amount)
         VALUES ($1, $2, $3, $4)`,
        [input.fromUserId, input.toUserId, item.splitId, item.amount]
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
          amount: input.amount,
          method: input.method,
        }),
      ]
    );

    return { settledAmount: input.amount };
  });
}
