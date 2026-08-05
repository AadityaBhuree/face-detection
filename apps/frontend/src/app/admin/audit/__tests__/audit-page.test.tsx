import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminAuditPage from '../page';
import { ThemeProvider } from '@/components/ui/theme-provider';
import { useAuthStore } from '@/stores/auth-store';

const { replaceMock, auditApiMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  auditApiMock: {
    getLogs: vi.fn(),
    exportCsv: vi.fn(),
    getPhiAccessSummary: vi.fn(),
    getRetention: vi.fn(),
    runRetentionCleanup: vi.fn(),
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
  usePathname: () => '/admin/audit',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/services/api', () => ({
  auditApi: auditApiMock,
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

const sampleLogs = {
  data: [
    {
      id: 'log-1',
      action: 'PATIENT_PROFILE_VIEW',
      actorId: 'user-1',
      actorRole: 'DOCTOR',
      resourceType: 'patient',
      resourceId: '550e8400-e29b-41d4-a716-446655440001',
      details: {},
      ipAddress: '192.168.1.1',
      timestamp: '2026-07-15T10:30:00.000Z',
    },
    {
      id: 'log-2',
      action: 'INTAKE_RECORD_ACCESS',
      actorId: 'admin-1',
      actorRole: 'ADMIN',
      resourceType: 'intake',
      resourceId: '660e8400-e29b-41d4-a716-446655440002',
      details: {},
      ipAddress: '10.0.0.1',
      timestamp: '2026-07-14T09:00:00.000Z',
    },
  ],
  pagination: { page: 1, limit: 50, total: 2, totalPages: 1 },
};

function renderAudit() {
  return render(
    <ThemeProvider>
      <AdminAuditPage />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  replaceMock.mockClear();
  useAuthStore.getState().clearSession();
  localStorage.clear();

  auditApiMock.getLogs.mockResolvedValue(sampleLogs);
  auditApiMock.getRetention.mockResolvedValue({ retentionDays: 90 });
  auditApiMock.getPhiAccessSummary.mockResolvedValue({
    patientId: '550e8400-e29b-41d4-a716-446655440001',
    days: 30,
    totalAccesses: 3,
    uniqueActors: 2,
    perDay: [
      {
        date: '2026-07-15',
        accessCount: 2,
        uniqueActors: 1,
        actors: ['doctor-1'],
        actions: { PATIENT_PROFILE_VIEW: 2 },
      },
    ],
  });
  auditApiMock.runRetentionCleanup.mockResolvedValue({
    deleted: 5,
    retentionDays: 90,
    cutoff: '2026-04-15T00:00:00.000Z',
  });
});

describe('AdminAuditPage', () => {
  it('loads and renders audit log rows from the API', async () => {
    renderAudit();

    expect(await screen.findByText('PATIENT_PROFILE_VIEW')).toBeInTheDocument();
    expect(screen.getByText('INTAKE_RECORD_ACCESS')).toBeInTheDocument();
    expect(screen.getByText('user-1')).toBeInTheDocument();
    expect(auditApiMock.getLogs).toHaveBeenCalled();
  });

  it('shows the retention policy from the API', async () => {
    renderAudit();

    expect(await screen.findByText('90 days')).toBeInTheDocument();
  });

  it('applies filters and reloads with them', async () => {
    renderAudit();

    fireEvent.change(await screen.findByLabelText('Action'), {
      target: { value: 'PATIENT_PROFILE_VIEW' },
    });
    fireEvent.change(screen.getByLabelText('Actor'), {
      target: { value: 'user-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }));

    await waitFor(() => {
      expect(auditApiMock.getLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: 'PATIENT_PROFILE_VIEW', actorId: 'user-1' }),
        expect.any(Number),
        expect.any(Number),
      );
    });
  });

  it('exports the anonymized CSV and triggers a download', async () => {
    renderAudit();
    auditApiMock.exportCsv.mockResolvedValue(
      '\uFEFFtimestamp,action,actorId\n2026-07-15T10:30:00.000Z,PATIENT_PROFILE_VIEW,user-1\n',
    );

    const exportBtn = await screen.findByRole('button', { name: /export csv/i });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    });

    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(auditApiMock.exportCsv).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
    });

    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads a PHI access summary for a patient', async () => {
    renderAudit();

    fireEvent.change(await screen.findByLabelText(/patient id/i), {
      target: { value: '550e8400-e29b-41d4-a716-446655440001' },
    });
    fireEvent.click(screen.getByRole('button', { name: /lookup/i }));

    expect(await screen.findByText('Total accesses: 3')).toBeInTheDocument();
    expect(screen.getByText('Unique actors: 2')).toBeInTheDocument();
    expect(screen.getByText('2026-07-15')).toBeInTheDocument();
    expect(screen.getByText('PATIENT_PROFILE_VIEW ×2')).toBeInTheDocument();
  });

  it('runs retention cleanup after confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderAudit();

    fireEvent.click(await screen.findByRole('button', { name: /run retention cleanup/i }));

    await waitFor(() => {
      expect(auditApiMock.runRetentionCleanup).toHaveBeenCalled();
      expect(confirmSpy).toHaveBeenCalled();
    });

    expect(await screen.findByText(/deleted 5 logs/i)).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it('skips cleanup when the confirmation is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAudit();

    fireEvent.click(await screen.findByRole('button', { name: /run retention cleanup/i }));

    expect(auditApiMock.runRetentionCleanup).not.toHaveBeenCalled();
  });

  it('shows an error alert when the log load fails', async () => {
    auditApiMock.getLogs.mockRejectedValue(new Error('boom'));

    renderAudit();

    expect(await screen.findByRole('alert')).toHaveTextContent('boom');
  });
});
