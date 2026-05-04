import { Link } from 'react-router-dom';
import type { Group, GroupMember } from '../api/groups';
import { getMemberInitials } from '../utils/memberDisplay';
import { displayTripName } from '../utils/tripDisplay';

type UserChip = {
  display_name: string;
  email: string;
};

type Props = {
  group: Group | null;
  members: GroupMember[];
  user: UserChip | null;
  onCopyInvite: () => void;
  onOpenInviteModal: () => void;
  onOpenSettings: () => void;
  showTripEditHint?: boolean;
  onEditTrip?: () => void;
  className?: string;
};

export function TripLeftSidebar({
  group,
  members,
  user,
  onCopyInvite,
  onOpenInviteModal,
  onOpenSettings,
  showTripEditHint,
  onEditTrip,
  className,
}: Props) {
  const tripTitle = displayTripName(group?.name);

  return (
    <aside
      className={[
        'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-4 xl:h-fit',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Link
        to="/dashboard"
        className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
      >
        ← Back to Dashboard
      </Link>

      <div className="mt-5">
        <div className="flex items-start justify-between gap-2">
          <h1 className="min-w-0 flex-1 text-xl font-bold leading-snug text-slate-900">
            {tripTitle}
          </h1>
          {showTripEditHint && onEditTrip ? (
            <button
              type="button"
              onClick={onEditTrip}
              className="shrink-0 text-xs font-semibold text-indigo-700 hover:text-indigo-600"
            >
              Edit trip
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {group?.description?.trim()
            ? group.description
            : 'Add trip notes, dates, or destination for members.'}
        </p>

        {group ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Invite code
            </p>
            <div className="mt-2 flex items-center gap-2">
              <p
                className="min-w-0 flex-1 truncate font-mono text-xs text-slate-800"
                title={group.invite_code}
              >
                {group.invite_code}
              </p>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(group.invite_code);
                  onCopyInvite();
                }}
                className="shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                aria-label="Copy invite code"
              >
                Copy
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Members</h2>
        <ul className="mt-3 space-y-2">
          {members.map((member) => (
            <li key={member.user_id} className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-800"
                aria-hidden
              >
                {getMemberInitials(member.display_name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{member.display_name}</p>
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium capitalize text-slate-700">
                {member.role}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenInviteModal}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Invite
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Settings
          </button>
        </div>
      </div>

      {user ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700">
          <p className="font-medium text-slate-600">Signed in</p>
          <p className="mt-0.5 truncate font-semibold text-slate-900">{user.display_name}</p>
          <p className="truncate text-slate-600">{user.email}</p>
        </div>
      ) : null}
    </aside>
  );
}
