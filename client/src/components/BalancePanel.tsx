import type { GroupMember } from '../api/groups';
import { useBalanceStore } from '../store/balanceStore';
import { getBalanceLabel } from '../utils/financeFormat';

type Props = {
  members: GroupMember[];
};

export function BalancePanel({ members }: Props) {
  const balances = useBalanceStore((state) => state.balances);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Member Balances</h3>
      <p className="mt-1 text-xs text-slate-500">
        Positive means this person should receive money. Negative means this person needs
        to pay.
      </p>
      <ul className="mt-4 space-y-2 text-sm">
        {members.map((member) => {
          const balance = balances[member.user_id];
          const signedAmount =
            !balance || balance.direction === 'settled'
              ? 0
              : balance.direction === 'owed'
                ? balance.amount
                : -balance.amount;
          const status = getBalanceLabel(signedAmount);
          const color =
            status.tone === 'neutral'
              ? 'text-slate-500'
              : status.tone === 'positive'
                ? 'text-emerald-600'
                : 'text-rose-600';

          return (
            <li
              key={member.user_id}
              className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
            >
              <div>
                <p className="font-medium text-slate-900">{member.display_name}</p>
                <p className={`text-xs ${color}`}>{status.text}</p>
              </div>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {member.role}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
