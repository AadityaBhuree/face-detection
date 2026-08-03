# Coverage Report — Jeevandata

**Generated:** August 3, 2026
**Test totals:** 162 unit (9 suites) + 129 E2E (9 suites) backend · 448 frontend (25 test files)

## Overall Coverage

| Layer             |  % Stmts   |  % Branch  |  % Funcs   |  % Lines   | Files measured |
| :---------------- | :--------: | :--------: | :--------: | :--------: | :------------: |
| Backend (unit)    | **36.72%** | **24.21%** | **34.74%** | **36.7%**  |       45       |
| Backend (E2E)     |    0%¹     |     0%     |     0%     |     0%     |       —        |
| Frontend (vitest) | **45.02%** | **79.87%** | **76.53%** | **45.02%** |       54       |

> ¹ E2E suites mock the entire service layer, so jest instruments nothing — see [E2E section](#e2e-test-coverage) for why this is expected.
>
> **Progress vs July 28 baseline:** backend statements 16.4% → **36.72%** (+20 pts), driven by new unit tests for `auth.service`, `dashboard.service`, `pms.service`, `health.service` and `validation.schema` (all previously 0%). Frontend coverage is measured for the first time.

---

## Backend — Unit Coverage by Module

### ✅ High Coverage (≥80% Statements)

| Module        | File                   | % Stmts | % Branch | % Funcs | % Lines |
| :------------ | :--------------------- | :-----: | :------: | :-----: | :-----: |
| **Audit**     | `audit.service.ts`     |  100%   |   100%   |  100%   |  100%   |
| **Dashboard** | `dashboard.service.ts` |  100%   |   100%   |  100%   |  100%   |
| **Session**   | `session.service.ts`   |  100%   |   100%   |  100%   |  100%   |
| **Face**      | `face.service.ts`      |  100%   |  81.25%  |  100%   |  100%   |
| **Config**    | `validation.schema.ts` | 98.07%  |  96.15%  |  100%   | 97.72%  |
| **Auth**      | `auth.service.ts`      | 94.11%  |  72.72%  |  100%   | 95.12%  |
| **PMS**       | `pms.service.ts`       | 94.28%  |  55.55%  |  100%   | 93.93%  |
| **Intake**    | `intake.service.ts`    | 94.11%  |  81.81%  | 88.88%  | 95.83%  |
| **Health**    | `health.service.ts`    | 92.85%  |  64.28%  | 82.35%  |   96%   |

### ⚠️ Partial Coverage (1–79% Statements)

| Module        | File                             | % Stmts | % Branch | % Funcs | % Lines |
| :------------ | :------------------------------- | :-----: | :------: | :-----: | :-----: |
| **Prisma**    | `prisma.service.ts`              | 35.71%  |    0%    |   0%    |   25%   |
| **PMS**       | `adapters/custom-api.adapter.ts` | 26.08%  |    0%    |   0%    | 19.04%  |
| **AI**        | `brief-generator.service.ts`     | 21.05%  |    0%    |   0%    | 17.64%  |
| **PMS**       | `adapters/hl7-fhir.adapter.ts`   | 14.28%  |    0%    |   0%    | 10.52%  |
| **PMS**       | `utils/retry.util.ts`            | 13.63%  |    0%    |   0%    |   15%   |
| **Telemetry** | `opentelemetry.service.ts`       |  11.9%  |    0%    |   0%    |  7.69%  |

### ❌ Zero Coverage

| Module              | File                                                                                                          | Stmts | Notes                                     |
| :------------------ | :------------------------------------------------------------------------------------------------------------ | :---: | :---------------------------------------- |
| **AI**              | `intake-agent.service.ts`                                                                                     |  0%   | LLM conversation orchestration (37 stmts) |
| **AI**              | `ai.service.ts`                                                                                               |  0%   | API orchestration w/ retry (18 stmts)     |
| **Transcription**   | `transcription.service.ts`                                                                                    |  0%   | Audio + Whisper calls (50 stmts)          |
| **Face**            | `face-registration.service.ts`                                                                                |  0%   | Qdrant upsert transaction (34 stmts)      |
| **Session**         | `session.gateway.ts`                                                                                          |  0%   | WebSocket gateway (61 stmts)              |
| **Session**         | `session-timeout.worker.ts`                                                                                   |  0%   | BullMQ worker (33 stmts)                  |
| **Telemetry**       | `tracing.ts`                                                                                                  |  0%   | OTel bootstrap (49 stmts)                 |
| **Logger**          | `logger.service.ts`                                                                                           |  0%   | Winston wrapper (14 stmts)                |
| **Config**          | `configuration.ts`                                                                                            |  0%   | env loader (3 stmts)                      |
| **Controllers** (7) | `auth`, `ai`, `dashboard`, `face`, `intake`, `pms`, `transcription`                                           |  0%   | thin HTTP layer, exercised by E2E instead |
| **Guards**          | `jwt-auth.guard.ts`, `roles.guard.ts`, `throttler.guard.ts`                                                   |  0%   | security-critical, no unit tests          |
| **Common**          | `http-exception.filter.ts`, `zod-validation.pipe.ts`, interceptors, middleware, decorators, `jwt.strategy.ts` |  0%   | pipeline infra (≈150 stmts)               |

---

## Frontend — Coverage by Area (vitest + v8)

| Area               | File                                                                                         | % Stmts | % Branch | % Funcs |
| :----------------- | :------------------------------------------------------------------------------------------- | :-----: | :------: | :-----: |
| **Stores**         | `stores/face-store.ts`                                                                       | 53.85%  |  11.11%  |  7.14%  |
| **Stores**         | `stores/session-store.ts`                                                                    | 52.94%  |    0%    |   0%    |
| **Services**       | `services/api.ts`                                                                            | 52.89%  |  42.86%  | 58.82%  |
| **Services**       | `services/socket.ts`                                                                         | 35.24%  |  38.46%  | 42.86%  |
| **UI**             | `components/ui/badge.tsx`                                                                    | 73.44%  |  8.33%   |   0%    |
| **UI**             | `components/ui/button.tsx`                                                                   | 57.50%  |  16.67%  |   n/a   |
| **UI**             | `components/ui/card.tsx`                                                                     | 40.58%  |   30%    |   0%    |
| **UI**             | `components/ui/dark-mode-toggle.tsx`                                                         | 36.54%  |    0%    |   0%    |
| **UI**             | `components/ui/language-selector.tsx`                                                        | 18.90%  |  15.56%  | 11.11%  |
| **Intake**         | `components/intake/transcript-view.tsx`                                                      | 34.57%  |    5%    |   0%    |
| **Lib**            | `lib/face-geometry.ts`                                                                       | 36.23%  |  11.54%  | 14.29%  |
| **Lib**            | `lib/env.ts`, `lib/utils.ts`                                                                 |  ~35%   |   ~15%   |  ~10%   |
| **Hooks**          | `useFaceDetection.ts`                                                                        | 11.46%  |  21.21%  |   0%    |
| **Hooks**          | `useLivenessDetection.ts`, `useCamera.ts`, `useIntakeConversation.ts`, `useFaceEmbedding.ts` |   0%    |    0%    |   0%    |
| **App pages**      | `app/*/page.tsx`, `providers.tsx`, `layout.tsx`                                              |   0%    |    0%    |   0%    |
| **Services**       | `services/db.ts` (Dexie)                                                                     |   0%    |    0%    |   0%    |
| **Radix wrappers** | `dialog`, `select`, `tabs`, `toast`, `tooltip`, etc.                                         |   0%    |    0%    |   0%    |

---

## E2E Test Coverage

**All 129 E2E tests pass across 9 suites** (`face`, `intake`, `ai`, `dashboard`, `pms`, `health`, `health-rate-limit`, `rate-limit`, `auth`), but they **contribute 0% to statement/branch/function coverage** — every E2E test mocks the service layer entirely. This is by design: the E2E layer validates

- ✅ HTTP routing and status codes
- ✅ Zod validation (missing fields, invalid types, out-of-range values)
- ✅ Error propagation (500 on service errors)
- ✅ Response shapes
- ✅ Auth guard enforcement & rate-limit behavior

What E2E tests DON'T cover:

- ❌ Service business logic
- ❌ Database interactions
- ❌ External API calls (Redis, Qdrant, Gemini, Whisper)
- ❌ Exception filter formatting

---

## Gap Analysis — Where Tests Are Still Needed

### 🔴 Priority 1: Core business logic still at 0%

| Service                        | Stmts | Business Risk                             |
| :----------------------------- | :---: | :---------------------------------------- |
| `intake-agent.service.ts`      |  37   | Gemini conversation orchestration         |
| `transcription.service.ts`     |  50   | Audio processing / Whisper                |
| `face-registration.service.ts` |  34   | Patient registration + Qdrant transaction |
| `session.gateway.ts`           |  61   | WebSocket session lifecycle               |
| `session-timeout.worker.ts`    |  33   | BullMQ background job                     |
| `ai.service.ts`                |  18   | AI API orchestration                      |

### 🔴 Priority 2: Security-critical infrastructure (0%)

| Component                  | Stmts | Risk                    |
| :------------------------- | :---: | :---------------------- |
| `jwt-auth.guard.ts`        |  14   | Auth bypass             |
| `roles.guard.ts`           |  16   | Privilege escalation    |
| `jwt.strategy.ts`          |   9   | Token validation        |
| `zod-validation.pipe.ts`   |  12   | Input validation bypass |
| `http-exception.filter.ts` |  36   | Info leakage in errors  |

### 🟡 Priority 3: Frontend hooks & libs (0–15%)

| File                                                                  | Risk                         |
| :-------------------------------------------------------------------- | :--------------------------- |
| `useLivenessDetection.ts`, `useCamera.ts`, `useIntakeConversation.ts` | core patient-flow logic      |
| `useFaceEmbedding.ts`                                                 | 512-dim vector correctness   |
| `lib/face-embedding.ts` (7%)                                          | geometric feature extraction |
| `services/db.ts`                                                      | offline Dexie cache          |

---

## How to Regenerate

```bash
# Backend unit (writes apps/backend/coverage/)
cd apps/backend && npx jest --coverage --coverageReporters=json-summary --coverageReporters=text --no-cache

# Backend E2E (writes apps/backend/test/coverage-e2e/) — expected: 0 files, tests mocked
cd apps/backend && npx jest --config ./test/jest-e2e.json --coverage --no-cache

# Frontend (writes apps/frontend/coverage/)
cd apps/frontend && npx vitest run --coverage
```

> Note: pass `--coverageReporters` as repeated flags — a comma-joined value (`json-summary,text`) is parsed by jest as a single reporter module name and fails with _"Cannot find module"_.
