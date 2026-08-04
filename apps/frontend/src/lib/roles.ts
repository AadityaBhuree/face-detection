import type { UserRole } from '@jeevandata/shared-types';

export type { UserRole };

/** Human-readable labels for the clinic user roles. */
export const ROLE_LABELS: Record<UserRole, string> = {
  RECEPTIONIST: 'Receptionist',
  DOCTOR: 'Doctor',
  ADMIN: 'Admin',
  SYSTEM: 'System',
};

/** True when the user's role is in the allowed set (fail-closed on unknown). */
export function hasRole(role: string | undefined, allowed: readonly UserRole[]): boolean {
  return !!role && (allowed as readonly string[]).includes(role);
}
