'use client';

import type { ReactNode } from 'react';
import { RequireAuth } from '@/components/auth/require-auth';
import { UserRole } from '@jeevandata/shared-types';

/**
 * Gates the entire /admin route behind an ADMIN or SYSTEM session —
 * mirroring the backend @Roles(ADMIN, SYSTEM) guard on /analytics/*.
 * Placed at the layout level so the page never mounts for lower roles.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <RequireAuth allowedRoles={[UserRole.ADMIN, UserRole.SYSTEM]}>{children}</RequireAuth>;
}
