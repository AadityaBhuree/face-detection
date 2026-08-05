import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { UserRole } from '@jeevandata/shared-types';
import AdminAuditLayout from '../layout';
import { useAuthStore } from '@/stores/auth-store';

const { replaceMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: replaceMock,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/admin/audit',
  useSearchParams: () => new URLSearchParams(),
}));

function user(role: UserRole) {
  return {
    id: 'u1',
    email: 'user@jeevandata.com',
    name: 'Test User',
    role,
    clinicId: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  replaceMock.mockClear();
  useAuthStore.getState().clearSession();
  localStorage.clear();
});

describe('Admin audit route gate', () => {
  it('renders audit children for ADMIN', () => {
    useAuthStore
      .getState()
      .setSession({ accessToken: 'a', refreshToken: 'r' }, user(UserRole.ADMIN));

    render(
      <AdminAuditLayout>
        <h1>Audit content</h1>
      </AdminAuditLayout>,
    );

    expect(screen.getByRole('heading', { name: /audit content/i })).toBeInTheDocument();
  });

  it('renders audit children for SYSTEM', () => {
    useAuthStore
      .getState()
      .setSession({ accessToken: 'a', refreshToken: 'r' }, user(UserRole.SYSTEM));

    render(
      <AdminAuditLayout>
        <h1>Audit content</h1>
      </AdminAuditLayout>,
    );

    expect(screen.getByRole('heading', { name: /audit content/i })).toBeInTheDocument();
  });

  it('denies DOCTOR with the access-denied view', () => {
    useAuthStore
      .getState()
      .setSession({ accessToken: 'a', refreshToken: 'r' }, user(UserRole.DOCTOR));

    render(
      <AdminAuditLayout>
        <h1>Audit content</h1>
      </AdminAuditLayout>,
    );

    expect(screen.getByRole('alert', { name: /access denied/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /audit content/i })).not.toBeInTheDocument();
  });

  it('denies RECEPTIONIST with the access-denied view', () => {
    useAuthStore
      .getState()
      .setSession({ accessToken: 'a', refreshToken: 'r' }, user(UserRole.RECEPTIONIST));

    render(
      <AdminAuditLayout>
        <h1>Audit content</h1>
      </AdminAuditLayout>,
    );

    expect(screen.getByRole('alert', { name: /access denied/i })).toBeInTheDocument();
  });

  it('redirects guests to /login', async () => {
    render(
      <AdminAuditLayout>
        <h1>Audit content</h1>
      </AdminAuditLayout>,
    );

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/login');
    });
  });
});
