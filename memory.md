# AyuTalk Care — Codebase Intelligence & Memory

## Project Overview

**AyuTalk Care** is an enterprise-grade, privacy-first, AI-driven contactless patient intake and face-recognition platform for healthcare clinics and hospitals. It automates patient check-in at arrival using real-time camera-based face detection and recognition, matches the patient against vector embeddings in Qdrant, retrieves their EMR/PMS history, and initiates an AI Voice Intake Assistant powered by Google Gemini 2.0 Flash and Whisper STT. The system transcribes the patient's symptoms in real-time, extracts clinical metadata, screens for emergency risk flags, and compiles a structured Clinical Brief for the doctor before the patient steps into the consultation room.

---

## Why It Exists

Traditional clinic intake is manual, paper-heavy, and time-consuming. Patients fill forms at reception, staff manually enter data into PMS systems, and doctors spend valuable consultation time gathering basic history. AyuTalk Care automates this end-to-end:
1. **Face Recognition** eliminates the need for ID cards or phone numbers at check-in
2. **AI Voice Intake** replaces paper forms with natural conversation
3. **Clinical Brief Generation** gives doctors a concise, structured summary before seeing the patient
4. **Privacy-first design** stores no raw face images, only normalized numerical vectors

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | Next.js 14 (App Router), React 18 | PWA with offline support, camera interface |
| **On-Device Vision** | @mediapipe/tasks-vision (WASM/WebGL) | 478-point 3D face landmark detection |
| **Styling** | Tailwind CSS v3, Radix UI primitives, lucide-react | Design system with custom ayutalk colors |
| **State (Client)** | Zustand + devtools | Face detection & session state |
| **State (Server)** | TanStack Query (React Query) | API data caching & mutations |
| **Backend** | NestJS 10 (TypeScript) | Modular REST + WebSocket API |
| **Database** | PostgreSQL 16 + Prisma ORM | Relational persistence |
| **Vector DB** | Qdrant v1.13.0 | 512-dim face embedding similarity search |
| **Cache/Queue** | Redis 7 + BullMQ | Session state, pub/sub, background jobs |
| **AI LLM** | Google Gemini 2.0 Flash | Symptom intake agent & brief generator |
| **Fallback LLM** | Anthropic Claude | Redundancy if Gemini is unavailable |
| **STT** | Whisper.cpp (local) | Speech-to-text transcription |
| **Object Storage** | MinIO (dev) / Cloudflare R2 (prod) | Audio recordings & face images |
| **Auth** | JWT (Passport.js) | API authentication |
| **Real-time** | Socket.IO | Live session updates, transcription streaming |
| **Offline Cache** | Dexie (IndexedDB) | Patient & session cache for offline resilience |
| **Monorepo** | Turborepo + pnpm 9.15.4 | Workspace orchestration & caching |

---

## Project Structure

```
face-detection/
├── .gemini/
│   └── settings.json                    # AI coding assistant config
├── apps/
│   ├── frontend/                        # Next.js 14 PWA Application
│   │   ├── public/                      # Static assets, PWA manifest, icons
│   │   ├── src/
│   │   │   ├── app/                     # App Router pages & layouts
│   │   │   │   ├── layout.tsx           # Root layout (metadata, viewport, fonts)
│   │   │   │   ├── page.tsx             # Landing page — start new intake
│   │   │   │   ├── providers.tsx        # React Query provider wrapper
│   │   │   │   ├── globals.css          # Tailwind base, theme variables, custom styles
│   │   │   │   ├── dashboard/
│   │   │   │   │   └── page.tsx         # Doctor dashboard (active sessions, briefs, live conv.)
│   │   │   │   └── intake/
│   │   │   │       └── [id]/            # Dynamic intake session page (TBD)
│   │   │   ├── components/
│   │   │   │   ├── face/
│   │   │   │   │   └── face-overlay.tsx # Camera overlay with scan animation
│   │   │   │   ├── intake/
│   │   │   │   │   └── brief-card.tsx   # Clinical brief display card
│   │   │   │   └── ui/                  # Reusable UI primitives
│   │   │   │       ├── button.tsx       # CVA-based button with variants
│   │   │   │       ├── badge.tsx        # Status badge component
│   │   │   │       └── card.tsx         # Card component
│   │   │   ├── hooks/                   # Custom React hooks
│   │   │   │   ├── useCamera.ts         # WebRTC camera access & control
│   │   │   │   ├── useFaceDetection.ts  # MediaPipe face landmarker integration
│   │   │   │   ├── useFaceEmbedding.ts  # Embedding generation & Qdrant search
│   │   │   │   ├── useLivenessDetection.ts # EAR-based blink detection
│   │   │   │   ├── useIntakeConversation.ts # AI conversation management
│   │   │   │   ├── useTranscription.ts  # WebSocket transcription listener
│   │   │   │   ├── useVoiceRecorder.ts  # MediaRecorder audio capture & streaming
│   │   │   │   └── use-toast.ts         # Toast notification system
│   │   │   ├── lib/                     # Core library code
│   │   │   │   ├── face-embedding.ts    # 512-dim embedding generation pipeline
│   │   │   │   ├── face-geometry.ts     # EAR calculation, face alignment, landmark constants
│   │   │   │   └── utils.ts             # cn(), date formatters, API/WS base URLs
│   │   │   ├── services/                # API & data services
│   │   │   │   ├── api.ts              # REST API client (intake, face, dashboard, AI endpoints)
│   │   │   │   ├── socket.ts           # Socket.IO client service
│   │   │   │   └── db.ts               # Dexie IndexedDB for offline caching
│   │   │   └── stores/                  # Zustand state stores
│   │   │       ├── face-store.ts        # Face detection state (status, faces, liveness, embedding)
│   │   │       └── session-store.ts     # Session state (status, patient, transcripts, brief)
│   │   ├── next.config.js               # PWA config, image optimization, standalone output
│   │   ├── tailwind.config.ts           # Theme: ayutalk colors, CSS variables, animations
│   │   ├── tsconfig.json                # Path aliases (@/* → ./src/*)
│   │   └── package.json                 # Dependencies: next, react, mediapipe, radix, zustand, dexie
│   │
│   └── backend/                         # NestJS 10 API Server
│       ├── prisma/
│       │   ├── schema.prisma            # DB schema: Patient, IntakeSession, FaceEmbedding, etc.
│       │   └── seed.ts                  # Database seed script
│       └── src/
│           ├── main.ts                  # Entry point: NestFactory, CORS, helmet, global pipes/filters
│           ├── app.module.ts            # Root module: imports all domain modules
│           ├── config/
│           │   └── configuration.ts     # Typed config from env vars (all services)
│           ├── logger/
│           │   └── logger.module.ts     # Scaffolding module (Logger used directly via new Logger())
│           ├── prisma/
│           │   ├── prisma.module.ts     # Global Prisma service module
│           │   └── prisma.service.ts    # Prisma client singleton
│           ├── common/
│           │   ├── decorators/          # Custom decorators (TBD)
│           │   ├── filters/
│           │   │   └── http-exception.filter.ts  # Global exception → JSON error response
│           │   ├── guards/
│           │   │   └── jwt-auth.guard.ts         # JWT auth with public endpoint support
│           │   ├── interceptors/
│           │   │   ├── transform.interceptor.ts  # Wraps responses in { status, data, timestamp, path }
│           │   │   └── logging.interceptor.ts    # HTTP request logging with correlation ID
│           │   ├── middleware/
│           │   │   └── correlation-id.middleware.ts # X-Correlation-Id propagation
│           │   └── pipes/              # Validation pipes (TBD)
│           └── modules/
│               ├── face/
│               │   ├── face.module.ts            # Face recognition module
│               │   ├── face.service.ts           # Qdrant CRUD + vector search
│               │   ├── face.controller.ts        # REST endpoints for face search/registration
│               │   └── face-registration.service.ts # Patient registration with embedding
│               ├── ai/
│               │   ├── ai.module.ts              # AI module (exporting both services)
│               │   ├── intake-agent.service.ts   # Gemini-powered conversational intake agent
│               │   └── brief-generator.service.ts # Gemini-powered clinical brief generation
│               ├── intake/
│               │   ├── intake.module.ts          # Intake session management module
│               │   ├── intake.service.ts         # Session lifecycle: create, complete, brief gen
│               │   └── intake.controller.ts      # REST endpoints for intake CRUD
│               ├── session/
│               │   ├── session.module.ts         # Real-time session management module
│               │   ├── session.service.ts        # Session state & WebSocket gateway management
│               │   └── session.gateway.ts        # Socket.IO gateway for real-time events
│               ├── transcription/
│               │   ├── transcription.module.ts   # Speech-to-text module
│               │   ├── transcription.service.ts  # Whisper API integration
│               │   └── transcription.controller.ts # REST endpoints for transcription
│               ├── dashboard/
│               │   ├── dashboard.module.ts       # Doctor dashboard module
│               │   ├── dashboard.service.ts      # Dashboard queries & aggregation
│               │   └── dashboard.controller.ts   # REST endpoints for dashboard data
│               ├── audit/
│               │   ├── audit.module.ts           # Compliance audit logging module
│               │   └── audit.service.ts          # Audit log creation & query
│               └── pms/
│                   ├── pms.module.ts             # PMS/EMR synchronization module
│                   ├── pms.service.ts            # PMS sync logic (HL7 FHIR / custom)
│                   └── pms.controller.ts         # REST endpoints for PMS operations
│
├── packages/
│   ├── shared-schemas/                  # Zod validation schemas (cross-platform)
│   │   └── src/index.ts                # Patient, face, intake, transcript, AI, audit schemas
│   ├── shared-types/                    # TypeScript interfaces & enums
│   │   └── src/index.ts                # Patient, SessionStatus, ClinicalBrief, WsEvent, ApiResponse
│   └── shared-utils/                    # Utility functions
│       └── src/index.ts                # generateUlid, cosineSimilarity, withRetry, sanitizeForLogging
│
├── docker-compose.yml                   # 7 services: postgres, redis, qdrant, minio, whisper, minio-init, redis-commander
├── Dockerfile.backend                   # Multi-stage build for NestJS
├── Dockerfile.frontend                  # Multi-stage build for Next.js (standalone)
├── docker-init/
│   └── postgres-init.sql               # Extensions (uuid-ossp, pgcrypto, vector), schemas
├── turbo.json                           # Task pipeline: build → lint → typecheck → test
├── pnpm-workspace.yaml                  # Workspace: apps/*, packages/*
├── package.json                         # Root scripts, devDependencies, lint-staged, husky
├── tsconfig.base.json                   # Shared TS config: ES2022, strict, bundler resolution
├── .eslintrc.js                         # ESLint: TS strict, no any, consistent imports
├── .prettierrc                          # Prettier formatting config
├── .prettierignore                      # Ignored paths
├── .env.example                         # Full environment variable reference with defaults
└── readme.md                            # Project documentation & architecture diagram
```

---

## Data Flow

### 1. Patient Arrival → Face Detection → Identity Match

```
Patient arrives → Camera activates (useCamera)
                → MediaPipe face_landmarker.task (useFaceDetection)
                    → 478 3D landmarks detected
                → Liveness check: EAR blink detection (useLivenessDetection)
                    → Requires 2 blinks within 8s window
                → Embedding generation (face-embedding.ts)
                    → Select 132 identity landmarks → normalize to nose tip
                    → Generate 396 coordinate values + 12 stats + distance features
                    → Pad to 512 dimensions → L2 normalize
                → POST /face/search (api.ts → faceApi.searchByFace)
                    → Qdrant cosine similarity search (threshold ≥ 0.82)
                → Match found → load patient context
                → No match → prompt for registration
```

### 2. AI Voice Intake Conversation

```
(Match found)
→ POST /intake/session → creates session in DB (status: INITIATED)
→ WebSocket join session room (socketService.joinSession)
→ useIntakeConversation.startConversation(patientName)
    → POST /ai/intake-turn (IntakeAgentService → Gemini 2.0 Flash)
    → AI greeting returned → displayed to patient
→ Patient speaks → useVoiceRecorder captures audio chunks
    → MediaRecorder → Opus audio → WebSocket audio:chunk events
    → Backend → Whisper STT → transcription text
    → Socket.IO transcript:chunk events back to frontend
→ useTranscription receives transcript
→ useIntakeConversation.sendPatientMessage(text)
    → POST /ai/intake-turn with conversation history
    → Gemini generates follow-up question
→ Loop continues until intakeComplete = true
```

### 3. Clinical Brief Generation

```
(intakeComplete = true)
→ useIntakeConversation.completeIntake()
    → POST /intake/session/:id/complete
    → IntakeService.completeWithIntake()
        → Update session status to TRANSCRIBING
        → Build transcript from DB
        → BriefGeneratorService.generate()
            → Gemini generates structured ClinicalBrief JSON
        → Save IntakeRecord to DB (brief + intakeData)
        → Update session status to BRIEF_GENERATED
    → Socket.IO brief:ready event emitted
→ Dashboard receives brief:ready → shows in briefs list
→ Doctor reviews brief → marks as reviewed → session COMPLETED
```

---

## Database Schema (Prisma)

### Tables

| Table | Purpose | Key Fields | Relations |
|---|---|---|---|
| `patients` | Patient demographics & consent | id, name, dob, mobile, aadhaarRef(SHA-256), consentGranted | → FaceEmbedding, IntakeSession, IntakeRecord |
| `face_embeddings` | Face embedding metadata (vectors in Qdrant) | id, patientId, capturedAt | → Patient |
| `intake_sessions` | Full session FSM tracking | id, patientId, status(enum), deviceId, metadata(JSON) | → Patient, SessionTranscript, IntakeRecord |
| `session_transcripts` | Per-session conversation entries | id, sessionId, speaker, text, timestampMs | → IntakeSession |
| `intake_records` | Clinical brief + intake data | id, sessionId, patientId, brief(JSON), intakeData(JSON) | → IntakeSession, Patient |
| `audit_logs` | Immutable compliance trail | id, action, actorId, actorRole, resourceType, resourceId, details(JSON), ipAddress | — |
| `clinic_users` | Staff accounts | id, email, passwordHash, role(enum), clinicId, isActive | — |
| `pms_patient_cache` | Offline PMS patient cache | id, patientId(unique), data(JSON), lastSyncedAt | — |

### SessionStatus FSM

```
INITIATED → FACE_MATCHED → CONTEXT_LOADED → INTAKE_IN_PROGRESS
→ TRANSCRIBING → BRIEF_GENERATED → SYNCED → COMPLETED
                                   (FAILED / TIMED_OUT at any point)
```

### Key Design Decisions
- **Face embeddings stored only in Qdrant**, not in PostgreSQL (vector column would bloat relational DB)
- **`face_embeddings` table** stores only metadata (patientId, capturedAt) — the actual 512-dim vectors live in Qdrant
- **Brief and intake data stored as JSON** in PostgreSQL (flexible schema, no complex joins needed)
- **Aadhaar stored as SHA-256 hash only** — never plaintext
- **Extensions**: `uuid-ossp`, `pgcrypto`, `vector` (pgvector for potential future vector operations)

---

## Frontend Architecture

### State Management

**Zustand Stores:**
- `face-store.ts`: Tracks `DetectionStatus`, detected `faces[]`, `embedding`, `matchResult`, `livenessStatus`, `livenessEar`, `blinkCount`
- `session-store.ts`: Tracks `SessionStatus`, `patient`, `transcripts[]`, `brief`, `isRecording`, `isAiThinking`

**TanStack Query:** Used for API data fetching (dashboard sessions, briefs) with:
- staleTime: 5 minutes
- gcTime: 30 minutes
- retry: 2 for queries, 1 for mutations
- refetchOnWindowFocus: disabled

**Dexie (IndexedDB):** Offline-first caching for:
- `patients` table: cached patient records by id, name, mobile
- `sessions` table: cached session records by id, status, startedAt

### Custom Hooks

| Hook | Responsibility | Key Integration |
|---|---|---|
| `useCamera` | WebRTC getUserMedia, stream management | Returns videoRef, start/stop/captureFrame |
| `useFaceDetection` | MediaPipe FaceLandmarker initialization, frame loop | Returns result, isFaceDetected, fps, startDetection |
| `useLivenessDetection` | EAR calculation, blink counting, challenge timeout | Returns status, blinkCount, ear, processFrame |
| `useFaceEmbedding` | Embedding generation from landmarks, Qdrant search | Returns searchIdentity, registerEmbedding, matchResult |
| `useIntakeConversation` | AI conversation turns, completeIntake | Returns turns, sendPatientMessage, startConversation |
| `useTranscription` | WebSocket transcript:chunk listener | Returns interimText, finalText, isProcessing |
| `useVoiceRecorder` | MediaRecorder capture, Opus chunk streaming, audio level | Returns isRecording, audioLevel, toggleRecording |
| `useToast` | Toast notification system | Returns toast(), dismiss(), toasts[] |

### Services

| Service | Purpose | Key Methods |
|---|---|---|
| `api.ts` | REST API client | intakeApi, faceApi, dashboardApi, aiApi |
| `socket.ts` | Socket.IO client singleton | connect, joinSession, onTranscriptChunk, onBriefReady, sendConversationTurn, sendAudioChunk |
| `db.ts` | Dexie IndexedDB | cachePatient, getCachedPatient, searchCachedPatients, cacheSession, getPendingSessions |

### Face Detection Pipeline (in detail)

1. **`useFaceDetection`** initializes `FaceLandmarker` from MediaPipe with GPU delegate
   - Model: `face_landmarker.task` (Float16, latest from GCS)
   - Running mode: VIDEO (frame-by-frame with timestamp)
   - Returns: 478 3D landmarks per face, optional blendshapes & face matrix

2. **`useLivenessDetection`** prevents photo/video spoofing
   - Algorithm: Eye Aspect Ratio (EAR) = (|p2-p6| + |p3-p5|) / (2 × |p1-p4|)
   - Threshold: EAR < 0.20 = eye closed, requires ≥ 2 consecutive frames
   - Challenge: 2 blinks within 8 seconds
   - Uses landmarks from `FACE_LANDMARK_INDICES.LEFT_EYE` (indices 33,7,163,...,246) and `RIGHT_EYE` (indices 362,382,...,398)

3. **`face-embedding.ts`** generates 512-dim normalized vector
   - Selects 132 identity landmarks from 478 (eyes, eyebrows, nose, mouth, jaw)
   - Normalizes relative to nose tip (translation invariance)
   - Creates vector: 132 × 3 (x,y,0) = 396 + 12 stats (min/max/mean/std for x,y) + distance features
   - Distance features: inter-pupillary, nose-to-eye, mouth width, mouth-to-nose
   - Pads to 512, then L2 normalizes

4. **`useFaceEmbedding`** sends embedding to backend with rate limiting (2s cooldown between searches)
   - Backend `FaceService` queries Qdrant with cosine similarity, threshold ≥ 0.82
   - Returns match with patientId + score, or indicates new patient

---

## Backend Architecture

### Module Dependency Graph

```
AppModule
├── LoggerModule (scaffolding only)
├── PrismaModule (Global — provides PrismaService everywhere)
├── FaceModule
│   ├── FaceService (Qdrant client, collection management)
│   ├── FaceRegistrationService (patient + embedding registration)
│   └── FaceController (REST endpoints)
├── AiModule
│   ├── IntakeAgentService (Gemini conversation agent)
│   └── BriefGeneratorService (Gemini brief generator)
├── IntakeModule
│   ├── IntakeService (session CRUD, completion flow)
│   ├── IntakeController (REST endpoints)
│   └── imports: SessionModule, AiModule
├── SessionModule
│   ├── SessionService (status updates, room management)
│   ├── SessionGateway (Socket.IO, event handling)
│   └── imports: TranscriptionModule
├── TranscriptionModule
│   ├── TranscriptionService (Whisper API integration)
│   └── TranscriptionController
├── DashboardModule
│   ├── DashboardService (aggregated queries)
│   └── DashboardController
├── AuditModule
│   └── AuditService (log creation)
└── PmsModule
    ├── PmsService (EMR sync)
    └── PmsController
```

### API Endpoints

#### Face Module
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/face/search-with-details` | Search Qdrant + return patient details |
| POST | `/face/register-patient` | Register new patient + store embedding |
| POST | `/face/embedding` | Upsert vector into Qdrant |
| POST | `/face/search` | Raw vector similarity search |
| GET | `/face/:patientId/embeddings` | Retrieve embedding history for a patient |

#### Intake Module
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/intake/session` | Create new intake session |
| GET | `/intake/session/:id` | Get session details + transcripts + records |
| POST | `/intake/session/:id/complete` | Complete intake + generate brief |
| GET | `/intake/session/:id/status` | Get session status only |

#### AI Module
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/ai/intake-turn` | Single turn with Gemini Intake Agent |
| POST | `/ai/generate-brief` | Generate structured clinical brief |

#### Dashboard Module
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/dashboard/active-sessions` | Get active sessions (paginated) |
| GET | `/dashboard/recent-briefs` | Get recent briefs (paginated) |
| GET | `/dashboard/patient/:id/latest-brief` | Get latest brief for a patient |
| GET | `/dashboard/patient/:id/history` | Get visit history for a patient |
| PATCH | `/brief/:id/review` | Mark brief as reviewed |

#### WebSocket Events (Session Gateway)
| Event | Direction | Purpose |
|---|---|---|
| `session:status` | Server → Client | Session status change notification |
| `session:updated` | Server → Client | Full session data update |
| `transcript:chunk` | Server → Client | Real-time transcription (interim/final) |
| `transcript:final` | Server → Client | Final transcription result |
| `brief:ready` | Server → Client | New clinical brief available |
| `face:matched` | Server → Client | Face identity matched |
| `face:no_match` | Server → Client | No matching identity found |
| `conversation:turn` | Bidirectional | AI/patient conversation turn |
| `audio:chunk` | Client → Server | Audio data for Whisper transcription |
| `join:session` | Client → Server | Join session room |
| `leave:session` | Client → Server | Leave session room |
| `error` | Server → Client | Error notification |

### Common Infrastructure

1. **HttpExceptionFilter** — Global exception handler
   - Catches all exceptions (HttpException and unexpected errors)
   - Formats to `{ status: 'error', error: { code, message, details }, timestamp, path }`
   - Handles class-validator errors (maps to VALIDATION_ERROR)
   - In production, hides internal error messages

2. **TransformInterceptor** — Wraps successful responses
   - Output: `{ status: 'success', data, timestamp, path }`

3. **LoggingInterceptor** — HTTP request logging
   - Logs: `METHOD /path STATUS_CODE DURATIONms [CORRELATION_ID]`
   - Uses pino-compatible Logger

4. **CorrelationIdMiddleware** — Request tracing
   - Reads `X-Correlation-Id` header or generates UUID
   - Sets response header for downstream propagation

5. **JwtAuthGuard** — Authentication guard
   - Supports `@Public()` decorator for public endpoints
   - Uses Passport JWT strategy

---

## Infrastructure (Docker Compose)

| Service | Image | Port | Purpose | Health Check |
|---|---|---|---|---|
| postgres | postgres:16-alpine | 5432 | Primary database | pg_isready |
| redis | redis:7-alpine | 6379 | Cache + queue | redis-cli ping |
| qdrant | qdrant/qdrant:v1.13.0 | 6333, 6334 | Vector database | /health endpoint |
| minio | minio/minio | 9000, 9001 | S3-compatible storage | mc ready |
| minio-init | minio/mc | — | Auto-creates ayutalk-media bucket | — |
| whisper | whisper.cpp:server | 9001 | Speech-to-text | — |
| redis-commander | rediscommander/redis-commander | 8081 | Redis admin UI (devtools profile) | — |

Volumes: postgres-data, redis-data, qdrant-storage, minio-data, whisper-models

Database init (`postgres-init.sql`): Enables uuid-ossp, pgcrypto, vector extensions. Creates ayutalk and audit schemas.

---

## Environment Variables

Key environment variables (see `.env.example` for full list):

| Variable | Default | Purpose |
|---|---|---|
| DATABASE_URL | postgresql://ayutalk:ayutalk_secret@localhost:5432/ayutalk_care | PostgreSQL connection |
| REDIS_URL | redis://default:redis_secret@localhost:6379 | Redis connection |
| QDRANT_URL | http://localhost:6333 | Qdrant REST API |
| GOOGLE_GEMINI_API_KEY | — | Gemini 2.0 Flash API key |
| ANTHROPIC_API_KEY | — | Claude fallback API key |
| JWT_SECRET | change-this-to-a-strong-random-secret | JWT signing secret |
| FACE_MATCH_THRESHOLD | 0.82 | Cosine similarity threshold |
| FACE_EMBEDDING_DIM | 512 | Embedding vector dimension |
| NEXT_PUBLIC_API_URL | http://localhost:4000 | Frontend API base URL |
| NEXT_PUBLIC_WS_URL | http://localhost:4000 | Frontend WebSocket URL |

---

## Coding Standards & Conventions

### TypeScript
- Strict mode enabled (`noUncheckedIndexedAccess`, `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`)
- `no-explicit-any` is enforced as an error
- `consistent-type-imports` with `prefer: 'type-imports'`
- No console.log allowed (use Logger in backend)

### Naming
- Files: kebab-case (e.g., `face-embedding.ts`, `http-exception.filter.ts`)
- Components: PascalCase (e.g., `FaceOverlay`, `BriefCard`)
- Hooks: camelCase with `use` prefix (e.g., `useFaceDetection`)
- Services/Controllers: PascalCase (e.g., `FaceService`, `IntakeController`)
- Stores: kebab-case (e.g., `face-store.ts`)
- Database tables: snake_case (e.g., `intake_sessions`, `face_embeddings`)

### React Components
- All interactive components use `'use client'`
- UI components use Radix Slot for asChild pattern
- Variants managed by CVA (class-variance-authority)
- Conditional classes via `cn()` utility (clsx + tailwind-merge)

### Imports
- Frontend: `@/` maps to `./src/*`
- Backend: relative imports within module
- Shared packages: `@ayutalk/shared-schemas`, `@ayutalk/shared-types`, `@ayutalk/shared-utils`

### Testing
- Backend: Jest with ts-jest, Supertest for e2e
- Test files: `*.spec.ts` in `test/` directories
- Prisma seed: `prisma/seed.ts`

---

## Common Gotchas & Notes

1. **The frontend uses `crypto.randomUUID()`** which requires a secure context (HTTPS or localhost)
2. **MediaPipe WASM files** are loaded from CDN — offline usage requires local hosting of WASM binaries
3. **The `useFaceEmbedding` hook has a 2-second cooldown** between searches to prevent Qdrant rate limiting
4. **Gemini uses `model` role** in API, not `assistant` — the service maps this correctly
5. **Backend fallbacks exist** for when GOOGLE_GEMINI_API_KEY is not set — returns placeholder responses
6. **The `completeIntake` function** in `useIntakeConversation` currently uses `turnsRef.current[0]?.content` as chief complaint — this is a placeholder and needs proper structured data extraction
7. **The dashboard `page.tsx`** has inline type definitions (`ActiveSession`, `BriefRecord`) that should ideally be in shared-types
8. **Whisper server** runs on port 9001 (same as MinIO console) — be careful about port conflicts
9. **PWA caching** uses `NetworkFirst` for API calls and `CacheFirst` for images with a 30-day expiry
10. **Eyes EAR calculation** uses six eye landmarks with specific MediaPipe index mapping — changes to MediaPipe model version may break indices

---

## Running the Project

```bash
# Install dependencies
pnpm install

# Start infrastructure services (Docker required)
pnpm docker:up

# Generate Prisma client
pnpm db:generate

# Run database migrations
pnpm db:migrate

# Seed database
pnpm db:seed

# Start development (frontend :3000 + backend :4000)
pnpm dev

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Testing
pnpm test

# Build for production
pnpm build
```
