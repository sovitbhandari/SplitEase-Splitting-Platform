import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/axios';
import { abortBootstrapAuth } from '../auth/bootstrap';
import { createGroup, getGroups, joinGroup, type Group } from '../api/groups';
import { GroupCard } from '../components/GroupCard';
import { useAuthStore } from '../store/authStore';

export function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [groups, setGroups] = useState<Group[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    currency: 'USD',
  });
  const [inviteCode, setInviteCode] = useState('');

  const handleLogout = async (): Promise<void> => {
    abortBootstrapAuth();
    try {
      await api.post('/api/auth/logout');
    } catch {
      // still clear local session
    }
    clearAuth();
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        const data = await getGroups();
        setGroups(data);
      } catch {
        setError('Failed to load groups');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleCreate = async (): Promise<void> => {
    setError(null);
    try {
      const newGroup = await createGroup(createForm);
      setGroups((prev) => [newGroup, ...prev]);
      setCreateOpen(false);
      setCreateForm({ name: '', description: '', currency: 'USD' });
    } catch {
      setError('Failed to create group');
    }
  };

  const handleJoin = async (): Promise<void> => {
    setError(null);
    try {
      const joined = await joinGroup(inviteCode);
      setGroups((prev) => {
        if (prev.some((group) => group.id === joined.id)) {
          return prev;
        }
        return [joined, ...prev];
      });
      setJoinOpen(false);
      setInviteCode('');
    } catch {
      setError('Failed to join group');
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-lg text-slate-800">
              Hello <span className="font-semibold">{user?.display_name ?? 'there'}</span>
            </p>
            <p className="mt-1 text-sm text-slate-600">{user?.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setJoinOpen(true)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Join Group
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Create Group
            </button>
          </div>
        </div>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <p className="text-sm text-slate-500">Loading groups...</p>
          ) : groups.length === 0 ? (
            <p className="text-sm text-slate-500">No groups yet. Create or join one.</p>
          ) : (
            groups.map((group) => <GroupCard key={group.id} group={group} />)
          )}
        </div>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="mt-8 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Log out
        </button>
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-10 bg-black/40 p-4">
          <div className="mx-auto mt-20 max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Create group</h2>
            <div className="mt-4 space-y-3">
              <input
                placeholder="Group name"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={createForm.name}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, name: event.target.value }))
                }
              />
              <textarea
                placeholder="Description"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={createForm.description}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, description: event.target.value }))
                }
              />
              <input
                maxLength={3}
                placeholder="Currency (USD)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase"
                value={createForm.currency}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, currency: event.target.value }))
                }
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white"
                onClick={() => void handleCreate()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {joinOpen && (
        <div className="fixed inset-0 z-10 bg-black/40 p-4">
          <div className="mx-auto mt-20 max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Join with invite code</h2>
            <input
              placeholder="Invite code UUID"
              className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                onClick={() => setJoinOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white"
                onClick={() => void handleJoin()}
              >
                Join
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
