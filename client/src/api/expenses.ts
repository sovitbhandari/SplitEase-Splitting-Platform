import { api } from './axios';

export type BalanceEntry = {
  userId: string;
  amount: number;
  direction: 'owes' | 'owed' | 'settled';
};

export type Expense = {
  id: string;
  amount: string;
  description: string;
  category: string;
  date: string;
  paid_by: string;
  paid_by_name: string;
  created_at: string;
};

export async function getGroupExpenses(groupId: string): Promise<{
  expenses: Expense[];
  balances: BalanceEntry[];
}> {
  const { data } = await api.get<{ expenses: Expense[]; balances: BalanceEntry[] }>(
    `/api/groups/${groupId}/expenses`
  );
  return data;
}

export async function createExpense(
  groupId: string,
  payload: {
    amount: string;
    description: string;
    category: string;
    date: string;
    paidBy: string;
    splitMode: 'equal' | 'percentage' | 'exact';
    splits: Array<{ userId: string; value: string | number }>;
  }
): Promise<{ expenseId: string; balances: BalanceEntry[] }> {
  const { data } = await api.post<{ expenseId: string; balances: BalanceEntry[] }>(
    `/api/groups/${groupId}/expenses`,
    payload
  );
  return data;
}

export async function deleteExpense(
  groupId: string,
  expenseId: string
): Promise<{ deleted: boolean; balances: BalanceEntry[] }> {
  const { data } = await api.delete<{ deleted: boolean; balances: BalanceEntry[] }>(
    `/api/groups/${groupId}/expenses/${expenseId}`
  );
  return data;
}
