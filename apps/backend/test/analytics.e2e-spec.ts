/* eslint-disable @typescript-eslint/no-explicit-any -- test mocks */

import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { AnalyticsModule } from '../src/modules/analytics/analytics.module';
import { AnalyticsService } from '../src/modules/analytics/analytics.service';

// ─── Mocks ─────────────────────────────────────────────────────

const mockAuditService = {
  log: jest.fn().mockResolvedValue(undefined),
};

const mockAnalyticsService = {
  getOverview: jest.fn(),
  getVolume: jest.fn(),
  getHours: jest.fn(),
  getFlow: jest.fn(),
  exportCsv: jest.fn(),
};

type Role = 'RECEPTIONIST' | 'DOCTOR' | 'ADMIN' | 'SYSTEM';

describe('Analytics (ADMIN/SYSTEM E2E)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const userId = '550e8400-e29b-41d4-a716-446655440000';

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
        AnalyticsModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({} as any)
      .overrideProvider(AuditService)
      .useValue(mockAuditService)
      .overrideProvider(AnalyticsService)
      .useValue(mockAnalyticsService)
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
    mockAnalyticsService.getOverview.mockResolvedValue({
      days: 30,
      totalSessions: 42,
      returningPatients: 30,
      newPatients: 12,
      faceMatchRate: 71.4,
      avgIntakeMinutes: 12.5,
      briefSuccessRate: 95.2,
      activeSessions: 3,
    });
    mockAnalyticsService.getVolume.mockResolvedValue({
      days: 30,
      data: [
        { date: '2026-07-01', count: 5 },
        { date: '2026-07-02', count: 8 },
      ],
    });
    mockAnalyticsService.getHours.mockResolvedValue({
      days: 30,
      data: Array.from({ length: 24 }, (_, hour) => ({ hour, count: hour === 10 ? 12 : 0 })),
    });
    mockAnalyticsService.getFlow.mockResolvedValue({
      total: 4,
      stages: [
        { key: 'waiting', label: 'Waiting', count: 1 },
        { key: 'in_intake', label: 'In Intake', count: 1 },
        { key: 'triaged', label: 'Triaged', count: 1 },
        { key: 'with_doctor', label: 'With Doctor', count: 1 },
      ],
    });
    mockAnalyticsService.exportCsv.mockResolvedValue({
      filename: 'analytics-30d.csv',
      csv: '\uFEFFdate,sessions\n2026-07-01,5\n2026-07-02,8\n',
    });
  });

  // ─── RBAC matrix ─────────────────────────────────────────────

  describe('RBAC enforcement', () => {
    it('GET /analytics/overview returns 401 without a token', async () => {
      await request(app.getHttpServer()).get('/analytics/overview').expect(401);
    });

    it('GET /analytics/overview returns 403 for a DOCTOR', async () => {
      const token = await signToken('DOCTOR');
      await request(app.getHttpServer())
        .get('/analytics/overview')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('GET /analytics/overview returns 403 for a RECEPTIONIST', async () => {
      const token = await signToken('RECEPTIONIST');
      await request(app.getHttpServer())
        .get('/analytics/overview')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('GET /analytics/overview returns 200 for an ADMIN', async () => {
      const token = await signToken('ADMIN');
      const res = await request(app.getHttpServer())
        .get('/analytics/overview')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.totalSessions).toBe(42);
      expect(res.body.faceMatchRate).toBe(71.4);
    });

    it('GET /analytics/overview returns 200 for SYSTEM', async () => {
      const token = await signToken('SYSTEM');
      await request(app.getHttpServer())
        .get('/analytics/overview')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });

  // ─── Endpoint payloads ───────────────────────────────────────

  describe('GET /analytics/volume', () => {
    it('passes the days window to the service', async () => {
      const token = await signToken('ADMIN');
      const res = await request(app.getHttpServer())
        .get('/analytics/volume?days=7')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(mockAnalyticsService.getVolume).toHaveBeenCalledWith(7, undefined);
      expect(res.body.data).toHaveLength(2);
    });

    it('rejects an invalid days window with 400', async () => {
      const token = await signToken('ADMIN');
      await request(app.getHttpServer())
        .get('/analytics/volume?days=9999')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('passes a clinicId filter through', async () => {
      const token = await signToken('ADMIN');
      await request(app.getHttpServer())
        .get('/analytics/volume?days=30&clinicId=550e8400-e29b-41d4-a716-446655440001')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(mockAnalyticsService.getVolume).toHaveBeenCalledWith(
        30,
        '550e8400-e29b-41d4-a716-446655440001',
      );
    });
  });

  describe('GET /analytics/hours', () => {
    it('returns 24 heatmap buckets', async () => {
      const token = await signToken('ADMIN');
      const res = await request(app.getHttpServer())
        .get('/analytics/hours')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data).toHaveLength(24);
      expect(res.body.data[10].count).toBe(12);
    });
  });

  describe('GET /analytics/flow', () => {
    it('returns the pipeline stage counts', async () => {
      const token = await signToken('ADMIN');
      const res = await request(app.getHttpServer())
        .get('/analytics/flow')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.total).toBe(4);
      expect(res.body.stages.map((s: { key: string }) => s.key)).toEqual([
        'waiting',
        'in_intake',
        'triaged',
        'with_doctor',
      ]);
    });
  });

  describe('GET /analytics/export', () => {
    it('downloads a CSV file with the attachment header', async () => {
      const token = await signToken('ADMIN');
      const res = await request(app.getHttpServer())
        .get('/analytics/export?days=30')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('analytics-30d.csv');
      expect(res.text).toContain('date,sessions');
    });
  });
});
