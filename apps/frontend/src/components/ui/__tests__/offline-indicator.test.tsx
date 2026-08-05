import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OfflineIndicator } from '../offline-indicator';
import { useOfflineStore } from '@/stores/offline-store';

const { flushMock } = vi.hoisted(() => ({
  flushMock: vi.fn(),
}));

vi.mock('@/services/sync', () => ({
  flushPendingMutations: flushMock,
}));

function renderIndicator() {
  return render(<OfflineIndicator />);
}

beforeEach(() => {
  vi.clearAllMocks();
  useOfflineStore.getState().reset();
  flushMock.mockResolvedValue({ synced: 0, failed: 0, remaining: 0 });
});

describe('OfflineIndicator', () => {
  it('renders nothing when online with no pending mutations', () => {
    const { container } = renderIndicator();
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the offline banner when the browser is offline', () => {
    useOfflineStore.getState().setOnline(false);

    renderIndicator();

    expect(screen.getByText(/you're offline/i)).toBeInTheDocument();
  });

  it('shows the queued count when offline with pending mutations', () => {
    useOfflineStore.getState().setOnline(false);
    useOfflineStore.getState().setPendingCount(3);

    renderIndicator();

    expect(screen.getByText(/3 changes queued/i)).toBeInTheDocument();
  });

  it('renders a retry sync button while offline that flushes the queue', async () => {
    useOfflineStore.getState().setOnline(false);
    useOfflineStore.getState().setPendingCount(2);

    renderIndicator();

    fireEvent.click(screen.getByRole('button', { name: /retry sync/i }));

    await waitFor(() => {
      expect(flushMock).toHaveBeenCalled();
    });
  });

  it('shows the syncing state while a flush is in progress', () => {
    useOfflineStore.getState().setOnline(false);
    useOfflineStore.getState().setPendingCount(2);
    useOfflineStore.getState().setIsSyncing(true);

    renderIndicator();

    expect(screen.getByText(/syncing/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /syncing/i })).toBeDisabled();
  });

  it('shows the back-online banner with queued count after reconnect', () => {
    useOfflineStore.getState().setOnline(true);
    useOfflineStore.getState().setPendingCount(1);

    renderIndicator();

    expect(screen.getByText(/you're back online/i)).toBeInTheDocument();
    expect(screen.getByText(/1 queued change/i)).toBeInTheDocument();
  });

  it('shows the sync error detail when a flush fails', () => {
    useOfflineStore.getState().setOnline(true);
    useOfflineStore.getState().setPendingCount(1);
    useOfflineStore.getState().setSyncError('Network error');

    renderIndicator();

    expect(screen.getByText(/network error/i)).toBeInTheDocument();
  });

  it('hides again once synced and nothing is pending', async () => {
    const { container, rerender } = renderIndicator();
    useOfflineStore.getState().setOnline(false);
    useOfflineStore.getState().setPendingCount(1);
    rerender(<OfflineIndicator />);
    expect(screen.getByText(/you're offline/i)).toBeInTheDocument();

    useOfflineStore.getState().setOnline(true);
    useOfflineStore.getState().setPendingCount(0);
    rerender(<OfflineIndicator />);
    expect(container).toBeEmptyDOMElement();
  });
});
