import { describe, it, expect, beforeEach } from 'vitest';
import { UserRole } from '@jeevandata/shared-types';
import { useAuthStore } from '../auth-store';

const user = {
  id: 'u1',
  email: 'doctor@jeevandata.com',
  name: 'Dr. Priya Sharma',
  role: UserRole.DOCTOR,
  clinicId: 'clinic-1',
};

const tokens = {
  accessToken: 'access-token-123',
  refreshToken: 'refresh-token-456',
  expiresIn: 86400,
};

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
    localStorage.clear();
  });

  it('should start logged out', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.user).toBeNull();
  });

  it('should authenticate via setSession', () => {
    useAuthStore.getState().setSession(tokens, user);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.accessToken).toBe('access-token-123');
    expect(state.refreshToken).toBe('refresh-token-456');
    expect(state.user).toEqual(user);
  });

  it('should update the access token via setAccessToken', () => {
    useAuthStore.getState().setSession(tokens, user);
    useAuthStore.getState().setAccessToken('rotated-access');

    expect(useAuthStore.getState().accessToken).toBe('rotated-access');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('should clear the session via clearSession', () => {
    useAuthStore.getState().setSession(tokens, user);
    useAuthStore.getState().clearSession();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.user).toBeNull();
  });

  it('should persist the session to localStorage', () => {
    useAuthStore.getState().setSession(tokens, user);

    const raw = localStorage.getItem('jeevandata-auth');
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw!) as {
      state: { user: typeof user; accessToken: string; refreshToken: string };
    };
    expect(stored.state.user.email).toBe('doctor@jeevandata.com');
    expect(stored.state.accessToken).toBe('access-token-123');
  });
});
