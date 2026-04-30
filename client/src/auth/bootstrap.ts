import axios from 'axios';
import { useAuthStore, type AuthUser } from '../store/authStore';

const bootstrapClient = axios.create({
  baseURL: '',
  withCredentials: true,
});

export async function bootstrapAuth(): Promise<void> {
  const store = useAuthStore.getState();
  store.setBootstrapping(true);
  try {
    const refresh = await bootstrapClient.post<{ accessToken: string }>(
      '/api/auth/refresh'
    );
    const accessToken = refresh.data.accessToken;
    const me = await bootstrapClient.get<{ user: AuthUser }>('/api/users/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    useAuthStore.getState().setAuth(me.data.user, accessToken);
  } catch {
    useAuthStore.getState().clearAuth();
  } finally {
    useAuthStore.getState().setBootstrapping(false);
  }
}
