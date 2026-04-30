import { create } from 'zustand';
import type { BalanceEntry } from '../api/expenses';

type BalanceState = {
  balances: Record<string, BalanceEntry>;
  setBalances: (entries: BalanceEntry[]) => void;
  clearBalances: () => void;
};

export const useBalanceStore = create<BalanceState>((set) => ({
  balances: {},
  setBalances: (entries) =>
    set({
      balances: entries.reduce<Record<string, BalanceEntry>>((acc, entry) => {
        acc[entry.userId] = entry;
        return acc;
      }, {}),
    }),
  clearBalances: () => set({ balances: {} }),
}));
