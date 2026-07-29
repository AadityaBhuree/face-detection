// ─── ioredis Mock ──────────────────────────────────────────────
// BullMQ uses ioredis internally for queue management. This mock
// prevents BullMQ from attempting a real Redis connection during
// E2E tests by providing all the methods BullMQ needs.
const mockIoRedis = {
  // Connection lifecycle
  on: jest.fn().mockReturnThis(),
  once: jest.fn().mockReturnThis(),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  quit: jest.fn().mockResolvedValue('OK'),
  duplicate: jest.fn().mockReturnThis(),
  isReady: true,
  status: 'ready',
  options: {},

  // Basic operations
  ping: jest.fn().mockResolvedValue('PONG'),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  setex: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  exists: jest.fn().mockResolvedValue(0),
  expire: jest.fn().mockResolvedValue(1),
  ttl: jest.fn().mockResolvedValue(-1),
  incr: jest.fn().mockResolvedValue(1),
  decr: jest.fn().mockResolvedValue(0),

  // Queue operations (BullMQ needs these)
  brpoplpush: jest.fn().mockResolvedValue(null),
  rpoplpush: jest.fn().mockResolvedValue(null),
  lpush: jest.fn().mockResolvedValue(1),
  rpush: jest.fn().mockResolvedValue(1),
  lpop: jest.fn().mockResolvedValue(null),
  rpop: jest.fn().mockResolvedValue(null),
  llen: jest.fn().mockResolvedValue(0),
  lrange: jest.fn().mockResolvedValue([]),
  lrem: jest.fn().mockResolvedValue(0),
  ltrim: jest.fn().mockResolvedValue('OK'),

  // Sorted sets (BullMQ rate limiting)
  zadd: jest.fn().mockResolvedValue(0),
  zrange: jest.fn().mockResolvedValue([]),
  zrem: jest.fn().mockResolvedValue(0),
  zrangebyscore: jest.fn().mockResolvedValue([]),
  zremrangebyscore: jest.fn().mockResolvedValue(0),
  zcard: jest.fn().mockResolvedValue(0),
  zcount: jest.fn().mockResolvedValue(0),

  // Hashes (BullMQ job metadata)
  hget: jest.fn().mockResolvedValue(null),
  hset: jest.fn().mockResolvedValue(1),
  hgetall: jest.fn().mockResolvedValue({}),
  hdel: jest.fn().mockResolvedValue(1),
  hlen: jest.fn().mockResolvedValue(0),
  hkeys: jest.fn().mockResolvedValue([]),
  hvals: jest.fn().mockResolvedValue([]),
  hexists: jest.fn().mockResolvedValue(0),

  // Sets
  sadd: jest.fn().mockResolvedValue(1),
  srem: jest.fn().mockResolvedValue(1),
  smembers: jest.fn().mockResolvedValue([]),
  sismember: jest.fn().mockResolvedValue(0),
  scard: jest.fn().mockResolvedValue(0),

  // Scripting
  eval: jest.fn().mockResolvedValue(undefined),
  evalsha: jest.fn().mockResolvedValue(undefined),
  script: jest.fn().mockResolvedValue(undefined),

  // Utility
  keys: jest.fn().mockResolvedValue([]),
  multi: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue([]),
  batch: jest.fn().mockReturnThis(),
  call: jest.fn().mockResolvedValue(undefined),
  sendCommand: jest.fn().mockResolvedValue(undefined),
  waitUntilReady: jest.fn().mockResolvedValue(undefined),
};
jest.mock('ioredis', () => ({
  Redis: jest.fn(() => mockIoRedis),
  default: jest.fn(() => mockIoRedis),
}));

import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { IntakeModule } from '../src/modules/intake/intake.module';
import { IntakeService } from '../src/modules/intake/intake.service';
import { SessionService } from '../src/modules/session/session.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { SessionGateway } from '../src/modules/session/session.gateway';
import { SessionTimeoutWorker } from '../src/modules/session/session-timeout.worker';
import { AiService } from '../src/modules/ai/ai.service';
import { IntakeAgentService } from '../src/modules/ai/intake-agent.service';
import { BriefGeneratorService } from '../src/modules/ai/brief-generator.service';
import { TranscriptionService } from '../src/modules/transcription/transcription.service';

// ─── Mock Service ──────────────────────────────────────────────

const mockIntakeService = {
  startSession: jest.fn(),
  getSession: jest.fn(),
  completeWithIntake: jest.fn(),
  getSessionStatus: jest.fn(),
};

// ─── Test Data ──────────────────────────────────────────────────

const validUuid = '550e8400-e29b-41d4-a716-446655440000';
const validPatientId = '660e8400-e29b-41d4-a716-446655440001';

const mockSessionResponse = {
  id: validUuid,
  patientId: null,
  status: 'INITIATED',
  deviceId: 'web-cam-1',
  metadata: {},
  startedAt: new Date('2025-01-15T10:30:00.000Z'),
  updatedAt: new Date('2025-01-15T10:30:00.000Z'),
};

const mockSessionWithPatient = {
  ...mockSessionResponse,
  patientId: validPatientId,
};

const mockFullSession = {
  ...mockSessionWithPatient,
  status: 'INTAKE_IN_PROGRESS',
  intakeRecords: [
    {
      id: 'record-1',
      sessionId: validUuid,
      patientId: validPatientId,
      brief: { summary: 'Patient presents with headache' },
      intakeData: { chiefComplaint: 'Headache' },
    },
  ],
  transcripts: [
    { id: 't1', speaker: 'patient', text: 'I have a headache', timestampMs: 0 },
    { id: 't2', speaker: 'ai', text: 'How long?', timestampMs: 1000 },
  ],
};

const mockStatusResponse = {
  id: validUuid,
  status: 'FACE_MATCHED',
  updatedAt: new Date('2025-01-15T10:30:00.000Z'),
};

const validIntakeData = {
  chiefComplaint: 'Headache and fever',
  symptoms: [{ name: 'Headache', duration: '3 days', severity: 6 }],
  associated: ['Fatigue', 'Nausea'],
  medicationChanges: 'None',
  allergyUpdates: 'No known allergies',
  patientNotes: '',
};

describe('IntakeController (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    jest.clearAllMocks();
    app = await createApp();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Helper: create Nest app with necessary global modules ─────
  //
  // IntakeModule imports SessionModule and AiModule, which have providers
  // that connect to external services (Redis, BullMQ, PostgreSQL). We
  // override ALL non-controller providers to prevent those connections.

  async function createApp(): Promise<INestApplication> {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        BullModule.forRoot({
          connection: {
            host: '127.0.0.1',
            port: 6379,
            retryStrategy: () => null as any,
            maxRetriesPerRequest: null,
          },
        }),
        IntakeModule,
      ],
    })
      .overrideProvider(IntakeService)
      .useValue(mockIntakeService)
      .overrideProvider(PrismaService)
      .useValue({} as any)
      .overrideProvider(SessionService)
      .useValue({} as any)
      .overrideProvider(SessionGateway)
      .useValue({} as any)
      .overrideProvider(SessionTimeoutWorker)
      .useValue({} as any)
      .overrideProvider(AiService)
      .useValue({} as any)
      .overrideProvider(IntakeAgentService)
      .useValue({} as any)
      .overrideProvider(BriefGeneratorService)
      .useValue({} as any)
      .overrideProvider(TranscriptionService)
      .useValue({} as any)
      .compile();

    const app = moduleFixture.createNestApplication();

    // Suppress NestJS error logs during tests
    app.useLogger(new Logger('', { timestamp: false }));

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    await app.init();
    return app;
  }

  // ─── POST /intake/session ─────────────────────────────────────

  describe('POST /intake/session', () => {
    it('should create a new intake session successfully', async () => {
      mockIntakeService.startSession.mockResolvedValue(mockSessionResponse);

      const res = await request(app.getHttpServer())
        .post('/intake/session')
        .send({ deviceId: 'web-cam-1' })
        .expect(201);

      expect(res.body).toHaveProperty('id', validUuid);
      expect(res.body).toHaveProperty('status', 'INITIATED');
      expect(res.body).toHaveProperty('deviceId', 'web-cam-1');
      expect(mockIntakeService.startSession).toHaveBeenCalledTimes(1);
    });

    it('should create a session with optional patientId', async () => {
      mockIntakeService.startSession.mockResolvedValue(mockSessionWithPatient);

      const res = await request(app.getHttpServer())
        .post('/intake/session')
        .send({ deviceId: 'kiosk-01', patientId: validPatientId })
        .expect(201);

      expect(res.body).toHaveProperty('patientId', validPatientId);
    });

    it('should create a session with optional metadata', async () => {
      mockIntakeService.startSession.mockResolvedValue({
        ...mockSessionResponse,
        metadata: { deviceType: 'kiosk', language: 'en' },
      });

      const res = await request(app.getHttpServer())
        .post('/intake/session')
        .send({
          deviceId: 'kiosk-01',
          metadata: { deviceType: 'kiosk', language: 'en' },
        })
        .expect(201);

      expect(res.body.metadata).toHaveProperty('deviceType', 'kiosk');
    });

    it('should reject missing deviceId', async () => {
      await request(app.getHttpServer())
        .post('/intake/session')
        .send({})
        .expect(400);
    });

    it('should reject empty deviceId string', async () => {
      await request(app.getHttpServer())
        .post('/intake/session')
        .send({ deviceId: '' })
        .expect(400);
    });

    it('should reject invalid UUID for patientId', async () => {
      await request(app.getHttpServer())
        .post('/intake/session')
        .send({ deviceId: 'cam-1', patientId: 'not-a-uuid' })
        .expect(400);
    });

    it('should propagate service errors as 500', async () => {
      mockIntakeService.startSession.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await request(app.getHttpServer())
        .post('/intake/session')
        .send({ deviceId: 'cam-1' })
        .expect(500);
    });
  });

  // ─── GET /intake/session/:id ──────────────────────────────────

  describe('GET /intake/session/:id', () => {
    it('should return session with related records', async () => {
      mockIntakeService.getSession.mockResolvedValue(mockFullSession);

      const res = await request(app.getHttpServer())
        .get(`/intake/session/${validUuid}`)
        .expect(200);

      expect(res.body).toHaveProperty('id', validUuid);
      expect(res.body).toHaveProperty('status', 'INTAKE_IN_PROGRESS');
      expect(res.body).toHaveProperty('intakeRecords');
      expect(Array.isArray(res.body.intakeRecords)).toBe(true);
      expect(res.body).toHaveProperty('transcripts');
      expect(res.body.transcripts).toHaveLength(2);
    });

    it('should return 404 when session does not exist', async () => {
      mockIntakeService.getSession.mockRejectedValue(
        new NotFoundException('Session nonexistent-id not found'),
      );

      await request(app.getHttpServer())
        .get('/intake/session/nonexistent-id')
        .expect(404);
    });

    it('should propagate service errors as 500', async () => {
      mockIntakeService.getSession.mockRejectedValue(
        new Error('Query timeout'),
      );

      await request(app.getHttpServer())
        .get(`/intake/session/${validUuid}`)
        .expect(500);
    });
  });

  // ─── POST /intake/session/:id/complete ────────────────────────

  describe('POST /intake/session/:id/complete', () => {
    const completeResponse = {
      session: { ...mockSessionWithPatient, status: 'BRIEF_GENERATED' },
      intakeRecord: {
        id: 'record-1',
        sessionId: validUuid,
        patientId: validPatientId,
      },
      brief: {
        summary: 'Patient presents with headache and fever for 3 days.',
        chiefComplaint: 'Headache and fever',
        riskFlags: [],
        vitalsToCheck: ['Blood Pressure', 'Heart Rate', 'Temperature'],
        suggestedFollowups: ['Any visual disturbances?'],
        medicationsNote: 'None',
        icd10Hints: ['R51', 'R50.9'],
      },
    };

    it('should complete the intake flow successfully', async () => {
      mockIntakeService.completeWithIntake.mockResolvedValue(completeResponse);

      const res = await request(app.getHttpServer())
        .post(`/intake/session/${validUuid}/complete`)
        .send(validIntakeData)
        .expect(200);

      expect(res.body).toHaveProperty('session');
      expect(res.body).toHaveProperty('intakeRecord');
      expect(res.body).toHaveProperty('brief');
      expect(res.body.session).toHaveProperty('status', 'BRIEF_GENERATED');
      expect(res.body.brief).toHaveProperty('summary');
      expect(res.body.brief).toHaveProperty('chiefComplaint', 'Headache and fever');
    });

    it('should reject missing chiefComplaint', async () => {
      await request(app.getHttpServer())
        .post(`/intake/session/${validUuid}/complete`)
        .send({
          symptoms: [],
          associated: [],
          medicationChanges: '',
          allergyUpdates: '',
          patientNotes: '',
        })
        .expect(400);
    });

    it('should reject empty chiefComplaint', async () => {
      await request(app.getHttpServer())
        .post(`/intake/session/${validUuid}/complete`)
        .send({
          chiefComplaint: '',
          symptoms: [],
          associated: [],
          medicationChanges: '',
          allergyUpdates: '',
          patientNotes: '',
        })
        .expect(400);
    });

    it('should reject excessive symptoms (>50)', async () => {
      const tooManySymptoms = Array.from({ length: 51 }, (_, i) => ({
        name: `Symptom ${i}`,
        duration: '1 day',
        severity: 3,
      }));

      await request(app.getHttpServer())
        .post(`/intake/session/${validUuid}/complete`)
        .send({
          chiefComplaint: 'Many symptoms',
          symptoms: tooManySymptoms,
          associated: [],
          medicationChanges: '',
          allergyUpdates: '',
          patientNotes: '',
        })
        .expect(400);
    });

    it('should return 404 when session does not exist', async () => {
      mockIntakeService.completeWithIntake.mockRejectedValue(
        new NotFoundException('Session nonexistent-id not found'),
      );

      await request(app.getHttpServer())
        .post('/intake/session/nonexistent-id/complete')
        .send(validIntakeData)
        .expect(404);
    });

    it('should return 400 when session is already completed', async () => {
      mockIntakeService.completeWithIntake.mockRejectedValue(
        new BadRequestException('Session is already completed'),
      );

      await request(app.getHttpServer())
        .post(`/intake/session/${validUuid}/complete`)
        .send(validIntakeData)
        .expect(400);
    });

    it('should propagate service errors as 500', async () => {
      mockIntakeService.completeWithIntake.mockRejectedValue(
        new Error('Brief generation failed'),
      );

      await request(app.getHttpServer())
        .post(`/intake/session/${validUuid}/complete`)
        .send(validIntakeData)
        .expect(500);
    });
  });

  // ─── GET /intake/session/:id/status ───────────────────────────

  describe('GET /intake/session/:id/status', () => {
    it('should return session status', async () => {
      mockIntakeService.getSessionStatus.mockResolvedValue(mockStatusResponse);

      const res = await request(app.getHttpServer())
        .get(`/intake/session/${validUuid}/status`)
        .expect(200);

      expect(res.body).toHaveProperty('id', validUuid);
      expect(res.body).toHaveProperty('status', 'FACE_MATCHED');
      expect(res.body).toHaveProperty('updatedAt');
    });

    it('should return 404 when session does not exist', async () => {
      mockIntakeService.getSessionStatus.mockRejectedValue(
        new NotFoundException('Session nonexistent-id not found'),
      );

      await request(app.getHttpServer())
        .get('/intake/session/nonexistent-id/status')
        .expect(404);
    });

    it('should propagate service errors as 500', async () => {
      mockIntakeService.getSessionStatus.mockRejectedValue(
        new Error('Cache unavailable'),
      );

      await request(app.getHttpServer())
        .get(`/intake/session/${validUuid}/status`)
        .expect(500);
    });
  });
});
