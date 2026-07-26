# AyuTalk Care — Engineering Roadmap

> **Version:** 0.1.0 | **Status:** Active Development
> **Phases 1 & 5 Complete** — Proceeding through Phases 2–6

---

## How to Use This Plan

Each phase contains numbered steps. Every step is sized for a **single atomic commit** — one logical change that can be reviewed, tested, and pushed independently. Steps within a phase can be parallelized where indicated.

**Commit convention per step:** `feat:`, `fix:`, `test:`, `style:`, `refactor:`, `docs:`, `chore:`, `perf:`

---

## Progress Overview

| Phase | Title                          | Status             | Steps        | Est. Effort |
| :---- | :----------------------------- | :----------------- | :----------- | :---------- |
| **1** | Emergency Repairs              | ✅ **Done**        | 7/7          | Completed   |
| **2** | Testing & Validation           | ⬜ **Not started** | 8            | 8–12h       |
| **3** | Backend Production Hardening   | ⬜ **Not started** | 7            | 10–14h      |
| **4** | Authentication & Multi-Tenancy | ⬜ **Not started** | 6            | 8–10h       |
| **5** | UI/UX Excellence               | ✅ **Done**        | 8            | Completed   |
| **6** | Feature Expansion              | ⬜ **Not started** | 7            | 14–20h      |
| **7** | Infrastructure & Deployment    | ⬜ **Not started** | 6            | 8–12h       |
|       | **Total remaining**            |                    | **34 steps** | **48–68h**  |

---

## Phase 1 — Emergency Repairs ✅

> **Goal:** Fix critical auth gaps, add input validation, rate limiting, and session timeout enforcement.

| Step    | Description                                                            | Status | Files                                                                      |
| :------ | :--------------------------------------------------------------------- | :----- | :------------------------------------------------------------------------- |
| 1.1–1.4 | `@Public()` decorator, JWT strategy, AuthModule, mark endpoints public | ✅     | `common/decorators/`, `common/strategies/`, `auth/`, `app.module.ts`       |
| 1.5     | Complete Zod validation on all controllers (Dashboard, Transcription)  | ✅     | `shared-schemas`, `dashboard.controller.ts`, `transcription.controller.ts` |
| 1.6     | Rate limiting on face search endpoints (10 req/min)                    | ✅     | `face.controller.ts`                                                       |
| 1.7     | BullMQ session timeout worker (auto-close stale sessions)              | ✅     | `session-timeout.worker.ts`, `session.module.ts`                           |

---

## Phase 2 — Testing & Validation

> **Goal:** Achieve >70% backend coverage, validate all FSM transitions, add E2E tests for critical paths, and set up frontend testing.

**Existing test coverage (4 service specs):**

- `AuditService` — 11 tests (log, query, pagination, edge cases) ✅
- `FaceService` — 11 tests (init, upsert, search, scroll, edge cases) ✅
- `IntakeService` — 10 tests (session CRUD, FSM, error propagation) ✅
- `SessionService` — 14 tests (state machine FSM, Redis cache, inactivity timeout) ✅

### Step 2.1 — Backend: Controller E2E tests

Create Supertest-based E2E tests for all 6 controllers. These validate the full HTTP layer: route resolution, Zod validation, error formatting, response shape.

| Controller                | Endpoints to cover                                                                   | Key edge cases                                         |
| :------------------------ | :----------------------------------------------------------------------------------- | :----------------------------------------------------- |
| `FaceController`          | POST search, POST search-with-details, POST register, POST embedding, GET embeddings | Invalid UUID, threshold out of range, missing vector   |
| `IntakeController`        | POST session, GET session/:id, POST complete, GET status                             | Session not found, already completed, missing deviceId |
| `AiController`            | POST intake-agent, POST brief                                                        | Missing sessionId, empty conversation, invalid schema  |
| `DashboardController`     | GET active-sessions, GET recent-briefs, GET latest-brief, PATCH review, GET history  | Negative page, missing patientId, UUID validation      |
| `TranscriptionController` | POST transcribe, GET transcript                                                      | Invalid audioUrl, missing sessionId, pagination        |
| `PmsController`           | POST sync                                                                            | Missing target system, invalid UUIDs                   |

**Files to create:** `test/face.e2e-spec.ts`, `test/intake.e2e-spec.ts`, `test/ai.e2e-spec.ts`, `test/dashboard.e2e-spec.ts`, `test/transcription.e2e-spec.ts`, `test/pms.e2e-spec.ts`
**Est. effort:** 3–4h

### Step 2.2 — Backend: Remaining service unit tests

Write unit tests for services that currently have none.

| Service                   | Key behaviors to test                                                            |
| :------------------------ | :------------------------------------------------------------------------------- |
| `DashboardService`        | Aggregation queries, empty results, pagination edge cases                        |
| `TranscriptionService`    | Whisper API call, retry logic, timeout handling, error normalization             |
| `PmsService`              | EMR sync flow, cache lookup on network failure, HL7 FHIR mapping                 |
| `AiService`               | Gemini API call, retry with backoff, fallback to Claude, empty response handling |
| `BriefGeneratorService`   | Schema validation of Gemini output, risk flag extraction, ICD-10 hint generation |
| `IntakeAgentService`      | Conversation history management, emergency screening, turn-by-turn flow          |
| `FaceRegistrationService` | Combined Qdrant + Prisma transaction, duplicate detection, consent check         |

**Files to modify/create:** `*.service.spec.ts` for each missing service
**Est. effort:** 3–4h

### Step 2.3 — Backend: Guard & validation pipe tests

Test the auth infrastructure and validation pipes that protect every endpoint.

| Component              | Tests                                                                                  |
| :--------------------- | :------------------------------------------------------------------------------------- |
| `JwtAuthGuard`         | Valid token, expired token, missing header, malformed token, `@Public()` bypass        |
| `ZodValidationPipe`    | Valid input, invalid input (each error type), empty body, extra fields (stripped)      |
| `HttpExceptionFilter`  | NestJS HTTP exception, unexpected error, class-validator error, production mode hiding |
| `TransformInterceptor` | Successful response shape, paginated response shape                                    |
| `LoggingInterceptor`   | Correlation ID propagation, duration calculation                                       |

**Files to create:** `common/guards/jwt-auth.guard.spec.ts`, `common/pipes/zod-validation.pipe.spec.ts`, `common/filters/http-exception.filter.spec.ts`, `common/interceptors/transform.interceptor.spec.ts`
**Est. effort:** 2h

### Step 2.4 — Backend: BullMQ worker tests

Test the session timeout worker and any future background jobs.

| Worker                 | Tests                                                                                                                         |
| :--------------------- | :---------------------------------------------------------------------------------------------------------------------------- |
| `SessionTimeoutWorker` | Stale session found → marked TIMED_OUT, no stale sessions → no-op, Prisma error → logged, queue connection failure → graceful |

**Files to create:** `modules/session/session-timeout.worker.spec.ts`
**Est. effort:** 1h

### Step 2.5 — Frontend: Hook unit tests

Test the custom hooks that contain the core business logic.

| Hook                    | Key behaviors to test                                                             |
| :---------------------- | :-------------------------------------------------------------------------------- |
| `useFaceDetection`      | MediaPipe initialization, frame loop, face detection callback, cleanup on unmount |
| `useLivenessDetection`  | EAR calculation, blink counting, challenge timeout, `isAlive` flag                |
| `useFaceEmbedding`      | Embedding generation, Qdrant search, 2s cooldown, new patient detection           |
| `useIntakeConversation` | Turn management, `completeIntake` flow, AI thinking state                         |
| `useVoiceRecorder`      | MediaRecorder start/stop, audio chunk streaming, cleanup                          |
| `useCamera`             | getUserMedia, stream lifecycle, error handling (permission denied, no camera)     |

**Files to create:** `hooks/*.test.ts` (using Vitest or Jest + jsdom)
**Est. effort:** 3–4h

### Step 2.6 — Frontend: Component tests

Test critical UI components for rendering and interaction.

| Component               | Key behaviors to test                                                          |
| :---------------------- | :----------------------------------------------------------------------------- |
| `Button`                | All CVA variants, loading state, disabled state, icon rendering, click handler |
| `Badge` / `StatusBadge` | All variants, status text mapping, icon rendering (check/x)                    |
| `DarkModeToggle`        | Theme selection, icon switch, system preference fallback                       |
| `FaceOverlay`           | Face box rendering, match color, no-face state                                 |
| `BriefCard`             | All brief fields rendering, empty fields, risk flag display                    |

**Files to create:** `components/ui/*.test.tsx` (using Vitest + Testing Library)
**Est. effort:** 2h

### Step 2.7 — Frontend: Store tests

Test Zustand stores for state management correctness.

| Store           | Key behaviors to test                                                         |
| :-------------- | :---------------------------------------------------------------------------- |
| `face-store`    | Status transitions, face list management, embedding/confidence updates, reset |
| `session-store` | Status transitions, patient info, transcript management, brief data, reset    |

**Files to create:** `stores/*.test.ts`
**Est. effort:** 1h

### Step 2.8 — Coverage & CI integration

- Run `test:cov` and document baseline coverage
- Set up coverage thresholds in jest config (70% statement, 60% branch initially)
- Configure CI pipeline (GitHub Actions) to:
  - Run `pnpm lint` on PR
  - Run `pnpm typecheck` on PR
  - Run `pnpm test` with coverage reporting
  - Run `pnpm build` on merge to main
  - Cache pnpm store + turbo outputs

**Files to create:** `.github/workflows/ci.yml`
**Files to modify:** `apps/backend/jest.config.js`
**Est. effort:** 2h

---

## Phase 3 — Backend Production Hardening

> **Goal:** Fill remaining backend gaps: PMS sync, audit wiring, error handling, health checks, structured logging, and configuration validation.

### Step 3.1 — Complete PMS/EMR sync module

The `PmsService` and `PmsController` exist but the sync logic is likely incomplete. Build out the full sync pipeline:

- Implement HL7 FHIR resource mapping (Patient, Encounter, Observation)
- Add storage-agnostic interface (swapable: FHIR, custom API, HL7v2)
- Implement retry with exponential backoff for network failures
- Add PmsPatientCache read-through/write-through caching
- Add `lastSyncedAt` tracking per patient

**Files to modify:** `modules/pms/pms.service.ts`, `modules/pms/pms.controller.ts`
**Est. effort:** 2–3h

### Step 3.2 — Wire audit logging into all modules

The `AuditService` exists but needs to be called from every service that accesses PHI (Protected Health Information):

- Add `AuditService` injection to: FaceService, IntakeService, DashboardService, PmsService, TranscriptionService
- Log on: face search, patient lookup, brief generation, EMR sync, session view
- Ensure audit failures never block the primary operation (fire-and-forget pattern)

**Files to modify:** Each service constructor + key methods
**Est. effort:** 1.5h

### Step 3.3 — Add health check endpoints

Create a standardized health check that reports dependency status:

- `GET /health` — overall status (200 OK or 503)
- `GET /health/ready` — readiness (DB, Redis, Qdrant, Gemini)
- `GET /health/live` — liveness (process up)
- Each dependency check has timeout (5s) and reports individual status

**Files to create:** `modules/health/health.controller.ts`, `modules/health/health.service.ts`, `modules/health/health.module.ts`
**Est. effort:** 2h

### Step 3.4 — Replace console.log with structured logger

The frontend uses `console.error` in several places. Standardize:

- Backend: Already uses pino + Logger — verify every module uses it (no stray `console.log`)
- Frontend: Create a simple logger utility that:
  - Uses `console` in development
  - Respects `NEXT_PUBLIC_LOG_LEVEL` in production
  - Supports structured context (correlation ID, session ID)
  - Never logs in production at `debug` level
- Remove or suppress the 3 pre-existing `console.error` calls in `intake/page.tsx`

**Files to create:** `frontend/src/lib/logger.ts`
**Files to modify:** `intake/page.tsx`, `dashboard/page.tsx`, `landing/page.tsx`
**Est. effort:** 1.5h

### Step 3.5 — Add configuration validation

Validate all critical env vars at startup (both backend and frontend):

- Backend: Add `config/validation.schema.ts` using Zod to validate ALL env vars on bootstrap
- Frontend: Add `lib/env.ts` that validates `NEXT_PUBLIC_*` vars at build time
- Fail fast with clear error messages listing which vars are missing

**Files to create:** `backend/src/config/validation.schema.ts`, `frontend/src/lib/env.ts`
**Est. effort:** 1h

### Step 3.6 — API documentation with Swagger/OpenAPI

Generate and host API documentation:

- Add `@nestjs/swagger` dependency
- Decorate controllers/DTOs with Swagger decorators
- Host at `/api/docs` in development
- Add bearer auth support to Swagger UI

**Files to modify:** `main.ts`, each controller + DTO
**Est. effort:** 2h

### Step 3.7 — Database migration & seed hardening

- Verify all Prisma migrations are tracked and up-to-date
- Add seed data: sample patients, face embeddings (mock 512-dim vectors), past sessions, clinic users
- Add `prisma/seed.ts` with realistic healthcare data (10+ patients, 5+ doctors, 20+ sessions)
- Ensure seed is idempotent (upsert, not insert)

**Files to modify:** `prisma/seed.ts`
**Est. effort:** 2h

---

## Phase 4 — Authentication & Multi-Tenancy

> **Goal:** Complete the auth system: login/register endpoints, API key management, role-based access control, clinic multi-tenancy.

### Step 4.1 — Auth endpoints: login, register, profile

Implement endpoints that the JWT strategy can actually validate against:

- `POST /auth/register` — Create clinic user with hashed password (bcrypt)
- `POST /auth/login` — Validate credentials, return JWT + refresh token
- `GET /auth/profile` — Return current user info
- `POST /auth/refresh` — Rotate refresh token
- Add password strength validation (min 8 chars, mixed case, number)

**Files to create:** `modules/auth/auth.controller.ts`, `modules/auth/auth.service.ts`, `dto/auth.dto.ts`
**Est. effort:** 2h

### Step 4.2 — Role-based access control (RBAC)

Add fine-grained authorization beyond the blanket `@Public()` decorator:

- Create `@Roles()` decorator that accepts `UserRole[]`
- Create `RolesGuard` that checks JWT payload role against allowed roles
- Apply to sensitive endpoints:
  - `PATCH /brief/:id/review` → DOCTOR only
  - `GET /dashboard/*` → DOCTOR, RECEPTIONIST
  - `POST /face/register-patient` → RECEPTIONIST, DOCTOR
  - `POST /pms/sync` → ADMIN, SYSTEM
- Remove `@Public()` from endpoints that should require auth

**Files to create:** `common/decorators/roles.decorator.ts`, `common/guards/roles.guard.ts`
**Files to modify:** All controllers (add @Roles where needed, remove @Public from some)
**Est. effort:** 2h

### Step 4.3 — API key authentication for external integrations

Allow PMS/EMR systems to authenticate via API keys:

- Create `ApiKeyGuard` that validates `X-API-Key` header
- Add `api_keys` table to Prisma schema
- Create API key management endpoints: `POST /api-keys`, `GET /api-keys`, `DELETE /api-keys/:id`
- Apply `ApiKeyGuard` to PMS sync endpoint

**Files to create:** `common/guards/api-key.guard.ts`
**Files to modify:** `prisma/schema.prisma`, `pms.controller.ts`
**Est. effort:** 1.5h

### Step 4.4 — Clinic multi-tenancy

Support multiple clinics using the same deployment:

- Add `clinicId` to relevant tables (patients, intake_sessions, clinic_users)
- Create `ClinicModule` with CRUD endpoints
- Create `@Clinic()` decorator that extracts clinic from subdomain or header
- Add `ClinicGuard` that scopes all queries to the current clinic
- Update Prisma queries to filter by `clinicId` by default

**Files to create:** `modules/clinic/`
**Files to modify:** Most services + Prisma queries
**Est. effort:** 3h

### Step 4.5 — Frontend login UI & session management

Build the login page and auth state management:

- Create `/login` page with email + password form
- Create `useAuth` hook with login/logout/session refresh
- Store JWT in httpOnly cookie (or secure localStorage with refresh)
- Add `AuthProvider` that protects dashboard routes
- Add redirect to login if token is expired

**Files to create:** `app/login/page.tsx`, `hooks/useAuth.ts`, `components/auth/`
**Est. effort:** 2–3h

### Step 4.6 — Frontend RBAC UI

- Hide buttons/actions the user doesn't have permission for
- Show role-appropriate views (doctor sees briefs, receptionist sees registration)
- Add role badge to header

**Files to modify:** `dashboard/page.tsx`, `intake/page.tsx`, header components
**Est. effort:** 1.5h

---

## Phase 5 — UI/UX Excellence ✅

> **Goal:** Beautiful, responsive, accessible frontend with animations, dark mode, and polished interactions.

| Step | Description                                | Status |
| :--- | :----------------------------------------- | :----- |
| 5.1  | Design system animations + globals.css     | ✅     |
| 5.2  | ToastProvider + Dialog components          | ✅     |
| 5.3  | Enhanced Button with CVA variants          | ✅     |
| 5.4  | Landing page redesign                      | ✅     |
| 5.5  | FaceOverlay multi-state detection UI       | ✅     |
| 5.6  | Intake page fixes + ESLint config          | ✅     |
| 5.7  | Dashboard skeleton loaders + lucide icons  | ✅     |
| 5.8  | Dark mode with system preference detection | ✅     |

---

## Phase 6 — Feature Expansion

> **Goal:** Ship the remaining major features: patient registration UI, mobile support, multi-language, admin dashboard, HIPAA compliance, offline mode, and monitoring.

### Step 6.1 — Patient registration UI & flow

Build the registration dialog that appears when a new face is detected:

- Complete `FaceRegistrationDialog` component (name, DOB, mobile, consent checkbox)
- Add form validation (mobile format, DOB range, name length)
- Add progressive disclosure: show minimal fields first, expand if needed
- Connect to `POST /face/register-patient` endpoint
- Add success confirmation + transition to intake phase

**Files to modify:** `components/face/FaceRegistrationDialog.tsx`
**Est. effort:** 2–3h

### Step 6.2 — Mobile camera support (PWA)

Optimize the camera + face detection flow for mobile devices:

- Use `facingMode: { exact: 'environment' }` for rear camera on mobile
- Detect mobile via `useMobileDetection` hook → adjust UI layout
- Add camera selection dropdown (front/back) when multiple cameras available
- Optimize MediaPipe WASM loading for mobile (smaller model, CPU delegate fallback)
- Test PWA install prompt on iOS Safari + Android Chrome

**Files to modify:** `hooks/useCamera.ts`, `intake/page.tsx`, `components/face/FaceDetectionCanvas.tsx`
**Est. effort:** 2–3h

### Step 6.3 — Multi-language intake support

Enable the AI intake agent to conduct conversations in multiple languages:

- Add language selector to intake start screen
- Pass `language` parameter to Gemini: `systemInstruction` includes target language
- Translate UI labels using `next-intl` or a lightweight i18n library
- Supported languages: English (`en`), Hindi (`hi`), Marathi (`mr`), Spanish (`es`)
- Store patient language preference in session metadata

**Files to create:** `i18n/` directory with locale JSON files
**Files to modify:** `intake/page.tsx`, `intake-agent.service.ts`
**Est. effort:** 3–4h

### Step 6.4 — Clinic admin dashboard with analytics

Build a comprehensive analytics dashboard for clinic administrators:

- Daily/weekly/monthly patient volume charts (Recharts or Chart.js)
- Average intake duration metric
- Face match rate (returning vs. new patients)
- Brief generation success rate
- Peak clinic hours heatmap
- Export to CSV/PDF
- Real-time patient flow board (waiting → in intake → triaged → with doctor)

**Files to create:** `app/admin/page.tsx`, `components/admin/` (multiple charts + widgets)
**Est. effort:** 4–5h

### Step 6.5 — HIPAA compliance audit module

Build the compliance audit viewer and reporting tools:

- Audit log viewer in admin panel: filter by action type, date range, user
- Export audit logs to CSV for compliance reviews
- Add automatic log retention policy (90 days default, configurable)
- Add data anonymization for audit log exports
- Show PHI access summary per patient per day

**Files to create:** `app/admin/audit/page.tsx`, `modules/audit/audit.controller.ts` (new endpoints)
**Est. effort:** 3–4h

### Step 6.6 — Offline mode with IndexedDB sync

Complete the offline-first architecture using the existing Dexie setup:

- Cache patient records in IndexedDB on every lookup
- Cache active session data locally (transcripts, briefs)
- Queue intake data mutations when offline (post-sync on reconnect)
- Show offline indicator in header
- Sync queue on network recovery with conflict resolution (last-write-wins + log)
- PWA service worker: cache API responses with `NetworkFirst` strategy

**Files to modify:** `services/db.ts`, `services/socket.ts`, `hooks/useOfflineSync.ts`
**Est. effort:** 3–4h

### Step 6.7 — Performance monitoring & alerting

Add production observability:

- Prometheus metrics endpoint (`GET /metrics`): request count, duration histogram, error count, active sessions, Qdrant latency
- Sentry/Raygun error tracking for both frontend and backend
- Custom dashboard in admin panel: error rate, API latency p50/p95/p99, face match latency
- Alert thresholds: error rate > 1%, face match latency > 2s, session timeout rate > 5%
- Database connection pool monitoring

**Files to create:** `modules/monitoring/`, `lib/monitoring.ts`
**Files to modify:** `main.ts`, `app.module.ts`
**Est. effort:** 3–4h

---

## Phase 7 — Infrastructure & Deployment

> **Goal:** Production-ready deployment with CI/CD, container orchestration, secrets management, and disaster recovery.

### Step 7.1 — CI/CD pipeline (GitHub Actions)

Create a complete CI/CD pipeline:

```yaml
# .github/workflows/ci.yml
on: [pull_request]
jobs:
  quality:
    - pnpm lint
    - pnpm typecheck
    - pnpm test -- --coverage
    - pnpm build

# .github/workflows/deploy.yml
on: [push to main]
jobs:
  deploy:
    - build Docker images
    - push to container registry
    - deploy to staging
    - run smoke tests
    - promote to production
```

**Files to create:** `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`
**Est. effort:** 2h

### Step 7.2 — Container orchestration (Docker Compose → Kubernetes)

Production-ready container setup:

- Add resource limits to all docker-compose services
- Create Kubernetes manifests (deployments, services, configmaps, secrets)
- Add liveness/readiness probes to all services
- Configure HPA (Horizontal Pod Autoscaler) for backend + frontend
- Set up Ingress with TLS termination

**Files to create:** `k8s/` directory with all manifests
**Files to modify:** `docker-compose.yml`
**Est. effort:** 3–4h

### Step 7.3 — Secrets management

Replace `.env` with proper secrets management:

- Document required secrets for each environment
- Add integration guidelines for:
  - HashiCorp Vault (self-hosted)
  - Doppler (cloud-hosted, generous free tier)
  - AWS Secrets Manager / GCP Secret Manager (cloud-provider native)
- Create `.env.example` with clear annotations for each variable
- Add pre-startup script that validates all required secrets exist

**Files to modify:** `.env.example`
**Files to create:** `scripts/validate-secrets.sh`
**Est. effort:** 1.5h

### Step 7.4 — Database backup & disaster recovery

Automate database protection:

- Automated daily PostgreSQL backups (pg_dump → S3/R2)
- Point-in-time recovery configuration
- Qdrant collection snapshot schedule
- Redis RDB/AOF persistence configuration
- Documented restore procedure in `docs/disaster-recovery.md`

**Files to create:** `scripts/backup.sh`, `scripts/restore.sh`, `docs/disaster-recovery.md`
**Est. effort:** 2h

### Step 7.5 — SSL/TLS & domain setup

Production networking:

- Configure Caddy or nginx reverse proxy with automatic Let's Encrypt
- Set up staging domain: `staging.ayutalk.care`
- Set up production domain: `app.ayutalk.care`
- Configure CORS for production domains
- Add HSTS headers, CSP headers

**Files to create:** `infra/Caddyfile` or `infra/nginx.conf`
**Files to modify:** `main.ts` (CORS config)
**Est. effort:** 1.5h

### Step 7.6 — Monitoring stack (Prometheus + Grafana)

Production observability infrastructure:

- Prometheus configuration for scraping all services
- Grafana dashboards:
  - API performance (latency, throughput, error rate)
  - Business metrics (active sessions, match rate, briefs generated)
  - Infrastructure (CPU, memory, disk, network)
- Alertmanager configuration for critical alerts (PagerDuty/Slack)
- Uptime monitoring (Pingdom/Checkly)

**Files to create:** `infra/prometheus/`, `infra/grafana/`
**Est. effort:** 3h

---

## README Roadmap — Feature Status

From the README roadmap, mapped to implementation phases:

| Feature                                     | Phase         | Status |
| :------------------------------------------ | :------------ | :----- |
| Core face detection & liveness verification | Built-in      | ✅     |
| Qdrant vector search integration            | Built-in      | ✅     |
| Gemini 2.0 Flash AI intake agent            | Built-in      | ✅     |
| Clinical brief generation pipeline          | Built-in      | ✅     |
| WebSocket session management                | Built-in      | ✅     |
| Doctor dashboard with briefs                | Built-in      | ✅     |
| JWT authentication infrastructure           | Phase 1       | ✅     |
| Rate limiting                               | Phase 1       | ✅     |
| Input validation (Zod)                      | Phase 1       | ✅     |
| Session timeout worker                      | Phase 1       | ✅     |
| Unit tests (4 services)                     | Phase 2.1–2.4 | ✅     |
| Patient registration UI & flow              | Phase 6.1     | ⬜     |
| Mobile camera support (iOS/Android)         | Phase 6.2     | ⬜     |
| Multi-language intake support               | Phase 6.3     | ⬜     |
| Clinic admin dashboard with analytics       | Phase 6.4     | ⬜     |
| HIPAA compliance audit module               | Phase 6.5     | ⬜     |
| Offline mode with IndexedDB sync            | Phase 6.6     | ⬜     |
| Performance monitoring & alerting           | Phase 6.7     | ⬜     |
| CI/CD pipeline                              | Phase 7.1     | ⬜     |
| Container orchestration                     | Phase 7.2     | ⬜     |
| Secrets management                          | Phase 7.3     | ⬜     |
| DB backup & disaster recovery               | Phase 7.4     | ⬜     |
| SSL/TLS & domain                            | Phase 7.5     | ⬜     |
| Monitoring stack                            | Phase 7.6     | ⬜     |
| PMS/EMR sync adapters                       | Phase 3.1     | ⬜     |
| Auth endpoints + RBAC                       | Phase 4.1–4.3 | ⬜     |
| Clinic multi-tenancy                        | Phase 4.4     | ⬜     |
| Login UI + frontend auth                    | Phase 4.5–4.6 | ⬜     |
| Dark mode UI                                | Phase 5.8     | ✅     |
| E2E tests                                   | Phase 2.1     | ⬜     |
| Frontend tests                              | Phase 2.5–2.7 | ⬜     |

---

## Effort Summary

| Phase                               | Steps  | Min (h) | Max (h) |
| :---------------------------------- | :----- | :------ | :------ |
| **2 — Testing & Validation**        | 8      | 8       | 12      |
| **3 — Backend Hardening**           | 7      | 10      | 14      |
| **4 — Auth & Multi-Tenancy**        | 6      | 8       | 10      |
| **6 — Feature Expansion**           | 7      | 14      | 20      |
| **7 — Infrastructure & Deployment** | 6      | 8       | 12      |
| **Total remaining**                 | **34** | **48**  | **68**  |

---

## Commit Strategy

Every step above maps to 1–3 atomic commits following this pattern:

```bash
# Example: Step 2.1 — Face controller E2E tests
git add test/face.e2e-spec.ts test/jest-e2e.json
git commit -m "test: add E2E tests for face controller (search, register, embeddings)"

# Example: Step 6.1 — Patient registration UI
git add src/components/face/FaceRegistrationDialog.tsx src/services/api.ts
git commit -m "feat: complete patient registration dialog with form validation"
```

**Rules:**

- Never mix test changes with production code changes in the same commit
- Never mix frontend and backend changes in the same commit (except shared packages)
- Always typecheck before committing: `pnpm typecheck`
- Always push immediately after a successful commit

---

## How to Use This Plan

1. **Pick a phase** — Start with Phase 2 (testing) since it validates all existing work
2. **Pick a step** — Each step is self-contained and commit-sized
3. **Implement** — Follow the Elite Engineer protocol: research → plan → implement → verify → report
4. **Commit & push** — Use conventional commits, one logical change per commit
5. **Check off** — Update this plan when a step is complete

> **To reassign priority:** Run `grep -n "⬜\|✅" PLAN.md` to see the current status of all steps at a glance.
