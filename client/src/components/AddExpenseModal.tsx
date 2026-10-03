import { useMemo, useState } from 'react';
import type { GroupMember } from '../api/groups';
import { inferCategoryEnumFromDescription } from '../utils/expenseDisplay';
import { SplitModeSelector } from './SplitModeSelector';

type Mode = 'equal' | 'percentage' | 'exact';

type Props = {
  members: GroupMember[];
  paidBy: string;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    amount: string;
    description: string;
    category: string;
    date: string;
    paidBy: string;
    splitMode: Mode;
    splits: Array<{ userId: string; value: string | number }>;
  }) => Promise<void>;
};

export function AddExpenseModal({ members, paidBy, loading, onClose, onSubmit }: Props) {
  const [amount, setAmount] = useState('0');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');
  const [categoryManual, setCategoryManual] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [splitMode, setSplitMode] = useState<Mode>('equal');
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(members.map((member) => [member.user_id, '0']))
  );
  const [error, setError] = useState<string | null>(null);

  const parseUsd = (value: string): number | null =>
    /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value.trim()) ? Number(value) : null;
  const parsePercent = (value: string): number | null =>
    /^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(value.trim()) ? Number(value) : null;
  const numericAmount = parseUsd(amount) ?? Number.NaN;
  const splitSum = useMemo(
    () =>
      members.reduce((sum, member) => {
        const raw = values[member.user_id] || '0';
        const parsed = splitMode === 'percentage' ? parsePercent(raw) : parseUsd(raw);
        return sum + (parsed ?? Number.NaN);
      }, 0),
    [members, splitMode, values]
  );

  const helperText =
    parseUsd(amount) === null
      ? 'Amount must be USD with at most 2 decimal places'
      : splitMode !== 'equal' && !Number.isFinite(splitSum)
        ? 'Split values use unsupported precision'
        : splitMode === 'percentage'
      ? Math.abs(splitSum - 100) > 0.001
        ? 'Splits must add up to 100%'
        : undefined
      : splitMode === 'exact'
        ? Math.abs(splitSum - numericAmount) > 0.001
          ? 'Exact splits must add up to total amount'
          : undefined
        : undefined;

  const submit = async (): Promise<void> => {
    setError(null);
    const payload = {
      amount: amount.trim(),
      description,
      category,
      date,
      paidBy,
      splitMode,
      splits: members.map((member) => ({
        userId: member.user_id,
        value:
          splitMode === 'equal'
            ? 1
            : (values[member.user_id] || '0').trim(),
      })),
    };
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || payload.description.trim() === '') {
      setError('Amount and description are required');
      return;
    }
    if (helperText) {
      setError(helperText);
      return;
    }
    try {
      await onSubmit(payload);
      onClose();
    } catch (err: unknown) {
      const message =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        err.response &&
        typeof err.response === 'object' &&
        'data' in err.response &&
        err.response.data &&
        typeof err.response.data === 'object' &&
        'error' in err.response.data &&
        typeof (err.response.data as { error: unknown }).error === 'string'
          ? (err.response.data as { error: string }).error
          : err instanceof Error
            ? err.message
            : 'Failed to save expense';
      setError(message);
    }
  };

  return (
    <div className="fixed inset-0 z-[65] bg-black/40 p-4">
      <div className="mx-auto mt-10 max-w-2xl rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">Add Expense</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Amount"
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Description"
            value={description}
            onChange={(event) => {
              const next = event.target.value;
              setDescription(next);
              if (!categoryManual) {
                setCategory(inferCategoryEnumFromDescription(next));
              }
            }}
          />
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <select
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            value={category}
            onChange={(event) => {
              setCategoryManual(true);
              setCategory(event.target.value);
            }}
            aria-label="Expense category"
          >
            <option value="food">food</option>
            <option value="transport">transport</option>
            <option value="housing">housing</option>
            <option value="utilities">utilities</option>
            <option value="entertainment">entertainment</option>
            <option value="travel">travel</option>
            <option value="other">other</option>
          </select>
        </div>
        <div className="mt-4">
          <SplitModeSelector mode={splitMode} onChange={setSplitMode} helperText={helperText} />
        </div>
        {splitMode !== 'equal' && (
          <div className="mt-4 space-y-2">
            {members.map((member) => (
              <div key={member.user_id} className="flex items-center justify-between gap-2">
                <span className="text-sm">{member.display_name}</span>
                <input
                  className="w-32 rounded border border-slate-300 px-2 py-1 text-sm"
                  type="number"
                  step={splitMode === 'percentage' ? '0.0001' : '0.01'}
                  min="0"
                  value={values[member.user_id] ?? '0'}
                  onChange={(event) =>
                    setValues((prev) => ({ ...prev, [member.user_id]: event.target.value }))
                  }
                />
              </div>
            ))}
          </div>
        )}
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-indigo-600 px-3 py-2 text-sm font-semibold text-white"
            onClick={() => void submit()}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Expense'}
          </button>
        </div>
      </div>
    </div>
  );
}
