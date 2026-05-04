import { useEffect, useState } from 'react';
import type { DebtEntry } from '../api/settlements';
import { formatCurrency } from '../utils/financeFormat';

type Props = {
  debt: DebtEntry;
  tripName: string;
  onClose: () => void;
  onCopyMessage: () => void;
};

export function SendReminderModal({ debt, tripName, onClose, onCopyMessage }: Props) {
  const defaultMsg = `Hey ${debt.fromUserName}, can you settle ${formatCurrency(debt.amount)} for ${tripName} when you get a chance?`;
  const [message, setMessage] = useState(defaultMsg);

  useEffect(() => {
    setMessage(
      `Hey ${debt.fromUserName}, can you settle ${formatCurrency(debt.amount)} for ${tripName} when you get a chance?`
    );
  }, [debt, tripName]);

  const copy = (): void => {
    void navigator.clipboard.writeText(message);
    onCopyMessage();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-3 sm:items-center">
      <div
        className="max-h-[90vh] w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        role="dialog"
        aria-labelledby="reminder-title"
        aria-modal="true"
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 id="reminder-title" className="text-lg font-semibold text-slate-900">
            Send reminder
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Remind <span className="font-semibold">{debt.fromUserName}</span> to pay{' '}
            <span className="font-semibold">{debt.toUserName}</span>{' '}
            {formatCurrency(debt.amount)}.
          </p>
        </div>
        <div className="max-h-[calc(90vh-140px)] space-y-3 overflow-y-auto px-5 py-4">
          <label className="block text-sm font-medium text-slate-700" htmlFor="rem-text">
            Message
          </label>
          <textarea
            id="rem-text"
            rows={5}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="w-full resize-y rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-inner"
          />
          <p className="text-xs text-slate-500">
            Copy and paste into text, email, or any app. Real push notifications are not wired yet.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            onClick={copy}
            aria-label="Copy reminder message"
          >
            Copy message
          </button>
          <button
            type="button"
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
