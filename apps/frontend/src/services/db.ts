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

class JeevandataDB extends Dexie {
  patients!: Table<CachedPatient, string>;
  sessions!: Table<CachedSession, string>;

  constructor() {
    super('Jeevandata');

    this.version(1).stores({
      patients: 'id, name, mobile, lastSyncedAt',
      sessions: 'id, patientId, status, startedAt',
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
