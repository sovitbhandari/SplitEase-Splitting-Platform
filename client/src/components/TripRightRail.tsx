import type { Expense } from '../api/expenses';
import type { GroupMember } from '../api/groups';
import type { ConnectedAccount } from '../api/plaid';
import { ConnectedAccounts } from './ConnectedAccounts';
import { PlaidLinkButton } from './PlaidLinkButton';
import { useBalanceStore } from '../store/balanceStore';
import { formatCurrency, getBalanceLabel } from '../utils/financeFormat';
import { formatExpenseTitle, resolveExpensePresentation } from '../utils/expenseDisplay';
import { getMemberInitials } from '../utils/memberDisplay';
import { formatShortDate } from '../utils/dateFormat';
import { pluralUnit } from '../utils/pluralize';

type SessionActivityLine = {
  id: string;
  label: string;
};

type Props = {
  userSignedBalance: number;
  members: GroupMember[];
  expenses: Expense[];
  accounts: ConnectedAccount[];
  onSettleUp: () => void;
  onAccountsUpdated: (accounts: ConnectedAccount[]) => void;
  sessionActivity?: SessionActivityLine[];
  className?: string;
};

export function TripRightRail({
  userSignedBalance,
  members,
  expenses,
  accounts,
  onSettleUp,
  onAccountsUpdated,
  sessionActivity,
  className,
}: Props) {
  const balances = useBalanceStore((state) => state.balances);

  const absBal = Math.abs(userSignedBalance);
  const hasPersonalBalance = userSignedBalance > 0.009 || userSignedBalance < -0.009;

  const headline =
    userSignedBalance > 0.009
      ? 'You are owed money.'
      : userSignedBalance < -0.009
        ? 'You need to pay.'
        : "You're all settled.";

  const toneClass =
    userSignedBalance > 0.009
      ? 'text-emerald-700'
      : userSignedBalance < -0.009
        ? 'text-rose-700'
        : 'text-slate-700';

  const recent = [...expenses]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 3);

  return (
    <div className={['order-3 space-y-4', className ?? ''].filter(Boolean).join(' ')}>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Your balance
        </h3>
        <p className={`mt-2 text-4xl font-bold tracking-tight ${toneClass}`}>
          {hasPersonalBalance ? formatCurrency(absBal) : formatCurrency(0)}
        </p>
        <p className="mt-2 text-sm text-slate-600">{headline}</p>
        {hasPersonalBalance ? (
          <button
            type="button"
            onClick={onSettleUp}
            className="mt-4 w-full rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            Settle Up
          </button>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Members</h3>
          <span className="text-[11px] font-medium text-slate-400">
            {pluralUnit(members.length, 'member', 'members')}
          </span>
        </div>
        <ul className="mt-3 space-y-4">
          {members.map((member) => {
            const balance = balances[member.user_id];
            const signedAmount =
              !balance || balance.direction === 'settled'
                ? 0
                : balance.direction === 'owed'
                  ? balance.amount
                  : -balance.amount;
            const status = getBalanceLabel(signedAmount);
            const statusColor =
              status.tone === 'neutral'
                ? 'text-slate-500'
                : status.tone === 'positive'
                  ? 'text-emerald-600'
                  : 'text-rose-600';

            return (
              <li key={member.user_id} className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-800">
                  {getMemberInitials(member.display_name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {member.display_name}
                    </p>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium capitalize text-slate-700">
                      {member.role}
                    </span>
                  </div>
                  <p className={`mt-0.5 text-xs font-medium ${statusColor}`}>{status.text}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Recent activity
        </h3>
        {(sessionActivity?.length ?? 0) === 0 && recent.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-slate-200 px-3 py-5 text-center text-sm text-slate-500">
            Activity will appear here after expenses are added.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {(sessionActivity ?? []).map((line) => (
              <li key={line.id} className="flex gap-3 text-sm">
                <span
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-base ring-1 ring-emerald-100"
                  aria-hidden
                >
                  💸
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug text-slate-900">{line.label}</p>
                  <p className="mt-1 text-xs text-slate-500">Just now · this session</p>
                </div>
              </li>
            ))}
            {recent.map((expense) => {
              const presentation = resolveExpensePresentation(
                expense.category,
                expense.description
              );
              return (
                <li key={expense.id} className="flex gap-3 text-sm">
                  <span
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-base ring-1 ring-indigo-100"
                    aria-hidden
                  >
                    {presentation.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug text-slate-900">
                      <span className="font-semibold">{expense.paid_by_name}</span> added{' '}
                      <span>{formatExpenseTitle(expense.description)}</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{formatShortDate(expense.date)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Payment setup
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Connect a sandbox bank account to test settlement payments.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Use sandbox mode to simulate settlements safely.
        </p>
        <div className="mt-3">
          <PlaidLinkButton
            onConnected={onAccountsUpdated}
            aria-label="Connect bank account for sandbox settlements"
          />
        </div>
        {accounts.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No sandbox accounts connected.</p>
        ) : null}
        <div className="mt-3">
          <ConnectedAccounts accounts={accounts} />
        </div>
      </section>
    </div>
  );
}
