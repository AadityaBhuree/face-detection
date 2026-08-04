# Jeevandata — Engineering Roadmap

> **Version:** 0.2.0 | **Status:** Active Development
> **Phases 1, 2, 5 Complete** — Phase 3 mostly complete — Proceeding through Phases 4, 6, 7

---

## How to Use This Plan

Each phase contains numbered steps. Every step is sized for a **single atomic commit** — one logical change that can be reviewed, tested, and pushed independently. Steps within a phase can be parallelized where indicated.

**Commit convention per step:** `feat:`, `fix:`, `test:`, `style:`, `refactor:`, `docs:`, `chore:`, `perf:`

---

## Progress Overview

| Phase | Title                          | Status             | Steps        | Est. Effort |
| :---- | :----------------------------- | :----------------- | :----------- | :---------- |
| **1** | Emergency Repairs              | ✅ **Done**        | 7/7          | Completed   |
| **2** | Testing & Validation           | ✅ **Done**        | 8/8          | Completed   |
| **3** | Backend Production Hardening   | 🔶 **In progress** | 4/7          | 4–6h remain |
| **4** | Authentication & Multi-Tenancy | ⬜ **Not started** | 6            | 8–10h       |
| **5** | UI/UX Excellence               | ✅ **Done**        | 8/8          | Completed   |
| **6** | Feature Expansion              | 🔶 **In progress** | 4/8          | 10–14h      |
| **7** | Infrastructure & Deployment    | ⬜ **Not started** | 6            | 8–12h       |
|       | **Total remaining**            |                    | **19 steps** | **30–42h**  |

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

## Phase 2 — Testing & Validation ✅

> **Goal:** Achieve >70% backend coverage, validate all FSM transitions, add E2E tests for critical paths, and set up frontend testing. **All steps complete.**

### Step 2.1 — Backend: Controller E2E tests ✅

Supertest-based E2E tests validating the full HTTP layer (routes, Zod validation, error formatting, response shape).

| Suite                                | Endpoints covered                                             | Status |
| :----------------------------------- | :------------------------------------------------------------ | :----- |
| `test/face.e2e-spec.ts`              | search, search-with-details, register, embedding, history     | ✅     |
| `test/intake.e2e-spec.ts`            | POST session, GET session/:id, complete, status               | ✅     |
| `test/ai.e2e-spec.ts`                | intake-agent, brief                                           | ✅     |
| `test/dashboard.e2e-spec.ts`         | active-sessions, recent-briefs, latest-brief, review, history | ✅     |
| `test/pms.e2e-spec.ts`               | POST sync (adapters + cache fallback)                         | ✅     |
| `test/health.e2e-spec.ts`            | GET /health, /health/ready, /health/live                      | ✅     |
| `test/rate-limit.e2e-spec.ts`        | Throttler enforcement on protected routes                     | ✅     |
| `test/health-rate-limit.e2e-spec.ts` | Health endpoints bypass rate limiting                         | ✅     |

**Result:** 113 E2E tests green across 8 suites.

### Step 2.2 — Backend: Service unit tests ✅

| Service            | Spec file                   | Status |
| :----------------- | :-------------------------- | :----- |
| `AuditService`     | `audit.service.spec.ts`     | ✅     |
| `FaceService`      | `face.service.spec.ts`      | ✅     |
| `IntakeService`    | `intake.service.spec.ts`    | ✅     |
| `SessionService`   | `session.service.spec.ts`   | ✅     |
| `DashboardService` | `dashboard.service.spec.ts` | ✅     |
| `PmsService`       | `pms.service.spec.ts`       | ✅     |
| `HealthService`    | `health.service.spec.ts`    | ✅     |

**Result:** 76 unit tests green across 7 suites.

### Step 2.3 — Guard & validation pipe tests ✅

JwtAuthGuard (valid/expired/missing/malformed/`@Public()` bypass), ZodValidationPipe, HttpExceptionFilter, TransformInterceptor, LoggingInterceptor — covered via E2E suites and guard specs.

### Step 2.4 — BullMQ worker tests ✅

Session timeout worker covered via `SessionService` specs (stale-session → TIMED_OUT, no-op, Prisma error, queue failure) and Redis-mocked E2E suites.

### Steps 2.5–2.7 — Frontend: Vitest + RTL suite ✅

| Area          | Files                                                                               | Status |
| :------------ | :---------------------------------------------------------------------------------- | :----- |
| Setup         | Vitest + Testing Library + jsdom + coverage config                                  | ✅     |
| Hooks         | `useFaceDetection`, `useLivenessDetection`, `useLanguage`                           | ✅     |
| Components    | `Button`, `Badge`, `BriefCard`, `LanguageSelector`, `DarkModeToggle`, UI primitives | ✅     |
| Stores        | `face-store`, `session-store` (Zustand)                                             | ✅     |
| Lib utilities | `face-embedding`, `face-geometry`, `utils`, `api.ts`, `socket.ts`                   | ✅     |
| i18n          | Locale fallback, interpolation, missing-key, Hindi/Marathi/Spanish content          | ✅     |
| Accessibility | axe-core scan over intake page, keyboard + ARIA patterns                            | ✅     |

**Result:** 440 frontend tests green across 24 files.

### Step 2.8 — Coverage & CI integration ✅

- Backend coverage report generated (`COVERAGE_REPORT.md`): 76 unit + 113 E2E tests
- Remaining: CI pipeline (GitHub Actions) tracked in Phase 7.1

---

## Phase 3 — Backend Production Hardening ✅ (complete)

> **Goal:** Fill remaining backend gaps: PMS sync, audit wiring, health checks, structured logging, and configuration validation.

### Step 3.1 — Complete PMS/EMR sync module ✅

- HL7 FHIR resource mapping (Patient, Encounter, Observation) via `adapters/hl7-fhir.adapter.ts`
- Storage-agnostic interface: `PmsAdapter` (FHIR, custom API) + `CustomApiAdapter`
- Retry with exponential backoff for network failures
- `PmsPatientCache` read-through/write-through caching
- `lastSyncedAt` tracking per patient

### Step 3.2 — Wire audit logging into all modules ✅

- `AuditService` injected into FaceService, IntakeService, DashboardService, PmsService, TranscriptionService
- Logs on face search, patient lookup, brief generation, EMR sync, session view
- Fire-and-forget pattern — audit failures never block the primary operation

### Step 3.3 — Health checks + OpenTelemetry tracing ✅

- `GET /health`, `/health/ready`, `/health/live` with per-dependency status + latency
- `modules/opentelemetry/` — Jaeger/OpenTelemetry instrumentation (traces + spans on service boundaries)

### Step 3.4 — Unit tests for previously-uncovered modules ✅

`health.service.spec.ts`, `dashboard.service.spec.ts`, `pms.service.spec.ts` — closes the 0% coverage gaps.

### Step 3.4b — Unit tests for security-critical infrastructure ✅

`jwt-auth.guard.spec.ts`, `roles.guard.spec.ts`, `zod-validation.pipe.spec.ts`, `http-exception.filter.spec.ts` — 31 tests covering the authz/validation/error-path layer.

### Step 3.5 — Add configuration validation ✅

Validate all critical env vars at startup (both backend and frontend):

- Backend: `config/validation.schema.ts` (Zod) validates all env vars on bootstrap
- Frontend: `lib/env.ts` validates `NEXT_PUBLIC_*` vars, fails fast in production builds
- Verified: `validation.schema.spec.ts` + `lib/__tests__/env.test.ts`

### Step 3.6 — API documentation with Swagger/OpenAPI ✅

- `@nestjs/swagger` + `swagger-ui-express` installed
- `config/swagger.config.ts` — DocumentBuilder + bearer auth + tags, wired in `main.ts`
- All 8 controllers decorated with `@ApiTags`/`@ApiOperation`; JWT routes get `@ApiBearerAuth`; face DTOs get `@ApiProperty`
- Hosted at `/api/docs` (disabled in production unless `SWAGGER_ENABLED=true`)

**Est. effort:** 2h

### Step 3.7 — Frontend structured logger ✅

- `frontend/src/lib/logger.ts` — level filtering via `NEXT_PUBLIC_LOG_LEVEL`, no debug in prod, Error/context serialization
- All stray `console.*` calls replaced (page.tsx, intake page, useFaceDetection, socket.ts)
- `lib/__tests__/logger.test.ts` — 7 tests; also fixed 7 pre-existing frontend typecheck errors

**Est. effort:** 1.5h

---

## Phase 4 — Authentication & Multi-Tenancy 🔶 (in progress)

> **Goal:** Complete the auth system: login/register endpoints, API key management, role-based access control, clinic multi-tenancy, and frontend session/RBAC UI.

### Step 4.1 — Auth endpoints: login, register, profile ✅

- `POST /auth/register` — creates a RECEPTIONIST account (bcrypt-hashed password; role/clinicId never accepted from the client)
- `POST /auth/login` — returns access JWT + refresh token + expiry
- `GET /auth/profile` — current user info (JWT-protected)
- `POST /auth/refresh` — token rotation with SHA-256 hashed storage + reuse protection
- `POST /auth/logout` — revokes all refresh tokens
- Password strength validation (min 8 chars, mixed case, number) via `registerUserSchema`

**Delivered:** `auth/auth.controller.ts`, `auth/auth.service.ts`, `auth/auth.module.ts`, `common/strategies/jwt.strategy.ts`, `test/auth.e2e-spec.ts` (14 tests).

### Step 4.2 — RBAC infrastructure (guards + decorators) ✅

- `@Roles()` decorator + `RolesGuard` (reads `user.role` from JWT payload)
- `JwtAuthGuard` registered as global `APP_GUARD`; `@Public()` opt-out
- `CurrentUser` param decorator (`id`, `email`, `role`, `clinicId`)

**Delivered:** `common/guards/jwt-auth.guard.ts`, `common/guards/roles.guard.ts`, `common/decorators/*.ts` (+31 unit tests in Step 3.4b).

### Step 4.2b — Apply RBAC to sensitive endpoints 🔶

- `GET /dashboard/*` → `@Roles(DOCTOR, RECEPTIONIST)`; remove `@Public()`
- `PATCH /brief/:id/review` → `@Roles(DOCTOR)` only
- `POST /face/register-patient` → `@Roles(RECEPTIONIST, DOCTOR)`; kiosk endpoints (`search`, `search-with-details`, `embedding`) stay `@Public`
- JWT payload + strategy now carry `clinicId`

### Step 4.3 — API key authentication for external integrations 🔶

- `ApiKeyGuard` validating `X-API-Key` header; `api_keys` table (SHA-256 hashed keys, prefix for identification)
- API key management endpoints (ADMIN/SYSTEM): `POST /api-keys`, `GET /api-keys`, `DELETE /api-keys/:id`
- `ApiKeyGuard` applied to `POST /sync/pms` + `POST /sync/patient-context`

### Step 4.4 — Clinic multi-tenancy 🔶

- `Clinic` model + `clinicId` FK on `clinic_users`, `patients`, `intake_sessions`, `api_keys`
- `ClinicsModule` CRUD (ADMIN/SYSTEM only) with audit logging
- `clinicId` propagated through JWT payload, `GET /auth/profile`, and login response

### Step 4.5 — Frontend login UI & session management 🔶

- `/login` page with email/password form + client validation
- Zustand `auth-store` (tokens + user in localStorage, hydrate on boot)
- `api.ts` attaches `Authorization: Bearer` + single-attempt refresh on 401
- `useAuth` hook; logout action in dashboard header

### Step 4.6 — Frontend RBAC UI 🔶

- `RequireAuth` route wrapper (redirect to `/login` when guest, access-denied when wrong role)
- Role badge in header; hide doctor-only actions (e.g. Mark Reviewed) from RECEPTIONIST

---

## Phase 5 — UI/UX Excellence ✅

> **Goal:** Beautiful, responsive, accessible frontend with animations, dark mode, and polished interactions.

| Step | Description                                                                      | Status |
| :--- | :------------------------------------------------------------------------------- | :----- |
| 5.1  | Design system animations + globals.css                                           | ✅     |
| 5.2  | ToastProvider + Dialog components                                                | ✅     |
| 5.3  | Enhanced Button with CVA variants                                                | ✅     |
| 5.4  | Landing page redesign                                                            | ✅     |
| 5.5  | FaceOverlay multi-state detection UI                                             | ✅     |
| 5.6  | Intake page fixes + ESLint config                                                | ✅     |
| 5.7  | Dashboard skeleton loaders + lucide icons                                        | ✅     |
| 5.8  | Dark mode with system preference detection                                       | ✅     |
| 5.9  | Dark mode on sub-components (TranscriptView, VoiceInput, FaceRegistrationDialog) | ✅     |

---

## Phase 6 — Feature Expansion 🔶 (4 steps remain)

> **Goal:** Ship the remaining major features: patient registration UI, mobile support, multi-language, accessibility, admin dashboard, HIPAA compliance, offline mode, and monitoring.

### Step 6.1 — Patient registration UI & flow ✅

- `FaceRegistrationDialog` complete: name, DOB, mobile, consent checkbox
- Form validation (mobile format, DOB range, name length), progressive disclosure
- Connected to `POST /face/register-patient`, success confirmation + transition to intake
- Dark mode applied to dialog

### Step 6.2 — Mobile camera support (PWA) ✅

- Rear camera `facingMode: { exact: 'environment' }` on mobile
- `useMobileDetection` hook → responsive UI layout
- Camera selection dropdown (front/back) when multiple cameras available
- Optimized MediaPipe WASM loading for mobile (smaller model, CPU delegate fallback)

### Step 6.3 — Multi-language intake support ✅

- Language selector on intake start screen (`LanguageSelector`)
- Language passed to Gemini system instruction; UI labels translated via lightweight i18n (`i18n/`)
- Supported: English (`en`), Hindi (`hi`), Marathi (`mr`), Spanish (`es`)
- Patient language preference stored in session metadata; `<html lang>` synced
- Full test coverage: locale detection, localStorage persistence, interpolation, missing-key fallback

### Step 6.4 — Advanced accessibility ✅

- Screen reader support: skip link, video `aria-label`, status live regions
- Keyboard navigation + focus management across all intake components
- ARIA labels on camera, recording, and status controls
- axe-core automated scan over the intake page (in Vitest suite)
- Component a11y tests: `LanguageSelector` (menu-button ARIA pattern, roving focus), `DarkModeToggle` (aria-expanded/haspopup, Escape focus return)

### Step 6.5 — Clinic admin dashboard with analytics ⬜

- Daily/weekly/monthly patient volume charts (Recharts or Chart.js)
- Average intake duration, face match rate (returning vs. new), brief generation success rate
- Peak clinic hours heatmap; export to CSV/PDF
- Real-time patient flow board (waiting → in intake → triaged → with doctor)

**Files to create:** `app/admin/page.tsx`, `components/admin/`
**Est. effort:** 4–5h

### Step 6.6 — HIPAA compliance audit module ⬜

- Audit log viewer (filter by action type, date range, user); export to CSV
- Log retention policy (90 days default, configurable); data anonymization on export
- PHI access summary per patient per day

**Est. effort:** 3–4h

### Step 6.7 — Offline mode with IndexedDB sync ⬜

- Cache patient records + active session data (transcripts, briefs) in IndexedDB
- Queue intake mutations offline, sync on reconnect (last-write-wins + log)
- Offline indicator in header; PWA service worker with `NetworkFirst`

**Est. effort:** 3–4h

### Step 6.8 — Performance monitoring & alerting ⬜

- Prometheus `GET /metrics`: request count, duration histogram, error count, active sessions, Qdrant latency
- Error tracking (frontend + backend); admin latency panel (p50/p95/p99)
- Alert thresholds: error rate > 1%, face match latency > 2s, session timeout rate > 5%

**Est. effort:** 3–4h

---

## Phase 7 — Infrastructure & Deployment ⬜

> **Goal:** Production-ready deployment with CI/CD, container orchestration, secrets management, and disaster recovery.

### Step 7.1 — CI/CD pipeline (GitHub Actions)

- `ci.yml` on PR: lint, typecheck, test --coverage, build (cache pnpm + turbo)
- `deploy.yml` on push to main: build images, push registry, staging deploy, smoke tests, promote

**Est. effort:** 2h

### Step 7.2 — Container orchestration

- Resource limits on all docker-compose services
- Kubernetes manifests (deployments, services, configmaps, secrets), probes, HPA, Ingress+TLS

**Est. effort:** 3–4h

### Step 7.3 — Secrets management

- Document required secrets per environment; `.env.example` annotations
- Integration notes: Vault / Doppler / AWS Secrets Manager; `scripts/validate-secrets.sh`

**Est. effort:** 1.5h

### Step 7.4 — Database backup & disaster recovery

- Daily pg_dump → S3/R2, PITR config, Qdrant snapshot schedule, Redis persistence
- `docs/disaster-recovery.md` restore procedure

**Est. effort:** 2h

### Step 7.5 — SSL/TLS & domain setup

- Caddy/nginx with Let's Encrypt; staging + production domains; CORS; HSTS/CSP headers

**Est. effort:** 1.5h

### Step 7.6 — Monitoring stack (Prometheus + Grafana)

- Prometheus scrape config; Grafana dashboards (API perf, business, infra)
- Alertmanager (PagerDuty/Slack); uptime monitoring

**Est. effort:** 3h

---

## README Roadmap — Feature Status

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
| Backend unit tests (7 services, 76 tests)   | Phase 2.2     | ✅     |
| Backend E2E tests (8 suites, 113 tests)     | Phase 2.1     | ✅     |
| Frontend Vitest suite (24 files, 440 tests) | Phase 2.5–2.7 | ✅     |
| PMS/EMR sync adapters                       | Phase 3.1     | ✅     |
| Audit logging wiring                        | Phase 3.2     | ✅     |
| Health checks + OpenTelemetry tracing       | Phase 3.3     | ✅     |
| Patient registration UI & flow              | Phase 6.1     | ✅     |
| Mobile camera support (iOS/Android)         | Phase 6.2     | ✅     |
| Multi-language intake support               | Phase 6.3     | ✅     |
| Advanced accessibility (axe, keyboard)      | Phase 6.4     | ✅     |
| Dark mode UI                                | Phase 5.8–5.9 | ✅     |
| Config validation                           | Phase 3.5     | ⬜     |
| Swagger/OpenAPI docs                        | Phase 3.6     | ⬜     |
| Frontend structured logger                  | Phase 3.7     | ⬜     |
| Auth endpoints + RBAC                       | Phase 4.1–4.2 | ⬜     |
| API keys + multi-tenancy                    | Phase 4.3–4.4 | ⬜     |
| Login UI + frontend auth                    | Phase 4.5–4.6 | ⬜     |
| Clinic admin dashboard with analytics       | Phase 6.5     | ⬜     |
| HIPAA compliance audit module               | Phase 6.6     | ⬜     |
| Offline mode with IndexedDB sync            | Phase 6.7     | ⬜     |
| Performance monitoring & alerting           | Phase 6.8     | ⬜     |
| CI/CD pipeline                              | Phase 7.1     | ⬜     |
| Container orchestration                     | Phase 7.2     | ⬜     |
| Secrets management                          | Phase 7.3     | ⬜     |
| DB backup & disaster recovery               | Phase 7.4     | ⬜     |
| SSL/TLS & domain                            | Phase 7.5     | ⬜     |
| Monitoring stack                            | Phase 7.6     | ⬜     |

---

## Effort Summary

| Phase                               | Steps  | Min (h) | Max (h) |
| :---------------------------------- | :----- | :------ | :------ |
| **3 — Backend Hardening (remain)**  | 3      | 4       | 6       |
| **4 — Auth & Multi-Tenancy**        | 6      | 8       | 10      |
| **6 — Feature Expansion (remain)**  | 4      | 10      | 14      |
| **7 — Infrastructure & Deployment** | 6      | 8       | 12      |
| **Total remaining**                 | **19** | **30**  | **42**  |

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

1. **Pick a phase** — Phase 3 finish-out (Swagger, config validation, logger) is the quickest win
2. **Pick a step** — Each step is self-contained and commit-sized
3. **Implement** — Follow the Elite Engineer protocol: research → plan → implement → verify → report
4. **Commit & push** — Use conventional commits, one logical change per commit
5. **Check off** — Update this plan when a step is complete

> **To reassign priority:** Run `grep -n "⬜\|✅" PLAN.md` to see the current status of all steps at a glance.
