import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/auth.store';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3333/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

// ─── Request: injeta token ───
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response: refresh automático em 401 ───
let isRefreshing = false;
let pendingRequests: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    // Evita loop infinito se for o próprio refresh que deu 401
    if (original.url?.includes('/auth/refresh')) {
      useAuthStore.getState().logout();
      return Promise.reject(error);
    }

    original._retry = true;

    if (isRefreshing) {
      // Já tem um refresh em andamento — enfileira
      return new Promise((resolve) => {
        pendingRequests.push((newToken: string) => {
          if (original.headers) original.headers.Authorization = `Bearer ${newToken}`;
          resolve(api(original));
        });
      });
    }

    isRefreshing = true;
    try {
      const newToken = await useAuthStore.getState().refresh();
      pendingRequests.forEach(cb => cb(newToken));
      pendingRequests = [];
      if (original.headers) original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch (err) {
      pendingRequests = [];
      useAuthStore.getState().logout();
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  }
);
