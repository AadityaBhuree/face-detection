'use client';

import { useAuthStore } from '@/stores/auth-store';

/**
 * Convenience hook exposing the auth session: current user, tokens,
 * and session actions. Re-renders when any slice changes.
 */
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setSession = useAuthStore((s) => s.setSession);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const clearSession = useAuthStore((s) => s.clearSession);

  return {
    user,
    accessToken,
    refreshToken,
    isAuthenticated,
    setSession,
    setAccessToken,
    logout: clearSession,
  };
}
