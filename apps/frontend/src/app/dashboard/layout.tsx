'use client';

import type { ReactNode } from 'react';
import { RequireAuth } from '@/components/auth/require-auth';

/**
 * Gates the entire /dashboard route behind an active session.
 * Placed at the layout level so the page component (and its data-fetch
 * and socket side effects) never mount for unauthenticated visitors.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
