import type { GroupMember } from '../api/groups';
import { useBalanceStore } from '../store/balanceStore';
import { getBalanceLabel } from '../utils/financeFormat';
import { getMemberInitials } from '../utils/memberDisplay';

type Props = {
  members: GroupMember[];
};

export function BalancePanel({ members }: Props) {
  const balances = useBalanceStore((state) => state.balances);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Member Balances</h3>
      <p className="mt-1 text-sm text-slate-600">
        A quick read on who is owed money after expenses and recorded settlements.
      </p>
      <ul className="mt-4 space-y-3 text-sm">
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
              className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-800 shadow-inner ring-1 ring-slate-100">
                {getMemberInitials(member.display_name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{member.display_name}</p>
                  <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold capitalize text-slate-700 ring-1 ring-slate-200">
                    {member.role}
                  </span>
                </div>
                <p className={`mt-0.5 text-xs font-medium ${color}`}>{status.text}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
