# Coverage Report — Jeevandata Backend

**Generated:** July 28, 2026  
**Tests:** 76 unit (4 suites) + 113 E2E (6 suites)  
**Overall Coverage:** 16.4% Statements | 17.67% Branch | 15.15% Functions | 16.25% Lines

---

## Coverage by Module

### ✅ High Coverage (≥80% Statements)

| Module      | File                 | % Stmts  | % Branch | % Funcs  | % Lines  | Uncovered Lines |
| :---------- | :------------------- | :------: | :------: | :------: | :------: | :-------------- |
| **Audit**   | `audit.service.ts`   | **100%** | **100%** | **100%** | **100%** | —               |
| **Face**    | `face.service.ts`    | **100%** |  81.25%  | **100%** | **100%** | 15, 75, 105     |
| **Session** | `session.service.ts` | **100%** | **100%** | **100%** | **100%** | —               |
| **Intake**  | `intake.service.ts`  |  95.12%  |  92.85%  |  87.50%  |  94.87%  | 124-125         |

### ⚠️ Partial Coverage (1–79% Statements)

| Module                | File                           | % Stmts | % Branch | % Funcs | % Lines | Notes                          |
| :-------------------- | :----------------------------- | :-----: | :------: | :-----: | :-----: | :----------------------------- |
| **Intake**            | `intake.service.ts`            | 95.12%  |  92.85%  | 87.50%  | 94.87%  | Near 100%, 2 uncovered lines   |
| **Face**              | `face-registration.service.ts` |   0%    |    0%    |   0%    |   0%    | **No tests at all**            |
| **Face** (overall)    | —                              | 34.56%  |   65%    |  40.9%  |  33.8%  | Only face.service.ts tested    |
| **Session** (overall) | —                              | 25.78%  |  45.83%  | 23.07%  |  25.4%  | Only session.service.ts tested |
| **AI**                | `brief-generator.service.ts`   | 19.44%  |    0%    |   0%    | 15.62%  | Minimal coverage               |
| **Prisma**            | `prisma.service.ts`            | 35.71%  |    0%    |   0%    |   25%   | Only init path tested          |

### ❌ Zero Coverage Modules

These modules have **no tests at all** for any of their files:

| Module                  | Files                                                                                                                                      | % Stmts |              Priority              |
| :---------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- | :-----: | :--------------------------------: |
| **Health** ✨           | `health.controller.ts`, `health.service.ts`                                                                                                | **0%**  |        🟢 Low (new, simple)        |
| **Dashboard**           | `dashboard.controller.ts` (1-63), `dashboard.service.ts` (1-162)                                                                           | **0%**  | 🔴 High (controller has endpoints) |
| **PMS**                 | `pms.controller.ts` (1-24), `pms.service.ts` (1-52)                                                                                        | **0%**  |       🔴 High (sync module)        |
| **Transcription**       | `transcription.controller.ts` (1-34), `transcription.service.ts` (1-155)                                                                   | **0%**  |     🔴 High (audio processing)     |
| **AI**                  | `ai.controller.ts`, `ai.service.ts`, `intake-agent.service.ts`                                                                             | **0%**  |    🔴 High (LLM orchestration)     |
| **Session Gateway**     | `session.gateway.ts` (1-269)                                                                                                               | **0%**  |  🟡 Medium (WebSocket, 269 lines)  |
| **Session Worker**      | `session-timeout.worker.ts` (1-110)                                                                                                        | **0%**  |     🟡 Medium (BullMQ worker)      |
| **Face Registration**   | `face-registration.service.ts` (1-111)                                                                                                     | **0%**  |             🟡 Medium              |
| **Auth Infrastructure** | `jwt-auth.guard.ts`, `roles.guard.ts`, `jwt.strategy.ts`, etc.                                                                             | **0%**  |    🔴 High (security critical)     |
| **Common**              | `http-exception.filter.ts`, `zod-validation.pipe.ts`, `logging.interceptor.ts`, `transform.interceptor.ts`, `correlation-id.middleware.ts` | **0%**  |             🟡 Medium              |
| **Config**              | `configuration.ts` (67 env vars)                                                                                                           | **0%**  |               🟢 Low               |
| **Logger**              | `logger.service.ts`                                                                                                                        | **0%**  |               🟢 Low               |
| **DTOs**                | `register-patient.dto.ts`                                                                                                                  | **0%**  |   🟢 Low (thin class-validator)    |

---

## E2E Test Coverage

**All 113 E2E tests pass** across 6 suites, but **contribute 0% to statement/branch/function coverage** because every E2E test mocks the service layer entirely. The E2E tests validate:

- ✅ HTTP routing and status codes
- ✅ Zod validation (missing fields, invalid types, out-of-range values)
- ✅ Error propagation (500 on service errors)
- ✅ Response shapes

**What E2E tests DON'T cover:**

- ❌ Service business logic
- ❌ Database interactions
- ❌ External API calls (Redis, Qdrant, Gemini, Whisper)
- ❌ Exception filter formatting
- ❌ Guard/auth enforcement

---

## Gap Analysis: What Needs Tests Most

### 🔴 Priority 1: Critical Business Logic (0% coverage)

These services handle core clinical/patient data and have zero coverage:

| Priority | Service                        | Lines | Business Risk                             |
| :------- | :----------------------------- | :---: | :---------------------------------------- |
| P1       | `dashboard.service.ts`         |  162  | Clinic metrics & patient data aggregation |
| P1       | `transcription.service.ts`     |  155  | Audio processing & Whisper API calls      |
| P1       | `intake-agent.service.ts`      |  117  | Gemini LLM conversation orchestration     |
| P1       | `ai.service.ts`                |  46   | AI API orchestration with retry           |
| P1       | `brief-generator.service.ts`   |  146  | Clinical brief generation (19% covered)   |
| P1       | `face-registration.service.ts` |  111  | Patient registration + Qdrant transaction |
| P1       | `session.gateway.ts`           |  269  | WebSocket session management              |
| P1       | `session-timeout.worker.ts`    |  110  | BullMQ background job                     |

### 🔴 Priority 2: Security-Critical Infrastructure (0% coverage)

| Component                  | Lines | Risk                    |
| :------------------------- | :---: | :---------------------- |
| `jwt-auth.guard.ts`        |  34   | Auth bypass             |
| `roles.guard.ts`           |  38   | Privilege escalation    |
| `jwt.strategy.ts`          |  23   | Token validation        |
| `zod-validation.pipe.ts`   |  29   | Input validation bypass |
| `http-exception.filter.ts` |  90   | Info leakage in errors  |

### 🟡 Priority 3: New or Thin Modules (0% coverage)

| Module                 | Lines | Notes                     |
| :--------------------- | :---: | :------------------------ |
| `health.service.ts`    |  168  | New, clean implementation |
| `health.controller.ts` |  33   | Thin controller           |
| `pms.service.ts`       |  52   | Sync module               |
| `pms.controller.ts`    |  24   | Thin controller           |

---

## Recommended Next Testing Steps

Ordered by impact/effort ratio:

| Step | Module                                   | Est. Tests  | Est. Time |         Coverage Gain         |
| :--- | :--------------------------------------- | :---------: | :-------: | :---------------------------: |
| 1    | **FaceRegistrationService**              |    15–20    |    1h     |       +111 lines (100%)       |
| 2    | **PmsService** + **PmsController**       |    10–12    |   0.5h    |       +76 lines (100%)        |
| 3    | **DashboardService**                     |    15–20    |    1h     |       +162 lines (100%)       |
| 4    | **HealthService**                        |    12–15    |   0.5h    |       +168 lines (100%)       |
| 5    | **JwtAuthGuard** + **ZodValidationPipe** |    15–20    |    1h     |     +63 lines (security)      |
| 6    | **TranscriptionService**                 |    12–15    |    1h     |          +155 lines           |
| 7    | **BriefGeneratorService**                |    10–15    |    1h     | +146 lines (from 19% to 100%) |
| 8    | **IntakeAgentService**                   |    12–15    |    1h     |          +117 lines           |
|      | **Total**                                | **101–132** | **7–8h**  |    **~998 lines to 100%**     |

After completing these steps, overall coverage would rise from **~16% → ~80%**.

---

## Combined Test Inventory

| Test Suite                | Type |  Tests  |  % Stmts  |  % Funcs   |          Status          |
| :------------------------ | :--- | :-----: | :-------: | :--------: | :----------------------: |
| `audit.service.spec.ts`   | Unit |   18    |   100%    |    100%    |       ✅ Complete        |
| `face.service.spec.ts`    | Unit |   16    |   100%    |    100%    |       ✅ Complete        |
| `session.service.spec.ts` | Unit |   26    |   100%    |    100%    |       ✅ Complete        |
| `intake.service.spec.ts`  | Unit |   16    |  95.12%   |   87.50%   |     ✅ Near complete     |
| `face.e2e-spec.ts`        | E2E  |   26    |    0%     |     0%     | ✅ Route/validation only |
| `intake.e2e-spec.ts`      | E2E  |   20    |    0%     |     0%     | ✅ Route/validation only |
| `ai.e2e-spec.ts`          | E2E  |   22    |    0%     |     0%     | ✅ Route/validation only |
| `dashboard.e2e-spec.ts`   | E2E  |   22    |    0%     |     0%     | ✅ Route/validation only |
| `pms.e2e-spec.ts`         | E2E  |   13    |    0%     |     0%     | ✅ Route/validation only |
| `health.e2e-spec.ts`      | E2E  |   10    |    0%     |     0%     | ✅ Route/validation only |
| **Total**                 |      | **189** | **16.4%** | **15.15%** |                          |
