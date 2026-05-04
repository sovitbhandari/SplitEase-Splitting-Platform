import type { GroupTransferRow } from '../api/paymentTransfers';
import { formatCurrency } from '../utils/financeFormat';
import { formatShortDate } from '../utils/dateFormat';

type Props = {
  transfers: GroupTransferRow[];
};

function methodLabel(method: GroupTransferRow['method']): string {
  return method === 'sandbox_bank' ? 'Sandbox bank' : 'Manual';
}

function statusLabel(status: string): string {
  switch (status) {
    case 'pending_authorization':
      return 'Pending authorization';
    case 'authorized':
      return 'Authorized';
    case 'pending':
      return 'Pending';
    case 'posted':
      return 'Posted';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    case 'returned':
      return 'Returned';
    case 'settled_manually':
      return 'Manual record';
    default:
      return status;
  }
}

export function PaymentHistoryCard({ transfers }: Props) {
  if (transfers.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Payment history</h3>
      <p className="mt-1 text-sm text-slate-600">
        Plaid transfer attempts from this trip (Sandbox when labeled). Manual cash/Venmo recordings are not listed here.
      </p>
      <ul className="mt-4 divide-y divide-slate-100">
        {transfers.map((t) => (
          <li key={t.id} className="py-3 first:pt-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  {t.debtorName} → {t.receiverName}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {methodLabel(t.method)} · {statusLabel(t.status)}
                  {t.settlementApplied ? ' · Applied to balance' : ''}
                </p>
                {t.note ? (
                  <p className="mt-1 text-xs text-slate-500">&ldquo;{t.note}&rdquo;</p>
                ) : null}
              </div>
              <div className="text-right">
                <p className="text-sm font-bold tabular-nums text-slate-900">
                  {formatCurrency(t.amount)}
                </p>
                <p className="text-xs text-slate-500">{formatShortDate(t.createdAt)}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
