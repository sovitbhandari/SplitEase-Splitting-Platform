import { useState } from 'react';
import type { DebtEntry } from '../api/settlements';
import { formatCurrency, getDebtLabel } from '../utils/financeFormat';

type Props = {
  currentUserId: string;
  debts: DebtEntry[];
  onCashSettle: (debt: DebtEntry, amount: number) => Promise<void>;
  onPay: (debt: DebtEntry) => Promise<void>;
};

export function SettlementPanel({ currentUserId, debts, onCashSettle, onPay }: Props) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [amountInputs, setAmountInputs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const myDebts = debts.filter((item) => item.fromUserId === currentUserId);
  const owedToMe = debts.filter((item) => item.toUserId === currentUserId);
  const otherDebts = debts.filter(
    (item) => item.fromUserId !== currentUserId && item.toUserId !== currentUserId
  );
  const orderedDebts = [...myDebts, ...owedToMe, ...otherDebts];

  const settleCash = async (debt: DebtEntry): Promise<void> => {
    const amountKey = `${debt.fromUserId}-${debt.toUserId}`;
    const input = Number(amountInputs[amountKey] ?? debt.amount);
    if (!Number.isFinite(input) || input <= 0) {
      setError('Enter a valid cash amount');
      return;
    }
    if (input > debt.amount) {
      setError('Amount cannot exceed current debt');
      return;
    }
    const key = `${debt.fromUserId}-${debt.toUserId}-cash`;
    setError(null);
    setBusyKey(key);
    try {
      await onCashSettle(debt, input);
      setAmountInputs((prev) => ({ ...prev, [amountKey]: '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to settle debt');
    } finally {
      setBusyKey(null);
    }
  };

  const startPay = async (debt: DebtEntry): Promise<void> => {
    const key = `${debt.fromUserId}-${debt.toUserId}-pay`;
    setError(null);
    setBusyKey(key);
    try {
      await onPay(debt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start payment');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Settlement Plan</h3>
        <span className="text-xs text-slate-500">
          {debts.length} open {debts.length === 1 ? 'debt' : 'debts'}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Follow this list to settle balances quickly and clearly.
      </p>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}

      <div className="mt-4 space-y-3">
        {orderedDebts.length === 0 ? (
          <p className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Everyone is settled up 🎉
          </p>
        ) : (
          orderedDebts.map((debt) => {
            const cashKey = `${debt.fromUserId}-${debt.toUserId}-cash`;
            const payKey = `${debt.fromUserId}-${debt.toUserId}-pay`;
            const inputKey = `${debt.fromUserId}-${debt.toUserId}`;
            const relevant = debt.fromUserId === currentUserId;
            const toneClass =
              debt.fromUserId === currentUserId
                ? 'border-rose-100 bg-rose-50'
                : debt.toUserId === currentUserId
                  ? 'border-emerald-100 bg-emerald-50'
                  : 'border-slate-200 bg-slate-50';

            return (
              <div
                key={`${debt.fromUserId}-${debt.toUserId}`}
                className={`rounded-lg border p-3 ${toneClass}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">
                    {getDebtLabel(debt, currentUserId)}
                  </p>
                  <p className="text-base font-bold text-slate-900">
                    {formatCurrency(debt.amount)}
                  </p>
                </div>
                {relevant ? (
                  <div className="mt-3 space-y-2">
                    <label className="block text-xs font-medium text-slate-600">
                      Amount to record
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder={debt.amount.toFixed(2)}
                      value={amountInputs[inputKey] ?? ''}
                      onChange={(event) =>
                        setAmountInputs((prev) => ({
                          ...prev,
                          [inputKey]: event.target.value,
                        }))
                      }
                      className="w-40 rounded border border-slate-300 px-2 py-1.5 text-sm"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
                        disabled={busyKey !== null}
                        onClick={() => void settleCash(debt)}
                      >
                        {busyKey === cashKey ? 'Recording...' : 'Record Cash Payment'}
                      </button>
                      <button
                        type="button"
                        className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                        disabled={busyKey !== null}
                        onClick={() => void startPay(debt)}
                      >
                        {busyKey === payKey ? 'Opening...' : 'Pay'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
