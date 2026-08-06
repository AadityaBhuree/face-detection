import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mocks ─────────────────────────────────────────────────────

const dbMocks = vi.hoisted(() => ({
  enqueueMutation: vi.fn(),
  getPendingMutationCount: vi.fn(),
  getPendingMutations: vi.fn(),
  markMutationFailed: vi.fn(),
  markMutationSynced: vi.fn(),
  logSyncEntry: vi.fn(),
  clearSyncedMutations: vi.fn(),
}));

const apiMocks = vi.hoisted(() => ({
  completeSession: vi.fn(),
  registerPatient: vi.fn(),
}));

vi.mock('../db', () => ({
  enqueueMutation: dbMocks.enqueueMutation,
  getPendingMutationCount: dbMocks.getPendingMutationCount,
  getPendingMutations: dbMocks.getPendingMutations,
  markMutationFailed: dbMocks.markMutationFailed,
  markMutationSynced: dbMocks.markMutationSynced,
  logSyncEntry: dbMocks.logSyncEntry,
  clearSyncedMutations: dbMocks.clearSyncedMutations,
}));

vi.mock('../api', () => ({
  intakeApi: { completeSession: apiMocks.completeSession },
  faceApi: { registerPatient: apiMocks.registerPatient },
}));

import {
  initOfflineSync,
  enqueueIntakeMutation,
  flushPendingMutations,
  refreshPendingCount,
} from '../sync';
import { useOfflineStore } from '@/stores/offline-store';

const sessionMutation = {
  id: 1,
  type: 'COMPLETE_SESSION' as const,
  payload: { sessionId: 's1', intakeData: { chiefComplaint: 'Fever' } },
  clientTimestamp: '2026-08-05T09:00:00.000Z',
  createdAt: '2026-08-05T09:00:00.000Z',
  attempts: 0,
  status: 'pending' as const,
};

const registerMutation = {
  id: 2,
  type: 'REGISTER_PATIENT' as const,
  payload: {
    name: 'Raj',
    dob: '1990-01-01',
    mobile: '+919999999999',
    consent: true,
    embedding: [0.1],
  },
  clientTimestamp: '2026-08-05T09:05:00.000Z',
  createdAt: '2026-08-05T09:05:00.000Z',
  attempts: 0,
  status: 'pending' as const,
};

describe('offline sync service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useOfflineStore.getState().reset();
    dbMocks.getPendingMutationCount.mockResolvedValue(0);
    // Queue drains after the first batch by default.
    dbMocks.getPendingMutations.mockResolvedValue([]);
  });

  afterEach(() => {
    // Remove any listeners registered by initOfflineSync
    vi.restoreAllMocks();
  });

  describe('refreshPendingCount', () => {
    it('should hydrate the store pendingCount from the outbox', async () => {
      dbMocks.getPendingMutationCount.mockResolvedValue(2);

      await refreshPendingCount();

      expect(useOfflineStore.getState().pendingCount).toBe(2);
    });
  });

  describe('enqueueIntakeMutation', () => {
    it('should add the mutation to the outbox and refresh the count', async () => {
      dbMocks.enqueueMutation.mockResolvedValue(42);
      dbMocks.getPendingMutationCount.mockResolvedValue(1);

      const id = await enqueueIntakeMutation('COMPLETE_SESSION', {
        sessionId: 's1',
        intakeData: {},
      });

      expect(id).toBe(42);
      expect(dbMocks.enqueueMutation).toHaveBeenCalledWith(
        'COMPLETE_SESSION',
        expect.objectContaining({ sessionId: 's1' }),
      );
      expect(dbMocks.getPendingMutationCount).toHaveBeenCalled();
      expect(useOfflineStore.getState().pendingCount).toBe(1);
    });
  });

  describe('flushPendingMutations', () => {
    it('should no-op when a flush is already in progress', async () => {
      useOfflineStore.getState().setIsSyncing(true);

      const result = await flushPendingMutations();

      expect(result).toEqual({ synced: 0, failed: 0, remaining: 0 });
      expect(dbMocks.getPendingMutations).not.toHaveBeenCalled();
    });

    it('should replay pending mutations with an idempotency key and mark them synced', async () => {
      dbMocks.getPendingMutations.mockResolvedValueOnce([sessionMutation]).mockResolvedValue([]);
      apiMocks.completeSession.mockResolvedValue({ brief: {} });
      dbMocks.getPendingMutationCount.mockResolvedValue(0);

      const result = await flushPendingMutations();

      // The replay carries the outbox row id as the Idempotency-Key.
      expect(apiMocks.completeSession).toHaveBeenCalledWith('s1', { chiefComplaint: 'Fever' }, '1');
      expect(dbMocks.markMutationSynced).toHaveBeenCalledWith(1);
      expect(dbMocks.logSyncEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 's1',
          entityType: 'COMPLETE_SESSION',
          action: 'REPLAYED',
          status: 'synced',
        }),
      );
      expect(result.synced).toBe(1);
      expect(result.failed).toBe(0);
      expect(useOfflineStore.getState().lastSyncedAt).not.toBeNull();
      expect(useOfflineStore.getState().isSyncing).toBe(false);
    });

    it('should replay REGISTER_PATIENT mutations with idempotency + PHI-free log id', async () => {
      dbMocks.getPendingMutations.mockResolvedValueOnce([registerMutation]).mockResolvedValue([]);
      apiMocks.registerPatient.mockResolvedValue({ id: 'p-new', name: 'Raj' });
      dbMocks.getPendingMutationCount.mockResolvedValue(0);

      await flushPendingMutations();

      expect(apiMocks.registerPatient).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Raj',
          consent: true,
          embedding: [0.1],
        }),
        '2',
      );
      expect(dbMocks.markMutationSynced).toHaveBeenCalledWith(2);
      // Sync log must never contain the patient's mobile number.
      const logCall = dbMocks.logSyncEntry.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(logCall.entityId).toBe('mutation-2');
      expect(JSON.stringify(logCall)).not.toContain('+919999999999');
    });

    it('should stop at the first failure and keep the rest queued', async () => {
      const failing = { ...sessionMutation, id: 1 };
      const second = {
        ...sessionMutation,
        id: 2,
        clientTimestamp: '2026-08-05T09:10:00.000Z',
      };
      dbMocks.getPendingMutations.mockResolvedValue([failing, second]);
      apiMocks.completeSession
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ brief: {} });
      dbMocks.getPendingMutationCount.mockResolvedValue(1);

      const result = await flushPendingMutations();

      expect(result.synced).toBe(0);
      expect(result.failed).toBe(1);
      expect(dbMocks.markMutationFailed).toHaveBeenCalledWith(1, 1);
      // Second mutation must NOT have been replayed after the failure
      expect(apiMocks.completeSession).toHaveBeenCalledTimes(1);
      // lastSyncedAt stays null because the flush did not fully succeed
      expect(useOfflineStore.getState().lastSyncedAt).toBeNull();
      expect(useOfflineStore.getState().syncError).toBe('Network error');
    });

    it('should replay oldest-first (last-write-wins ordering)', async () => {
      const older = { ...sessionMutation, id: 1, clientTimestamp: '2026-08-05T08:00:00.000Z' };
      const newer = { ...sessionMutation, id: 2, clientTimestamp: '2026-08-05T10:00:00.000Z' };
      dbMocks.getPendingMutations.mockResolvedValueOnce([older, newer]).mockResolvedValue([]);
      apiMocks.completeSession.mockResolvedValue({ brief: {} });
      dbMocks.getPendingMutationCount.mockResolvedValue(0);

      await flushPendingMutations();

      const order = apiMocks.completeSession.mock.calls.map((c) => c[0]);
      expect(order).toEqual(['s1', 's1']);
      // Both marked synced in order
      expect(dbMocks.markMutationSynced.mock.calls.map((c) => c[0])).toEqual([1, 2]);
    });

    it('should pick up mutations enqueued during a flush (loop until drained)', async () => {
      const first = { ...sessionMutation, id: 1 };
      const enqueuedDuringFlush = {
        ...sessionMutation,
        id: 2,
        clientTimestamp: '2026-08-05T09:02:00.000Z',
        payload: { sessionId: 's2', intakeData: { chiefComplaint: 'Cough' } },
      };
      // First pass sees [first]; second pass sees the newly enqueued one;
      // third pass sees an empty queue.
      dbMocks.getPendingMutations
        .mockResolvedValueOnce([first])
        .mockResolvedValueOnce([enqueuedDuringFlush])
        .mockResolvedValue([]);
      apiMocks.completeSession.mockResolvedValue({ brief: {} });
      dbMocks.getPendingMutationCount.mockResolvedValue(0);

      const result = await flushPendingMutations();

      expect(result.synced).toBe(2);
      expect(apiMocks.completeSession).toHaveBeenCalledTimes(2);
      expect(apiMocks.completeSession).toHaveBeenCalledWith('s2', { chiefComplaint: 'Cough' }, '2');
      expect(dbMocks.markMutationSynced.mock.calls.map((c) => c[0])).toEqual([1, 2]);
      expect(useOfflineStore.getState().lastSyncedAt).not.toBeNull();
    });
  });

  describe('initOfflineSync', () => {
    it('should hydrate the online flag and register listeners', () => {
      const cleanup = initOfflineSync();

      expect(useOfflineStore.getState().isOnline).toBe(
        typeof navigator === 'undefined' ? true : navigator.onLine,
      );
      expect(typeof cleanup).toBe('function');
      cleanup();
    });

    it('should be a no-op on double init (React StrictMode guard)', () => {
      const cleanup1 = initOfflineSync();
      const cleanup2 = initOfflineSync();

      // Second init must not register duplicate listeners — calling its
      // cleanup should not tear down the first init's listeners.
      cleanup2();
      window.dispatchEvent(new Event('online'));
      expect(useOfflineStore.getState().isOnline).toBe(true);
      cleanup1();
    });

    it('should flush queued mutations when the online event fires', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const cleanup = initOfflineSync();

      // Capture the online handler
      const onlineHandler = addEventListenerSpy.mock.calls.find(
        ([event]) => event === 'online',
      )?.[1] as EventListener;

      dbMocks.getPendingMutations.mockResolvedValueOnce([sessionMutation]).mockResolvedValue([]);
      apiMocks.completeSession.mockResolvedValue({ brief: {} });
      dbMocks.getPendingMutationCount.mockResolvedValue(0);

      // Simulate the browser reconnecting
      onlineHandler?.(new Event('online'));

      // The flush is async (fire-and-forget) — wait for it
      await vi.waitFor(() => {
        expect(apiMocks.completeSession).toHaveBeenCalledWith(
          's1',
          { chiefComplaint: 'Fever' },
          '1',
        );
      });

      expect(useOfflineStore.getState().isOnline).toBe(true);
      cleanup();
    });
  });
});
