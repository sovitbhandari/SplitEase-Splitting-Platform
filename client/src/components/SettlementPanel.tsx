import { useMemo, useState } from 'react';
import type { GroupTransferRow } from '../api/paymentTransfers';
import type { DebtEntry } from '../api/settlements';
import { buildSettlementKey } from '../utils/settlementKey';
import { latestTransferForSettlementKey, sandboxTransferBadgeLabel } from '../utils/transferDisplay';
import { pluralUnit } from '../utils/pluralize';
import { formatCurrency } from '../utils/financeFormat';

type Props = {
  currentUserId: string;
  debts: DebtEntry[];
  groupTransfers: GroupTransferRow[];
  interactionLocked?: boolean;
  onRecordPayment: (debt: DebtEntry) => void;
  onSendReminder: (debt: DebtEntry) => void;
  onViewBreakdown: (debt: DebtEntry) => void;
};

const btnPrimary =
  'rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60';
const btnSecondary =
  'rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-60';

const INITIAL_VISIBLE = 3;

export function SettlementPanel({
  currentUserId,
  debts,
  groupTransfers,
  interactionLocked,
  onRecordPayment,
  onSendReminder,
  onViewBreakdown,
}: Props) {
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myDebts = debts.filter((item) => item.fromUserId === currentUserId);
  const owedToMe = debts.filter((item) => item.toUserId === currentUserId);
  const otherDebts = debts.filter(
    (item) => item.fromUserId !== currentUserId && item.toUserId !== currentUserId
  );
  const orderedDebts = [...myDebts, ...owedToMe, ...otherDebts];

  const visibleDebts = useMemo(() => {
    if (showAll || orderedDebts.length <= INITIAL_VISIBLE) {
      return orderedDebts;
    }
    return orderedDebts.slice(0, INITIAL_VISIBLE);
  }, [orderedDebts, showAll]);

  const summaryLine =
    debts.length === 0
      ? 'Everyone is settled up.'
      : `${debts.length} ${pluralUnit(debts.length, 'payment', 'payments')} can settle this group.`;

  return (
    <section
      id="settlement-plan"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-slate-900">Settlement plan</h3>
        <span className="text-xs font-medium text-slate-500">
          {debts.length === 0
            ? 'No open debts'
            : pluralUnit(debts.length, 'open debt', 'open debts')}
        </span>
      </div>
      <p
        className={`mt-2 text-sm font-medium ${
          debts.length === 0 ? 'text-emerald-800' : 'text-slate-700'
        }`}
      >
        {summaryLine}
      </p>
      <p className="mt-1 text-sm text-slate-600">
        Pay down these balances to keep the trip fair and easy to follow.
      </p>
      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

      <div className="mt-4 space-y-4">
        {orderedDebts.length === 0 ? (
          <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
            Everyone is settled up.
          </p>
        ) : (
          visibleDebts.map((debt) => {
            const toneClass =
              debt.fromUserId === currentUserId
                ? 'border-rose-100 bg-rose-50/70'
                : debt.toUserId === currentUserId
                  ? 'border-emerald-100 bg-emerald-50/70'
                  : 'border-slate-200 bg-slate-50';

            const settlementKey = buildSettlementKey(debt.fromUserId, debt.toUserId);
            const latestTr = latestTransferForSettlementKey(groupTransfers, settlementKey);
            const badge = sandboxTransferBadgeLabel(latestTr);

            return (
              <div
                key={`${debt.fromUserId}-${debt.toUserId}`}
                className={`rounded-2xl border p-4 shadow-sm ${toneClass}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Debtor → Receiver
                    </p>
                    <p className="text-sm font-semibold text-slate-900">
                      <span className="font-semibold">{debt.fromUserName}</span>
                      <span className="px-1 text-slate-400">→</span>
                      <span className="font-semibold">{debt.toUserName}</span>
                    </p>
                    {badge ? (
                      <span className="inline-block rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-900">
                        {badge}
                      </span>
                    ) : null}
                    <p className="text-xs text-slate-600">
                      Suggested payment to clear this balance.
                    </p>
                  </div>
                  <p className="text-2xl font-bold tabular-nums text-slate-900">
                    {formatCurrency(debt.amount)}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={interactionLocked}
                    onClick={() => {
                      setError(null);
                      onRecordPayment(debt);
                    }}
                    aria-label={`Record payment from ${debt.fromUserName} to ${debt.toUserName}`}
                  >
                    Record payment
                  </button>
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={interactionLocked}
                    onClick={() => onSendReminder(debt)}
                    aria-label={`Send reminder to ${debt.fromUserName}`}
                  >
                    Send reminder
                  </button>
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={interactionLocked}
                    onClick={() => onViewBreakdown(debt)}
                    aria-label="View settlement breakdown"
                  >
                    View breakdown
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {orderedDebts.length > INITIAL_VISIBLE ? (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            className="text-sm font-semibold text-indigo-700 hover:text-indigo-600"
            onClick={() => setShowAll((prev) => !prev)}
          >
            {showAll ? 'Show fewer' : 'Show all settlements'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
