import type { PoolClient } from 'pg';
import { query, withTransaction } from '../utils/db';

export class ExpenseHasSettlementsError extends Error {
  constructor() {
    super('Cannot delete an expense that has settlement history.');
    this.name = 'ExpenseHasSettlementsError';
  }
}

type SplitInsert = {
  userId: string;
  amountOwed: number;
  amountOwedCents: number;
  ratio: number;
};

export async function createExpenseWithSplits(input: {
  groupId: string;
  amount: number;
  amountCents: number;
  description: string;
  category: string;
  date: string;
  paidBy: string;
  splits: SplitInsert[];
}): Promise<{ expenseId: string }> {
  return withTransaction(async (client: PoolClient) => {
    const members = await client.query<{ user_id: string }>(
      `SELECT user_id
       FROM group_members
       WHERE group_id = $1
         AND removed_at IS NULL`,
      [input.groupId]
    );
    const memberIds = new Set(members.rows.map((item) => item.user_id));
    if (!memberIds.has(input.paidBy)) {
      throw new Error('Payer must be a member of this group');
    }
    for (const split of input.splits) {
      if (!memberIds.has(split.userId)) {
        throw new Error('All split users must be members of this group');
      }
    }

    const expenseRes = await client.query<{ id: string }>(
      `INSERT INTO expenses (
        group_id, paid_by, amount, amount_cents, currency, description, category, date
       )
       VALUES ($1,$2,$3,$4,'USD',$5,$6,$7)
       RETURNING id`,
      [
        input.groupId,
        input.paidBy,
        input.amount,
        input.amountCents,
        input.description,
        input.category,
        input.date,
      ]
    );
    const expenseId = expenseRes.rows[0]?.id;
    if (!expenseId) {
      throw new Error('Failed to create expense');
    }

    for (const split of input.splits) {
      await client.query(
        `INSERT INTO expense_splits (
          expense_id, group_id, user_id, amount_owed, original_amount_owed_cents,
          amount_owed_cents, ratio
         )
         VALUES ($1,$2,$3,$4,$5,$5,$6)`,
        [
          expenseId,
          input.groupId,
          split.userId,
          split.amountOwed,
          split.amountOwedCents,
          split.ratio,
        ]
      );
    }

    await client.query(
      `INSERT INTO ledger_entries (group_id, event_type, entity_id, payload)
       VALUES ($1, 'expense_created', $2, $3::jsonb)`,
      [
        input.groupId,
        expenseId,
        JSON.stringify({
          amount: input.amount,
          amountCents: input.amountCents,
          currency: 'USD',
          description: input.description,
          paidBy: input.paidBy,
          splitCount: input.splits.length,
        }),
      ]
    );

    return { expenseId };
  });
}

export async function getExpensesByGroup(groupId: string): Promise<
  Array<{
    id: string;
    amount: string;
    description: string;
    category: string;
    date: string;
    paid_by: string;
    paid_by_name: string;
    created_at: string;
  }>
> {
  const { rows } = await query<{
    id: string;
    amount: string;
    description: string;
    category: string;
    date: string;
    paid_by: string;
    paid_by_name: string;
    created_at: string;
  }>(
    `SELECT
      e.id,
      e.amount::text,
      e.description,
      e.category::text AS category,
      e.date::text AS date,
      e.paid_by,
      u.display_name AS paid_by_name,
      e.created_at::text
     FROM expenses e
     INNER JOIN users u ON u.id = e.paid_by
     WHERE e.group_id = $1
     ORDER BY e.date DESC, e.created_at DESC`,
    [groupId]
  );
  return rows;
}

export async function deleteExpenseById(
  expenseId: string,
  groupId: string
): Promise<boolean> {
  return withTransaction(async (client: PoolClient) => {
    const settlementCount = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM settlements s
       INNER JOIN expense_splits es ON es.id = s.expense_split_id
       WHERE es.expense_id = $1
         AND es.group_id = $2`,
      [expenseId, groupId]
    );
    if (Number(settlementCount.rows[0]?.count ?? 0) > 0) {
      throw new ExpenseHasSettlementsError();
    }

    const result = await client.query(
      `DELETE FROM expenses WHERE id = $1 AND group_id = $2`,
      [expenseId, groupId]
    );
    if (result.rowCount === 0) {
      return false;
    }

    await client.query(
      `INSERT INTO ledger_entries (group_id, event_type, entity_id, payload)
       VALUES ($1, 'expense_deleted', $2, $3::jsonb)`,
      [groupId, expenseId, JSON.stringify({ expenseId })]
    );
    return true;
  });
}
