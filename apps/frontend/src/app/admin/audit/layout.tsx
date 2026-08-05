'use client';

import type { ReactNode } from 'react';
import { RequireAuth } from '@/components/auth/require-auth';
import { UserRole } from '@jeevandata/shared-types';

/**
 * Gates the entire /admin/audit route behind an ADMIN or SYSTEM session —
 * mirroring the backend @Roles(ADMIN, SYSTEM) guard on /audit/* (HIPAA trail).
 */
export default function AdminAuditLayout({ children }: { children: ReactNode }) {
  return <RequireAuth allowedRoles={[UserRole.ADMIN, UserRole.SYSTEM]}>{children}</RequireAuth>;
}
