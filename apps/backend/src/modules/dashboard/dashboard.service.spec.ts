import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MetricsService } from '../opentelemetry/metrics.service';

// ─── Mocks ─────────────────────────────────────────────────────

const mockPrisma = {
  intakeRecord: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
  },
  intakeSession: {
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
};

const mockAuditService = {
  log: jest.fn().mockResolvedValue(undefined),
};

const mockMetricsService = {
  incrementSessionsCompleted: jest.fn(),
  incrementSessionTimeouts: jest.fn(),
  setActiveSessions: jest.fn(),
};

// ─── Test Data ──────────────────────────────────────────────────

const validPatientId = '660e8400-e29b-41d4-a716-446655440001';
const validSessionId = '550e8400-e29b-41d4-a716-446655440000';
const validBriefId = '770e8400-e29b-41d4-a716-446655440002';

const mockPatient = {
  id: validPatientId,
  name: 'Priya Sharma',
  dob: new Date('1990-01-15'),
  mobile: '+911234567890',
};

const mockIntakeRecord = {
  id: validBriefId,
  sessionId: validSessionId,
  patientId: validPatientId,
  brief: { summary: 'Test', chiefComplaint: 'Headache', riskFlags: [] },
  intakeData: { chiefComplaint: 'Headache' },
  generatedAt: new Date('2025-01-15T10:35:00Z'),
  patient: mockPatient,
  session: {
    id: validSessionId,
    startedAt: new Date('2025-01-15T10:30:00Z'),
    status: 'BRIEF_GENERATED',
  },
};

const mockSession = {
  id: validSessionId,
  patientId: validPatientId,
  status: 'INTAKE_IN_PROGRESS',
  startedAt: new Date('2025-01-15T10:30:00Z'),
  patient: {
    id: validPatientId,
    name: 'Priya Sharma',
    dob: new Date('1990-01-15'),
  },
};

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAuditService },
        { provide: MetricsService, useValue: mockMetricsService },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  // ─── Get Latest Brief ────────────────────────────────────────

  describe('getLatestBrief', () => {
    it('should return the latest brief for a patient', async () => {
      mockPrisma.intakeRecord.findFirst.mockResolvedValue(mockIntakeRecord);

      const result = await service.getLatestBrief(validPatientId);

      expect(result).toHaveProperty('id', validBriefId);
      expect(result).toHaveProperty('sessionId', validSessionId);
      expect(result).toHaveProperty('patientId', validPatientId);
      expect(result.brief).toHaveProperty('chiefComplaint', 'Headache');
      expect(result.session).toHaveProperty('status', 'BRIEF_GENERATED');
    });

    it('should query the most recent record ordered by generatedAt desc', async () => {
      mockPrisma.intakeRecord.findFirst.mockResolvedValue(mockIntakeRecord);

      await service.getLatestBrief(validPatientId);

      expect(mockPrisma.intakeRecord.findFirst).toHaveBeenCalledWith({
        where: { patientId: validPatientId },
        orderBy: { generatedAt: 'desc' },
        include: expect.objectContaining({
          session: expect.objectContaining({
            select: expect.objectContaining({ id: true, status: true }),
          }),
        }),
      });
    });

    it('should throw NotFoundException when no records exist', async () => {
      mockPrisma.intakeRecord.findFirst.mockResolvedValue(null);

      await expect(service.getLatestBrief(validPatientId)).rejects.toThrow(NotFoundException);
    });

    it('should log audit event on successful retrieval', async () => {
      mockPrisma.intakeRecord.findFirst.mockResolvedValue(mockIntakeRecord);

      await service.getLatestBrief(validPatientId);

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DASHBOARD_BRIEF_VIEW',
          resourceId: validBriefId,
        }),
      );
    });
  });

  // ─── Get Active Sessions ──────────────────────────────────────

  describe('getActiveSessions', () => {
    it('should return active sessions with pagination', async () => {
      mockPrisma.intakeSession.findMany.mockResolvedValue([mockSession]);
      mockPrisma.intakeSession.count.mockResolvedValue(1);

      const result = await service.getActiveSessions(1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toHaveProperty('id', validSessionId);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it('should exclude COMPLETED, FAILED, and TIMED_OUT statuses', async () => {
      mockPrisma.intakeSession.findMany.mockResolvedValue([]);
      mockPrisma.intakeSession.count.mockResolvedValue(0);

      await service.getActiveSessions(1, 20);

      expect(mockPrisma.intakeSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: { notIn: ['COMPLETED', 'FAILED', 'TIMED_OUT'] },
          },
        }),
      );
    });

    it('should support custom pagination', async () => {
      mockPrisma.intakeSession.findMany.mockResolvedValue(Array(5).fill(mockSession));
      mockPrisma.intakeSession.count.mockResolvedValue(25);

      const result = await service.getActiveSessions(3, 5);

      expect(mockPrisma.intakeSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
      expect(result.pagination).toEqual({
        page: 3,
        limit: 5,
        total: 25,
        totalPages: 5,
      });
    });

    it('should return empty data when no active sessions exist', async () => {
      mockPrisma.intakeSession.findMany.mockResolvedValue([]);
      mockPrisma.intakeSession.count.mockResolvedValue(0);

      const result = await service.getActiveSessions(1, 20);

      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it('should log audit event', async () => {
      mockPrisma.intakeSession.findMany.mockResolvedValue([mockSession]);
      mockPrisma.intakeSession.count.mockResolvedValue(1);

      await service.getActiveSessions(1, 20);

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DASHBOARD_ACTIVE_SESSIONS_VIEW',
        }),
      );
    });
  });

  // ─── Get Recent Briefs ────────────────────────────────────────

  describe('getRecentBriefs', () => {
    it('should return recent briefs with pagination', async () => {
      mockPrisma.intakeRecord.findMany.mockResolvedValue([mockIntakeRecord]);
      mockPrisma.intakeRecord.count.mockResolvedValue(1);

      const result = await service.getRecentBriefs(1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toHaveProperty('id', validBriefId);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it('should include patient and session data in results', async () => {
      mockPrisma.intakeRecord.findMany.mockResolvedValue([mockIntakeRecord]);
      mockPrisma.intakeRecord.count.mockResolvedValue(1);

      const result = await service.getRecentBriefs(1, 20);

      expect(result.data[0]!).toHaveProperty('patient');
      expect(result.data[0]!).toHaveProperty('session');
      expect(result.data[0]!.session).toHaveProperty('status', 'BRIEF_GENERATED');
    });

    it('should log audit event', async () => {
      mockPrisma.intakeRecord.findMany.mockResolvedValue([mockIntakeRecord]);
      mockPrisma.intakeRecord.count.mockResolvedValue(1);

      await service.getRecentBriefs(1, 20);

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DASHBOARD_RECENT_BRIEFS_VIEW',
        }),
      );
    });
  });

  // ─── Mark Brief Reviewed ──────────────────────────────────────

  describe('markBriefReviewed', () => {
    it('should mark a brief as reviewed and complete the session', async () => {
      mockPrisma.intakeRecord.findUnique.mockResolvedValue(mockIntakeRecord);
      mockPrisma.intakeSession.update.mockResolvedValue({
        id: validSessionId,
        status: 'COMPLETED',
      });

      const result = await service.markBriefReviewed(validBriefId);

      expect(result).toEqual({ success: true, message: 'Brief marked as reviewed' });
      expect(mockPrisma.intakeSession.update).toHaveBeenCalledWith({
        where: { id: validSessionId },
        data: { status: 'COMPLETED' },
      });
    });

    it('should throw NotFoundException when brief does not exist', async () => {
      mockPrisma.intakeRecord.findUnique.mockResolvedValue(null);

      await expect(service.markBriefReviewed(validBriefId)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.intakeSession.update).not.toHaveBeenCalled();
    });

    it('should log audit event on successful review', async () => {
      mockPrisma.intakeRecord.findUnique.mockResolvedValue(mockIntakeRecord);
      mockPrisma.intakeSession.update.mockResolvedValue({
        id: validSessionId,
        status: 'COMPLETED',
      });

      await service.markBriefReviewed(validBriefId);

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DASHBOARD_BRIEF_REVIEWED',
          resourceId: validBriefId,
        }),
      );
    });

    it('should increment the sessions-completed metric (direct COMPLETED path)', async () => {
      mockPrisma.intakeRecord.findUnique.mockResolvedValue(mockIntakeRecord);
      mockPrisma.intakeSession.update.mockResolvedValue({
        id: validSessionId,
        status: 'COMPLETED',
      });

      await service.markBriefReviewed(validBriefId);

      expect(mockMetricsService.incrementSessionsCompleted).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Get Patient History ──────────────────────────────────────

  describe('getPatientHistory', () => {
    it('should return paginated patient history', async () => {
      mockPrisma.intakeRecord.findMany.mockResolvedValue([mockIntakeRecord]);
      mockPrisma.intakeRecord.count.mockResolvedValue(1);

      const result = await service.getPatientHistory(validPatientId, 1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });

    it('should filter by patientId', async () => {
      mockPrisma.intakeRecord.findMany.mockResolvedValue([]);
      mockPrisma.intakeRecord.count.mockResolvedValue(0);

      await service.getPatientHistory(validPatientId, 1, 10);

      expect(mockPrisma.intakeRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { patientId: validPatientId },
        }),
      );
    });

    it('should return empty data for patient with no records', async () => {
      mockPrisma.intakeRecord.findMany.mockResolvedValue([]);
      mockPrisma.intakeRecord.count.mockResolvedValue(0);

      const result = await service.getPatientHistory(validPatientId, 1, 10);

      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it('should log audit event', async () => {
      mockPrisma.intakeRecord.findMany.mockResolvedValue([mockIntakeRecord]);
      mockPrisma.intakeRecord.count.mockResolvedValue(1);

      await service.getPatientHistory(validPatientId, 1, 10);

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DASHBOARD_PATIENT_HISTORY_VIEW',
          resourceId: validPatientId,
        }),
      );
    });

    it('should calculate correct totalPages for edge cases', async () => {
      // 0 items → 0 pages
      mockPrisma.intakeRecord.findMany.mockResolvedValue([]);
      mockPrisma.intakeRecord.count.mockResolvedValue(0);
      let result = await service.getPatientHistory(validPatientId, 1, 10);
      expect(result.pagination.totalPages).toBe(0);

      // 5 items with limit 10 → 1 page
      mockPrisma.intakeRecord.findMany.mockResolvedValue(Array(5).fill(mockIntakeRecord));
      mockPrisma.intakeRecord.count.mockResolvedValue(5);
      result = await service.getPatientHistory(validPatientId, 1, 10);
      expect(result.pagination.totalPages).toBe(1);

      // 11 items with limit 10 → 2 pages
      mockPrisma.intakeRecord.findMany.mockResolvedValue(Array(10).fill(mockIntakeRecord));
      mockPrisma.intakeRecord.count.mockResolvedValue(11);
      result = await service.getPatientHistory(validPatientId, 1, 10);
      expect(result.pagination.totalPages).toBe(2);
    });
  });
});
