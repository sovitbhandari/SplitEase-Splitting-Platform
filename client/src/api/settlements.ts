import { api } from './axios';
import type { BalanceEntry } from './expenses';

export type DebtEntry = {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
};

export async function getGroupDebts(groupId: string): Promise<DebtEntry[]> {
  const { data } = await api.get<{ debts: DebtEntry[] }>(
    `/api/groups/${groupId}/settlements`
  );
  return data.debts;
}

export async function settleDebt(
  groupId: string,
  payload: {
    fromUserId: string;
    toUserId: string;
    amount: number;
    method: 'cash' | 'pay';
  }
): Promise<{ balances: BalanceEntry[]; debts: DebtEntry[] }> {
  const { data } = await api.post<{ balances: BalanceEntry[]; debts: DebtEntry[] }>(
    `/api/groups/${groupId}/settlements`,
    payload
  );
  return data;
}
