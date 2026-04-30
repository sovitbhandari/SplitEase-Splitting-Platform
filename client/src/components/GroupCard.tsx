import { Link } from 'react-router-dom';
import type { Group } from '../api/groups';

type Props = {
  group: Group;
};

export function GroupCard({ group }: Props) {
  return (
    <Link
      to={`/groups/${group.id}`}
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow"
    >
      <h3 className="text-base font-semibold text-slate-900">{group.name}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-slate-600">
        {group.description || 'No description yet'}
      </p>
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span>{group.member_count} members</span>
        <span>{group.currency}</span>
      </div>
      <p className="mt-2 text-xs text-slate-400">Invite: {group.invite_code}</p>
    </Link>
  );
}
