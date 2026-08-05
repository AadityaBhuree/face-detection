import { describe, it, expect, beforeEach } from 'vitest';
import { useOfflineStore } from '../offline-store';

describe('useOfflineStore', () => {
  beforeEach(() => {
    useOfflineStore.getState().reset();
  });

  it('should have correct initial state', () => {
    const state = useOfflineStore.getState();

    expect(state.isOnline).toBe(true);
    expect(state.isSyncing).toBe(false);
    expect(state.pendingCount).toBe(0);
    expect(state.lastSyncedAt).toBeNull();
    expect(state.syncError).toBeNull();
  });

  it('should set online state', () => {
    useOfflineStore.getState().setOnline(false);
    expect(useOfflineStore.getState().isOnline).toBe(false);

    useOfflineStore.getState().setOnline(true);
    expect(useOfflineStore.getState().isOnline).toBe(true);
  });

  it('should set syncing state', () => {
    useOfflineStore.getState().setIsSyncing(true);
    expect(useOfflineStore.getState().isSyncing).toBe(true);

    useOfflineStore.getState().setIsSyncing(false);
    expect(useOfflineStore.getState().isSyncing).toBe(false);
  });

  it('should set pending mutation count', () => {
    useOfflineStore.getState().setPendingCount(3);
    expect(useOfflineStore.getState().pendingCount).toBe(3);
  });

  it('should set last synced timestamp', () => {
    useOfflineStore.getState().setLastSyncedAt('2026-08-05T10:00:00.000Z');
    expect(useOfflineStore.getState().lastSyncedAt).toBe('2026-08-05T10:00:00.000Z');
  });

  it('should set sync error', () => {
    useOfflineStore.getState().setSyncError('Network error');
    expect(useOfflineStore.getState().syncError).toBe('Network error');
  });

  it('should reset all fields to initial state', () => {
    useOfflineStore.getState().setOnline(false);
    useOfflineStore.getState().setIsSyncing(true);
    useOfflineStore.getState().setPendingCount(5);
    useOfflineStore.getState().setLastSyncedAt('2026-08-05T10:00:00.000Z');
    useOfflineStore.getState().setSyncError('boom');

    useOfflineStore.getState().reset();

    const state = useOfflineStore.getState();
    expect(state.isOnline).toBe(true);
    expect(state.isSyncing).toBe(false);
    expect(state.pendingCount).toBe(0);
    expect(state.lastSyncedAt).toBeNull();
    expect(state.syncError).toBeNull();
  });
});
