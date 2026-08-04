import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminPage from '../page';
import { ThemeProvider } from '@/components/ui/theme-provider';
import { useAuthStore } from '@/stores/auth-store';

const { replaceMock, analyticsApiMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  analyticsApiMock: {
    getOverview: vi.fn(),
    getVolume: vi.fn(),
    getHours: vi.fn(),
    getFlow: vi.fn(),
    fetchCsv: vi.fn(),
  },
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
  usePathname: () => '/admin',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/services/api', () => ({
  analyticsApi: analyticsApiMock,
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

function renderAdmin() {
  return render(
    <ThemeProvider>
      <AdminPage />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  replaceMock.mockClear();
  useAuthStore.getState().clearSession();
  localStorage.clear();

  analyticsApiMock.getOverview.mockResolvedValue({
    days: 30,
    totalSessions: 42,
    returningPatients: 30,
    newPatients: 12,
    faceMatchRate: 71.4,
    avgIntakeMinutes: 12.5,
    briefSuccessRate: 95.2,
    activeSessions: 3,
  });
  analyticsApiMock.getVolume.mockResolvedValue({
    days: 30,
    data: [
      { date: '2026-07-01', count: 5 },
      { date: '2026-07-02', count: 8 },
    ],
  });
  analyticsApiMock.getHours.mockResolvedValue({
    days: 30,
    data: Array.from({ length: 24 }, (_, hour) => ({ hour, count: hour === 10 ? 12 : 0 })),
  });
  analyticsApiMock.getFlow.mockResolvedValue({
    total: 4,
    stages: [
      { key: 'waiting', label: 'Waiting', count: 1 },
      { key: 'in_intake', label: 'In Intake', count: 1 },
      { key: 'triaged', label: 'Triaged', count: 1 },
      { key: 'with_doctor', label: 'With Doctor', count: 1 },
    ],
  });
  analyticsApiMock.fetchCsv.mockResolvedValue('\uFEFFdate,sessions\n2026-07-01,5\n');
});

describe('AdminPage', () => {
  it('loads and renders KPI cards from the API', async () => {
    renderAdmin();

    expect(await screen.findByText('42')).toBeInTheDocument();
    expect(screen.getByText('Total Sessions')).toBeInTheDocument();
    expect(screen.getByText('12.5 min')).toBeInTheDocument();
    expect(screen.getByText('95.2%')).toBeInTheDocument();
  });

  it('renders the volume chart, heatmap, and flow board', async () => {
    renderAdmin();

    expect(await screen.findByText('Daily patient volume')).toBeInTheDocument();
    expect(screen.getByText('Peak clinic hours')).toBeInTheDocument();
    expect(screen.getByText('Patient Flow Board')).toBeInTheDocument();
    expect(screen.getByTitle('10:00 — 12 sessions')).toBeInTheDocument();
  });

  it('switches the range window and reloads with the new days', async () => {
    renderAdmin();

    fireEvent.click(await screen.findByRole('button', { name: '7d' }));

    await waitFor(() => {
      expect(analyticsApiMock.getOverview).toHaveBeenCalledWith(7);
      expect(analyticsApiMock.getVolume).toHaveBeenCalledWith(7);
      expect(analyticsApiMock.getHours).toHaveBeenCalledWith(7);
    });
  });

  it('exports the CSV and triggers a download', async () => {
    renderAdmin();

    const exportBtn = await screen.findByRole('button', { name: /export csv/i });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    });

    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(analyticsApiMock.fetchCsv).toHaveBeenCalledWith(30);
      expect(clickSpy).toHaveBeenCalled();
    });

    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shows an error alert when the analytics load fails', async () => {
    analyticsApiMock.getOverview.mockRejectedValue(new Error('boom'));

    renderAdmin();

    expect(await screen.findByRole('alert')).toHaveTextContent('boom');
  });
});
