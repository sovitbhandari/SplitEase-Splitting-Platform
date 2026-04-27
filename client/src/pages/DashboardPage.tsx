import { useNavigate } from 'react-router-dom';
import { api } from '../api/axios';
import { useAuthStore } from '../store/authStore';

export function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const handleLogout = async (): Promise<void> => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // still clear local session
    }
    clearAuth();
    navigate('/login', { replace: true });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-lg text-slate-800">
          Hello <span className="font-semibold">{user?.display_name ?? 'there'}</span>
        </p>
        <p className="mt-1 text-sm text-slate-600">{user?.email}</p>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="mt-6 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
