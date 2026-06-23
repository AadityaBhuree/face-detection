# 1____________________________
Frontend: React / Next.js
Backend: NestJS
Face Detection: MediaPipe
Face Recognition: InsightFace
Database: PostgreSQL
Vector Search: Qdrant
Storage: S3 / R2


# projectflow

┌─────────────────────────────┐
│ Patient Arrives at Clinic   │
└─────────────┬───────────────┘
              ↓
┌─────────────────────────────┐
│ Camera Detects Presence     │
│ & Activates Intake Session  │
└─────────────┬───────────────┘
              ↓
┌─────────────────────────────┐
│ Face Detection              │
│ (MediaPipe / RetinaFace)    │
└─────────────┬───────────────┘
              ↓
┌─────────────────────────────┐
│ Face Recognition            │
│ (InsightFace / FaceNet)     │
└─────────────┬───────────────┘
              ↓
      ┌───────┴────────┐
      │ Match Found ?  │
      └───────┬────────┘
              │
      ┌───────┴────────┐
      │      YES       │
      └───────┬────────┘
              ↓
┌─────────────────────────────┐
│ Retrieve Patient Profile    │
│ from PMS / EMR Database     │
└─────────────┬───────────────┘
              ↓
┌─────────────────────────────┐
│ Verify Identity             │
│ • Name Confirmation         │
│ • DOB / Mobile Verification │
│ • Consent Check             │
└─────────────┬───────────────┘
              ↓
┌─────────────────────────────┐
│ Load Patient Context        │
│ • Demographics              │
│ • Previous Visits           │
│ • Medical History           │
│ • Current Medications       │
│ • Upcoming Appointment      │
└─────────────┬───────────────┘
              ↓
┌─────────────────────────────┐
│ AI Welcome Assistant        │
│ "Hello John, welcome back"  │
└─────────────┬───────────────┘
              ↓
┌─────────────────────────────┐
│ AI Voice Intake Starts      │
│ • Symptoms                  │
│ • Duration                  │
│ • Severity                  │
│ • Follow-up Questions       │
└─────────────┬───────────────┘
              ↓
┌─────────────────────────────┐
│ Real-Time Transcription     │
│ & Structured Data Capture   │
└─────────────┬───────────────┘
              ↓
┌─────────────────────────────┐
│ Clinical AI Analysis        │
│ • Chief Complaint           │
│ • Medical Summary           │
│ • Risk Flags                │
│ • Suggested Follow-ups      │
└─────────────┬───────────────┘
              ↓
┌─────────────────────────────┐
│ Generate AI Intake Brief    │
└─────────────┬───────────────┘
              ↓
┌─────────────────────────────┐
│ Sync to PMS / EMR           │
│ Store Audio, Transcript,    │
│ Intake Summary & Metadata   │
└─────────────┬───────────────┘
              ↓
┌─────────────────────────────┐
│ Doctor Dashboard Updates    │
│ Ready Before Consultation   │
└─────────────┬───────────────┘
              ↓
┌─────────────────────────────┐
│ Doctor Opens Patient Visit  │
│ with AI-Generated Brief     │
└─────────────────────────────┘



# requirement

Frontend
├─ Next.js PWA
├─ MediaPipe (Browser)
├─ Local Cache
└─ Offline Support

AI Edge
├─ Face Detection
├─ Liveness Detection
└─ Embedding Generation

Backend
├─ NestJS
├─ PostgreSQL
├─ Redis Cache
└─ Qdrant

Storage
├─ Cloudflare R2
├─ WebP Images
├─ Opus Audio
└─ Auto Archival

AI Services
├─ Whisper / STT
├─ LLM Intake Agent
└─ AI Brief Generator