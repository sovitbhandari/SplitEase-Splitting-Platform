import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import {
  registerFormSchema,
  type RegisterFormValues,
} from '../schemas/authForms';
import { api } from '../api/axios';
import { useAuthStore, type AuthUser } from '../store/authStore';

type RegisterResponse = { user: AuthUser; accessToken: string };

export function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      display_name: '',
      email: '',
      password: '',
      confirm_password: '',
    },
  });

  const onSubmit = async (values: RegisterFormValues): Promise<void> => {
    try {
      const { data } = await api.post<RegisterResponse>('/api/auth/register', {
        display_name: values.display_name,
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
          : 'Unable to register';
      setError('root', { message });
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Create account</h1>
        <p className="mt-1 text-sm text-slate-600">
          Already have an account?{' '}
          <Link className="font-medium text-indigo-600 hover:text-indigo-500" to="/login">
            Sign in
          </Link>
        </p>
        <form className="mt-8 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="display_name">
              Display name
            </label>
            <input
              id="display_name"
              type="text"
              autoComplete="name"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-indigo-500 focus:border-indigo-500 focus:ring-2"
              {...register('display_name')}
            />
            {errors.display_name && (
              <p className="mt-1 text-sm text-red-600">{errors.display_name.message}</p>
            )}
          </div>
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
              autoComplete="new-password"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-indigo-500 focus:border-indigo-500 focus:ring-2"
              {...register('password')}
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>
          <div>
            <label
              className="block text-sm font-medium text-slate-700"
              htmlFor="confirm_password"
            >
              Confirm password
            </label>
            <input
              id="confirm_password"
              type="password"
              autoComplete="new-password"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-indigo-500 focus:border-indigo-500 focus:ring-2"
              {...register('confirm_password')}
            />
            {errors.confirm_password && (
              <p className="mt-1 text-sm text-red-600">{errors.confirm_password.message}</p>
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
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
