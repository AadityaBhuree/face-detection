<p align="center">
  <br/>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="">
    <img alt="AyuTalk Care" src="" width="160">
  </picture>
  <h3 align="center">AyuTalk Care</h3>
  <p align="center">AI-powered contactless patient intake and face-recognition platform for clinics and hospitals.</p>
</p>

<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/status-alpha-blue" alt="Status"></a>
  <a href="#"><img src="https://img.shields.io/badge/version-0.1.0-blueviolet" alt="Version"></a>
  <a href="#"><img src="https://img.shields.io/badge/license-MIT-green" alt="License"></a>
  <a href="#"><img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="#"><img src="https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white" alt="Next.js"></a>
  <a href="#"><img src="https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs&logoColor=white" alt="NestJS"></a>
  <a href="#"><img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL"></a>
  <a href="#"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs Welcome"></a>
</p>

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Demo](#demo)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
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

**AyuTalk Care** is an enterprise-grade, privacy-first, AI-driven contactless patient intake and face-recognition platform designed for clinics and hospitals.

When a patient arrives at a clinic, the system automatically detects their face via an on-device camera (MediaPipe 478-point 3D landmarks), verifies liveness through blink detection, matches their face against stored vector embeddings in **Qdrant**, retrieves their medical record, and initiates an **AI voice intake assistant** powered by **Google Gemini 2.0 Flash**.

The AI assistant conducts an empathetic, turn-by-turn voice conversation to gather symptoms, severity, duration, medication changes, and allergy updates — transcribing speech in real-time via **Whisper STT** — and generates a structured **Clinical Brief** for the doctor before the patient enters the consultation room.

Unlike traditional check-in kiosks, AyuTalk Care never stores raw face images — only normalized 512-dimensional numerical vectors — ensuring patient privacy compliance.

---

## Key Features

- **Contactless Patient Recognition** — Real-time face detection using MediaPipe 478 3D landmarks on-device (WASM/WebGL), with liveness verification via Eye Aspect Ratio (EAR) blink detection
- **Vector-Based Identity Matching** — 512-dimension L2-normalized embeddings searched against Qdrant with cosine similarity (threshold ≥ 0.82)
- **AI Voice Intake Assistant** — Turn-by-turn conversational symptom gathering via Google Gemini 2.0 Flash with real-time Whisper STT transcription
- **Clinical Brief Generator** — Structured JSON output with chief complaint, risk flags, suggested vitals, ICD-10 hints, and medication notes
- **Emergency Screening** — Automatic detection and escalation of critical symptoms (chest pain, severe dyspnea, acute bleeding)
- **Real-Time WebSocket Gateway** — Socket.IO-based session management with live audio streaming and brief delivery
- **Offline-First Resilience** — Local PMS patient cache ensures zero downtime during internet outages
- **Privacy-Compliant Design** — No raw face images stored; Aadhaar numbers stored as SHA-256 hashes; mandatory patient consent for vector registration
- **Audit Logging** — Immutable audit trail for every face search, patient lookup, and EMR export
- **Progressive Web App** — Installable, offline-capable frontend built with Next.js 14 PWA

---

## Demo

> _Screenshots and demo GIFs coming soon._

| Page              | Preview                     |
| :---------------- | :-------------------------- |
| Landing           | ![Screenshot placeholder]() |
| Face Detection    | ![Screenshot placeholder]() |
| AI Intake Session | ![Screenshot placeholder]() |
| Doctor Dashboard  | ![Screenshot placeholder]() |

---

## Tech Stack

| Layer                | Technology                             | Purpose                                        |
| :------------------- | :------------------------------------- | :--------------------------------------------- |
| **Frontend**         | Next.js 14 (App Router, PWA)           | Client UI, camera interface, patient portal    |
| **On-Device Vision** | `@mediapipe/tasks-vision`              | Browser-side 478 3D face landmark detection    |
| **Styling**          | Tailwind CSS + Radix UI + Lucide Icons | Design system & component library              |
| **State**            | Zustand + TanStack Query               | Client & server state management               |
| **Backend**          | NestJS (TypeScript)                    | Modular REST & WebSocket API gateway           |
| **Database**         | PostgreSQL 16 + Prisma ORM             | Relational persistence                         |
| **Vector DB**        | Qdrant v1.13.0                         | 512-dimension vector similarity search         |
| **Cache & Queue**    | Redis 7 + BullMQ                       | Session caching, pub/sub, background jobs      |
| **AI LLM**           | Google Gemini 2.0 Flash                | Voice intake agent & clinical brief generation |
| **Speech-to-Text**   | Whisper.cpp HTTP Server                | Real-time voice transcription                  |
| **Object Storage**   | MinIO / Cloudflare R2                  | S3-compatible media storage                    |
| **Auth**             | Passport.js + JWT (bearer tokens)      | API authentication                             |
| **Monorepo**         | Turborepo + pnpm Workspaces            | Fast cached builds & task orchestration        |
| **Containerization** | Docker + Docker Compose                | Microservice orchestration                     |

---

## Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0
- **Docker** & **Docker Compose** (for local infrastructure)
- **Google Gemini API key** (for AI intake & brief generation)
- **Modern browser** with WebGL support (Chrome, Edge, or Firefox)

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/your-org/face-detection.git
cd face-detection
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment

```bash
cp .env.example apps/backend/.env
# Edit apps/backend/.env with your API keys and secrets
```

### 4. Start infrastructure services

```bash
docker compose up -d
```

This starts PostgreSQL, Redis, Qdrant, MinIO, and Whisper STT server.

### 5. Apply database schema

```bash
pnpm db:push
```

### 6. (Optional) Seed sample data

```bash
pnpm db:seed
```

### 7. Start development servers

```bash
pnpm dev
```

This starts:

- **Frontend** → [http://localhost:3000](http://localhost:3000)
- **Backend** → [http://localhost:4000](http://localhost:4000)

---

### Quick Start with Docker (full stack)

```bash
# Build and start all services
docker compose -f docker-compose.yml -f Dockerfile.backend -f Dockerfile.frontend up --build
```

---

## Configuration

### Environment Variables

| Variable                        | Description                  | Required | Default                 |
| :------------------------------ | :--------------------------- | :------- | :---------------------- |
| `NODE_ENV`                      | Application environment      | No       | `development`           |
| `APP_PORT`                      | Backend server port          | No       | `4000`                  |
| `FRONTEND_URL`                  | Frontend URL for CORS        | No       | `http://localhost:3000` |
| `DATABASE_URL`                  | PostgreSQL connection string | **Yes**  | —                       |
| `REDIS_URL`                     | Redis connection string      | **Yes**  | —                       |
| `QDRANT_URL`                    | Qdrant REST endpoint         | **Yes**  | `http://localhost:6333` |
| `GOOGLE_GEMINI_API_KEY`         | Gemini 2.0 Flash API key     | **Yes**  | —                       |
| `JWT_SECRET`                    | Token signing secret         | **Yes**  | —                       |
| `JWT_EXPIRATION`                | Token expiry duration        | No       | `24h`                   |
| `FACE_MATCH_THRESHOLD`          | Cosine similarity threshold  | No       | `0.82`                  |
| `FACE_EMBEDDING_DIM`            | Vector dimension             | No       | `512`                   |
| `SESSION_INACTIVITY_TIMEOUT_MS` | Inactivity timeout           | No       | `600000`                |
| `LOG_LEVEL`                     | Logging verbosity            | No       | `debug`                 |

<details>
<summary><b>View full <code>.env.example</code></b></summary>

```env
# ─────────────────────────────────────────────
# AyuTalk Care — Environment Configuration
# ─────────────────────────────────────────────

# Application
NODE_ENV=development
APP_NAME=AyuTalkCare
APP_PORT=4000
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:4000

# Database (PostgreSQL)
DATABASE_URL=postgresql://ayutalk:ayutalk_secret@localhost:5432/ayutalk_care?schema=public

# Redis
REDIS_URL=redis://default:redis_secret@localhost:6379

# Qdrant (Vector search)
QDRANT_URL=http://localhost:6333

# Google Gemini (AI LLM)
GOOGLE_GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-2.0-flash

# JWT
JWT_SECRET=change-this-to-a-strong-random-secret
JWT_EXPIRATION=24h

# Face Recognition
FACE_MATCH_THRESHOLD=0.82
FACE_EMBEDDING_DIM=512

# Session
SESSION_INACTIVITY_TIMEOUT_MS=600000
SESSION_AUTO_CLOSE_MS=600000

# Logging
LOG_LEVEL=debug
LOG_FORMAT=json
```

</details>

---

## Usage

### Patient Check-In Flow

1. Open the frontend at `http://localhost:3000`
2. The camera activates and automatically detects faces
3. The system performs liveness blink verification
4. If recognized: greeting with patient name + proceed to intake
5. If new: prompted to register (name, DOB, mobile)
6. AI voice intake begins — speak your symptoms
7. The system generates a clinical brief for the doctor
8. Doctor views the brief on the dashboard

### Commands

```bash
# Development
pnpm dev              # Start all apps in parallel
pnpm --filter @ayutalk/backend dev  # Backend only
pnpm --filter @ayutalk/frontend dev # Frontend only

# Database
pnpm db:migrate       # Run Prisma migrations
pnpm db:studio        # Open Prisma Studio GUI
pnpm db:seed          # Seed sample data

# Lint & Format
pnpm lint             # Run ESLint across all packages
pnpm lint:fix         # Auto-fix lint issues
pnpm format           # Format with Prettier
pnpm typecheck        # TypeScript type checking

# Build
pnpm build            # Production build for all apps
```

---

## Architecture

### End-to-End Clinical Flow

```mermaid
sequenceDiagram
    autonumber
    actor P as Patient
    participant C as Camera / Next.js PWA
    participant MP as MediaPipe (Browser)
    participant Q as Qdrant Vector DB
    participant B as NestJS Backend
    participant AI as Gemini 2.0 Flash LLM
    actor D as Doctor

    P->>C: Patient arrives at clinic camera kiosk
    C->>MP: Process video feed frame-by-frame
    MP-->>C: Detect face & extract 478 3D landmarks
    C->>C: Execute EAR Blink Liveness Verification
    C->>B: Send 512-dim L2-normalized vector embedding
    B->>Q: Cosine distance search (Threshold ≥ 0.82)
    alt Match Found
        Q-->>B: Return Patient ID + Similarity Score
        B->>B: Load Patient Context from PostgreSQL
        C->>P: "Hello [Name], welcome back!"
    else No Match Found
        C->>P: Prompt to Register New Patient
        B->>Q: Store new 512-dim embedding in Qdrant
    end
    C->>B: Initialize Intake Session (Socket.IO)
    loop AI Voice Intake
        P->>C: Speaks symptoms into microphone
        C->>B: Stream Opus Audio Chunk
        B->>B: Whisper STT converts speech to text
        B->>AI: Send conversation history + current text
        AI-->>B: Generate empathetic response & follow-up
        B-->>C: Play audio response / display text
    end
    B->>AI: Generate Clinical Brief (JSON)
    AI-->>B: Return structured clinical summary
    B->>B: Save IntakeRecord & Sync to EMR
    B-->>D: Display ready Clinical Brief on Dashboard
```

### System Architecture

```
┌──────────────────────────────────────────────────┐
│               Next.js 14 Frontend PWA            │
│  ┌─────────────┐ ┌──────────┐ ┌───────────────┐  │
│  │ MediaPipe    │ │ Camera   │ │ Socket.IO     │  │
│  │ Face Landmark│ │ Stream   │ │ Client        │  │
│  │ Detection    │ │ (WebRTC) │ │               │  │
│  └─────────────┘ └──────────┘ └───────────────┘  │
└──────────────────────┬───────────────────────────┘
                       │ HTTP / WebSocket
┌──────────────────────▼───────────────────────────┐
│              NestJS Backend Gateway               │
│  ┌──────────┐ ┌────────┐ ┌────────┐ ┌─────────┐  │
│  │ Face     │ │ AI     │ │ Intake │ │ Session │  │
│  │ Module   │ │ Module │ │ Module │ │ Gateway │  │
│  └────┬─────┘ └───┬────┘ └───┬────┘ └────┬────┘  │
└───────┼────────────┼──────────┼───────────┼───────┘
        │            │          │           │
   ┌────▼───┐  ┌─────▼────┐ ┌──▼────┐ ┌───▼──────┐
   │ Qdrant │  │ Gemini   │ │PostgreSQL│ │  Redis   │
   │Vector DB│  │ 2.0 Flash│ │(Prisma)│ │ + BullMQ │
   └────────┘  │+ Whisper │ └────────┘ └──────────┘
               └──────────┘
```

### Key Design Decisions

- **On-Device Face Detection**: MediaPipe runs in the browser via WASM/WebGL, avoiding server-side video processing costs and reducing latency
- **No Raw Face Storage**: Only 512-dimensional L2-normalized vectors are stored — original face images are never retained
- **Vector Search over SQL**: Cosine similarity on embeddings enables fast, privacy-preserving identity matching without storing identifiable biometric data
- **Event-Driven Intake**: Socket.IO + BullMQ enables real-time audio streaming and background clinical brief generation
- **Workspace Monorepo**: Turborepo + pnpm ensures fast parallel builds and shared TypeScript types/schemas across packages

---

## Project Structure

```
face-detection/
├── apps/
│   ├── backend/                  # NestJS API Gateway
│   │   ├── prisma/               # Schema, migrations, seeds
│   │   └── src/
│   │       ├── common/           # Guards, decorators, pipes, filters
│   │       ├── config/           # Environment configuration
│   │       ├── modules/
│   │       │   ├── ai/           # Gemini LLM intake & brief services
│   │       │   ├── audit/        # Compliance audit logging
│   │       │   ├── dashboard/    # Doctor & clinic metrics
│   │       │   ├── face/         # Qdrant vector search & registration
│   │       │   ├── intake/       # Session record management
│   │       │   ├── pms/          # EMR/PMS synchronization
│   │       │   ├── session/      # Socket.IO real-time gateway
│   │       │   └── transcription/ # Audio buffer & Whisper STT client
│   │       └── auth/             # Auth module (JWT + Passport)
│   └── frontend/                 # Next.js 14 PWA
│       ├── public/               # Icons, PWA manifest, WASM models
│       └── src/
│           ├── app/              # App router pages
│           ├── components/       # UI components (Radix, custom)
│           ├── hooks/            # useFaceDetection, useLiveness, etc.
│           ├── lib/              # Vector math & EAR algorithms
│           └── services/         # API clients & WebSocket managers
├── packages/
│   ├── shared-schemas/           # Zod validation schemas
│   ├── shared-types/             # TypeScript interfaces & DTOs
│   └── shared-utils/             # Retry helpers, formatters, crypto
├── docker-compose.yml            # Infrastructure container orchestration
├── turbo.json                    # Turborepo task pipeline
├── pnpm-workspace.yaml           # Workspace configuration
└── tsconfig.base.json            # Shared TypeScript config
```

---

## API Reference

### Face Recognition (`/api/v1/face`)

All endpoints are currently public (`@Public()` decorator) during alpha.

| Method | Endpoint                      | Description                            | Request Body                                             |
| :----- | :---------------------------- | :------------------------------------- | :------------------------------------------------------- |
| `POST` | `/face/search`                | Raw vector similarity search           | `{ vector: number[], threshold: number, limit: number }` |
| `POST` | `/face/search-with-details`   | Search Qdrant & return patient details | `{ vector: number[], threshold: 0.82, limit: 5 }`        |
| `POST` | `/face/register-patient`      | Register patient & store embedding     | `{ name, dob, mobile, consent, embedding }`              |
| `POST` | `/face/embedding`             | Upsert vector into Qdrant              | `{ patientId: string, vector: number[] }`                |
| `GET`  | `/face/:patientId/embeddings` | Embedding history for patient          | —                                                        |

### AI Intake (`/api/v1/ai`)

| Method | Endpoint             | Description                        | Request Body                                            |
| :----- | :------------------- | :--------------------------------- | :------------------------------------------------------ |
| `POST` | `/ai/intake-turn`    | Single LLM intake turn             | `{ sessionId, currentInput, conversationHistory }`      |
| `POST` | `/ai/generate-brief` | Generate structured clinical brief | `{ sessionId, patientHistory, intakeData, transcript }` |

### Intake (`/api/v1/intake`)

| Method | Endpoint              | Description                 |
| :----- | :-------------------- | :-------------------------- |
| `POST` | `/intake/session`     | Create new intake session   |
| `GET`  | `/intake/session/:id` | Get session details & brief |

### Dashboard (`/api/v1/dashboard`)

| Method | Endpoint                     | Description                   |
| :----- | :--------------------------- | :---------------------------- |
| `GET`  | `/dashboard/recent-briefs`   | Recent clinical briefs        |
| `GET`  | `/dashboard/intake-sessions` | Active/recent intake sessions |

### WebSocket Events (Socket.IO)

| Event               | Direction       | Description                        |
| :------------------ | :-------------- | :--------------------------------- |
| `session:join`      | Client → Server | Join an intake session room        |
| `session:leave`     | Client → Server | Leave a session room               |
| `audio:stream`      | Client → Server | Stream Opus audio chunks           |
| `brief:ready`       | Server → Client | Clinical brief generation complete |
| `intake:transcript` | Server → Client | Real-time transcription update     |

---

## Testing

```bash
# Run all tests
pnpm test

# Backend tests only
pnpm --filter @ayutalk/backend test

# With coverage
pnpm --filter @ayutalk/backend test:cov

# E2E tests
pnpm test:e2e
```

Test framework: **Jest** with `ts-jest` for TypeScript compilation.

---

## Deployment

### Docker Deployment

```bash
# Build production images
docker build -f Dockerfile.backend -t ayutalk-backend .
docker build -f Dockerfile.frontend -t ayutalk-frontend .

# Run with infrastructure
docker compose up -d postgres redis qdrant minio whisper
docker run -d --name ayutalk-backend --network host ayutalk-backend
docker run -d --name ayutalk-frontend --network host ayutalk-frontend
```

### Production Checklist

- [ ] Set strong `JWT_SECRET` and rotate regularly
- [ ] Configure `CORS_ORIGINS` to restrict to clinic domain
- [ ] Enable Qdrant API key authentication
- [ ] Set `NODE_ENV=production` and `LOG_LEVEL=info`
- [ ] Configure proper S3-compatible storage (Cloudflare R2 recommended)
- [ ] Set up SSL/TLS termination (reverse proxy with nginx/Caddy)
- [ ] Enable database connection pooling (PgBouncer recommended)
- [ ] Configure automated database backups
- [ ] Set up monitoring (Prometheus + Grafana recommended)
- [ ] Configure rate limiting for production traffic

---

## Roadmap

- [x] Core face detection & liveness verification
- [x] Qdrant vector search integration
- [x] Gemini 2.0 Flash AI intake agent
- [x] Clinical brief generation pipeline
- [x] Real-time WebSocket session management
- [x] Doctor dashboard with recent briefs
- [x] JWT authentication infrastructure
- [x] Rate limiting on face search endpoints
- [ ] Patient registration UI & flow
- [ ] EMR/PMS synchronization adapters
- [ ] Mobile camera support (iOS/Android)
- [ ] Multi-language intake support
- [ ] Dark mode UI
- [ ] Clinic admin dashboard with analytics
- [ ] HIPAA compliance audit module
- [ ] Offline mode with IndexedDB sync
- [ ] Performance monitoring & alerting

---

## Contributing

We welcome contributions! Follow these steps:

1. **Fork** the repository
2. **Create a branch**: `git checkout -b feat/your-feature-name`
3. **Make changes** following existing code conventions
4. **Run lint & typecheck**: `pnpm lint && pnpm typecheck`
5. **Write/update tests**: `pnpm test`
6. **Commit** with [conventional commits](https://www.conventionalcommits.org/):
   - `feat:` new feature
   - `fix:` bug fix
   - `style:` UI/style changes
   - `refactor:` code restructuring
   - `docs:` documentation
   - `test:` test changes
   - `chore:` tooling/config
7. **Push** and open a Pull Request

### Code Style

- TypeScript strict mode throughout
- ESLint + Prettier enforced via pre-commit hooks
- Conventional commit messages required
- Keep commits atomic and focused

---

## FAQ / Troubleshooting

### "Definition for rule 'react-hooks/exhaustive-deps' was not found"

Install the plugin in the root workspace:

```bash
pnpm add -D eslint-plugin-react-hooks --workspace-root
```

### Face detection not working

- Ensure camera permissions are granted in the browser
- Check that `face_landmarker.task` WASM model is in `public/`
- Verify WebGL is enabled in your browser (Chrome typically works best)

### Docker containers fail to start

- Ensure ports `5432`, `6379`, `6333`, `9000`, `9001` are free
- Run `docker compose down -v` to reset volumes, then `docker compose up -d`

### Qdrant returns no matches on known faces

- Lower `FACE_MATCH_THRESHOLD` temporarily (try `0.75`) to test
- Ensure the face is well-lit and facing the camera directly
- Re-register the embedding from a better-lit capture

---

## License

This project is licensed under the **MIT License**. See the [LICENSE](./LICENSE) file for details.

---

## Acknowledgments

- [Google MediaPipe](https://mediapipe.dev) for on-device face landmark detection
- [Qdrant](https://qdrant.tech) for high-performance vector search
- [Google Gemini](https://deepmind.google/technologies/gemini/) for AI language capabilities
- [Whisper.cpp](https://github.com/ggerganov/whisper.cpp) for on-premise speech-to-text
- [NestJS](https://nestjs.com) for modular backend architecture
- [Next.js](https://nextjs.org) for the React PWA framework
- [Radix UI](https://radix-ui.com) for accessible UI primitives
- [Lucide](https://lucide.dev) for beautiful open-source icons

---

## Contact

- **Project Maintainer**: [Your Name](mailto:your-email@example.com)
- **GitHub Issues**: [github.com/your-org/face-detection/issues](https://github.com/your-org/face-detection/issues)
- **Discussions**: [github.com/your-org/face-detection/discussions](https://github.com/your-org/face-detection/discussions)

---

<details>
<summary><b>Maintainer Notes: Keeping This README Current</b></summary>

- [ ] **Badges**: Update status, version, and CI badges when deploying new releases
- [ ] **Screenshots**: Add/update demo screenshots and GIFs after UI changes
- [ ] **Install steps**: Verify commands work with the latest Node.js/pnpm versions
- [ ] **API reference**: Regenerate endpoint docs when adding/changing routes
- [ ] **Environment variables**: Update `.env.example` and the table when adding new config
- [ ] **Roadmap**: Mark completed items and add new planned features
- [ ] **Dependencies**: Update tech stack versions after major upgrades

**One-line prompt for AI-assisted review:**

> _Review this README against the current codebase, update outdated sections, and flag anything missing._

</details>
