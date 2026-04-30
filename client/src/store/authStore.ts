import { create } from 'zustand';

export type AuthUser = {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
};

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  bootstrapping: boolean;
  setAuth: (user: AuthUser, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  setBootstrapping: (value: boolean) => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  bootstrapping: true,
  setAuth: (user, accessToken) => set({ user, accessToken }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setBootstrapping: (value) => set({ bootstrapping: value }),
  clearAuth: () => set({ user: null, accessToken: null }),
}));
