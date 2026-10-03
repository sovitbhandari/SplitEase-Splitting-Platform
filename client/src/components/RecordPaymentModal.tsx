import { useEffect, useId, useState } from 'react';
import type { DebtEntry } from '../api/settlements';
import type { PaymentMethodAccount, TransferPreviewResponse } from '../api/paymentTransfers';
import { formatCurrency } from '../utils/financeFormat';
import { formatShortDate } from '../utils/dateFormat';
import { PlaidLinkButton } from './PlaidLinkButton';
import type { ConnectedAccount } from '../api/plaid';

type PaymentMode = 'manual' | 'sandbox';

type Props = {
  debt: DebtEntry;
  tripName: string;
  canRecord: boolean;
  loading?: boolean;
  error?: string | null;
  /** Plaid transfer UX */
  transferFeatureEnabled: boolean;
  sandboxCopy: boolean;
  paymentAccounts: PaymentMethodAccount[];
  paymentContextLoading: boolean;
  hasBlockingPlaidTransfer: boolean;
  onRefreshPaymentContext: () => Promise<void>;
  onPlaidConnected: (accounts: ConnectedAccount[]) => void;
  onPreviewSandbox: (input: {
    fromPlaidAccountId: string;
    amount: number;
  }) => Promise<TransferPreviewResponse>;
  onConfirmSandbox: (input: {
    fromPlaidAccountId: string;
    amount: number;
    note: string;
  }) => Promise<void>;
  onClose: () => void;
  onConfirm: (input: { amount: number; note: string; paymentDate: string }) => Promise<void>;
};

export function RecordPaymentModal({
  debt,
  tripName,
  canRecord,
  loading,
  error,
  transferFeatureEnabled,
  sandboxCopy,
  paymentAccounts,
  paymentContextLoading,
  hasBlockingPlaidTransfer,
  onRefreshPaymentContext,
  onPlaidConnected,
  onPreviewSandbox,
  onConfirmSandbox,
  onClose,
  onConfirm,
}: Props) {
  const modeGroupId = useId();
  const [mode, setMode] = useState<PaymentMode>('manual');
  const [amount, setAmount] = useState(debt.amount.toFixed(2));
  const [note, setNote] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [preview, setPreview] = useState<TransferPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    setAmount(debt.amount.toFixed(2));
    setNote('');
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setMode('manual');
    setSelectedAccountId('');
    setPreview(null);
    setPreviewError(null);
  }, [debt]);

  useEffect(() => {
    if (paymentAccounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(paymentAccounts[0].id);
    }
  }, [paymentAccounts, selectedAccountId]);

  const submitManual = (): void => {
    void (async () => {
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0) {
        return;
      }
      if (n > debt.amount + 0.009) {
        return;
      }
      await onConfirm({
        amount: Math.round(n * 100) / 100,
        note: note.trim(),
        paymentDate,
      });
    })();
  };

  const runPreview = (): void => {
    void (async () => {
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0 || n > debt.amount + 0.009) {
        return;
      }
      if (!selectedAccountId) {
        return;
      }
      setPreviewLoading(true);
      setPreviewError(null);
      setPreview(null);
      try {
        const res = await onPreviewSandbox({ fromPlaidAccountId: selectedAccountId, amount: n });
        setPreview(res);
        if (!res.canTransfer) {
          setPreviewError(res.message);
        }
      } catch (err) {
        setPreviewError(err instanceof Error ? err.message : 'Preview failed');
      } finally {
        setPreviewLoading(false);
      }
    })();
  };

  const submitSandbox = (): void => {
    void (async () => {
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0 || n > debt.amount + 0.009) {
        return;
      }
      if (!selectedAccountId || !preview?.canTransfer) {
        return;
      }
      await onConfirmSandbox({
        fromPlaidAccountId: selectedAccountId,
        amount: Math.round(n * 100) / 100,
        note: note.trim(),
      });
    })();
  };

  const amountInvalid =
    !Number.isFinite(Number(amount)) ||
    Number(amount) <= 0 ||
    Number(amount) > debt.amount + 0.009;

  const manualDisabled = loading || !canRecord || amountInvalid || hasBlockingPlaidTransfer;
  const sandboxGoDisabled =
    loading ||
    !canRecord ||
    amountInvalid ||
    !selectedAccountId ||
    hasBlockingPlaidTransfer ||
    !preview?.canTransfer;

  const transferHelp = !transferFeatureEnabled
    ? 'Sandbox bank payments are not enabled on this server. Use a manual payment to record what happened outside the app.'
    : sandboxCopy
      ? 'This simulates ACH settlement using Plaid Sandbox. No real money is moved.'
      : 'Bank payments are currently in sandbox mode. No real money is moved until your organization enables production transfer access.';

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-3 sm:items-center">
      <div
        className="max-h-[92vh] w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        role="dialog"
        aria-labelledby="record-pay-title"
        aria-modal="true"
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 id="record-pay-title" className="text-lg font-semibold text-slate-900">
            Record payment
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Record a manual payment or start a sandbox bank payment for{' '}
            <span className="font-medium text-slate-900">{tripName}</span>.
          </p>
        </div>
        <div className="max-h-[calc(92vh-160px)] space-y-4 overflow-y-auto px-5 py-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">Debtor → Receiver</p>
            <p className="mt-1 font-semibold text-slate-900">
              {debt.fromUserName} → {debt.toUserName}
            </p>
            <p className="mt-2 text-xs text-slate-600">
              Open balance:{' '}
              <span className="font-semibold text-slate-900">{formatCurrency(debt.amount)}</span>
            </p>
          </div>

          {!canRecord ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Only <span className="font-semibold">{debt.fromUserName}</span> can record this
              payment, since they are the one who owes this balance.
            </p>
          ) : null}

          {hasBlockingPlaidTransfer ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              A sandbox bank payment is already in progress for this settlement. Wait for it to
              finish, or retry after a failed or returned payment.
            </p>
          ) : null}

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-slate-500">Payment method</p>
            <div className="flex flex-wrap gap-3" role="group" aria-labelledby={modeGroupId}>
              <span id={modeGroupId} className="sr-only">
                Choose payment method
              </span>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="pay-mode"
                  checked={mode === 'manual'}
                  onChange={() => {
                    setMode('manual');
                    setPreview(null);
                    setPreviewError(null);
                  }}
                  disabled={loading || !canRecord}
                  className="accent-indigo-600"
                />
                Manual payment
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="pay-mode"
                  checked={mode === 'sandbox'}
                  onChange={() => {
                    setMode('sandbox');
                    setPreview(null);
                    setPreviewError(null);
                  }}
                  disabled={loading || !canRecord || !transferFeatureEnabled}
                  className="accent-indigo-600"
                />
                Sandbox bank payment
              </label>
            </div>
            <p className="text-xs text-slate-600">{transferHelp}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="pay-amt">
              Amount
            </label>
            <input
              id="pay-amt"
              type="number"
              min="0.01"
              step="0.01"
              max={debt.amount}
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setPreview(null);
                setPreviewError(null);
              }}
              disabled={loading || !canRecord}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-inner disabled:bg-slate-100"
            />
            <p className="mt-1 text-xs text-slate-500">
              Maximum {formatCurrency(debt.amount)} for this settlement line.
            </p>
          </div>

          {mode === 'manual' ? (
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="pay-date">
                Payment date
              </label>
              <input
                id="pay-date"
                type="date"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
                disabled={loading || !canRecord}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-inner disabled:bg-slate-100"
              />
              <p className="mt-1 text-xs text-slate-500">
                Shown on your settlement history ({formatShortDate(paymentDate)}).
              </p>
            </div>
          ) : null}

          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="pay-note">
              Note <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              id="pay-note"
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={
                mode === 'sandbox'
                  ? 'Optional note for this sandbox transfer…'
                  : 'e.g. Cash, Venmo, paid at dinner…'
              }
              disabled={loading || !canRecord}
              className="mt-1 w-full resize-y rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-inner disabled:bg-slate-100"
            />
          </div>

          {mode === 'sandbox' && transferFeatureEnabled ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-800">Linked sandbox bank account</p>
              {paymentContextLoading ? (
                <p className="mt-2 text-xs text-slate-600">Loading accounts…</p>
              ) : paymentAccounts.length === 0 ? (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-slate-600">
                    Connect a sandbox bank account to test bank payments.
                  </p>
                  <PlaidLinkButton
                    onConnected={(acct) => {
                      onPlaidConnected(acct);
                      void onRefreshPaymentContext();
                    }}
                    aria-label="Connect sandbox bank account"
                  />
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  <label className="block text-xs font-medium text-slate-700" htmlFor="pay-acct">
                    Account
                  </label>
                  <select
                    id="pay-acct"
                    value={selectedAccountId}
                    onChange={(e) => {
                      setSelectedAccountId(e.target.value);
                      setPreview(null);
                      setPreviewError(null);
                    }}
                    disabled={loading || !canRecord}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
                  >
                    {paymentAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.accountName} ·•••{a.mask ?? '****'} ({a.institutionName})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-800 hover:bg-indigo-50 disabled:opacity-50"
                    onClick={() => runPreview()}
                    disabled={
                      loading || !canRecord || amountInvalid || !selectedAccountId || previewLoading
                    }
                  >
                    {previewLoading ? 'Checking…' : 'Preview sandbox payment'}
                  </button>
                  {preview?.canTransfer ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-2 text-xs text-emerald-900">
                      <p>{preview.message}</p>
                      {preview.estimatedTimeline ? (
                        <p className="mt-1 text-emerald-800">{preview.estimatedTimeline}</p>
                      ) : null}
                    </div>
                  ) : null}
                  {previewError ? (
                    <p className="text-xs text-rose-600">{previewError}</p>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}

          {mode === 'sandbox' && !transferFeatureEnabled ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              Use manual payment to record settlement. Bank transfers require enabling Plaid Transfer
              in this environment.
            </p>
          ) : null}

          {error ? (
            <p
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          {mode === 'manual' ? (
            <button
              type="button"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              onClick={() => submitManual()}
              disabled={manualDisabled}
              aria-busy={loading}
            >
              {loading ? 'Recording…' : 'Record manual payment'}
            </button>
          ) : (
            <button
              type="button"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              onClick={() => submitSandbox()}
              disabled={sandboxGoDisabled || previewLoading}
              aria-busy={loading}
            >
              {loading ? 'Starting…' : 'Start sandbox bank payment'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
