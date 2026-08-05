import Dexie, { type Table } from 'dexie';

interface CachedPatient {
  id: string;
  name: string;
  dob: string;
  mobile: string;
  lastSyncedAt: string;
  data: Record<string, unknown>;
}

interface CachedSession {
  id: string;
  patientId: string | null;
  status: string;
  startedAt: string;
  localData: Record<string, unknown>;
}

/** Transcript entries cached per session for offline viewing. */
interface CachedTranscripts {
  sessionId: string;
  entries: Array<{ speaker: string; text: string; timestamp: number }>;
  updatedAt: string;
}

/** Generated clinical brief cached per session for offline viewing. */
interface CachedBrief {
  sessionId: string;
  brief: Record<string, unknown>;
  generatedAt: string;
}

export type MutationType = 'COMPLETE_SESSION' | 'REGISTER_PATIENT';

/** Outbox entry — an intake mutation queued while offline. */
interface OutboxMutation {
  id?: number;
  type: MutationType;
  payload: Record<string, unknown>;
  /** Client-side timestamp — the last-write-wins key when replaying. */
  clientTimestamp: string;
  createdAt: string;
  attempts: number;
  status: 'pending' | 'synced' | 'failed';
}

/** Sync log — audit trail of every replayed mutation (last-write-wins). */
interface SyncLogEntry {
  id?: number;
  entityId: string;
  entityType: string;
  action: string;
  clientTimestamp: string;
  syncedAt: string;
  status: 'synced' | 'failed';
  note?: string;
}

class JeevandataDB extends Dexie {
  patients!: Table<CachedPatient, string>;
  sessions!: Table<CachedSession, string>;
  transcripts!: Table<CachedTranscripts, string>;
  briefs!: Table<CachedBrief, string>;
  mutations!: Table<OutboxMutation, number>;
  syncLog!: Table<SyncLogEntry, number>;

  constructor() {
    super('Jeevandata');

    this.version(1).stores({
      patients: 'id, name, mobile, lastSyncedAt',
      sessions: 'id, patientId, status, startedAt',
    });

    // v2 — offline mode: transcripts/briefs caches + outbox + sync log
    this.version(2).stores({
      patients: 'id, name, mobile, lastSyncedAt',
      sessions: 'id, patientId, status, startedAt',
      transcripts: 'sessionId, updatedAt',
      briefs: 'sessionId, generatedAt',
      mutations: '++id, type, status, createdAt',
      syncLog: '++id, entityId, entityType, syncedAt',
    });
  }
}

export const db = new JeevandataDB();

// ─── Patient Cache Operations ──────────────────────────────────

export async function cachePatient(patient: CachedPatient): Promise<void> {
  await db.patients.put(patient);
}

export async function getCachedPatient(id: string): Promise<CachedPatient | undefined> {
  return db.patients.get(id);
}

export async function searchCachedPatients(query: string): Promise<CachedPatient[]> {
  return db.patients
    .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()) || p.mobile.includes(query))
    .toArray();
}

export async function getAllCachedPatients(): Promise<CachedPatient[]> {
  return db.patients.orderBy('name').toArray();
}

// ─── Session Cache Operations ──────────────────────────────────

export async function cacheSession(session: CachedSession): Promise<void> {
  await db.sessions.put(session);
}

export async function getCachedSession(id: string): Promise<CachedSession | undefined> {
  return db.sessions.get(id);
}

export async function getPendingSessions(): Promise<CachedSession[]> {
  return db.sessions.where('status').notEqual('COMPLETED').toArray();
}

// ─── Transcript Cache (offline viewing) ────────────────────────

export async function cacheTranscripts(sessionId: string, entries: CachedTranscripts['entries']) {
  const existing = (await db.transcripts.get(sessionId))?.entries ?? [];
  const merged = mergeTranscripts(existing, entries);
  await db.transcripts.put({
    sessionId,
    entries: merged,
    updatedAt: new Date().toISOString(),
  });
  return merged;
}

export async function getCachedTranscripts(
  sessionId: string,
): Promise<CachedTranscripts | undefined> {
  return db.transcripts.get(sessionId);
}

/** Dedupes transcript entries by timestamp + speaker (idempotent appends). */
function mergeTranscripts(
  existing: CachedTranscripts['entries'],
  incoming: CachedTranscripts['entries'],
): CachedTranscripts['entries'] {
  const seen = new Set(existing.map((e) => `${e.timestamp}-${e.speaker}`));
  const merged = [...existing];
  for (const entry of incoming) {
    const key = `${entry.timestamp}-${entry.speaker}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(entry);
    }
  }
  return merged.sort((a, b) => a.timestamp - b.timestamp);
}

// ─── Brief Cache (offline viewing) ─────────────────────────────

export async function cacheBrief(sessionId: string, brief: Record<string, unknown>) {
  await db.briefs.put({ sessionId, brief, generatedAt: new Date().toISOString() });
}

export async function getCachedBrief(sessionId: string): Promise<CachedBrief | undefined> {
  return db.briefs.get(sessionId);
}

// ─── Outbox (offline mutation queue) ───────────────────────────

export async function enqueueMutation(
  type: MutationType,
  payload: Record<string, unknown>,
): Promise<number> {
  return db.mutations.add({
    type,
    payload,
    clientTimestamp: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: 'pending',
  });
}

export async function getPendingMutations(): Promise<OutboxMutation[]> {
  const pending = await db.mutations.where('status').equals('pending').toArray();
  // Oldest first — last-write-wins means the newest timestamp wins on replay.
  // Stable tie-break on id keeps insertion order when timestamps collide.
  return pending.sort((a, b) => {
    if (a.clientTimestamp !== b.clientTimestamp) {
      return a.clientTimestamp < b.clientTimestamp ? -1 : 1;
    }
    return (a.id ?? 0) - (b.id ?? 0);
  });
}

export async function getPendingMutationCount(): Promise<number> {
  return db.mutations.where('status').equals('pending').count();
}

export async function markMutationSynced(id: number): Promise<void> {
  await db.mutations.update(id, { status: 'synced' });
}

export async function markMutationFailed(id: number, attempts: number): Promise<void> {
  await db.mutations.update(id, { status: 'failed', attempts });
}

/** Purges all mutations that reached the terminal synced state. */
export async function clearSyncedMutations(): Promise<void> {
  await db.mutations.where('status').equals('synced').delete();
}

// ─── Sync Log (last-write-wins audit trail) ────────────────────

export async function logSyncEntry(entry: Omit<SyncLogEntry, 'id' | 'syncedAt'>) {
  await db.syncLog.add({ ...entry, syncedAt: new Date().toISOString() });
}

export async function getSyncLogs(limit = 100): Promise<SyncLogEntry[]> {
  const logs = await db.syncLog.orderBy('id').reverse().toArray();
  return logs.slice(0, limit);
}

// ─── Types for consumers ───────────────────────────────────────

export type {
  CachedPatient,
  CachedSession,
  CachedTranscripts,
  CachedBrief,
  OutboxMutation,
  SyncLogEntry,
};
