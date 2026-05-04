import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3333/api/v1';

export interface User {
  id: string;
  tenantId: string | null;
  storeId: string | null;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'OWNER' | 'MANAGER' | 'CASHIER' | 'WAITER' | 'KITCHEN' | 'DELIVERER';
  tenant?: { id: string; slug: string; name: string } | null;
  store?: { id: string; name: string } | null;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;

  login: (email: string, password: string, tenantSlug?: string) => Promise<void>;
  loginByPin: (tenantSlug: string, pin: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<string>;
  hasRole: (...roles: User['role'][]) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      login: async (email, password, tenantSlug) => {
        const { data } = await axios.post(`${API_URL}/auth/login`, {
          email, password, tenantSlug,
        });
        set({
          user: data.user,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          isAuthenticated: true,
        });
      },

      loginByPin: async (tenantSlug, pin) => {
        const { data } = await axios.post(`${API_URL}/auth/login-pin`, { tenantSlug, pin });
        set({
          user: data.user,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          isAuthenticated: true,
        });
      },

      logout: () => {
        const rt = get().refreshToken;
        if (rt) {
          axios.post(`${API_URL}/auth/logout`, { refreshToken: rt }).catch(() => {});
        }
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },

      refresh: async () => {
        const rt = get().refreshToken;
        if (!rt) throw new Error('Sem refresh token');
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken: rt });
        set({
          user: data.user,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        });
        return data.accessToken as string;
      },

      hasRole: (...roles) => {
        const role = get().user?.role;
        return role ? roles.includes(role) : false;
      },
    }),
    {
      name: 'lanche-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
