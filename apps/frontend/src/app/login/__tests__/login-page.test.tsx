import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserRole } from '@jeevandata/shared-types';
import LoginPage from '../page';
import { ThemeProvider } from '@/components/ui/theme-provider';
import { useAuthStore } from '@/stores/auth-store';
import { authApi, ApiError } from '@/services/api';

// The page header renders <DarkModeToggle /> which requires a ThemeProvider.
function renderLogin() {
  return render(
    <ThemeProvider>
      <LoginPage />
    </ThemeProvider>,
  );
}

// ─── Router mock (shared so we can assert on push/replace) ─────
const { replaceMock, pushMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/login',
  useSearchParams: () => new URLSearchParams(),
}));

// ─── Mock api service ──────────────────────────────────────────

vi.mock('@/services/api', () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    refresh: vi.fn(),
    getProfile: vi.fn(),
    logout: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      public code: string,
      message: string,
    ) {
      super(message);
      this.name = 'ApiError';
    }
  },
}));

const mockLogin = vi.mocked(authApi.login);

const doctorUser = {
  id: 'u1',
  email: 'doctor@jeevandata.com',
  name: 'Dr. Priya Sharma',
  role: UserRole.DOCTOR,
  clinicId: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  replaceMock.mockClear();
  pushMock.mockClear();
  useAuthStore.getState().clearSession();
  localStorage.clear();
});

describe('LoginPage', () => {
  it('should render the login form', () => {
    renderLogin();

    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('should show validation errors for empty/invalid input', async () => {
    renderLogin();

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'not-an-email' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'short' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/valid email address/i)).toBeInTheDocument();
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('should call login and navigate to the dashboard on success', async () => {
    mockLogin.mockResolvedValue({
      user: doctorUser,
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      expiresIn: 86400,
    });

    renderLogin();

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'doctor@jeevandata.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'StrongPass123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'doctor@jeevandata.com',
        password: 'StrongPass123',
      });
    });

    expect(pushMock).toHaveBeenCalledWith('/dashboard');
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.accessToken).toBe('access-1');
    expect(state.user?.email).toBe('doctor@jeevandata.com');
  });

  it('should show the API error message when login fails', async () => {
    mockLogin.mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Invalid email or password'));

    renderLogin();

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'doctor@jeevandata.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'StrongPass123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('should redirect to /dashboard when already authenticated', async () => {
    useAuthStore.getState().setSession({ accessToken: 'a', refreshToken: 'r' }, doctorUser);

    renderLogin();

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/dashboard');
    });
  });
});
