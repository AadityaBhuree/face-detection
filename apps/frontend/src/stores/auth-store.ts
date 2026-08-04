'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserRole } from '@jeevandata/shared-types';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  clinicId: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;

  // Actions
  setSession: (tokens: AuthTokens, user: AuthUser) => void;
  setAccessToken: (accessToken: string) => void;
  setUser: (user: AuthUser) => void;
  clearSession: () => void;
}

/**
 * Client-side session store (JWT access + refresh tokens, current user).
 * Persisted to localStorage so a page refresh keeps the session.
 * Note: `api.ts` reads the token from here for the Authorization header,
 * and performs single-attempt refresh on 401 (see services/api.ts).
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,

      setSession: (tokens, user) =>
        set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user,
          isAuthenticated: true,
        }),

      setAccessToken: (accessToken) => set({ accessToken }),

      setUser: (user) => set({ user }),

      clearSession: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'jeevandata-auth',
    },
  ),
);
