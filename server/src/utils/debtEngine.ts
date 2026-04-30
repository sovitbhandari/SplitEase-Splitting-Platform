import { query } from './db';

export type DebtEntry = {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
};

export async function computeGroupDebts(groupId: string): Promise<DebtEntry[]> {
  const { rows } = await query<{
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
      SUM(es.amount_owed)::text AS amount
     FROM expense_splits es
     INNER JOIN expenses e ON e.id = es.expense_id
     INNER JOIN users debtor ON debtor.id = es.user_id
     INNER JOIN users creditor ON creditor.id = e.paid_by
     WHERE es.group_id = $1
       AND es.is_settled = false
       AND es.user_id <> e.paid_by
     GROUP BY es.user_id, debtor.display_name, e.paid_by, creditor.display_name
     HAVING SUM(es.amount_owed) > 0
     ORDER BY amount DESC`,
    [groupId]
  );

  return rows.map((row) => ({
    fromUserId: row.from_user_id,
    fromUserName: row.from_user_name,
    toUserId: row.to_user_id,
    toUserName: row.to_user_name,
    amount: Number(row.amount),
  }));
}
