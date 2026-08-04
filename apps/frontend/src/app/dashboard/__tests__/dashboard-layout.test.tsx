import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { UserRole } from '@jeevandata/shared-types';
import DashboardLayout from '../layout';
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
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}));

const receptionistUser = {
  id: 'u2',
  email: 'reception@jeevandata.com',
  name: 'Sita Verma',
  role: UserRole.RECEPTIONIST,
  clinicId: null,
};

const adminUser = {
  id: 'u3',
  email: 'admin@jeevandata.com',
  name: 'Admin User',
  role: UserRole.ADMIN,
  clinicId: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  replaceMock.mockClear();
  useAuthStore.getState().clearSession();
  localStorage.clear();
});

describe('DashboardLayout — role gate', () => {
  it('renders children for RECEPTIONIST', () => {
    useAuthStore.getState().setSession({ accessToken: 'a', refreshToken: 'r' }, receptionistUser);

    render(
      <DashboardLayout>
        <h1>Dashboard page</h1>
      </DashboardLayout>,
    );

    expect(screen.getByRole('heading', { name: /dashboard page/i })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders children for DOCTOR', () => {
    useAuthStore.getState().setSession(
      {
        accessToken: 'a',
        refreshToken: 'r',
      },
      {
        id: 'u1',
        email: 'doctor@jeevandata.com',
        name: 'Dr. Priya Sharma',
        role: UserRole.DOCTOR,
        clinicId: null,
      },
    );

    render(
      <DashboardLayout>
        <h1>Dashboard page</h1>
      </DashboardLayout>,
    );

    expect(screen.getByRole('heading', { name: /dashboard page/i })).toBeInTheDocument();
  });

  it('denies ADMIN with the access-denied view', () => {
    useAuthStore.getState().setSession({ accessToken: 'a', refreshToken: 'r' }, adminUser);

    render(
      <DashboardLayout>
        <h1>Dashboard page</h1>
      </DashboardLayout>,
    );

    expect(screen.getByRole('alert', { name: /access denied/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /dashboard page/i })).not.toBeInTheDocument();
  });

  it('redirects guests to /login', async () => {
    render(
      <DashboardLayout>
        <h1>Dashboard page</h1>
      </DashboardLayout>,
    );

    expect(screen.getByRole('status')).toBeInTheDocument();

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/login');
    });
    expect(screen.queryByRole('heading', { name: /dashboard page/i })).not.toBeInTheDocument();
  });
});
