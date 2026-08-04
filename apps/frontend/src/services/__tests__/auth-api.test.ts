import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authApi, intakeApi, ApiError } from '../api';
import { useAuthStore } from '@/stores/auth-store';
import { UserRole } from '@jeevandata/shared-types';

// ─── Mock fetch globally ──────────────────────────────────────

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.fetch = mockFetch;
  useAuthStore.getState().clearSession();
  localStorage.clear();
});

// ─── Helpers ──────────────────────────────────────────────────

function mockSuccessResponse(data: unknown, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: status < 400,
    status,
    json: () => Promise.resolve({ data }),
  });
}

function mockUnauthorized() {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status: 401,
    json: () =>
      Promise.resolve({
        error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
      }),
  });
}

const user = {
  id: 'u1',
  email: 'doctor@jeevandata.com',
  name: 'Dr. Priya Sharma',
  role: UserRole.DOCTOR,
  clinicId: null,
};

// ─── authApi ──────────────────────────────────────────────────

describe('authApi', () => {
  it('login should POST to /auth/login', async () => {
    mockSuccessResponse({
      user,
      accessToken: 'a1',
      refreshToken: 'r1',
      expiresIn: 86400,
    });

    const result = await authApi.login({
      email: 'doctor@jeevandata.com',
      password: 'StrongPass123',
    });

    expect(result.user.email).toBe('doctor@jeevandata.com');
    expect(result.accessToken).toBe('a1');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:4000/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          email: 'doctor@jeevandata.com',
          password: 'StrongPass123',
        }),
      }),
    );
  });

  it('register should POST to /auth/register', async () => {
    mockSuccessResponse(user);

    const result = await authApi.register({
      name: 'Dr. Priya Sharma',
      email: 'doctor@jeevandata.com',
      password: 'StrongPass123',
    });

    expect(result.role).toBe('DOCTOR');
  });

  it('refresh should POST to /auth/refresh', async () => {
    mockSuccessResponse({ accessToken: 'a2', refreshToken: 'r2', expiresIn: 86400 });

    const result = await authApi.refresh('old-refresh');

    expect(result.accessToken).toBe('a2');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:4000/auth/refresh',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ refreshToken: 'old-refresh' }),
      }),
    );
  });

  it('logout should POST to /auth/logout with the Bearer token', async () => {
    useAuthStore.getState().setSession({ accessToken: 'abc', refreshToken: 'r1' }, user);
    mockSuccessResponse({ success: true });

    await authApi.logout();

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:4000/auth/logout',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer abc' }),
      }),
    );
  });
});

// ─── Bearer header + refresh-on-401 ───────────────────────────

describe('request auth behavior', () => {
  it('should attach the Authorization header when a token is present', async () => {
    useAuthStore.getState().setSession({ accessToken: 'abc', refreshToken: 'r1' }, user);
    mockSuccessResponse({ id: 's1' });

    await intakeApi.getSession('s1');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:4000/intake/session/s1',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer abc' }),
      }),
    );
  });

  it('should NOT attach Authorization when logged out', async () => {
    mockSuccessResponse({ id: 's1' });

    await intakeApi.getSession('s1');

    const [, init] = mockFetch.mock.calls[0]!;
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('should refresh once on 401 and replay the original request', async () => {
    useAuthStore
      .getState()
      .setSession({ accessToken: 'expired', refreshToken: 'refresh-ok' }, user);

    mockUnauthorized(); // original request → 401
    mockSuccessResponse({
      // refresh
      accessToken: 'fresh-access',
      refreshToken: 'refresh-2',
      expiresIn: 86400,
    });
    mockSuccessResponse({ id: 's1' }); // replayed request

    const result = await intakeApi.getSession('s1');

    expect(result).toEqual({ id: 's1' });
    expect(useAuthStore.getState().accessToken).toBe('fresh-access');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('should clear the session when the refresh fails', async () => {
    useAuthStore
      .getState()
      .setSession({ accessToken: 'expired', refreshToken: 'bad-refresh' }, user);

    mockUnauthorized(); // original → 401
    mockUnauthorized(); // refresh → 401

    await expect(intakeApi.getSession('s1')).rejects.toThrow(ApiError);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
  });

  it('should not attempt refresh on auth endpoints themselves', async () => {
    useAuthStore.getState().setSession({ accessToken: 'expired', refreshToken: 'r1' }, user);

    mockUnauthorized(); // login endpoint → 401 (no refresh loop)

    await expect(authApi.login({ email: 'x@y.com', password: 'StrongPass123' })).rejects.toThrow(
      ApiError,
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
