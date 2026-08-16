import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError } from '../api/client';
import { tokenStore } from '../api/tokenStore';
import type { AdminUser } from '../api/types';

interface AuthState {
  admin: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

interface LoginResponse {
  admin: AdminUser;
  accessToken: string;
  refreshToken: string;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokenStore.getAccessToken()) {
      setLoading(false);
      return;
    }
    api
      .get<AdminUser>('/admin/auth/me')
      .then(setAdmin)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.postPublic<LoginResponse>('/admin/auth/login', { email, password });
    tokenStore.setTokens(result.accessToken, result.refreshToken);
    setAdmin(result.admin);
  }, []);

  const logout = useCallback(() => {
    const refreshToken = tokenStore.getRefreshToken();
    tokenStore.clear();
    setAdmin(null);
    if (refreshToken) {
      api.postPublic('/admin/auth/logout', { refreshToken }).catch(() => {
        // Best-effort — the local session is already cleared either way.
      });
    }
  }, []);

  return <AuthContext.Provider value={{ admin, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
