import { Link, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export function HomePage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (accessToken) {
    return <Navigate to="/dashboard" replace />;
  }
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-6 px-4 text-center">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">SplitEase</h1>
        <p className="mt-2 text-slate-600">Group expense splitting, simplified.</p>
      </div>
      <div className="flex gap-3">
        <Link
          to="/login"
          className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          Sign in
        </Link>
        <Link
          to="/register"
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-500"
        >
          Create account
        </Link>
      </div>
    </div>
  );
}
