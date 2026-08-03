# Jeevandata

> **AI-powered smart clinic intake system** — contactless face check-in, live AI voice symptom intake, and a structured clinical brief delivered to the doctor before the patient enters the room.

![Monorepo](https://img.shields.io/badge/monorepo-Turborepo%20%2B%20pnpm-5b21b6?logo=turborepo)
![Next.js](https://img.shields.io/badge/frontend-Next.js%2014-000000?logo=nextdotjs)
![NestJS](https://img.shields.io/badge/backend-NestJS%2010-e0234e?logo=nestjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL%2016%20%2F%20Prisma-4169e1?logo=postgresql)
![Qdrant](https://img.shields.io/badge/vector-Qdrant%20512--dim-e31c3d?logo=qdrant)
![Redis](https://img.shields.io/badge/Redis%207%20%2F%20BullMQ-dc382d?logo=redis)
![Tests](https://img.shields.io/badge/tests-739%20passing-22c55e)
![License](https://img.shields.io/badge/license-MIT-8b5cf6)

**Jeevandata** is a privacy-first, AI-driven patient intake platform for clinics and hospitals. Patients check in at a camera kiosk, the system recognizes returning patients from a 512-dimensional face embedding stored in a vector database, and an AI voice assistant interviews them about their symptoms. A structured **Clinical Brief** — chief complaint, risk flags, suggested vitals, ICD-10 hints — is waiting for the doctor when the patient sits down.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Demo & Screenshots](#demo--screenshots)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Architecture & How It Works](#architecture--how-it-works)
- [Testing](#testing)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [FAQ / Troubleshooting](#faq--troubleshooting)
- [License](#license)
- [Acknowledgments](#acknowledgments)
- [Contact](#contact)

---

## Overview

In most clinics, check-in is slow and paper-heavy. The doctor loses the first 5–10 minutes of every consultation to repetitive intake questions ("what brings you in? how long? how severe?"), queues build at reception, and emergency symptoms are only caught when the patient finally sits down.

Jeevandata fixes that by moving the entire intake conversation **before** the consultation:

1. **The camera recognizes the patient** (or registers them as new) at the kiosk in seconds.
2. **An AI voice assistant** interviews them about their symptoms while they wait.
3. **A clinical brief is generated automatically** and pushed to the doctor's dashboard in real time.

The result: shorter queues, no repeated intake questions, and early emergency screening. Read the full motivation and workflow in [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md).

**Who it's for:** clinic and hospital operators, doctors, and their patients — anyone who wants a faster, more consistent check-in experience.

---

## Key Features

- **Contactless face check-in** — 478-point MediaPipe landmark detection runs entirely in the browser (WASM/WebGL); no face images ever leave the device.
- **Liveness anti-spoofing** — Eye Aspect Ratio (EAR) blink verification rejects photos and videos before registration or recognition.
- **512-dim face recognition** — geometric feature extraction + L2-normalized embeddings searched against Qdrant with a cosine threshold (default `0.82`) for instant returning-patient lookup.
- **AI voice intake assistant** — turn-by-turn Gemini 2.0 Flash conversation with Whisper speech-to-text, one question at a time, with automatic retry and empathetic phrasing.
- **Clinical brief generation** — structured JSON brief (summary, chief complaint, risk flags, suggested vitals, follow-ups, medication notes, ICD-10 hints) delivered to the doctor dashboard.
- **Emergency screening** — critical symptoms (chest pain, severe dyspnea, acute bleeding) are flagged immediately for escalation.
- **Doctor dashboard** — live active sessions, recent briefs, review workflow, and per-patient visit history.
- **Privacy-first by design** — only numerical vectors are stored (no raw face images), Aadhaar references are SHA-256 hashed, registration is consent-gated, and every lookup/export writes an immutable `AuditLog`.
- **PMS/EMR sync** — HL7 FHIR and custom API adapters with an offline patient cache (`PmsPatientCache`) for zero-downtime operation during internet outages.
- **Multilingual intake** — UI and AI prompts support English, Hindi, Marathi, and Spanish.
- **Mobile-first PWA** — installable, offline-capable, front/rear camera toggle for clinic tablets and phones.
- **Production observability** — OpenTelemetry/Jaeger tracing, structured pino logging with correlation IDs, and liveness/readiness health checks.

---

## Demo & Screenshots

> Screenshots and a live demo are coming soon. The development UI runs at `http://localhost:3000` (frontend) and `http://localhost:4000` (backend API, `/health` for status).

---

## Tech Stack

| Layer                | Technology                                                     | Purpose                                         |
| :------------------- | :------------------------------------------------------------- | :---------------------------------------------- |
| **Monorepo**         | Turborepo + pnpm workspaces                                    | Fast cached task orchestration                  |
| **Frontend**         | Next.js 14 (App Router, PWA via `next-pwa`)                    | Patient kiosk, camera UI, doctor dashboard      |
| **On-device vision** | `@mediapipe/tasks-vision`                                      | Browser-side 478-landmark face tracking         |
| **UI**               | Tailwind CSS, Radix UI primitives, Lucide icons                | Accessible design system                        |
| **Client state**     | Zustand + TanStack Query                                       | Stores + server-state cache                     |
| **Backend**          | NestJS 10 (TypeScript)                                         | Modular REST + WebSocket API gateway            |
| **Database / ORM**   | PostgreSQL 16 + Prisma 6                                       | Patients, sessions, transcripts, records, audit |
| **Vector DB**        | Qdrant (`@qdrant/js-client-rest`)                              | 512-dim face embedding similarity search        |
| **Cache & queues**   | Redis 7 + BullMQ                                               | Session state, pub/sub, background jobs         |
| **AI LLM**           | Google Gemini 2.0 Flash (+ Claude fallback)                    | Intake agent & clinical brief generation        |
| **Speech-to-text**   | Whisper.cpp HTTP server                                        | Local fast voice transcription                  |
| **Object storage**   | MinIO / Cloudflare R2                                          | Opus audio & face media                         |
| **Auth**             | JWT (bcryptjs + passport-jwt, refresh tokens)                  | Clinic user authentication                      |
| **Security**         | helmet, @nestjs/throttler rate limiting, Zod + class-validator | Input validation & request protection           |
| **Observability**    | OpenTelemetry → Jaeger/OTLP, pino                              | Tracing, structured logs                        |

---

## Prerequisites

| Requirement                   | Version / Notes                                                     |
| :---------------------------- | :------------------------------------------------------------------ |
| **Node.js**                   | `>= 20.0.0`                                                         |
| **pnpm**                      | `>= 9.0.0` (lockfile managed by `pnpm@9.15.4`)                      |
| **Docker**                    | Required for PostgreSQL, Redis, Qdrant, MinIO, Whisper              |
| **Google Gemini API key**     | Required for the AI intake agent (`GOOGLE_GEMINI_API_KEY`)          |
| **OpenAI / Whisper endpoint** | Required for speech-to-text (`WHISPER_API_URL` or `OPENAI_API_KEY`) |

---

## Installation

### 1. Clone & install dependencies

```bash
git clone https://github.com/AadityaBhuree/face-detection.git jeevandata
cd jeevandata
pnpm install
```

### 2. Start the infrastructure

```bash
docker compose up -d
```

This boots PostgreSQL 16, Redis 7, Qdrant, MinIO, the Whisper.cpp server, and Redis Commander.

### 3. Configure environment

```bash
cp .env.example .env
# then fill in your Gemini / JWT secrets — see Configuration below
```

### 4. Prepare the database

```bash
pnpm db:generate   # generate the Prisma client
pnpm db:push       # sync the schema to PostgreSQL
pnpm db:seed       # create seed clinic users (see prisma/seed.ts)
```

### 5. Run everything

```bash
pnpm dev           # starts frontend (:3000) + backend (:4000) in parallel via Turborepo
```

---

## Configuration

Copy `.env.example` to `.env` and set the values below. **Never commit the real `.env`** — it is git-ignored.

| Variable                                                    | Description                                    | Required | Default                                                 |
| :---------------------------------------------------------- | :--------------------------------------------- | :------: | :------------------------------------------------------ |
| `APP_PORT`                                                  | Backend HTTP port                              |          | `4000`                                                  |
| `FRONTEND_URL` / `BACKEND_URL`                              | CORS origins for cross-origin requests         |          | `http://localhost:3000` / `:4000`                       |
| `DATABASE_URL`                                              | PostgreSQL connection string                   |    ✅    | `postgresql://jeevandata:...@localhost:5432/jeevandata` |
| `REDIS_URL`                                                 | Redis connection string (BullMQ + cache)       |    ✅    | `redis://default:...@localhost:6379`                    |
| `QDRANT_URL`                                                | Qdrant REST endpoint                           |    ✅    | `http://localhost:6333`                                 |
| `GOOGLE_GEMINI_API_KEY`                                     | Gemini API key for the intake agent            |    ✅    | —                                                       |
| `GEMINI_MODEL`                                              | LLM model name                                 |          | `gemini-2.0-flash`                                      |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL`                     | Optional Claude fallback                       |          | —                                                       |
| `WHISPER_API_URL`                                           | Whisper.cpp inference endpoint                 | ✅ (STT) | `http://localhost:9001/inference`                       |
| `R2_ENDPOINT` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | S3-compatible object storage                   |          | `http://localhost:9000` / `minioadmin`                  |
| `JWT_SECRET` / `JWT_REFRESH_SECRET`                         | JWT signing secrets (use strong random values) |    ✅    | dev placeholders                                        |
| `JWT_EXPIRATION`                                            | Access-token lifetime                          |          | `24h`                                                   |
| `FACE_MATCH_THRESHOLD`                                      | Qdrant cosine match threshold                  |          | `0.82`                                                  |
| `FACE_EMBEDDING_DIM`                                        | Vector dimension                               |          | `512`                                                   |
| `LIVENESS_THRESHOLD`                                        | Blink/liveness EAR threshold                   |          | `0.7`                                                   |
| `CORS_ORIGINS`                                              | Comma-separated allowed origins                |          | `http://localhost:3000`                                 |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX_REQUESTS`          | Throttler window / max requests                |          | `60000` / `100`                                         |
| `LOG_LEVEL` / `LOG_FORMAT`                                  | Logging verbosity and format                   |          | `debug` / `json`                                        |

Frontend public variables (in `apps/frontend/.env.local`):

| Variable              | Description          | Default                 |
| :-------------------- | :------------------- | :---------------------- |
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://localhost:4000` |

---

## Usage

### Common commands (run from the repo root)

| Command                               | What it does                                                |
| :------------------------------------ | :---------------------------------------------------------- |
| `pnpm dev`                            | Start frontend + backend in watch mode (Turborepo parallel) |
| `pnpm build`                          | Build all workspaces                                        |
| `pnpm lint` / `pnpm lint:fix`         | Lint (and autofix) all workspaces                           |
| `pnpm typecheck`                      | Type-check all workspaces                                   |
| `pnpm test`                           | Run all unit/component tests                                |
| `pnpm test:e2e`                       | Run backend E2E suites                                      |
| `pnpm db:migrate`                     | Create/apply Prisma migrations                              |
| `pnpm db:seed`                        | Seed the database                                           |
| `pnpm docker:up` / `pnpm docker:down` | Start / stop the infrastructure stack                       |

### Scoped commands

```bash
# Backend only
pnpm --filter @jeevandata/backend dev          # nest start --watch
pnpm --filter @jeevandata/backend test         # jest unit tests
pnpm --filter @jeevandata/backend test:e2e     # supertest E2E suites
pnpm --filter @jeevandata/backend prisma:studio

# Frontend only
pnpm --filter @jeevandata/frontend dev         # next dev --port 3000
pnpm --filter @jeevandata/frontend test        # vitest
```

### Typical flow

1. Open `http://localhost:3000` in a browser (Chrome recommended for camera access).
2. Grant camera permission; the kiosk runs liveness detection and face matching.
3. Returning patients are greeted by name; new patients register via the modal (name, DOB, mobile, consent).
4. The AI voice assistant interviews the patient; the conversation streams over Socket.IO.
5. When complete, the Clinical Brief appears on the doctor dashboard (`/dashboard`).

---

## API Reference

All routes are prefixed by the backend base URL (default `http://localhost:4000`). Endpoints marked 🔓 are public; the rest require a `Bearer` JWT. See [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) for request/response examples.

### Auth — `POST /auth/*`

| Method | Route            | Description                              | Auth |
| :----- | :--------------- | :--------------------------------------- | :--- |
| POST   | `/auth/register` | Register a clinic user (email, password) | 🔓   |
| POST   | `/auth/login`    | Login, returns access + refresh tokens   | 🔓   |
| POST   | `/auth/refresh`  | Rotate an expired access token           | 🔓   |
| GET    | `/auth/profile`  | Current user profile                     | JWT  |
| POST   | `/auth/logout`   | Revoke the refresh token                 | JWT  |

### Face recognition — `POST /face/*`

| Method | Route                         | Description                                                   |
| :----- | :---------------------------- | :------------------------------------------------------------ |
| POST   | `/face/embedding`             | Upsert a 512-dim embedding for a patient                      |
| POST   | `/face/search`                | Raw Qdrant cosine search (returns matches + scores)           |
| POST   | `/face/search-with-details`   | Search and return full patient details                        |
| POST   | `/face/register-patient`      | Register a patient + store their embedding (consent required) |
| GET    | `/face/:patientId/embeddings` | Embedding history for a patient                               |

### Intake sessions

| Method | Route                          | Description                                     |
| :----- | :----------------------------- | :---------------------------------------------- |
| POST   | `/intake/session`              | Create a new intake session (`{ deviceId }`)    |
| GET    | `/intake/session/:id`          | Full session details + brief                    |
| POST   | `/intake/session/:id/complete` | Mark the session complete (generates the brief) |
| GET    | `/intake/session/:id/status`   | Live session status                             |

### AI intake agent

| Method | Route              | Description                                                      |
| :----- | :----------------- | :--------------------------------------------------------------- |
| POST   | `/ai/intake-agent` | One conversational turn with Gemini (history + input → response) |
| POST   | `/ai/brief`        | Generate the structured clinical brief for a session             |

### Doctor dashboard

| Method | Route                                        | Description                       |
| :----- | :------------------------------------------- | :-------------------------------- |
| GET    | `/dashboard/patient/:patientId/latest-brief` | Latest brief for a patient        |
| GET    | `/dashboard/active-sessions`                 | Live sessions currently in intake |
| GET    | `/dashboard/recent-briefs`                   | Recently generated briefs         |
| PATCH  | `/brief/:id/review`                          | Mark a brief as reviewed          |
| GET    | `/dashboard/patient/:patientId/history`      | Full visit history for a patient  |

### Transcription & PMS sync

| Method | Route                            | Description                                      |
| :----- | :------------------------------- | :----------------------------------------------- |
| POST   | `/transcribe`                    | Transcribe an uploaded audio buffer (Whisper)    |
| GET    | `/transcribe/session/:sessionId` | Transcripts for a session                        |
| POST   | `/sync/pms`                      | Push intake data to the connected PMS/EMR        |
| POST   | `/sync/patient-context`          | Pull patient context from the PMS into the cache |

### Health

| Method | Route           | Description                             |
| :----- | :-------------- | :-------------------------------------- |
| GET    | `/health`       | Aggregate health check                  |
| GET    | `/health/live`  | Liveness (process up)                   |
| GET    | `/health/ready` | Readiness (DB, Redis, Qdrant reachable) |

---

## Project Structure

```
jeevandata/
├── apps/
│   ├── backend/                  # NestJS API (TypeScript)
│   │   ├── prisma/               # schema.prisma + seed.ts
│   │   ├── src/
│   │   │   ├── auth/             # JWT register/login/refresh, guards
│   │   │   ├── common/           # decorators, filters, interceptors, middleware
│   │   │   ├── config/           # env schema (Zod) + configuration
│   │   │   ├── logger/           # pino structured logging
│   │   │   ├── modules/
│   │   │   │   ├── ai/           # Gemini intake agent + brief generator
│   │   │   │   ├── audit/        # immutable AuditLog service
│   │   │   │   ├── dashboard/    # doctor metrics & briefs
│   │   │   │   ├── face/         # Qdrant search + registration
│   │   │   │   ├── health/       # liveness/readiness endpoints
│   │   │   │   ├── intake/       # session record management
│   │   │   │   ├── pms/          # FHIR/custom EMR adapters + cache
│   │   │   │   ├── session/      # Socket.IO realtime gateway
│   │   │   │   └── transcription/# Whisper STT client
│   │   │   ├── prisma/           # PrismaService
│   │   │   ├── tracing.ts        # OpenTelemetry bootstrap (first import)
│   │   │   └── main.ts
│   │   └── test/                 # supertest E2E suites
│   └── frontend/                 # Next.js 14 PWA (React 18)
│       ├── public/               # manifest, icons, WASM assets
│       └── src/
│           ├── app/              # App Router pages (/, /dashboard, /intake/[sessionId])
│           ├── components/       # UI primitives + feature components
│           ├── hooks/            # useFaceDetection, useLiveness, useVoice, useLanguage…
│           ├── i18n/             # EN/HI/MR/ES translations
│           ├── lib/              # face-embedding, face-geometry, env, utils
│           ├── services/         # api.ts (axios), socket.ts (Socket.IO)
│           └── stores/           # Zustand stores (face, session)
├── packages/
│   ├── shared-schemas/           # shared Zod validation schemas
│   ├── shared-types/             # shared TS interfaces & DTOs
│   └── shared-utils/             # retry helpers, formatters, crypto
├── docker-init/                  # postgres-init.sql
├── docker-compose.yml            # postgres, redis, qdrant, minio, whisper, redis-commander
├── Dockerfile.backend            # multi-stage NestJS build
├── Dockerfile.frontend           # multi-stage Next.js build
├── turbo.json                    # Turborepo task pipeline
├── pnpm-workspace.yaml
├── .env.example
└── PROJECT_OVERVIEW.md           # deep-dive into motive & workflow
```

---

## Architecture & How It Works

```
┌──────────────────────────────┐        ┌──────────────────────────────────────────────┐
│   Next.js 14 PWA (browser)   │        │            NestJS Backend (:4000)             │
│                              │        │                                                │
│  MediaPipe 478-landmarks ────┼───────▶│  Face module → Qdrant 512-dim cosine search    │
│  EAR liveness (anti-spoof)   │        │  (threshold ≥ 0.82)                            │
│  512-dim embedding (L2-norm) │        ├────────────────────────────────────────────────┤
│  Voice capture (Opus) ───────┼───────▶│  Transcription → Whisper STT → Gemini 2.0      │
│  Socket.IO client / WebRTC   │◀───────│  Intake agent (turn-by-turn, 1 Q at a time)    │
│                              │        │  → Clinical Brief JSON                         │
└──────────────────────────────┘        ├────────────────────────────────────────────────┤
                                        │  Postgres (Prisma): Patient, IntakeSession,    │
                                        │  SessionTranscript, IntakeRecord, AuditLog     │
                                        │  Redis + BullMQ: session cache, jobs           │
                                        │  MinIO/R2: audio + media                       │
                                        └────────────────────────────────────────────────┘
```

**End-to-end flow**

```mermaid
sequenceDiagram
    actor P as Patient
    participant C as Camera / Next.js PWA
    participant B as NestJS Backend
    participant Q as Qdrant
    participant AI as Gemini 2.0 Flash

    P->>C: Arrives at kiosk
    C->>C: MediaPipe landmarks + EAR blink liveness
    C->>B: POST /face/search-with-details (512-dim vector)
    B->>Q: cosine search (threshold ≥ 0.82)
    alt Match found
        Q-->>B: patientId + score
        B-->>C: "Hello [Name], welcome back!"
    else New patient
        C->>B: POST /face/register-patient (name, DOB, mobile, consent)
    end
    C->>B: POST /intake/session (Socket.IO session starts)
    loop AI voice intake
        P->>C: Speaks symptoms
        C->>B: Streams audio chunk → Whisper STT → Gemini turn
        B-->>C: Empathetic response + follow-up question
    end
    B->>AI: Generate structured Clinical Brief
    B->>B: Save IntakeRecord + AuditLog + PMS sync
    B-->>D: Brief ready on doctor dashboard
```

**Key design decisions**

- **No raw face images stored** — only L2-normalized numerical vectors, keeping the system privacy-safe and storage-light.
- **Everything the patient says happens before the consultation** — the doctor reads the brief, not the paperwork.
- **Modular NestJS modules** with `@Public()` decorators, Zod env validation, throttling, and full OpenTelemetry tracing out of the box.

---

## Testing

| Suite                                             | Runner                   | Count | Command                                      |
| :------------------------------------------------ | :----------------------- | :---: | :------------------------------------------- |
| Backend unit                                      | Jest                     |  162  | `pnpm --filter @jeevandata/backend test`     |
| Backend E2E (HTTP)                                | Jest + Supertest         |  129  | `pnpm --filter @jeevandata/backend test:e2e` |
| Frontend (components, hooks, stores, utils, i18n) | Vitest + Testing Library |  448  | `pnpm --filter @jeevandata/frontend test`    |

Coverage report: [COVERAGE_REPORT.md](./COVERAGE_REPORT.md)

```bash
pnpm --filter @jeevandata/backend test:cov   # backend unit coverage
pnpm --filter @jeevandata/frontend test:cov  # frontend coverage (Vitest)
```

> Note: backend E2E suites mock the service layer, so they exercise the full HTTP surface without contributing to coverage.

---

## Deployment

### Docker

```bash
docker compose up -d --build        # build + start the full stack
```

- `Dockerfile.backend` — multi-stage NestJS build (compile → slim runtime image).
- `Dockerfile.frontend` — multi-stage Next.js build (compile → standalone runtime).
- The infra stack (Postgres, Redis, Qdrant, MinIO, Whisper) runs via `docker-compose.yml`.

### Manual (VPS / PaaS)

1. Set all environment variables from [Configuration](#configuration).
2. Backend: `pnpm --filter @jeevandata/backend build && pnpm --filter @jeevandata/backend start:prod`
3. Frontend: `pnpm --filter @jeevandata/frontend build && pnpm --filter @jeevandata/frontend start`
4. Run `pnpm db:migrate` against the production database before the first deploy.

---

## Roadmap

- [x] Phase 1 — Foundation: auth, `@Public()` routes, env validation
- [x] Phase 2 — Backend E2E test suite (all controllers)
- [x] Phase 3 — Observability: audit logging, OpenTelemetry/Jaeger tracing, rate limiting, health checks
- [x] Phase 4 — Frontend test infrastructure (Vitest + Testing Library, 448 tests)
- [x] Phase 5 — UI/UX: dark mode, accessibility, design system
- [x] Phase 6 — PWA mobile camera support + multilingual intake
- [ ] Phase 7 — Production hardening: deployment pipeline, load testing, SLOs, audit dashboards

---

## Contributing

1. **Fork** the repo and create a branch: `git checkout -b feat/my-feature`.
2. **Commit with conventional messages** — `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`, `perf:`, `style:`.
3. **Pre-commit hooks** (Husky + lint-staged) run Prettier and ESLint with autofix on staged files — keep commits small and atomic.
4. **Push and open a pull request.** CI-equivalent gates: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` should all pass.

**Style notes**

- TypeScript strictly; NestJS DI imports must stay value imports (the backend eslint override disables `consistent-type-imports` to protect `emitDecoratorMetadata`).
- UI work uses Tailwind utilities and the existing Radix-based primitives — match the current patterns rather than adding new abstractions.

---

## FAQ / Troubleshooting

| Problem                                   | Fix                                                                                            |
| :---------------------------------------- | :--------------------------------------------------------------------------------------------- |
| Backend fails to start with Prisma errors | Run `pnpm db:generate` (the client is regenerated against the schema).                         |
| E2E tests hang or fail                    | Redis must be running (`docker compose up -d redis`) — BullMQ connects at boot.                |
| Camera doesn't open in the kiosk          | Use Chrome; the page requires HTTPS or `localhost` for `getUserMedia`.                         |
| Face match always fails                   | Check `FACE_MATCH_THRESHOLD` (default `0.82`) and that Qdrant is up (`docker compose ps`).     |
| Cross-origin errors                       | Set `CORS_ORIGINS` to include your frontend origin.                                            |
| "Repository not found" on clone           | The repo was renamed from `face-detection` to `jeevandata`; GitHub auto-redirects the old URL. |

---

## License

MIT — see [LICENSE](LICENSE) once added. Until then, this project is a private, active-development codebase; reach out before reusing it commercially.

---

## Acknowledgments

- **Google MediaPipe** — on-device face landmark models
- **Qdrant** — high-performance vector search engine
- **Google Gemini** — conversational intake agent & brief generation
- **OpenAI Whisper / whisper.cpp** — speech-to-text
- **NestJS, Next.js, Prisma, BullMQ** — the core framework ecosystem

---

## Contact

- Maintainer: Aditya Bhure — [aadityabhure03@gmail.com](mailto:aadityabhure03@gmail.com)
- Repository: [github.com/AadityaBhuree/jeevandata](https://github.com/AadityaBhuree/jeevandata)

<details>
<summary><b>Maintainer Notes: Keeping This README Current</b></summary>

- [ ] Update the **badges** (test counts, versions) whenever the stack or test totals change.
- [ ] Keep the **API Reference** tables in sync with any controller changes.
- [ ] Update the **Installation / Configuration** steps if scripts, ports, or env vars change.
- [ ] Add **screenshots / demo GIFs** once the UI is deployed.
- [ ] Tick off **Roadmap** items as phases complete; add new phases as planned.

> Reusable prompt: _"Review this README against the current codebase, update outdated sections, and flag anything missing."_

</details>
