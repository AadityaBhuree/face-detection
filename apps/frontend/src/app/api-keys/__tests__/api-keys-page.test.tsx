import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ApiKeysPage from '../page';
import { ThemeProvider } from '@/components/ui/theme-provider';

const apiKeysApiMock = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  revoke: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/api-keys',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/services/api', () => ({
  apiKeysApi: apiKeysApiMock,
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

const keyRecord = {
  id: 'k1',
  name: 'PMS integration',
  prefix: 'jk_a1B2c3D4',
  clinicId: null,
  isActive: true,
  lastUsedAt: null,
  expiresAt: '2026-10-01T00:00:00.000Z',
  createdAt: '2026-07-01T00:00:00.000Z',
  revokedAt: null,
};

function renderPage() {
  return render(
    <ThemeProvider>
      <ApiKeysPage />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  apiKeysApiMock.list.mockResolvedValue([keyRecord]);
  apiKeysApiMock.revoke.mockResolvedValue({ success: true, message: 'ok' });
});

describe('ApiKeysPage', () => {
  it('loads and renders key metadata', async () => {
    renderPage();

    expect(await screen.findByText('PMS integration')).toBeInTheDocument();
    expect(screen.getByText(/jk_a1B2c3D4…/)).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('creates a key and reveals it once with a copy button', async () => {
    apiKeysApiMock.create.mockResolvedValue({
      ...keyRecord,
      id: 'k2',
      prefix: 'jk_new',
      apiKey: 'jk_newsecretvalue123',
    });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /generate key/i }));
    fireEvent.change(screen.getByLabelText(/key name/i), {
      target: { value: 'Whisper STT' },
    });
    fireEvent.change(screen.getByLabelText(/expiry/i), {
      target: { value: '90' },
    });
    // Header and form-submit buttons share the label; submit is the second one.
    fireEvent.click(screen.getAllByRole('button', { name: /^generate key$/i })[1]);

    await waitFor(() => {
      expect(apiKeysApiMock.create).toHaveBeenCalledWith({
        name: 'Whisper STT',
        expiresInDays: 90,
      });
    });
    expect(await screen.findByText(/copy it now/i)).toBeInTheDocument();
    expect(screen.getByText(/jk_newsecretvalue123/)).toBeInTheDocument();
  });

  it('rejects an invalid expiry value', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /generate key/i }));
    fireEvent.change(screen.getByLabelText(/key name/i), {
      target: { value: 'X' },
    });
    fireEvent.change(screen.getByLabelText(/expiry/i), {
      target: { value: '999' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /^generate key$/i })[1]);

    expect(await screen.findByText(/between 1 and 365/i)).toBeInTheDocument();
    expect(apiKeysApiMock.create).not.toHaveBeenCalled();
  });

  it('revokes an active key after confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /^revoke$/i }));

    await waitFor(() => {
      expect(apiKeysApiMock.revoke).toHaveBeenCalledWith('k1');
    });
    expect(confirmSpy).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
