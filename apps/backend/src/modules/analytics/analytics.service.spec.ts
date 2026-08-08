/* eslint-disable @typescript-eslint/no-explicit-any -- test mocks */

import { Test, type TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

// ─── Mocks ─────────────────────────────────────────────────────

const mockPrisma = {
  intakeSession: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  intakeRecord: {
    count: jest.fn(),
  },
};

const mockAuditService = {
  log: jest.fn().mockResolvedValue(undefined),
};

function session(
  overrides: Partial<{
    patientId: string | null;
    endedAt: Date | null;
    status: string;
    hoursAgo: number;
  }>,
) {
  const {
    patientId = '660e8400-e29b-41d4-a716-446655440001',
    endedAt = new Date(Date.now() - 30 * 60000),
    status = 'COMPLETED',
    hoursAgo = 24,
  } = overrides;
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    patientId,
    endedAt,
    status,
    startedAt: new Date(Date.now() - hoursAgo * 3600000),
  };
}

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.intakeSession.findMany.mockResolvedValue([]);
    mockPrisma.intakeRecord.count.mockResolvedValue(0);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  // ─── Overview ────────────────────────────────────────────────

  describe('getOverview', () => {
    it('computes KPIs from fetched sessions', async () => {
      // Two completed sessions: started 60 min ago, ended 30 min ago → 30 min each.
      const completed = (patientId: string) => ({
        ...session({ patientId, status: 'COMPLETED' }),
        startedAt: new Date(Date.now() - 60 * 60000),
        endedAt: new Date(Date.now() - 30 * 60000),
      });
      mockPrisma.intakeSession.findMany.mockResolvedValue([
        completed('p1'),
        completed('p1'),
        session({ patientId: null, status: 'INTAKE_IN_PROGRESS', endedAt: null }),
      ]);
      mockPrisma.intakeRecord.count.mockResolvedValue(2);

      const result = await service.getOverview(30);

      expect(result.totalSessions).toBe(3);
      expect(result.returningPatients).toBe(2);
      expect(result.newPatients).toBe(1);
      expect(result.faceMatchRate).toBe(66.7);
      expect(result.avgIntakeMinutes).toBe(30);
      expect(result.briefSuccessRate).toBe(66.7);
      expect(result.activeSessions).toBe(1);
    });

    it('returns zeros for an empty window', async () => {
      const result = await service.getOverview(7);

      expect(result.totalSessions).toBe(0);
      expect(result.faceMatchRate).toBe(0);
      expect(result.avgIntakeMinutes).toBe(0);
      expect(result.briefSuccessRate).toBe(0);
    });

    it('scopes the query by days and optional clinicId', async () => {
      mockPrisma.intakeSession.findMany.mockResolvedValue([]);

      await service.getOverview(90, 'clinic-1');

      expect(mockPrisma.intakeSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            clinicId: 'clinic-1',
            startedAt: { gte: expect.any(Date) },
          }),
        }),
      );
    });

    it('scopes the brief count through the session clinic when clinicId is set', async () => {
      mockPrisma.intakeSession.findMany.mockResolvedValue([]);

      await service.getOverview(30, 'clinic-1');

      expect(mockPrisma.intakeRecord.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            session: { clinicId: 'clinic-1' },
          }),
        }),
      );
    });

    it('keeps the brief count global when no clinic filter is set', async () => {
      mockPrisma.intakeSession.findMany.mockResolvedValue([]);

      await service.getOverview(30);

      expect(mockPrisma.intakeRecord.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            generatedAt: { gte: expect.any(Date) },
          }),
        }),
      );
      const callWhere = mockPrisma.intakeRecord.count.mock.calls[0][0].where;
      expect(callWhere).not.toHaveProperty('session');
    });

    it('logs an audit event', async () => {
      await service.getOverview(30);

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ANALYTICS_OVERVIEW_VIEW' }),
      );
    });
  });

  // ─── Volume ──────────────────────────────────────────────────

  describe('getVolume', () => {
    it('returns zero-filled daily buckets covering the whole window', async () => {
      mockPrisma.intakeSession.findMany.mockResolvedValue([]);

      const result = await service.getVolume(7);

      expect(result.data).toHaveLength(7);
      result.data.forEach((d) => expect(d.count).toBe(0));
    });

    it('counts sessions into their day bucket', async () => {
      // One session today, one yesterday (approximate hour offsets).
      mockPrisma.intakeSession.findMany.mockResolvedValue([
        session({ hoursAgo: 0 }),
        session({ hoursAgo: 24 }),
      ]);

      const result = await service.getVolume(7);

      expect(result.data.reduce((sum, d) => sum + d.count, 0)).toBe(2);
      const dayKey = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const today = dayKey(new Date());
      const yesterday = dayKey(new Date(Date.now() - 24 * 3600000));
      expect(result.data.find((d) => d.date === today)!.count).toBe(1);
      expect(result.data.find((d) => d.date === yesterday)!.count).toBe(1);
    });

    it('logs an audit event', async () => {
      await service.getVolume(30);

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ANALYTICS_VOLUME_VIEW' }),
      );
    });
  });

  // ─── Hours ───────────────────────────────────────────────────

  describe('getHours', () => {
    it('returns 24 hour buckets', async () => {
      mockPrisma.intakeSession.findMany.mockResolvedValue([]);

      const result = await service.getHours(30);

      expect(result.data).toHaveLength(24);
      result.data.forEach((d, i) => expect(d.hour).toBe(i));
    });

    it('counts sessions by their start hour', async () => {
      const atHour = (h: number) => {
        const d = new Date();
        d.setHours(h, 0, 0, 0);
        return { ...session({}), startedAt: d };
      };
      mockPrisma.intakeSession.findMany.mockResolvedValue([atHour(9), atHour(9), atHour(14)]);

      const result = await service.getHours(30);

      expect(result.data.find((d) => d.hour === 9)!.count).toBe(2);
      expect(result.data.find((d) => d.hour === 14)!.count).toBe(1);
    });

    it('logs an audit event', async () => {
      await service.getHours(30);

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ANALYTICS_HOURS_VIEW' }),
      );
    });
  });

  // ─── Flow board ──────────────────────────────────────────────

  describe('getFlow', () => {
    it('maps session statuses onto pipeline stages', async () => {
      mockPrisma.intakeSession.findMany.mockResolvedValue([
        { status: 'INITIATED' },
        { status: 'INTAKE_IN_PROGRESS' },
        { status: 'BRIEF_GENERATED' },
        { status: 'COMPLETED' },
        { status: 'FAILED' },
      ]);

      const result = await service.getFlow();

      expect(result.total).toBe(5);
      const byKey = (k: string) => result.stages.find((s) => s.key === k)!;
      expect(byKey('waiting').count).toBe(1);
      expect(byKey('in_intake').count).toBe(1);
      expect(byKey('triaged').count).toBe(1);
      expect(byKey('with_doctor').count).toBe(1);
      expect(byKey('failed').count).toBe(1);
    });

    it('filters by clinicId when provided', async () => {
      mockPrisma.intakeSession.findMany.mockResolvedValue([]);

      await service.getFlow('clinic-1');

      expect(mockPrisma.intakeSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clinicId: 'clinic-1' } }),
      );
    });

    it('logs an audit event', async () => {
      await service.getFlow();

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ANALYTICS_FLOW_VIEW' }),
      );
    });
  });

  // ─── CSV export ──────────────────────────────────────────────

  describe('exportCsv', () => {
    it('produces a BOM-prefixed CSV with header and rows', async () => {
      mockPrisma.intakeSession.findMany.mockResolvedValue([
        session({ hoursAgo: 0 }),
        session({ hoursAgo: 0 }),
      ]);

      const { filename, csv } = await service.exportCsv(7);

      expect(filename).toBe('analytics-7d.csv');
      expect(csv.startsWith('\uFEFFdate,sessions\n')).toBe(true);
      const lines = csv.trim().split('\n');
      expect(lines).toHaveLength(8); // header + 7 days
      // The two sessions landed on today's bucket (the last data row).
      const today = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
      expect(lines[7]).toBe(`${today},2`);
    });

    it('logs an audit event', async () => {
      await service.exportCsv(30);

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ANALYTICS_CSV_EXPORT' }),
      );
    });
  });
});
