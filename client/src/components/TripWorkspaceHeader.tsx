import { formatCurrency } from '../utils/financeFormat';
import { pluralUnit } from '../utils/pluralize';

type Props = {
  tripName: string;
  dateRangeLabel?: string | null;
  membersCount: number;
  expenseCount: number;
  openDebtsCount: number;
  userSignedBalance: number;
  onSettleUp: () => void;
  onAddExpense: () => void;
  showEditTrip?: boolean;
  onEditTrip?: () => void;
  /** Show Settle Up when others still owe in the group even if you’re personally settled. */
  showGroupSettlementCta?: boolean;
};

export function TripWorkspaceHeader({
  tripName,
  dateRangeLabel,
  membersCount,
  expenseCount,
  openDebtsCount,
  userSignedBalance,
  onSettleUp,
  onAddExpense,
  showEditTrip,
  onEditTrip,
  showGroupSettlementCta,
}: Props) {
  const hasPersonalBalance =
    userSignedBalance > 0.009 || userSignedBalance < -0.009;

  const showSettleCta = hasPersonalBalance || Boolean(showGroupSettlementCta && openDebtsCount > 0);

  const balanceLine =
    userSignedBalance > 0.009
      ? `You are owed ${formatCurrency(userSignedBalance)}`
      : userSignedBalance < -0.009
        ? `You owe ${formatCurrency(Math.abs(userSignedBalance))}`
        : 'You are settled up';

  const metaParts: string[] = [];
  if (dateRangeLabel) {
    metaParts.push(dateRangeLabel);
  }
  metaParts.push(pluralUnit(membersCount, 'member', 'members'));
  metaParts.push(pluralUnit(expenseCount, 'expense', 'expenses'));
  metaParts.push(pluralUnit(openDebtsCount, 'open debt', 'open debts'));

  return (
    <header className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-indigo-50/60 p-5 shadow-sm ring-1 ring-slate-100">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
            Trip workspace
          </p>
          <div className="flex min-w-0 items-start gap-2">
            <h1 className="min-w-0 flex-1 truncate text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {tripName}
            </h1>
            {showEditTrip && onEditTrip ? (
              <button
                type="button"
                onClick={onEditTrip}
                className="mt-1 shrink-0 rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 shadow-sm hover:bg-slate-50"
                aria-label="Edit trip name and description"
                title="Edit trip"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="h-5 w-5"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                  />
                </svg>
              </button>
            ) : null}
          </div>
          <p className="text-sm text-slate-600">{metaParts.join(' · ')}</p>
          <p
            className={`text-sm font-semibold ${
              userSignedBalance > 0.009
                ? 'text-emerald-700'
                : userSignedBalance < -0.009
                  ? 'text-rose-700'
                  : 'text-slate-700'
            }`}
          >
            {balanceLine}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
          <button
            type="button"
            onClick={onAddExpense}
            aria-label="Add expense"
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Add Expense
          </button>
          {showSettleCta ? (
            <button
              type="button"
              onClick={onSettleUp}
              aria-label="Settle up — scroll to settlement plan"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
            >
              Settle Up
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
