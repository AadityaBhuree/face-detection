# Coverage Report — Jeevandata

**Generated:** August 8, 2026 (fresh coverage runs, no cache)
**Test totals:** 287 unit (20 suites) + 191 E2E (13 suites) backend · 599 frontend (45 test files) = **1,077 tests, all passing**

## Overall Coverage

| Layer             |  % Stmts   |  % Branch  |  % Funcs   |  % Lines   | Files measured |
| :---------------- | :--------: | :--------: | :--------: | :--------: | :------------: |
| Backend (unit)    | **52.30%** | **42.45%** | **48.69%** | **52.33%** |       45       |
| Backend (E2E)     |    0%¹     |     0%     |     0%     |     0%     |       —        |
| Frontend (vitest) | **64.61%** | **79.89%** | **75.93%** | **64.61%** |       54       |

> ¹ E2E suites mock the entire service layer, so jest instruments nothing — see [E2E Test Coverage](#e2e-test-coverage) for why this is expected.
>
> **Progress vs August 3 baseline:** backend statements 36.72% → **52.30%** (+16 pts, driven by new suites for `analytics`, `api-keys`, `clinics`, `monitoring`, `metrics.service`, and expanded `face`, `intake`, `audit` specs). Frontend 45.02% → **64.61%** (+20 pts, 25 → 45 test files). Backend unit tests 162 → **287**; E2E 129 → **191**; frontend 448 → **599**.

---

## Backend — Unit Coverage by Module

### ✅ High Coverage (≥80% Statements)

| Module            | File                           | % Stmts | % Branch | % Funcs | % Lines |
| :---------------- | :----------------------------- | :-----: | :------: | :-----: | :-----: |
| **Analytics**     | `analytics.service.ts`         |  100%   |  93.33%  |  100%   |  100%   |
| **API Keys**      | `api-keys.service.ts`          |  100%   |   100%   |  100%   |  100%   |
| **Clinics**       | `clinics.service.ts`           |  100%   |  63.33%  |  100%   |  100%   |
| **Dashboard**     | `dashboard.service.ts`         |  100%   |   100%   |  100%   |  100%   |
| **Face**          | `face.service.ts`              |  100%   |  81.25%  |  100%   |  100%   |
| **Face**          | `face-registration.service.ts` |  100%   |   100%   |  100%   |  100%   |
| **Monitoring**    | `monitoring.service.ts`        |  100%   |   100%   |  100%   |  100%   |
| **Session**       | `session.service.ts`           |  100%   |   100%   |  100%   |  100%   |
| **Audit**         | `audit.service.ts`             | 92.78%  |  84.61%  | 94.44%  | 93.61%  |
| **Health**        | `health.service.ts`            | 92.85%  |  64.28%  | 82.35%  |   96%   |
| **Intake**        | `intake.service.ts`            | 94.64%  |  83.33%  | 88.88%  | 96.22%  |
| **PMS**           | `pms.service.ts`               | 94.28%  |  55.55%  |  100%   | 93.93%  |
| **OpenTelemetry** | `metrics.service.ts`           | 81.91%  |  86.95%  | 83.33%  | 81.81%  |

### ⚠️ Partial Coverage (1–79% Statements)

| Module            | File                         | % Stmts | % Branch | % Funcs | % Lines |
| :---------------- | :--------------------------- | :-----: | :------: | :-----: | :-----: |
| **Analytics**     | `analytics.controller.ts`    |   0%    |   100%   |   0%    |   0%    |
| **API Keys**      | `api-keys.controller.ts`     |   0%    |   100%   |   0%    |   0%    |
| **Audit**         | `audit.controller.ts`        |   0%    |   100%   |   0%    |   0%    |
| **Clinics**       | `clinics.controller.ts`      |   0%    |   100%   |   0%    |   0%    |
| **Dashboard**     | `dashboard.controller.ts`    |   0%    |   100%   |   0%    |   0%    |
| **Face**          | `face.controller.ts`         |   0%    |   100%   |   0%    |   0%    |
| **Face/DTO**      | `register-patient.dto.ts`    |   0%    |   100%   |  100%   |   0%    |
| **Health**        | `health.controller.ts`       |   0%    |    0%    |   0%    |   0%    |
| **Intake**        | `intake.controller.ts`       |   0%    |   100%   |   0%    |   0%    |
| **Monitoring**    | `monitoring.controller.ts`   |   0%    |   100%   |   0%    |   0%    |
| **OpenTelemetry** | `prometheus.controller.ts`   |   0%    |   100%   |   0%    |   0%    |
| **OpenTelemetry** | `opentelemetry.service.ts`   | 11.90%  |    0%    |   0%    |  7.69%  |
| **PMS**           | `pms.controller.ts`          |   0%    |   100%   |   0%    |   0%    |
| **PMS/Adapters**  | `hl7-fhir.adapter.ts`        | 14.28%  |    0%    |   0%    | 10.52%  |
| **PMS/Adapters**  | `custom-api.adapter.ts`      | 26.08%  |    0%    |   0%    | 19.04%  |
| **PMS/Utils**     | `retry.util.ts`              | 13.63%  |    0%    |   0%    |   15%   |
| **Prisma**        | `prisma.service.ts`          | 35.71%  |    0%    |   0%    |   25%   |
| **AI**            | `brief-generator.service.ts` | 21.05%  |    0%    |   0%    | 17.64%  |

### ❌ Zero Coverage Files

| Module            | File                          | % Stmts |            Priority             |
| :---------------- | :---------------------------- | :-----: | :-----------------------------: |
| **AI**            | `intake-agent.service.ts`     | **0%**  |   🔴 High (LLM orchestration)   |
| **Session**       | `session-timeout.worker.ts`   | **0%**  |    🟡 Medium (BullMQ worker)    |
| **Session**       | `session.gateway.ts`          | **0%**  |  🟡 Medium (WebSocket, 244 ln)  |
| **Transcription** | `transcription.service.ts`    | **0%**  | 🔴 High (audio/Whisper, 198 ln) |
| **Transcription** | `transcription.controller.ts` | **0%**  |          🟢 Low (thin)          |

> Controllers intentionally show 0% in unit runs — their behavior is validated by the E2E suite (191 tests, 13 suites).

---

## E2E Test Coverage

**All 191 E2E tests pass** across 13 suites (`face`, `intake`, `ai`, `dashboard`, `pms`, `health`, `rate-limit`, `health-rate-limit`, `auth`, `auth-rbac`, `analytics`, `audit`, `prometheus`), but contribute **0%** to statement/branch/function coverage because every E2E test mocks the service layer entirely. E2E validates:

- ✅ HTTP routing and status codes
- ✅ Zod validation (missing fields, invalid types, out-of-range values)
- ✅ Error propagation (500 on service errors)
- ✅ Response shapes
- ✅ Auth guard / RBAC enforcement (`auth-rbac.e2e-spec.ts`)
- ✅ Rate limiting behavior (`rate-limit`, `health-rate-limit`)
- ✅ Metrics exposure (`prometheus.e2e-spec.ts`)

**What E2E tests DON'T cover:**

- ❌ Service business logic
- ❌ Database interactions
- ❌ External API calls (Redis, Qdrant, Gemini, Whisper)
- ❌ Exception filter formatting

---

## Frontend — Coverage by Area (Vitest, 45 files, 599 tests)

| Area                  | % Stmts | % Branch | % Funcs | % Lines |
| :-------------------- | :-----: | :------: | :-----: | :-----: |
| **Stores**            |  100%   |   100%   | 97.29%  |  100%   |
| **Components/Auth**   |  100%   |   100%   |  100%   |  100%   |
| **Lib**               | 85.39%  |  90.26%  | 93.93%  | 85.39%  |
| **Services**          | 89.37%  |  83.69%  |   78%   | 89.37%  |
| **Components/Camera** | 98.73%  |  95.45%  |  100%   | 98.73%  |
| **Components/Intake** |   91%   |  83.78%  |   50%   |   91%   |
| **Components/Face**   | 59.66%  |  86.48%  |  91.3%  | 59.66%  |
| **Components/UI**     | 53.59%  |  78.75%  |   60%   | 53.59%  |
| **Hooks**             | 27.49%  |  77.31%  | 66.66%  | 27.49%  |

> Weakest areas: **Hooks** (27.49%) and **Components/UI** (53.59%) — the next best frontend coverage wins are `useFaceDetection`/`useLivenessDetection` deep paths and remaining UI primitives.

---

## Gap Analysis: What Needs Tests Most

### 🔴 Backend priorities (by risk × coverage gap)

| Priority | File                         | Coverage | Business Risk                               |
| :------- | :--------------------------- | :------: | :------------------------------------------ |
| P1       | `intake-agent.service.ts`    |    0%    | Gemini LLM conversation orchestration       |
| P1       | `transcription.service.ts`   |    0%    | Audio processing & Whisper API calls        |
| P1       | `session.gateway.ts`         |    0%    | WebSocket session management (244 lines)    |
| P1       | `session-timeout.worker.ts`  |    0%    | BullMQ background job (timeout enforcement) |
| P2       | `hl7-fhir.adapter.ts`        |  14.28%  | PMS/EMR sync mapping (282 lines)            |
| P2       | `custom-api.adapter.ts`      |  26.08%  | PMS/EMR sync mapping                        |
| P2       | `retry.util.ts`              |  13.63%  | Sync resilience — failure behavior          |
| P3       | `brief-generator.service.ts` |  21.05%  | Clinical brief generation                   |
| P3       | `opentelemetry.service.ts`   |  11.90%  | Trace export (degraded path)                |

### 🔴 Frontend priorities

| Area              | Coverage | Notes                                |
| :---------------- | :------: | :----------------------------------- |
| `hooks`           |  27.49%  | Face detection / liveness deep paths |
| `components/ui`   |  53.59%  | Remaining UI primitives              |
| `components/face` |  59.66%  | FaceOverlay / detection visuals      |

---

## Combined Test Inventory

| Layer        | Suites / Files |   Tests   | % Stmts | % Funcs |    Status    |
| :----------- | :------------- | :-------: | :-----: | :-----: | :----------: |
| Backend unit | 20 suites      |    287    | 52.30%  | 48.69%  | ✅ All green |
| Backend E2E  | 13 suites      |    191    |   0%    |   0%    | ✅ All green |
| Frontend     | 45 files       |    599    | 64.61%  | 75.93%  | ✅ All green |
| **Total**    |                | **1,077** |         |         |              |

> Next target: `intake-agent.service.ts` + `transcription.service.ts` unit suites would lift backend statements past ~58% and close the two highest-risk zero-coverage services.
