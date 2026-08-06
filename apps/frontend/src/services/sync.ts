import {
  enqueueMutation as dbEnqueue,
  getPendingMutationCount,
  getPendingMutations,
  markMutationFailed,
  markMutationSynced,
  logSyncEntry,
  clearSyncedMutations,
  type MutationType,
  type OutboxMutation,
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
 *
 * Safe against double-init (React StrictMode, hot reload): a second call
 * while already initialized is a no-op and returns an inert cleanup.
 */
let initialized = false;
export function initOfflineSync(): () => void {
  if (initialized) {
    return () => {};
  }
  initialized = true;

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
    initialized = false;
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

/**
 * Replays a single queued mutation against the backend.
 *
 * Every replay carries an `Idempotency-Key` header (the outbox row id) so a
 * replay whose first attempt succeeded server-side but whose response was
 * lost is a safe no-op instead of a double write.
 */
async function replayMutation(mutation: OutboxMutation): Promise<void> {
  const { id, type, payload, clientTimestamp } = mutation;
  const idempotencyKey = id !== undefined ? String(id) : clientTimestamp;

  if (type === 'COMPLETE_SESSION') {
    await intakeApi.completeSession(
      payload.sessionId as string,
      payload.intakeData as Record<string, unknown>,
      idempotencyKey,
    );
  } else if (type === 'REGISTER_PATIENT') {
    await faceApi.registerPatient(
      {
        name: String(payload.name ?? ''),
        dob: String(payload.dob ?? ''),
        mobile: String(payload.mobile ?? ''),
        consent: Boolean(payload.consent),
        embedding: (payload.embedding as number[]) ?? [],
      },
      idempotencyKey,
    );
  } else {
    throw new Error(`Unknown mutation type: ${String(type)}`);
  }

  // Sync log ids are PHI-free: session ids for completions, mutation ids
  // for registrations (never a mobile number or patient name).
  const entityId =
    type === 'COMPLETE_SESSION'
      ? String(payload.sessionId ?? 'unknown')
      : `mutation-${id ?? clientTimestamp}`;

  await logSyncEntry({
    entityId,
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
 *
 * The flush loops until the queue drains (bounded by MAX_PASSES) so
 * mutations enqueued while a flush is in flight are picked up immediately
 * instead of waiting for the next reconnect event.
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
    // Bound the loop so a pathological enqueue loop can't flush forever.
    const MAX_PASSES = 10;
    for (let pass = 0; pass < MAX_PASSES; pass += 1) {
      const pending = await getPendingMutations();
      if (pending.length === 0) break;

      let passFailed = false;
      for (const mutation of pending) {
        try {
          await replayMutation(mutation);
          if (mutation.id !== undefined) await markMutationSynced(mutation.id);
          synced += 1;
        } catch (error) {
          // Network-level failures (offline, DNS, timeout) abort the flush so
          // the rest stay queued. Non-network errors still abort — the queue
          // is replayed in order and a permanent failure would block later
          // entries.
          failed += 1;
          logger.error(`Outbox replay failed: ${mutation.type}`, error);
          if (mutation.id !== undefined) {
            await markMutationFailed(mutation.id, mutation.attempts + 1);
          }
          store.setSyncError(
            error instanceof Error ? error.message : 'Sync failed — will retry when online',
          );
          passFailed = true;
          break;
        }
      }
      if (passFailed) break;
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
