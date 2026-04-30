import { useMemo, useState } from 'react';
import type { Expense } from '../api/expenses';
import { ExpenseActionsMenu } from './ExpenseActionsMenu';
import { formatCurrency } from '../utils/financeFormat';

type Props = {
  expenses: Expense[];
  onDeleteExpense: (expense: Expense) => Promise<void>;
};

export function ExpenseList({ expenses, onDeleteExpense }: Props) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const list = expenses.filter((expense) => {
      if (!normalized) {
        return true;
      }
      return (
        expense.description.toLowerCase().includes(normalized) ||
        expense.paid_by_name.toLowerCase().includes(normalized) ||
        expense.category.toLowerCase().includes(normalized)
      );
    });
    return [...list].sort((a, b) => {
      const ad = new Date(a.created_at).getTime();
      const bd = new Date(b.created_at).getTime();
      return sort === 'newest' ? bd - ad : ad - bd;
    });
  }, [expenses, search, sort]);

  const categoryIcon: Record<string, string> = {
    food: '🍽️',
    transport: '🚕',
    housing: '🏠',
    utilities: '💡',
    entertainment: '🎉',
    travel: '✈️',
    other: '🧾',
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Expenses</h3>
      <p className="mt-1 text-xs text-slate-500">
        Scan recent expenses and who paid for what.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by title, member, or category"
          className="min-w-[220px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as 'newest' | 'oldest')}
          className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      <div className="mt-4 max-h-96 space-y-2 overflow-auto pr-2">
        {filtered.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
            No expenses yet. Add your first shared expense.
          </p>
        ) : (
          filtered.map((expense) => (
            <div
              key={expense.id}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {categoryIcon[expense.category] ?? '🧾'} {expense.description}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {expense.paid_by_name} paid {formatCurrency(expense.amount)} · split with
                    group members
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {new Date(expense.date).toLocaleDateString()} · {expense.category}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {formatCurrency(expense.amount)}
                  </p>
                  <ExpenseActionsMenu
                    onView={() => {
                      setActionError(null);
                      setSelectedExpense(expense);
                    }}
                    onDelete={() => {
                      setActionError(null);
                      setDeleteCandidate(expense);
                    }}
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      {actionError && <p className="mt-3 text-sm text-rose-600">{actionError}</p>}

      {selectedExpense && (
        <div className="fixed inset-0 z-30 bg-black/40 p-4">
          <div className="mx-auto mt-16 max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h4 className="text-lg font-semibold text-slate-900">Expense Details</h4>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <p>
                <span className="font-medium text-slate-900">Description:</span>{' '}
                {selectedExpense.description}
              </p>
              <p>
                <span className="font-medium text-slate-900">Amount:</span>{' '}
                {formatCurrency(selectedExpense.amount)}
              </p>
              <p>
                <span className="font-medium text-slate-900">Paid by:</span>{' '}
                {selectedExpense.paid_by_name}
              </p>
              <p>
                <span className="font-medium text-slate-900">Date:</span>{' '}
                {new Date(selectedExpense.date).toLocaleDateString()}
              </p>
              <p>
                <span className="font-medium text-slate-900">Category:</span>{' '}
                {selectedExpense.category}
              </p>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedExpense(null)}
                className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteCandidate && (
        <div className="fixed inset-0 z-30 bg-black/40 p-4">
          <div className="mx-auto mt-20 max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h4 className="text-lg font-semibold text-slate-900">Delete expense?</h4>
            <p className="mt-2 text-sm text-slate-600">
              This will remove{' '}
              <span className="font-semibold text-slate-900">{deleteCandidate.description}</span>{' '}
              and update balances.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                disabled={deleting}
                onClick={() =>
                  void (async () => {
                    if (!deleteCandidate) {
                      return;
                    }
                    setDeleting(true);
                    setActionError(null);
                    try {
                      await onDeleteExpense(deleteCandidate);
                      setDeleteCandidate(null);
                    } catch {
                      setActionError('Failed to delete expense. Please try again.');
                    } finally {
                      setDeleting(false);
                    }
                  })()
                }
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
