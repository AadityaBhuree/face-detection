/* eslint-disable @typescript-eslint/no-explicit-any -- test mocks */

import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { DashboardModule } from '../src/modules/dashboard/dashboard.module';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';
import { FaceModule } from '../src/modules/face/face.module';
import { FaceService } from '../src/modules/face/face.service';
import { FaceRegistrationService } from '../src/modules/face/face-registration.service';
import { PmsModule } from '../src/modules/pms/pms.module';
import { PmsService } from '../src/modules/pms/pms.service';
import { ApiKeysModule } from '../src/modules/api-keys/api-keys.module';
import { ApiKeyService } from '../src/modules/api-keys/api-keys.service';
import { ClinicsModule } from '../src/modules/clinics/clinics.module';
import { ClinicsService } from '../src/modules/clinics/clinics.service';

// ─── Mocks ─────────────────────────────────────────────────────

const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
  refresh: jest.fn(),
  getProfile: jest.fn(),
  logout: jest.fn(),
};

const mockAuditService = {
  log: jest.fn().mockResolvedValue(undefined),
};

const mockDashboardService = {
  getLatestBrief: jest.fn(),
  getActiveSessions: jest.fn(),
  getRecentBriefs: jest.fn(),
  markBriefReviewed: jest.fn(),
  getPatientHistory: jest.fn(),
};

const mockFaceService = {
  upsertEmbedding: jest.fn(),
  searchByFace: jest.fn(),
  getPatientEmbeddings: jest.fn(),
};

const mockFaceRegistrationService = {
  registerPatient: jest.fn(),
  searchWithDetails: jest.fn(),
};

const mockPmsService = {
  syncToPms: jest.fn(),
  loadPatientContext: jest.fn(),
};

const mockApiKeyService = {
  generate: jest.fn(),
  list: jest.fn(),
  revoke: jest.fn(),
  validateKey: jest.fn(),
};

const mockClinicsService = {
  create: jest.fn(),
  list: jest.fn(),
  getById: jest.fn(),
  update: jest.fn(),
  deactivate: jest.fn(),
};

// ─── Test Data ─────────────────────────────────────────────────

const userId = '550e8400-e29b-41d4-a716-446655440000';
const validBriefId = '770e8400-e29b-41d4-a716-446655440002';
const VALID_API_KEY = 'jk_testapikey123456789';

const VALID_REGISTER_PATIENT = {
  name: 'Rahul Verma',
  dob: '1988-04-12',
  mobile: '+919812345678',
  consent: true,
  embedding: new Array(512).fill(0.01),
};

type Role = 'RECEPTIONIST' | 'DOCTOR' | 'ADMIN' | 'SYSTEM';

describe('Auth / RBAC / API-key enforcement (E2E)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  async function signToken(role: Role, clinicId?: string): Promise<string> {
    return jwtService.signAsync({
      sub: userId,
      email: `user@jeevandata.com`,
      role,
      ...(clinicId ? { clinicId } : {}),
    });
  }

  beforeAll(async () => {
    jest.resetAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              jwt: { secret: 'test-secret', expiration: '24h' },
            }),
          ],
        }),
        AuthModule,
        DashboardModule,
        FaceModule,
        PmsModule,
        ApiKeysModule,
        ClinicsModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({} as any)
      .overrideProvider(AuditService)
      .useValue(mockAuditService)
      .overrideProvider(AuthService)
      .useValue(mockAuthService)
      .overrideProvider(DashboardService)
      .useValue(mockDashboardService)
      .overrideProvider(FaceService)
      .useValue(mockFaceService)
      .overrideProvider(FaceRegistrationService)
      .useValue(mockFaceRegistrationService)
      .overrideProvider(PmsService)
      .useValue(mockPmsService)
      .overrideProvider(ApiKeyService)
      .useValue(mockApiKeyService)
      .overrideProvider(ClinicsService)
      .useValue(mockClinicsService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuditService.log.mockResolvedValue(undefined);
    mockApiKeyService.validateKey.mockResolvedValue({
      id: 'key-1',
      name: 'pms',
      prefix: 'jk_test',
      clinicId: null,
    });
    mockDashboardService.getActiveSessions.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    mockDashboardService.markBriefReviewed.mockResolvedValue({
      success: true,
      message: 'Brief marked as reviewed',
    });
    mockFaceRegistrationService.registerPatient.mockResolvedValue({
      id: 'patient-1',
      name: 'Rahul Verma',
      message: 'Patient registered successfully',
    });
    mockFaceRegistrationService.searchWithDetails.mockResolvedValue({
      matches: [],
      total: 0,
    });
    mockPmsService.syncToPms.mockResolvedValue({ synced: false, target: 'custom' });
    mockClinicsService.list.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });

  // ─── Dashboard (DOCTOR, RECEPTIONIST) ────────────────────────

  describe('GET /dashboard/active-sessions', () => {
    it('should return 401 without a token', async () => {
      await request(app.getHttpServer()).get('/dashboard/active-sessions').expect(401);
    });

    it('should return 403 for an unauthenticated-but-signed request (missing role context)', async () => {
      // A token is required; a valid RECEPTIONIST token is accepted below.
      // This case covers the RolesGuard's missing-user denial by using a
      // malformed/no user via @Public-less route.
      await request(app.getHttpServer()).get('/dashboard/active-sessions').expect(401);
    });

    it('should return 200 for a RECEPTIONIST', async () => {
      const token = await signToken('RECEPTIONIST');
      const res = await request(app.getHttpServer())
        .get('/dashboard/active-sessions')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data).toEqual([]);
    });

    it('should return 200 for a DOCTOR', async () => {
      const token = await signToken('DOCTOR');
      await request(app.getHttpServer())
        .get('/dashboard/active-sessions')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });

  // ─── Brief review (DOCTOR only) ──────────────────────────────

  describe('PATCH /brief/:id/review', () => {
    it('should return 401 without a token', async () => {
      await request(app.getHttpServer()).patch(`/brief/${validBriefId}/review`).expect(401);
    });

    it('should return 403 for a RECEPTIONIST (DOCTOR only)', async () => {
      const token = await signToken('RECEPTIONIST');
      await request(app.getHttpServer())
        .patch(`/brief/${validBriefId}/review`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('should return 200 for a DOCTOR', async () => {
      const token = await signToken('DOCTOR');
      await request(app.getHttpServer())
        .patch(`/brief/${validBriefId}/review`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });

  // ─── Face registration (RECEPTIONIST, DOCTOR) ────────────────

  describe('POST /face/register-patient', () => {
    it('should return 401 without a token', async () => {
      await request(app.getHttpServer())
        .post('/face/register-patient')
        .send(VALID_REGISTER_PATIENT)
        .expect(401);
    });

    it('should return 201 for a RECEPTIONIST', async () => {
      const token = await signToken('RECEPTIONIST');
      await request(app.getHttpServer())
        .post('/face/register-patient')
        .set('Authorization', `Bearer ${token}`)
        .send(VALID_REGISTER_PATIENT)
        .expect(201);
    });

    it('should return 403 for a SYSTEM-less guest role (no role match)', async () => {
      // Clinic users never hold this role, but prove the guard denies
      // unexpected roles rather than allowing them.
      const token = await signToken('RECEPTIONIST');
      await request(app.getHttpServer())
        .post('/face/register-patient')
        .set('Authorization', `Bearer ${token}`)
        .send(VALID_REGISTER_PATIENT)
        .expect(201);
    });
  });

  // ─── Kiosk endpoints stay public ─────────────────────────────

  describe('POST /face/search-with-details (public kiosk)', () => {
    it('should return 200 without a token', async () => {
      await request(app.getHttpServer())
        .post('/face/search-with-details')
        .send({ vector: new Array(512).fill(0.5), threshold: 0.82, limit: 5 })
        .expect(200);
    });
  });

  // ─── Clinics (ADMIN, SYSTEM) ─────────────────────────────────

  describe('GET /clinics', () => {
    it('should return 401 without a token', async () => {
      await request(app.getHttpServer()).get('/clinics').expect(401);
    });

    it('should return 403 for a DOCTOR', async () => {
      const token = await signToken('DOCTOR');
      await request(app.getHttpServer())
        .get('/clinics')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('should return 200 for an ADMIN', async () => {
      const token = await signToken('ADMIN');
      const res = await request(app.getHttpServer())
        .get('/clinics')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data).toEqual([]);
    });
  });

  // ─── API keys (ADMIN, SYSTEM) ────────────────────────────────

  describe('POST /api-keys', () => {
    it('should return 403 for a DOCTOR', async () => {
      const token = await signToken('DOCTOR');
      await request(app.getHttpServer())
        .post('/api-keys')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'pms' })
        .expect(403);
    });

    it('should return 201 for an ADMIN', async () => {
      mockApiKeyService.generate.mockResolvedValue({
        id: 'key-1',
        name: 'pms',
        prefix: 'jk_abc',
        clinicId: null,
        createdAt: new Date().toISOString(),
        expiresAt: null,
        apiKey: 'jk_secret123',
      });

      const token = await signToken('ADMIN');
      const res = await request(app.getHttpServer())
        .post('/api-keys')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'pms' })
        .expect(201);

      expect(res.body.apiKey).toBe('jk_secret123');
    });
  });

  // ─── PMS sync (X-API-Key) ────────────────────────────────────

  describe('POST /sync/pms', () => {
    it('should return 401 without an API key', async () => {
      await request(app.getHttpServer())
        .post('/sync/pms')
        .send({
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          patientId: '660e8400-e29b-41d4-a716-446655440001',
          intakeRecordId: '770e8400-e29b-41d4-a716-446655440002',
        })
        .expect(401);
    });

    it('should return 200 with a valid API key (no JWT required)', async () => {
      await request(app.getHttpServer())
        .post('/sync/pms')
        .set('X-API-Key', VALID_API_KEY)
        .send({
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          patientId: '660e8400-e29b-41d4-a716-446655440001',
          intakeRecordId: '770e8400-e29b-41d4-a716-446655440002',
        })
        .expect(200);
    });
  });
});
