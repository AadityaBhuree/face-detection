import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { UserRole } from '@jeevandata/shared-types';
import ClinicsLayout from '../layout';
import ApiKeysLayout from '../../api-keys/layout';
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
  usePathname: () => '/clinics',
  useSearchParams: () => new URLSearchParams(),
}));

function user(role: UserRole) {
  return {
    id: 'u1',
    email: `user@jeevandata.com`,
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

describe('Admin management route gates', () => {
  it('renders clinics children for ADMIN', () => {
    useAuthStore
      .getState()
      .setSession({ accessToken: 'a', refreshToken: 'r' }, user(UserRole.ADMIN));

    render(
      <ClinicsLayout>
        <h1>Clinics content</h1>
      </ClinicsLayout>,
    );

    expect(screen.getByRole('heading', { name: /clinics content/i })).toBeInTheDocument();
  });

  it('renders api-keys children for SYSTEM', () => {
    useAuthStore
      .getState()
      .setSession({ accessToken: 'a', refreshToken: 'r' }, user(UserRole.SYSTEM));

    render(
      <ApiKeysLayout>
        <h1>API keys content</h1>
      </ApiKeysLayout>,
    );

    expect(screen.getByRole('heading', { name: /api keys content/i })).toBeInTheDocument();
  });

  it('denies DOCTOR on /clinics with the access-denied view', () => {
    useAuthStore
      .getState()
      .setSession({ accessToken: 'a', refreshToken: 'r' }, user(UserRole.DOCTOR));

    render(
      <ClinicsLayout>
        <h1>Clinics content</h1>
      </ClinicsLayout>,
    );

    expect(screen.getByRole('alert', { name: /access denied/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /clinics content/i })).not.toBeInTheDocument();
  });

  it('denies RECEPTIONIST on /api-keys with the access-denied view', () => {
    useAuthStore
      .getState()
      .setSession({ accessToken: 'a', refreshToken: 'r' }, user(UserRole.RECEPTIONIST));

    render(
      <ApiKeysLayout>
        <h1>API keys content</h1>
      </ApiKeysLayout>,
    );

    expect(screen.getByRole('alert', { name: /access denied/i })).toBeInTheDocument();
  });

  it('redirects guests to /login from both routes', async () => {
    render(
      <ClinicsLayout>
        <h1>Clinics content</h1>
      </ClinicsLayout>,
    );

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/login');
    });
  });
});
