import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginFormSchema, type LoginFormValues } from '../schemas/authForms';
import { api } from '../api/axios';
import { abortBootstrapAuth } from '../auth/bootstrap';
import { useAuthStore, type AuthUser } from '../store/authStore';

type LoginResponse = { user: AuthUser; accessToken: string };

export function LoginPage() {
  const navigate = useNavigate();
  const bootstrapping = useAuthStore((s) => s.bootstrapping);
  const accessToken = useAuthStore((s) => s.accessToken);
  const setAuth = useAuthStore((s) => s.setAuth);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginFormValues): Promise<void> => {
    abortBootstrapAuth();
    try {
      const { data } = await api.post<LoginResponse>('/api/auth/login', {
        email: values.email,
        password: values.password,
      });
      setAuth(data.user, data.accessToken);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const message =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        err.response &&
        typeof err.response === 'object' &&
        'data' in err.response &&
        err.response.data &&
        typeof err.response.data === 'object' &&
        'error' in err.response.data &&
        typeof (err.response.data as { error: unknown }).error === 'string'
          ? (err.response.data as { error: string }).error
          : 'Unable to sign in';
      setError('root', { message });
    }
  };

  useEffect(() => {
    if (!bootstrapping && accessToken) {
      navigate('/dashboard', { replace: true });
    }
  }, [accessToken, bootstrapping, navigate]);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Sign in</h1>
        <p className="mt-1 text-sm text-slate-600">
          New here?{' '}
          <Link className="font-medium text-indigo-600 hover:text-indigo-500" to="/register">
            Create an account
          </Link>
        </p>
        <form className="mt-8 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-indigo-500 focus:border-indigo-500 focus:ring-2"
              {...register('email')}
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-indigo-500 focus:border-indigo-500 focus:ring-2"
              {...register('password')}
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>
          {errors.root && (
            <p className="text-sm text-red-600">{errors.root.message}</p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-500 disabled:opacity-60"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
