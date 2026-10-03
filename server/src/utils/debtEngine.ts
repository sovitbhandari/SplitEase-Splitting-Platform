import type { PoolClient, QueryResultRow } from 'pg';
import { query } from './db';

export type DebtEntry = {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
};

async function computeGroupDebtsWithRunner(
  groupId: string,
  runner: Pick<PoolClient, 'query'> | typeof query
): Promise<DebtEntry[]> {
  async function run<R extends QueryResultRow>(
    text: string,
    params: unknown[]
  ): Promise<{ rows: R[] }> {
    if (typeof runner === 'function') {
      return runner<R>(text, params);
    }
    const result = await runner.query<R>(text, params);
    return { rows: result.rows };
  }
  const { rows } = await run<{
    from_user_id: string;
    from_user_name: string;
    to_user_id: string;
    to_user_name: string;
    amount: string;
  }>(
    `SELECT
      es.user_id AS from_user_id,
      debtor.display_name AS from_user_name,
      e.paid_by AS to_user_id,
      creditor.display_name AS to_user_name,
      SUM(es.amount_owed_cents)::text AS amount
     FROM expense_splits es
     INNER JOIN expenses e ON e.id = es.expense_id
     INNER JOIN users debtor ON debtor.id = es.user_id
     INNER JOIN users creditor ON creditor.id = e.paid_by
     WHERE es.group_id = $1
       AND es.is_settled = false
       AND es.user_id <> e.paid_by
     GROUP BY es.user_id, debtor.display_name, e.paid_by, creditor.display_name
     HAVING SUM(es.amount_owed_cents) > 0
     ORDER BY amount DESC`,
    [groupId]
  );

  return rows.map((row) => ({
    fromUserId: row.from_user_id,
    fromUserName: row.from_user_name,
    toUserId: row.to_user_id,
    toUserName: row.to_user_name,
    amount: Number(row.amount) / 100,
  }));
}

export async function computeGroupDebts(groupId: string): Promise<DebtEntry[]> {
  return computeGroupDebtsWithRunner(groupId, query);
}

export async function computeGroupDebtsInTransaction(
  client: PoolClient,
  groupId: string
): Promise<DebtEntry[]> {
  return computeGroupDebtsWithRunner(groupId, client);
}
