import { useMemo } from 'react';

type Props = {
  inviteCode: string;
  tripName: string;
  onClose: () => void;
  onCopyCode: () => void;
  onCopyLink: () => void;
};

export function InviteMembersModal({
  inviteCode,
  tripName,
  onClose,
  onCopyCode,
  onCopyLink,
}: Props) {
  const inviteLink = useMemo(
    () => `${window.location.origin}/join/${inviteCode}`,
    [inviteCode]
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-3 sm:items-center">
      <div
        className="max-h-[90vh] w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        role="dialog"
        aria-labelledby="invite-modal-title"
        aria-modal="true"
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 id="invite-modal-title" className="text-lg font-semibold text-slate-900">
            Invite members
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Share this invite code or link with friends so they can join{' '}
            <span className="font-medium text-slate-800">{tripName}</span>.
          </p>
        </div>
        <div className="max-h-[calc(90vh-88px)] overflow-y-auto px-5 py-4">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Invite code
          </label>
          <div className="mt-2 flex gap-2">
            <input
              readOnly
              value={inviteCode}
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900"
              aria-label="Invite code"
            />
            <button
              type="button"
              className="shrink-0 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
              onClick={() => {
                void navigator.clipboard.writeText(inviteCode);
                onCopyCode();
              }}
              aria-label="Copy invite code"
            >
              Copy code
            </button>
          </div>

          <label className="mt-6 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Invite link
          </label>
          <p className="mt-1 text-xs text-slate-500">
            Anyone with this link can join after signing in (invite code is included in the URL).
          </p>
          <div className="mt-2 flex gap-2">
            <input
              readOnly
              value={inviteLink}
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800"
              aria-label="Invite link"
            />
            <button
              type="button"
              className="shrink-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              onClick={() => {
                void navigator.clipboard.writeText(inviteLink);
                onCopyLink();
              }}
              aria-label="Copy invite link"
            >
              Copy link
            </button>
          </div>
        </div>
        <div className="flex justify-end border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
