/* eslint-disable @typescript-eslint/no-explicit-any -- test mocks */

import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { FaceModule } from '../src/modules/face/face.module';
import { FaceService } from '../src/modules/face/face.service';
import { FaceRegistrationService } from '../src/modules/face/face-registration.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/modules/audit/audit.service';

// ─── Qdrant Mock ────────────────────────────────────────────────
// Prevents FaceService constructor from attempting real Qdrant connection

const mockQdrantClient = {
  getCollections: jest.fn(),
  createCollection: jest.fn(),
  upsert: jest.fn(),
  search: jest.fn(),
  scroll: jest.fn(),
};

jest.mock('@qdrant/js-client-rest', () => ({
  QdrantClient: jest.fn(() => mockQdrantClient),
}));

// ─── Mock Services ──────────────────────────────────────────────

const mockFaceService = {
  upsertEmbedding: jest.fn(),
  searchByFace: jest.fn(),
  getPatientEmbeddings: jest.fn(),
};

const mockFaceRegistrationService = {
  registerPatient: jest.fn(),
  searchWithDetails: jest.fn(),
};

const mockAuditService = {
  log: jest.fn().mockResolvedValue(undefined),
};

// ─── Test Data ──────────────────────────────────────────────────

const validVector = new Array(512).fill(0.1);
const validUuid = '550e8400-e29b-41d4-a716-446655440000';
const validPatientId = '660e8400-e29b-41d4-a716-446655440001';

describe('FaceController (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    jest.clearAllMocks();

    // Provide mock Qdrant collection response so onModuleInit doesn't throw
    mockQdrantClient.getCollections.mockResolvedValue({
      collections: [{ name: 'face_embeddings' }],
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [FaceModule],
    })
      .overrideProvider(PrismaService)
      .useValue({} as any)
      .overrideProvider(FaceService)
      .useValue(mockFaceService)
      .overrideProvider(FaceRegistrationService)
      .useValue(mockFaceRegistrationService)
      .overrideProvider(AuditService)
      .useValue(mockAuditService)
      .compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── POST /face/embedding ──────────────────────────────────────

  describe('POST /face/embedding', () => {
    it('should upsert a face embedding successfully', async () => {
      mockFaceService.upsertEmbedding.mockResolvedValue(undefined);

      const res = await request(app.getHttpServer())
        .post('/face/embedding')
        .send({ patientId: validUuid, vector: validVector })
        .expect(201);

      expect(res.body).toBeDefined();
      expect(mockFaceService.upsertEmbedding).toHaveBeenCalledTimes(1);
    });

    it('should reject missing patientId', async () => {
      await request(app.getHttpServer())
        .post('/face/embedding')
        .send({ vector: validVector })
        .expect(400);
    });

    it('should reject missing vector', async () => {
      await request(app.getHttpServer())
        .post('/face/embedding')
        .send({ patientId: validUuid })
        .expect(400);
    });

    it('should reject vector with wrong length (not 512)', async () => {
      await request(app.getHttpServer())
        .post('/face/embedding')
        .send({ patientId: validUuid, vector: [0.1, 0.2, 0.3] })
        .expect(400);
    });

    it('should reject invalid UUID format', async () => {
      await request(app.getHttpServer())
        .post('/face/embedding')
        .send({ patientId: 'not-a-uuid', vector: validVector })
        .expect(400);
    });

    it('should propagate service errors as 500', async () => {
      mockFaceService.upsertEmbedding.mockRejectedValue(new Error('Service unavailable'));

      await request(app.getHttpServer())
        .post('/face/embedding')
        .send({ patientId: validUuid, vector: validVector })
        .expect(500);
    });

    it('should accept optional capturedAt field', async () => {
      mockFaceService.upsertEmbedding.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .post('/face/embedding')
        .send({
          patientId: validUuid,
          vector: validVector,
          capturedAt: '2025-01-15T10:30:00.000Z',
        })
        .expect(201);
    });

    it('should reject empty body', async () => {
      await request(app.getHttpServer()).post('/face/embedding').send({}).expect(400);
    });
  });

  // ─── POST /face/search ─────────────────────────────────────────

  describe('POST /face/search', () => {
    it('should return matches for a valid face search', async () => {
      mockFaceService.searchByFace.mockResolvedValue([
        { patientId: 'patient-a', score: 0.94, capturedAt: '2025-01-15T10:30:00Z' },
        { patientId: 'patient-b', score: 0.78, capturedAt: '2025-01-15T10:31:00Z' },
      ]);

      const res = await request(app.getHttpServer())
        .post('/face/search')
        .send({ vector: validVector })
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toHaveProperty('patientId', 'patient-a');
      expect(res.body[0]).toHaveProperty('score', 0.94);
    });

    it('should return empty array when no matches found', async () => {
      mockFaceService.searchByFace.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .post('/face/search')
        .send({ vector: validVector })
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('should register the search call with the service', async () => {
      mockFaceService.searchByFace.mockResolvedValue([]);

      await request(app.getHttpServer())
        .post('/face/search')
        .send({ vector: validVector, threshold: 0.9, limit: 3 })
        .expect(200);

      expect(mockFaceService.searchByFace).toHaveBeenCalledWith(
        expect.objectContaining({ threshold: 0.9, limit: 3 }),
      );
    });

    it('should reject missing vector', async () => {
      await request(app.getHttpServer()).post('/face/search').send({}).expect(400);
    });

    it('should reject vector with wrong length', async () => {
      await request(app.getHttpServer())
        .post('/face/search')
        .send({ vector: [0.1, 0.2] })
        .expect(400);
    });

    it('should reject threshold above 1.0', async () => {
      await request(app.getHttpServer())
        .post('/face/search')
        .send({ vector: validVector, threshold: 1.5 })
        .expect(400);
    });

    it('should reject limit above 10', async () => {
      await request(app.getHttpServer())
        .post('/face/search')
        .send({ vector: validVector, limit: 50 })
        .expect(400);
    });

    it('should handle service errors as 500', async () => {
      mockFaceService.searchByFace.mockRejectedValue(new Error('Search failed'));

      await request(app.getHttpServer())
        .post('/face/search')
        .send({ vector: validVector })
        .expect(500);
    });
  });

  // ─── POST /face/search-with-details ────────────────────────────

  describe('POST /face/search-with-details', () => {
    it('should return matches with patient details', async () => {
      mockFaceRegistrationService.searchWithDetails.mockResolvedValue({
        matches: [
          {
            patientId: validPatientId,
            score: 0.94,
            patientName: 'Test Patient',
            dob: '1990-01-01',
            mobile: '+919876543210',
          },
        ],
        total: 1,
      });

      const res = await request(app.getHttpServer())
        .post('/face/search-with-details')
        .send({ vector: validVector })
        .expect(200);

      expect(res.body.matches).toBeDefined();
      expect(res.body.total).toBe(1);
      expect(res.body.matches[0]).toHaveProperty('patientName', 'Test Patient');
    });

    it('should return empty matches when service finds nothing', async () => {
      mockFaceRegistrationService.searchWithDetails.mockResolvedValue({ matches: [], total: 0 });

      const res = await request(app.getHttpServer())
        .post('/face/search-with-details')
        .send({ vector: validVector })
        .expect(200);

      expect(res.body.matches).toEqual([]);
      expect(res.body.total).toBe(0);
    });

    it('should reject missing vector', async () => {
      await request(app.getHttpServer()).post('/face/search-with-details').send({}).expect(400);
    });
  });

  // ─── POST /face/register-patient ───────────────────────────────

  describe('POST /face/register-patient', () => {
    const validRegistration = {
      name: 'Priya Sharma',
      dob: '1990-01-15',
      mobile: '+919876543210',
      consent: true,
      embedding: validVector,
    };

    it('should register a new patient successfully', async () => {
      mockFaceRegistrationService.registerPatient.mockResolvedValue({
        id: validPatientId,
        name: 'Priya Sharma',
        message: 'Patient registered successfully',
      });

      const res = await request(app.getHttpServer())
        .post('/face/register-patient')
        .send(validRegistration)
        .expect(201);

      expect(res.body).toHaveProperty('id', validPatientId);
      expect(res.body).toHaveProperty('name', 'Priya Sharma');
      expect(res.body).toHaveProperty('message', 'Patient registered successfully');
    });

    it('should propagate service errors as 500', async () => {
      mockFaceRegistrationService.registerPatient.mockRejectedValue(
        new Error('Patient with mobile +919876543210 already exists'),
      );

      await request(app.getHttpServer())
        .post('/face/register-patient')
        .send(validRegistration)
        .expect(500);
    });

    it('should reject missing required fields', async () => {
      await request(app.getHttpServer())
        .post('/face/register-patient')
        .send({ name: 'Test' })
        .expect(400);
    });

    it('should handle service errors as 500', async () => {
      mockFaceRegistrationService.registerPatient.mockRejectedValue(
        new Error('DB connection failed'),
      );

      await request(app.getHttpServer())
        .post('/face/register-patient')
        .send(validRegistration)
        .expect(500);
    });

    it('should forward the Idempotency-Key header to the service', async () => {
      mockFaceRegistrationService.registerPatient.mockResolvedValue({
        id: validPatientId,
        name: 'Priya Sharma',
        message: 'Patient registered successfully',
      });

      await request(app.getHttpServer())
        .post('/face/register-patient')
        .set('Idempotency-Key', 'offline-mutation-7')
        .send(validRegistration)
        .expect(201);

      expect(mockFaceRegistrationService.registerPatient).toHaveBeenCalledWith(
        validRegistration,
        'offline-mutation-7',
      );
    });

    it('should forward a missing Idempotency-Key as undefined', async () => {
      mockFaceRegistrationService.registerPatient.mockResolvedValue({
        id: validPatientId,
        name: 'Priya Sharma',
        message: 'Patient registered successfully',
      });

      await request(app.getHttpServer())
        .post('/face/register-patient')
        .send(validRegistration)
        .expect(201);

      expect(mockFaceRegistrationService.registerPatient).toHaveBeenCalledWith(
        validRegistration,
        undefined,
      );
    });
  });

  // ─── GET /face/:patientId/embeddings ───────────────────────────

  describe('GET /face/:patientId/embeddings', () => {
    it('should return embeddings for a known patient', async () => {
      mockFaceService.getPatientEmbeddings.mockResolvedValue([
        { id: 'emb-1_1700000000', capturedAt: '2025-01-15T10:30:00Z' },
        { id: 'emb-2_1700000001', capturedAt: '2025-01-16T11:00:00Z' },
      ]);

      const res = await request(app.getHttpServer())
        .get(`/face/${validUuid}/embeddings`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toHaveProperty('id', 'emb-1_1700000000');
      expect(res.body[0]).toHaveProperty('capturedAt');
    });

    it('should return 500 when service throws generic error', async () => {
      mockFaceService.getPatientEmbeddings.mockRejectedValue(new Error('No embeddings found'));

      await request(app.getHttpServer()).get(`/face/${validUuid}/embeddings`).expect(500);
    });

    it('should handle service errors as 500', async () => {
      mockFaceService.getPatientEmbeddings.mockRejectedValue(new Error('Service unavailable'));

      await request(app.getHttpServer()).get(`/face/${validUuid}/embeddings`).expect(500);
    });
  });
});
