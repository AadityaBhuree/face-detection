import {
  enqueueMutation as dbEnqueue,
  getPendingMutationCount,
  getPendingMutations,
  markMutationFailed,
  markMutationSynced,
  logSyncEntry,
  clearSyncedMutations,
  type MutationType,
} from './db';
import { useOfflineStore } from '@/stores/offline-store';
import { intakeApi, faceApi } from './api';
import { logger } from '@/lib/logger';

// ─── Connectivity detection ────────────────────────────────────

function browserIsOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

/**
 * Wires the offline store to the browser's connectivity events and hydrates
 * the queued-mutation count. Returns a cleanup function.
 */
export function initOfflineSync(): () => void {
  const handleOnline = () => {
    useOfflineStore.getState().setOnline(true);
    logger.info('Network online — flushing queued mutations');
    void flushPendingMutations();
  };

  const handleOffline = () => {
    useOfflineStore.getState().setOnline(false);
    logger.warn('Network offline — intake mutations will be queued locally');
  };

  useOfflineStore.getState().setOnline(browserIsOnline());
  void refreshPendingCount();

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

/** Syncs the store's pendingCount with the outbox. */
export async function refreshPendingCount(): Promise<void> {
  try {
    const count = await getPendingMutationCount();
    useOfflineStore.getState().setPendingCount(count);
  } catch (error) {
    logger.error('Failed to read pending mutation count', error);
  }
}

// ─── Outbox enqueue ────────────────────────────────────────────

/**
 * Queues an intake mutation in the IndexedDB outbox. Safe to call both
 * while offline and as a fallback when a network call fails.
 */
export async function enqueueIntakeMutation(
  type: MutationType,
  payload: Record<string, unknown>,
): Promise<number> {
  const id = await dbEnqueue(type, payload);
  await refreshPendingCount();
  logger.info(`Offline mutation queued: ${type}`, { id });
  return id;
}

// ─── Flush / replay ────────────────────────────────────────────

/** Replays a single queued mutation against the backend. */
async function replayMutation(mutation: {
  id?: number;
  type: MutationType;
  payload: Record<string, unknown>;
  clientTimestamp: string;
}): Promise<void> {
  const { type, payload, clientTimestamp } = mutation;

  if (type === 'COMPLETE_SESSION') {
    await intakeApi.completeSession(
      payload.sessionId as string,
      payload.intakeData as Record<string, unknown>,
    );
  } else if (type === 'REGISTER_PATIENT') {
    await faceApi.registerPatient({
      name: String(payload.name ?? ''),
      dob: String(payload.dob ?? ''),
      mobile: String(payload.mobile ?? ''),
      consent: Boolean(payload.consent),
      embedding: (payload.embedding as number[]) ?? [],
    });
  } else {
    throw new Error(`Unknown mutation type: ${String(type)}`);
  }

  await logSyncEntry({
    entityId: String(payload.sessionId ?? payload.mobile ?? 'unknown'),
    entityType: type,
    action: 'REPLAYED',
    clientTimestamp,
    status: 'synced',
  });
}

/**
 * Replays all pending outbox mutations (oldest first). Stops at the first
 * network failure so remaining mutations stay queued. Returns the counts
 * of synced/failed mutations.
 */
export async function flushPendingMutations(): Promise<{
  synced: number;
  failed: number;
  remaining: number;
}> {
  const store = useOfflineStore.getState();
  if (store.isSyncing) return { synced: 0, failed: 0, remaining: store.pendingCount };
  store.setIsSyncing(true);
  store.setSyncError(null);

  let synced = 0;
  let failed = 0;

  try {
    const pending = await getPendingMutations();

    for (const mutation of pending) {
      try {
        await replayMutation(mutation);
        if (mutation.id !== undefined) await markMutationSynced(mutation.id);
        synced += 1;
      } catch (error) {
        // Network-level failures (offline, DNS, timeout) abort the flush so
        // the rest stay queued. Non-network errors still abort — the queue is
        // replayed in order and a permanent failure would block later entries.
        failed += 1;
        logger.error(`Outbox replay failed: ${mutation.type}`, error);
        if (mutation.id !== undefined) {
          await markMutationFailed(mutation.id, mutation.attempts + 1);
        }
        store.setSyncError(
          error instanceof Error ? error.message : 'Sync failed — will retry when online',
        );
        break;
      }
    }

    if (failed === 0 && synced > 0) {
      await clearSyncedMutations();
      store.setLastSyncedAt(new Date().toISOString());
    }
  } catch (error) {
    logger.error('Flush failed to read outbox', error);
    store.setSyncError(error instanceof Error ? error.message : 'Sync failed');
  } finally {
    await refreshPendingCount();
    store.setIsSyncing(false);
  }

  const remaining = await getPendingMutationCount().catch(() => 0);
  return { synced, failed, remaining };
}
