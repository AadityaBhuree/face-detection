'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';

interface RequireAuthProps {
  children: ReactNode;
  /** Optional — redirect here instead of /login when unauthenticated. */
  redirectTo?: string;
}

/**
 * Guards a client subtree behind an active session.
 * While the persisted session is being restored it renders a minimal
 * loading placeholder; if the user is not authenticated it redirects
 * (fail-closed) to /login (or `redirectTo`).
 */
export function RequireAuth({ children, redirectTo = '/login' }: RequireAuthProps) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace(redirectTo);
    }
  }, [isAuthenticated, redirectTo, router]);

  if (!isAuthenticated) {
    return (
      <div
        role="status"
        aria-label="Checking session"
        className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950"
      >
        <div className="border-jeevandata-200 border-t-jeevandata-500 h-8 w-8 animate-spin rounded-full border-2" />
      </div>
    );
  }

  return <>{children}</>;
}
