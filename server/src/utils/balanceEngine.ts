import { query } from './db';

export type BalanceEntry = {
  userId: string;
  amount: number;
  direction: 'owes' | 'owed' | 'settled';
};

export async function computeGroupBalances(groupId: string): Promise<BalanceEntry[]> {
  const { rows: receivableRows } = await query<{ user_id: string; amount_receivable: string }>(
    `SELECT e.paid_by AS user_id, SUM(es.amount_owed)::text AS amount_receivable
     FROM expense_splits es
     INNER JOIN expenses e ON e.id = es.expense_id
     WHERE es.group_id = $1
       AND es.is_settled = false
     GROUP BY e.paid_by`,
    [groupId]
  );

  const { rows: owedRows } = await query<{ user_id: string; amount_owed: string }>(
    `SELECT user_id, SUM(amount_owed)::text AS amount_owed
     FROM expense_splits
     WHERE group_id = $1 AND is_settled = false
     GROUP BY user_id`,
    [groupId]
  );

  const map = new Map<string, { receivable: number; owed: number }>();
  for (const row of receivableRows) {
    map.set(row.user_id, { receivable: Number(row.amount_receivable ?? 0), owed: 0 });
  }
  for (const row of owedRows) {
    const existing = map.get(row.user_id) ?? { receivable: 0, owed: 0 };
    existing.owed = Number(row.amount_owed ?? 0);
    map.set(row.user_id, existing);
  }

  return Array.from(map.entries()).map(([userId, totals]) => {
    const net = Math.round((totals.receivable - totals.owed) * 100) / 100;
    if (net > 0) {
      return { userId, amount: net, direction: 'owed' };
    }
    if (net < 0) {
      return { userId, amount: Math.abs(net), direction: 'owes' };
    }
    return { userId, amount: 0, direction: 'settled' };
  });
}
