'use client';

import type { ReactNode } from 'react';
import { RequireAuth } from '@/components/auth/require-auth';
import { UserRole } from '@jeevandata/shared-types';

/**
 * Gates the entire /dashboard route behind an authenticated session with a
 * DOCTOR or RECEPTIONIST role — mirroring the backend `@Roles(DOCTOR,
 * RECEPTIONIST)` guard on `GET /dashboard/*`. Placed at the layout level so
 * the page component (and its data-fetch and socket side effects) never
 * mounts for unauthorized visitors.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth allowedRoles={[UserRole.DOCTOR, UserRole.RECEPTIONIST]}>{children}</RequireAuth>
  );
}
