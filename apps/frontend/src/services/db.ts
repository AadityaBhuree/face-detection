import Dexie, { type Table } from 'dexie';
import { encryptJson, decryptJson } from './crypto';

// ─── Public shapes (what the rest of the app sees) ─────────────

/** Patient record cached for offline lookup. PII (name/dob/mobile/data)
 *  is encrypted at rest — only `id` and `lastSyncedAt` are plaintext. */
export interface CachedPatient {
  id: string;
  name: string;
  dob: string;
  mobile: string;
  lastSyncedAt: string;
  data: Record<string, unknown>;
}

export interface CachedSession {
  id: string;
  patientId: string | null;
  status: string;
  startedAt: string;
  localData: Record<string, unknown>;
}

/** Transcript entries cached per session for offline viewing. */
export interface CachedTranscripts {
  sessionId: string;
  entries: Array<{ speaker: string; text: string; timestamp: number }>;
  updatedAt: string;
}

/** Generated clinical brief cached per session for offline viewing. */
export interface CachedBrief {
  sessionId: string;
  brief: Record<string, unknown>;
  generatedAt: string;
}

export type MutationType = 'COMPLETE_SESSION' | 'REGISTER_PATIENT';

/** Outbox entry — an intake mutation queued while offline. The payload
 *  (embeddings, intake data, PII) is encrypted at rest. */
export interface OutboxMutation {
  id?: number;
  type: MutationType;
  payload: Record<string, unknown>;
  /** Client-side timestamp — the last-write-wins key when replaying. */
  clientTimestamp: string;
  createdAt: string;
  attempts: number;
  status: 'pending' | 'synced' | 'failed';
}

/** Sync log — audit trail of every replayed mutation. Kept PHI-free. */
export interface SyncLogEntry {
  id?: number;
  entityId: string;
  entityType: string;
  action: string;
  clientTimestamp: string;
  syncedAt: string;
  status: 'synced' | 'failed';
  note?: string;
}

// ─── At-rest row shapes (encrypted envelopes) ───────────────────

interface PatientRow {
  id: string;
  lastSyncedAt: string;
  enc: string;
}

interface SessionRow {
  id: string;
  patientId: string | null;
  status: string;
  startedAt: string;
  localDataEnc: string;
}

interface TranscriptRow {
  sessionId: string;
  updatedAt: string;
  enc: string;
}

interface BriefRow {
  sessionId: string;
  generatedAt: string;
  enc: string;
}

interface MutationRow {
  id?: number;
  type: MutationType;
  clientTimestamp: string;
  createdAt: string;
  attempts: number;
  status: 'pending' | 'synced' | 'failed';
  payloadEnc: string;
}

class JeevandataDB extends Dexie {
  patients!: Table<PatientRow, string>;
  sessions!: Table<SessionRow, string>;
  transcripts!: Table<TranscriptRow, string>;
  briefs!: Table<BriefRow, string>;
  mutations!: Table<MutationRow, number>;
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

    // v3 — PHI at rest is now encrypted. Any rows written by v1/v2 hold
    // plaintext PII, so we purge the sensitive caches on upgrade. They
    // repopulate on the next sync — losing an un-flushed outbox mutation
    // is preferable to leaving plaintext PHI on disk.
    this.version(3)
      .stores({
        patients: 'id, name, mobile, lastSyncedAt',
        sessions: 'id, patientId, status, startedAt',
        transcripts: 'sessionId, updatedAt',
        briefs: 'sessionId, generatedAt',
        mutations: '++id, type, status, createdAt',
        syncLog: '++id, entityId, entityType, syncedAt',
      })
      .upgrade(async (tx) => {
        await tx.table('patients').clear();
        await tx.table('transcripts').clear();
        await tx.table('briefs').clear();
        await tx.table('mutations').clear();
      });
  }
}

export const db = new JeevandataDB();

// ─── Patient Cache Operations ──────────────────────────────────

export async function cachePatient(patient: CachedPatient): Promise<void> {
  const enc = await encryptJson({
    name: patient.name,
    dob: patient.dob,
    mobile: patient.mobile,
    data: patient.data,
  });
  await db.patients.put({
    id: patient.id,
    lastSyncedAt: patient.lastSyncedAt,
    enc,
  });
}

async function decryptPatient(row: PatientRow): Promise<CachedPatient> {
  const inner = await decryptJson<{
    name: string;
    dob: string;
    mobile: string;
    data: Record<string, unknown>;
  }>(row.enc);
  return {
    id: row.id,
    lastSyncedAt: row.lastSyncedAt,
    name: inner.name,
    dob: inner.dob,
    mobile: inner.mobile,
    data: inner.data,
  };
}

export async function getCachedPatient(id: string): Promise<CachedPatient | undefined> {
  const row = await db.patients.get(id);
  return row ? decryptPatient(row) : undefined;
}

export async function searchCachedPatients(query: string): Promise<CachedPatient[]> {
  const rows = await db.patients.toArray();
  const q = query.toLowerCase();
  const patients = await Promise.all(rows.map(decryptPatient));
  return patients.filter((p) => p.name.toLowerCase().includes(q) || p.mobile.includes(q));
}

export async function getAllCachedPatients(): Promise<CachedPatient[]> {
  const rows = await db.patients.toArray();
  const patients = await Promise.all(rows.map(decryptPatient));
  return patients.sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Session Cache Operations ──────────────────────────────────

export async function cacheSession(session: CachedSession): Promise<void> {
  const localDataEnc = await encryptJson(session.localData);
  await db.sessions.put({
    id: session.id,
    patientId: session.patientId,
    status: session.status,
    startedAt: session.startedAt,
    localDataEnc,
  });
}

async function decryptSession(row: SessionRow): Promise<CachedSession> {
  const localData = await decryptJson<Record<string, unknown>>(row.localDataEnc);
  return {
    id: row.id,
    patientId: row.patientId,
    status: row.status,
    startedAt: row.startedAt,
    localData,
  };
}

export async function getCachedSession(id: string): Promise<CachedSession | undefined> {
  const row = await db.sessions.get(id);
  return row ? decryptSession(row) : undefined;
}

export async function getPendingSessions(): Promise<CachedSession[]> {
  const rows = await db.sessions.where('status').notEqual('COMPLETED').toArray();
  return Promise.all(rows.map(decryptSession));
}

// ─── Transcript Cache (offline viewing) ────────────────────────

export async function cacheTranscripts(sessionId: string, entries: CachedTranscripts['entries']) {
  const existing = await getCachedTranscriptEntries(sessionId);
  const merged = mergeTranscripts(existing, entries);
  const enc = await encryptJson(merged);
  await db.transcripts.put({
    sessionId,
    enc,
    updatedAt: new Date().toISOString(),
  });
  return merged;
}

async function getCachedTranscriptEntries(
  sessionId: string,
): Promise<CachedTranscripts['entries']> {
  const row = await db.transcripts.get(sessionId);
  if (!row) return [];
  try {
    return await decryptJson<CachedTranscripts['entries']>(row.enc);
  } catch {
    return []; // corrupt/undecryptable — start fresh rather than crash
  }
}

export async function getCachedTranscripts(
  sessionId: string,
): Promise<CachedTranscripts | undefined> {
  const row = await db.transcripts.get(sessionId);
  if (!row) return undefined;
  const entries = await getCachedTranscriptEntries(sessionId);
  return { sessionId: row.sessionId, entries, updatedAt: row.updatedAt };
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
  const enc = await encryptJson(brief);
  await db.briefs.put({ sessionId, enc, generatedAt: new Date().toISOString() });
}

export async function getCachedBrief(sessionId: string): Promise<CachedBrief | undefined> {
  const row = await db.briefs.get(sessionId);
  if (!row) return undefined;
  try {
    const brief = await decryptJson<Record<string, unknown>>(row.enc);
    return { sessionId: row.sessionId, brief, generatedAt: row.generatedAt };
  } catch {
    return undefined;
  }
}

// ─── Outbox (offline mutation queue) ───────────────────────────

export async function enqueueMutation(
  type: MutationType,
  payload: Record<string, unknown>,
): Promise<number> {
  const payloadEnc = await encryptJson(payload);
  return db.mutations.add({
    type,
    payloadEnc,
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
  const sorted = [...pending].sort((a, b) => {
    if (a.clientTimestamp !== b.clientTimestamp) {
      return a.clientTimestamp < b.clientTimestamp ? -1 : 1;
    }
    return (a.id ?? 0) - (b.id ?? 0);
  });

  const decrypted: OutboxMutation[] = [];
  for (const row of sorted) {
    try {
      decrypted.push({
        id: row.id,
        type: row.type,
        payload: await decryptJson<Record<string, unknown>>(row.payloadEnc),
        clientTimestamp: row.clientTimestamp,
        createdAt: row.createdAt,
        attempts: row.attempts,
        status: row.status,
      });
    } catch (error) {
      // A single corrupt payload (key rotation, partial write) must NOT block
      // the healthy mutations behind it. Terminate the unrecoverable row so
      // it stops retrying forever, log it, and keep the rest of the queue
      // replayable. The sync log note avoids embedding any raw payload text.
      if (row.id !== undefined) {
        await markMutationFailed(row.id, (row.attempts ?? 0) + 1);
        await logSyncEntry({
          entityId: `mutation-${row.id}`,
          entityType: row.type,
          action: 'DECRYPT_FAILED',
          clientTimestamp: row.clientTimestamp,
          status: 'failed',
          note: error instanceof Error ? error.message : 'Unable to decrypt queued mutation',
        });
      }
    }
  }
  return decrypted;
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
// Sync log entries are intentionally PHI-free (entityId is a session id
// or a mutation id — never a mobile number or patient name).

export async function logSyncEntry(entry: Omit<SyncLogEntry, 'id' | 'syncedAt'>) {
  await db.syncLog.add({ ...entry, syncedAt: new Date().toISOString() });
}

export async function getSyncLogs(limit = 100): Promise<SyncLogEntry[]> {
  const logs = await db.syncLog.orderBy('id').reverse().toArray();
  return logs.slice(0, limit);
}
