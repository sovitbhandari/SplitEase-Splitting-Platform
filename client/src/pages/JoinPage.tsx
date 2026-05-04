import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { joinGroup } from '../api/groups';

export function JoinPage() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (!inviteCode?.trim()) {
        navigate('/dashboard', { replace: true });
        return;
      }
      try {
        const group = await joinGroup(inviteCode.trim());
        navigate(`/groups/${group.id}`, { replace: true });
      } catch {
        setError(
          'Could not join with this invite. Check the code with your trip admin or sign in with the right account.'
        );
      }
    })();
  }, [inviteCode, navigate]);

  if (error) {
    return (
      <div className="mx-auto flex min-h-[40vh] max-w-md flex-col justify-center px-4 py-12">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-900">
          <p className="font-semibold">Unable to join trip</p>
          <p className="mt-2">{error}</p>
          <button
            type="button"
            className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            onClick={() => navigate('/dashboard')}
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[40vh] max-w-md flex-col items-center justify-center px-4 py-12 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
      <p className="mt-4 text-sm text-slate-600">Joining trip…</p>
    </div>
  );
}
