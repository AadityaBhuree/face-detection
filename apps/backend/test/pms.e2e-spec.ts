import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe, Logger } from '@nestjs/common';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { PmsModule } from '../src/modules/pms/pms.module';
import { PmsService } from '../src/modules/pms/pms.service';

// ─── Mock Service ──────────────────────────────────────────────

const mockPmsService = {
  syncToPms: jest.fn(),
  loadPatientContext: jest.fn(),
};

// ─── Test Data ──────────────────────────────────────────────────

const validUuid = '550e8400-e29b-41d4-a716-446655440000';
const validPatientId = '660e8400-e29b-41d4-a716-446655440001';
const validIntakeRecordId = '770e8400-e29b-41d4-a716-446655440002';

const mockSyncResult = { synced: false, target: 'custom' as const };
const mockSyncFhirResult = { synced: false, target: 'hl7_fhir' as const };

const mockPatientContext = {
  patientId: validPatientId,
  demographics: {
    id: validPatientId,
    name: 'Priya Sharma',
    dob: '1990-01-15',
    mobile: '+919876543210',
  },
  visitHistory: [],
  chronicConditions: [],
  currentMedications: [],
  upcomingAppointment: null,
  riskFlags: [],
};

describe('PmsController (E2E)', () => {
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

  // ─── Helper: create Nest app ───────────────────────────────────
  //
  // PmsModule is self-contained (no external service deps).
  // Only ConfigModule needed for @Public() decorator.

  async function createApp(): Promise<INestApplication> {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        PmsModule,
      ],
    })
      .overrideProvider(PmsService)
      .useValue(mockPmsService)
      .compile();

    const app = moduleFixture.createNestApplication();

    app.useLogger(new Logger('E2E', { timestamp: false }));

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

  // ─── POST /sync/pms ───────────────────────────────────────────

  describe('POST /sync/pms', () => {
    const validPayload = {
      sessionId: validUuid,
      patientId: validPatientId,
      intakeRecordId: validIntakeRecordId,
    };

    it('should sync intake to PMS using custom adapter (default)', async () => {
      mockPmsService.syncToPms.mockResolvedValue(mockSyncResult);

      const res = await request(app.getHttpServer())
        .post('/sync/pms')
        .send(validPayload)
        .expect(200);

      expect(res.body).toHaveProperty('synced', false);
      expect(res.body).toHaveProperty('target', 'custom');
      expect(mockPmsService.syncToPms).toHaveBeenCalledTimes(1);
    });

    it('should sync intake to PMS using HL7 FHIR adapter', async () => {
      mockPmsService.syncToPms.mockResolvedValue(mockSyncFhirResult);

      const res = await request(app.getHttpServer())
        .post('/sync/pms')
        .send({ ...validPayload, targetSystem: 'hl7_fhir' })
        .expect(200);

      expect(res.body).toHaveProperty('target', 'hl7_fhir');
      expect(mockPmsService.syncToPms).toHaveBeenCalledWith(
        expect.objectContaining({ targetSystem: 'hl7_fhir' }),
      );
    });

    it('should default targetSystem to custom when not provided', async () => {
      mockPmsService.syncToPms.mockResolvedValue(mockSyncResult);

      await request(app.getHttpServer())
        .post('/sync/pms')
        .send(validPayload)
        .expect(200);

      expect(mockPmsService.syncToPms).toHaveBeenCalledWith(
        expect.objectContaining({ targetSystem: 'custom' }),
      );
    });

    it('should reject missing sessionId', async () => {
      const { sessionId: _, ...rest } = validPayload;
      await request(app.getHttpServer())
        .post('/sync/pms')
        .send(rest)
        .expect(400);
    });

    it('should reject missing patientId', async () => {
      const { patientId: _, ...rest } = validPayload;
      await request(app.getHttpServer())
        .post('/sync/pms')
        .send(rest)
        .expect(400);
    });

    it('should reject missing intakeRecordId', async () => {
      const { intakeRecordId: _, ...rest } = validPayload;
      await request(app.getHttpServer())
        .post('/sync/pms')
        .send(rest)
        .expect(400);
    });

    it('should reject invalid UUID for sessionId', async () => {
      await request(app.getHttpServer())
        .post('/sync/pms')
        .send({ ...validPayload, sessionId: 'not-a-uuid' })
        .expect(400);
    });

    it('should reject invalid UUID for patientId', async () => {
      await request(app.getHttpServer())
        .post('/sync/pms')
        .send({ ...validPayload, patientId: 'bad-uuid' })
        .expect(400);
    });

    it('should reject invalid targetSystem enum value', async () => {
      await request(app.getHttpServer())
        .post('/sync/pms')
        .send({ ...validPayload, targetSystem: 'invalid-system' })
        .expect(400);
    });

    it('should propagate service errors as 500', async () => {
      mockPmsService.syncToPms.mockRejectedValue(
        new Error('PMS connection failed'),
      );

      await request(app.getHttpServer())
        .post('/sync/pms')
        .send(validPayload)
        .expect(500);
    });
  });

  // ─── POST /sync/patient-context ───────────────────────────────

  describe('POST /sync/patient-context', () => {
    it('should load patient context successfully', async () => {
      mockPmsService.loadPatientContext.mockResolvedValue(mockPatientContext);

      const res = await request(app.getHttpServer())
        .post('/sync/patient-context')
        .send({ patientId: validPatientId })
        .expect(200);

      expect(res.body).toHaveProperty('patientId', validPatientId);
      expect(res.body).toHaveProperty('demographics');
      expect(res.body.demographics).toHaveProperty('name', 'Priya Sharma');
      expect(res.body).toHaveProperty('visitHistory');
      expect(res.body).toHaveProperty('riskFlags');
    });

    it('should return empty response when patient is not found', async () => {
      mockPmsService.loadPatientContext.mockResolvedValue(null);

      // NestJS serializes null to an empty JSON body ; the controller
      // returns null directly which becomes {} through the serialization pipeline.
      await request(app.getHttpServer())
        .post('/sync/patient-context')
        .send({ patientId: '00000000-0000-0000-0000-000000000000' })
        .expect(200);

      expect(mockPmsService.loadPatientContext).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000000',
      );
    });

    it('should propagate service errors as 500', async () => {
      mockPmsService.loadPatientContext.mockRejectedValue(
        new Error('Database unavailable'),
      );

      await request(app.getHttpServer())
        .post('/sync/patient-context')
        .send({ patientId: validPatientId })
        .expect(500);
    });
  });
});
