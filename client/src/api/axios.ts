import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { AuthUser } from '../store/authStore';
import { useAuthStore } from '../store/authStore';

const refreshClient = axios.create({
  baseURL: '',
  withCredentials: true,
});

export const api = axios.create({
  baseURL: '',
  withCredentials: true,
});

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryConfig | undefined;
    if (!original) {
      return Promise.reject(error);
    }
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }
    const url = original.url ?? '';
    if (
      url.includes('/api/auth/login') ||
      url.includes('/api/auth/register') ||
      url.includes('/api/auth/refresh')
    ) {
      return Promise.reject(error);
    }
    original._retry = true;
    try {
      const { data } = await refreshClient.post<{ accessToken: string }>(
        '/api/auth/refresh'
      );
      const { data: me } = await refreshClient.get<{ user: AuthUser }>(
        '/api/users/me',
        {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        }
      );
      useAuthStore.getState().setAuth(me.user, data.accessToken);
      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(original);
    } catch {
      useAuthStore.getState().clearAuth();
      return Promise.reject(error);
    }
  }
);
