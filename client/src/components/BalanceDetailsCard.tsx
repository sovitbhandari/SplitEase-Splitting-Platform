import { formatCurrency } from '../utils/financeFormat';

type Props = {
  totalGroupExpenses: number;
  youPaid: number;
  yourShareEstimate: number;
  netBalance: number;
};

export function BalanceDetailsCard({
  totalGroupExpenses,
  youPaid,
  yourShareEstimate,
  netBalance,
}: Props) {
  const netPositive = netBalance > 0.009;
  const netNegative = netBalance < -0.009;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Balance details
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        Snapshot using equal-split estimates for “your share” when per-expense splits are not
        loaded.
      </p>
      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-slate-600">Total group expenses</dt>
          <dd className="font-semibold tabular-nums text-slate-900">
            {formatCurrency(totalGroupExpenses)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-slate-600">You paid</dt>
          <dd className="font-semibold tabular-nums text-slate-900">{formatCurrency(youPaid)}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-slate-600">Your share (equal split)</dt>
          <dd className="font-semibold tabular-nums text-slate-900">
            {formatCurrency(yourShareEstimate)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <dt className="font-medium text-slate-800">Net balance</dt>
          <dd
            className={`font-bold tabular-nums ${
              netPositive ? 'text-emerald-700' : netNegative ? 'text-rose-700' : 'text-slate-700'
            }`}
          >
            {netPositive ? '+' : ''}
            {formatCurrency(netBalance)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
