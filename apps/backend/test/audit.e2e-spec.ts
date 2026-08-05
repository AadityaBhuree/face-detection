/* eslint-disable @typescript-eslint/no-explicit-any -- test mocks */

import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { AuditModule } from '../src/modules/audit/audit.module';

// ─── Mocks ─────────────────────────────────────────────────────

const mockAuditService = {
  log: jest.fn().mockResolvedValue(undefined),
  queryLogs: jest.fn(),
  exportCsv: jest.fn(),
  getPhiAccessSummary: jest.fn(),
  getRetentionDays: jest.fn(),
  runRetentionCleanup: jest.fn(),
};

type Role = 'RECEPTIONIST' | 'DOCTOR' | 'ADMIN' | 'SYSTEM';

describe('Audit (HIPAA — ADMIN/SYSTEM E2E)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const userId = '550e8400-e29b-41d4-a716-446655440000';

  const sampleLogs = {
    data: [
      {
        id: 'log-1',
        action: 'PATIENT_PROFILE_VIEW',
        actorId: 'user-1',
        actorRole: 'DOCTOR',
        resourceType: 'patient',
        resourceId: '550e8400-e29b-41d4-a716-446655440001',
        details: {},
        ipAddress: '192.168.1.1',
        timestamp: '2026-07-15T10:30:00.000Z',
      },
    ],
    pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
  };

  async function signToken(role: Role): Promise<string> {
    return jwtService.signAsync({
      sub: userId,
      email: `user@jeevandata.com`,
      role,
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
        AuditModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({} as any)
      .overrideProvider(AuditService)
      .useValue(mockAuditService)
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
    mockAuditService.queryLogs.mockResolvedValue(sampleLogs);
    mockAuditService.exportCsv.mockResolvedValue({
      filename: 'audit-log-123.csv',
      csv: '\uFEFFtimestamp,action,actorId\n2026-07-15T10:30:00.000Z,PATIENT_PROFILE_VIEW,user-1\n',
    });
    mockAuditService.getPhiAccessSummary.mockResolvedValue({
      patientId: '550e8400-e29b-41d4-a716-446655440001',
      days: 30,
      totalAccesses: 3,
      uniqueActors: 2,
      perDay: [
        {
          date: '2026-07-15',
          accessCount: 2,
          uniqueActors: 1,
          actors: ['doctor-1'],
          actions: { PATIENT_PROFILE_VIEW: 2 },
        },
      ],
    });
    mockAuditService.getRetentionDays.mockReturnValue(90);
    mockAuditService.runRetentionCleanup.mockResolvedValue({
      deleted: 5,
      retentionDays: 90,
      cutoff: '2026-04-15T00:00:00.000Z',
    });
  });

  // ─── RBAC matrix ─────────────────────────────────────────────

  describe('RBAC enforcement', () => {
    it('GET /audit/logs returns 401 without a token', async () => {
      await request(app.getHttpServer()).get('/audit/logs').expect(401);
    });

    it('GET /audit/logs returns 403 for a DOCTOR', async () => {
      const token = await signToken('DOCTOR');
      await request(app.getHttpServer())
        .get('/audit/logs')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('GET /audit/logs returns 403 for a RECEPTIONIST', async () => {
      const token = await signToken('RECEPTIONIST');
      await request(app.getHttpServer())
        .get('/audit/logs')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('GET /audit/logs returns 200 for an ADMIN', async () => {
      const token = await signToken('ADMIN');
      const res = await request(app.getHttpServer())
        .get('/audit/logs')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination.total).toBe(1);
    });

    it('GET /audit/logs returns 200 for SYSTEM', async () => {
      const token = await signToken('SYSTEM');
      await request(app.getHttpServer())
        .get('/audit/logs')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });

  // ─── Filtered viewer ─────────────────────────────────────────

  describe('GET /audit/logs', () => {
    it('passes filters, pagination, and date range to the service', async () => {
      const token = await signToken('ADMIN');
      const res = await request(app.getHttpServer())
        .get(
          '/audit/logs?action=profile&actorId=doc&actorRole=DOCTOR&resourceType=patient&from=2026-01-01&to=2026-01-31&page=2&limit=25',
        )
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(mockAuditService.queryLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'profile',
          actorId: 'doc',
          actorRole: 'DOCTOR',
          resourceType: 'patient',
          from: '2026-01-01',
          to: '2026-01-31',
          page: 2,
          limit: 25,
        }),
      );
      expect(res.body.data).toHaveLength(1);
    });

    it('rejects an invalid date range with 400', async () => {
      const token = await signToken('ADMIN');
      await request(app.getHttpServer())
        .get('/audit/logs?from=not-a-date')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('rejects an invalid actorRole with 400', async () => {
      const token = await signToken('ADMIN');
      await request(app.getHttpServer())
        .get('/audit/logs?actorRole=SUPERADMIN')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });
  });

  // ─── CSV export ──────────────────────────────────────────────

  describe('GET /audit/logs/export', () => {
    it('downloads an anonymized CSV with the attachment header', async () => {
      const token = await signToken('ADMIN');
      const res = await request(app.getHttpServer())
        .get('/audit/logs/export?action=profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('audit-log-123.csv');
      expect(res.text).toContain('timestamp,action,actorId');
      expect(mockAuditService.exportCsv).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'profile' }),
      );
    });
  });

  // ─── PHI access summary ──────────────────────────────────────

  describe('GET /audit/patients/:patientId/access-summary', () => {
    it('returns the per-day access summary for a patient', async () => {
      const token = await signToken('ADMIN');
      const res = await request(app.getHttpServer())
        .get('/audit/patients/550e8400-e29b-41d4-a716-446655440001/access-summary?days=30')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(mockAuditService.getPhiAccessSummary).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440001',
        30,
      );
      expect(res.body.totalAccesses).toBe(3);
      expect(res.body.perDay[0].date).toBe('2026-07-15');
    });

    it('rejects an invalid patientId with 400', async () => {
      const token = await signToken('ADMIN');
      await request(app.getHttpServer())
        .get('/audit/patients/not-a-uuid/access-summary')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('rejects an out-of-range days window with 400', async () => {
      const token = await signToken('ADMIN');
      await request(app.getHttpServer())
        .get('/audit/patients/550e8400-e29b-41d4-a716-446655440001/access-summary?days=9999')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });
  });

  // ─── Retention policy & cleanup ──────────────────────────────

  describe('retention', () => {
    it('GET /audit/retention returns the configured policy', async () => {
      const token = await signToken('ADMIN');
      const res = await request(app.getHttpServer())
        .get('/audit/retention')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.retentionDays).toBe(90);
    });

    it('POST /audit/retention/cleanup triggers cleanup with an override', async () => {
      const token = await signToken('ADMIN');
      const res = await request(app.getHttpServer())
        .post('/audit/retention/cleanup')
        .set('Authorization', `Bearer ${token}`)
        .send({ days: 30 })
        .expect(200);

      expect(mockAuditService.runRetentionCleanup).toHaveBeenCalledWith(30);
      expect(res.body.deleted).toBe(5);
    });

    it('POST /audit/retention/cleanup without a body uses the config default', async () => {
      const token = await signToken('ADMIN');
      await request(app.getHttpServer())
        .post('/audit/retention/cleanup')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(200);

      expect(mockAuditService.runRetentionCleanup).toHaveBeenCalledWith(undefined);
    });

    it('POST /audit/retention/cleanup rejects an invalid days override', async () => {
      const token = await signToken('ADMIN');
      await request(app.getHttpServer())
        .post('/audit/retention/cleanup')
        .set('Authorization', `Bearer ${token}`)
        .send({ days: 0 })
        .expect(400);
    });
  });
});
