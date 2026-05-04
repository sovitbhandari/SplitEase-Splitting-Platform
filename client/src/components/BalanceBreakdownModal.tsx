import { useEffect } from 'react';
import type { DebtEntry } from '../api/settlements';
import type { Expense } from '../api/expenses';
import {
  formatEqualSplitLabel,
  formatExpenseTitle,
  getDebtExpenseContextLine,
  getEqualShareAmount,
  getExpenseCategoryLabel,
  resolveExpensePresentation,
} from '../utils/expenseDisplay';
import { formatCurrency } from '../utils/financeFormat';
import { formatShortDate } from '../utils/dateFormat';

type Props = {
  debt: DebtEntry | null;
  expenses: Expense[];
  memberCount: number;
  onClose: () => void;
};

export function BalanceBreakdownModal({
  debt,
  expenses,
  memberCount,
  onClose,
}: Props) {
  useEffect(() => {
    if (!debt) {
      return;
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [debt, onClose]);

  if (!debt) {
    return null;
  }

  const safeMembers = Math.max(memberCount, 1);
  const related = expenses
    .filter((expense) => expense.paid_by === debt.fromUserId || expense.paid_by === debt.toUserId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const rows = related.length > 0 ? related : [...expenses].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-3 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="balance-breakdown-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="balance-breakdown-title" className="text-lg font-semibold text-slate-900">
              Settlement breakdown
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{debt.fromUserName}</span> owes{' '}
              <span className="font-semibold text-slate-900">{debt.toUserName}</span>{' '}
              <span className="font-semibold text-slate-900">{formatCurrency(debt.amount)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="max-h-[calc(90vh-140px)] overflow-y-auto px-5 py-4">
          {related.length === 0 && expenses.length > 0 ? (
            <p className="mb-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              No expenses paid directly by these members were found. Showing recent group expenses for
              context.
            </p>
          ) : null}

          <ul className="space-y-3">
            {rows.map((expense) => {
              const total = Number(expense.amount);
              const userShare = getEqualShareAmount(total, safeMembers);
              const presentation = resolveExpensePresentation(expense.category, expense.description);
              const contextLine = getDebtExpenseContextLine(expense, debt, safeMembers);
              return (
                <li
                  key={expense.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 gap-2">
                      <span className="text-lg leading-none" aria-hidden>
                        {presentation.icon}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">
                          {formatExpenseTitle(expense.description)}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-600">
                          Paid by {expense.paid_by_name}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums text-slate-900">
                      {formatCurrency(expense.amount)}
                    </span>
                  </div>
                  <dl className="mt-3 grid gap-1.5 text-xs text-slate-600">
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Split method</dt>
                      <dd className="text-right font-medium text-slate-800">
                        {formatEqualSplitLabel(safeMembers)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Category</dt>
                      <dd className="text-right font-medium text-slate-800">
                        {getExpenseCategoryLabel(expense.category, expense.description)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Per-person share</dt>
                      <dd className="text-right font-semibold tabular-nums text-slate-900">
                        {formatCurrency(userShare)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2 border-t border-slate-200/80 pt-2">
                      <dt className="sr-only">How this ties to the settlement</dt>
                      <dd className="text-[11px] leading-snug text-slate-600">{contextLine}</dd>
                    </div>
                  </dl>
                  <div className="mt-2 text-[11px] text-slate-500">{formatShortDate(expense.date)}</div>
                </li>
              );
            })}
          </ul>

          {rows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
              No expenses yet. Activity will appear here once expenses are added.
            </p>
          ) : null}

          <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-900">Final amount owed</span>
              <span className="text-base font-bold tabular-nums text-slate-900">
                {formatCurrency(debt.amount)}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Line items use an equal split across current group members (display only). Custom
              splits are not shown on this list yet.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
