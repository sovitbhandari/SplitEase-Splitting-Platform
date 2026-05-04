import { useMemo, useState } from 'react';
import type { Expense } from '../api/expenses';
import type { GroupMember } from '../api/groups';
import { ExpenseActionsMenu } from './ExpenseActionsMenu';
import { formatShortDate } from '../utils/dateFormat';
import {
  formatEqualSplitLabel,
  formatExpenseTitle,
  getExpenseCategoryLabel,
  getExpenseImpactLine,
  getExpenseSharePrecision,
  getEqualShareAmount,
  resolveExpensePresentation,
} from '../utils/expenseDisplay';
import { formatCurrency } from '../utils/financeFormat';

type Props = {
  expenses: Expense[];
  onDeleteExpense: (expense: Expense) => Promise<void>;
  memberCount: number;
  members: GroupMember[];
  currentUserId?: string;
};

export function ExpenseList({
  expenses,
  onDeleteExpense,
  memberCount,
  members,
  currentUserId,
}: Props) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const safeMembers = Math.max(memberCount, 1);

  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const list = expenses.filter((expense) => {
      if (!normalized) {
        return true;
      }
      const presentation = resolveExpensePresentation(expense.category, expense.description);
      const labelLower = presentation.label.toLowerCase();
      return (
        expense.description.toLowerCase().includes(normalized) ||
        expense.paid_by_name.toLowerCase().includes(normalized) ||
        expense.category.toLowerCase().includes(normalized) ||
        labelLower.includes(normalized)
      );
    });
    return [...list].sort((a, b) => {
      const ad = new Date(a.created_at).getTime();
      const bd = new Date(b.created_at).getTime();
      return sort === 'newest' ? bd - ad : ad - bd;
    });
  }, [expenses, search, sort]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Expenses</h3>
      <p className="mt-1 text-sm text-slate-600">
        A clear ledger of what the group spent — with quick actions on each item.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by title, member, or category"
          className="min-w-[220px] flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-inner focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as 'newest' | 'oldest')}
          className="rounded-xl border border-slate-300 bg-white px-2 py-2 text-sm shadow-sm"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      <div className="mt-4 max-h-[28rem] space-y-2 overflow-auto pr-1">
        {filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-600">
            No expenses yet. Add the first shared cost to start tracking balances.
          </p>
        ) : (
          filtered.map((expense) => {
            const total = Number(expense.amount);
            const shareAmount = getEqualShareAmount(total, safeMembers);
            const precision = getExpenseSharePrecision(expense);
            const presentation = resolveExpensePresentation(expense.category, expense.description);
            const impactLine = getExpenseImpactLine(expense, currentUserId, members, safeMembers);
            const showShare = Boolean(currentUserId);

            const sharePrefix =
              precision === 'estimated' ? 'Your share (estimated):' : 'Your share:';

            return (
              <div
                key={expense.id}
                className="group rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/40 px-4 py-3 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <div
                      className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lg shadow-inner ring-1 ring-slate-100"
                      aria-hidden
                    >
                      {presentation.icon}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {formatExpenseTitle(expense.description)}
                        </p>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700 ring-1 ring-slate-200">
                          {getExpenseCategoryLabel(expense.category, expense.description)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">
                        Paid by <span className="font-semibold">{expense.paid_by_name}</span>
                        <span className="text-slate-400"> · </span>
                        {formatEqualSplitLabel(safeMembers)}
                      </p>
                      <p className="text-xs text-slate-500">{formatShortDate(expense.date)}</p>
                      {showShare ? (
                        <p className="text-xs font-medium text-slate-700">
                          {sharePrefix}{' '}
                          <span className="font-semibold text-slate-900">
                            {formatCurrency(shareAmount)}
                          </span>
                        </p>
                      ) : null}
                      {impactLine ? (
                        <p className="text-xs leading-snug text-slate-600">{impactLine}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-start gap-2">
                    <p className="text-lg font-bold tabular-nums text-slate-900">
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
            );
          })
        )}
      </div>
      {actionError && <p className="mt-3 text-sm text-rose-600">{actionError}</p>}

      {selectedExpense && (
        <div className="fixed inset-0 z-30 bg-black/40 p-4">
          <div className="mx-auto mt-16 max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h4 className="text-lg font-semibold text-slate-900">Expense Details</h4>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <p>
                <span className="font-medium text-slate-900">Description:</span>{' '}
                {formatExpenseTitle(selectedExpense.description)}
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
                {formatShortDate(selectedExpense.date)}
              </p>
              <p>
                <span className="font-medium text-slate-900">Category:</span>{' '}
                {getExpenseCategoryLabel(selectedExpense.category, selectedExpense.description)}
              </p>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedExpense(null)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteCandidate && (
        <div className="fixed inset-0 z-30 bg-black/40 p-4">
          <div className="mx-auto mt-20 max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h4 className="text-lg font-semibold text-slate-900">Delete expense?</h4>
            <p className="mt-2 text-sm text-slate-600">
              This will remove{' '}
              <span className="font-semibold text-slate-900">
                {formatExpenseTitle(deleteCandidate.description)}
              </span>{' '}
              and update balances.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-60"
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
