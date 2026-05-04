import axios from 'axios';
import { useAuthStore, type AuthUser } from '../store/authStore';

const bootstrapClient = axios.create({
  baseURL: '',
  withCredentials: true,
});

let activeBootstrap: AbortController | null = null;

/**
 * Stops in-flight session restore. Call before login/register so a late
 * /auth/refresh response cannot overwrite the new account’s cookies or store.
 */
export function abortBootstrapAuth(): void {
  activeBootstrap?.abort();
  activeBootstrap = null;
}

export async function bootstrapAuth(): Promise<void> {
  abortBootstrapAuth();
  const controller = new AbortController();
  activeBootstrap = controller;
  const { signal } = controller;

  const store = useAuthStore.getState();
  store.setBootstrapping(true);
  try {
    const refresh = await bootstrapClient.post<{ accessToken: string }>(
      '/api/auth/refresh',
      {},
      { signal }
    );
    const accessToken = refresh.data.accessToken;
    const me = await bootstrapClient.get<{ user: AuthUser }>('/api/users/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal,
    });
    useAuthStore.getState().setAuth(me.data.user, accessToken);
  } catch (err: unknown) {
    if (axios.isCancel(err)) {
      return;
    }
    useAuthStore.getState().clearAuth();
  } finally {
    activeBootstrap = null;
    useAuthStore.getState().setBootstrapping(false);
  }
}
