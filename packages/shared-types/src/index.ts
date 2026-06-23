// ─── Session Status (FSM) ───────────────────────────────────────
export enum SessionStatus {
  INITIATED = 'INITIATED',
  FACE_MATCHED = 'FACE_MATCHED',
  CONTEXT_LOADED = 'CONTEXT_LOADED',
  INTAKE_IN_PROGRESS = 'INTAKE_IN_PROGRESS',
  TRANSCRIBING = 'TRANSCRIBING',
  BRIEF_GENERATED = 'BRIEF_GENERATED',
  SYNCED = 'SYNCED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  TIMED_OUT = 'TIMED_OUT',
}

export enum BriefStatus {
  PENDING = 'PENDING',
  TRANSCRIBING = 'TRANSCRIBING',
  ANALYZING = 'ANALYZING',
  READY = 'READY',
  FAILED = 'FAILED',
}

export enum UserRole {
  RECEPTIONIST = 'RECEPTIONIST',
  DOCTOR = 'DOCTOR',
  ADMIN = 'ADMIN',
  SYSTEM = 'SYSTEM',
}

// ─── Core Data Types ────────────────────────────────────────────

export interface Patient {
  id: string;
  name: string;
  dob: string;
  mobile: string;
  aadhaarRef: string | null;
  consentGranted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FaceEmbedding {
  id: string;
  patientId: string;
  vector: number[];
  capturedAt: string;
}

export interface IntakeSession {
  id: string;
  patientId: string | null;
  startedAt: string;
  endedAt: string | null;
  status: SessionStatus;
  deviceId: string;
  metadata: Record<string, unknown>;
}

export interface SymptomEntry {
  name: string;
  duration: string;
  severity: number;
}

export interface IntakeData {
  chiefComplaint: string;
  symptoms: SymptomEntry[];
  associated: string[];
  medicationChanges: string;
  allergyUpdates: string;
  patientNotes: string;
}

export interface ClinicalBrief {
  summary: string;
  chiefComplaint: string;
  riskFlags: string[];
  vitalsToCheck: string[];
  suggestedFollowups: string[];
  medicationsNote: string;
  icd10Hints: string[];
}

export interface IntakeRecord {
  id: string;
  sessionId: string;
  patientId: string;
  brief: ClinicalBrief;
  intakeData: IntakeData;
  transcriptSummary: string;
  generatedAt: string;
}

export interface SessionTranscriptEntry {
  sessionId: string;
  speaker: 'patient' | 'ai' | 'system';
  text: string;
  timestampMs: number;
}

export interface PatientContext {
  patientId: string;
  demographics: Partial<Patient>;
  visitHistory: VisitSummary[];
  chronicConditions: string[];
  currentMedications: MedicationEntry[];
  upcomingAppointment: AppointmentSlot | null;
  riskFlags: string[];
}

export interface VisitSummary {
  visitId: string;
  date: string;
  chiefComplaint: string;
  doctor: string;
  department: string;
}

export interface MedicationEntry {
  name: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate: string | null;
  prescribedBy: string;
}

export interface AppointmentSlot {
  id: string;
  date: string;
  time: string;
  doctor: string;
  department: string;
  status: AppointmentStatus;
}

export enum AppointmentStatus {
  SCHEDULED = 'SCHEDULED',
  CHECKED_IN = 'CHECKED_IN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actorId: string;
  actorRole: UserRole;
  resourceType: string;
  resourceId: string;
  details: Record<string, unknown>;
  ipAddress: string;
  timestamp: string;
}

// ─── WebSocket Event Types ──────────────────────────────────────

export enum WsEvent {
  SESSION_UPDATED = 'session:updated',
  SESSION_STATUS = 'session:status',
  TRANSCRIPT_CHUNK = 'transcript:chunk',
  TRANSCRIPT_FINAL = 'transcript:final',
  BRIEF_READY = 'brief:ready',
  FACE_MATCHED = 'face:matched',
  FACE_NO_MATCH = 'face:no_match',
  ERROR = 'error',
  PING = 'ping',
  PONG = 'pong',
}

export interface WsMessage<T = unknown> {
  event: WsEvent;
  sessionId: string;
  payload: T;
  timestamp: string;
}

// ─── API Response Types ─────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  status: 'success' | 'error';
  data?: T;
  error?: ApiError;
  timestamp: string;
  path: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
