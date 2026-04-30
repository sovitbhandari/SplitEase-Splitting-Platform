import type { ConnectedAccount } from '../api/plaid';

type Props = {
  accounts: ConnectedAccount[];
};

export function ConnectedAccounts({ accounts }: Props) {
  if (accounts.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
        No connected accounts yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {accounts.map((account) => (
        <div
          key={account.id}
          className="rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm"
        >
          <p className="font-medium text-slate-900">
            {account.name} {account.mask ? `••${account.mask}` : ''}
          </p>
          <p className="mt-1 text-slate-600">
            {account.account_type}
            {account.account_subtype ? ` / ${account.account_subtype}` : ''}
          </p>
          <p className="mt-1 text-slate-700">
            Balance:{' '}
            {account.current_balance
              ? `${account.current_balance} ${account.iso_currency_code ?? ''}`.trim()
              : 'N/A'}
          </p>
        </div>
      ))}
    </div>
  );
}
