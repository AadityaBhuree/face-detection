import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ClinicsPage from '../page';
import { ThemeProvider } from '@/components/ui/theme-provider';

const clinicsApiMock = vi.hoisted(() => ({
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deactivate: vi.fn(),
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
  usePathname: () => '/clinics',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/services/api', () => ({
  clinicsApi: clinicsApiMock,
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

const clinic = {
  id: 'c1',
  name: 'Sharma Multispeciality',
  code: 'SMS-01',
  address: '12 MG Road, Pune',
  phone: '+91 98765 43210',
  email: 'contact@sharma.clinic',
  isActive: true,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

function renderPage() {
  return render(
    <ThemeProvider>
      <ClinicsPage />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  clinicsApiMock.list.mockResolvedValue({
    data: [clinic],
    pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
  });
  clinicsApiMock.create.mockResolvedValue({ ...clinic, id: 'c2' });
  clinicsApiMock.update.mockResolvedValue(clinic);
  clinicsApiMock.deactivate.mockResolvedValue({ success: true, message: 'ok' });
});

describe('ClinicsPage', () => {
  it('loads and renders the clinic list', async () => {
    renderPage();

    expect(await screen.findByText('Sharma Multispeciality')).toBeInTheDocument();
    // The code shares a <p> with address/phone/email, so match with a regex.
    expect(screen.getByText(/SMS-01/)).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('creates a clinic and refreshes the list', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /add clinic/i }));
    fireEvent.change(screen.getByLabelText(/clinic name/i), {
      target: { value: 'New Clinic' },
    });
    fireEvent.change(screen.getByLabelText(/clinic code/i), {
      target: { value: 'NEW-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create clinic/i }));

    await waitFor(() => {
      expect(clinicsApiMock.create).toHaveBeenCalledWith({
        name: 'New Clinic',
        code: 'NEW-1',
        address: undefined,
        phone: undefined,
        email: undefined,
      });
    });
    // list reloaded after create
    expect(clinicsApiMock.list).toHaveBeenCalledTimes(2);
  });

  it('rejects an invalid clinic code', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /add clinic/i }));
    fireEvent.change(screen.getByLabelText(/clinic name/i), {
      target: { value: 'X' },
    });
    fireEvent.change(screen.getByLabelText(/clinic code/i), {
      target: { value: 'lower case!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create clinic/i }));

    expect(await screen.findByText(/uppercase a-z/i)).toBeInTheDocument();
    expect(clinicsApiMock.create).not.toHaveBeenCalled();
  });

  it('edits a clinic and saves changes', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /edit sharma multispeciality/i }));
    fireEvent.change(screen.getByLabelText(/clinic name/i), {
      target: { value: 'Renamed Clinic' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(clinicsApiMock.update).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({ name: 'Renamed Clinic' }),
      );
    });
  });

  it('deactivates a clinic after confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage();

    fireEvent.click(
      await screen.findByRole('button', { name: /deactivate sharma multispeciality/i }),
    );

    await waitFor(() => {
      expect(clinicsApiMock.deactivate).toHaveBeenCalledWith('c1');
    });
    expect(confirmSpy).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
