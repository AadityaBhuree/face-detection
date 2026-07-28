import { Test, type TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuditLogInput } from '@ayutalk/shared-schemas';

// ─── Mocks ─────────────────────────────────────────────────────

const mockPrisma = {
  auditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

describe('AuditService', () => {
  let service: AuditService;

  const validAuditEntry: AuditLogInput = {
    action: 'PATIENT_PROFILE_VIEW',
    actorId: 'user-123',
    actorRole: 'DOCTOR',
    resourceType: 'patient',
    resourceId: 'patient-456',
    details: { ip: '192.168.1.1', browser: 'Chrome' },
    ipAddress: '192.168.1.1',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  // ─── Log PHI Access ──────────────────────────────────────────

  describe('log', () => {
    it('should successfully log a PHI access event', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'log-1',
        ...validAuditEntry,
        timestamp: new Date(),
      });

      await service.log(validAuditEntry);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: 'PATIENT_PROFILE_VIEW',
          actorId: 'user-123',
          actorRole: 'DOCTOR',
          resourceType: 'patient',
          resourceId: 'patient-456',
          details: { ip: '192.168.1.1', browser: 'Chrome' },
          ipAddress: '192.168.1.1',
        },
      });
    });

    it('should default details to empty object when not provided', async () => {
      const entryWithoutDetails = {
        ...validAuditEntry,
        details: undefined as unknown as Record<string, unknown>,
      };

      mockPrisma.auditLog.create.mockResolvedValue({ id: 'log-2' });

      await service.log(entryWithoutDetails);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          details: {},
        }),
      });
    });

    it('should NEVER throw an error — audit failure should not block operations', async () => {
      mockPrisma.auditLog.create.mockRejectedValue(
        new Error('Database connection error'),
      );

      // Should not throw despite DB error
      await expect(
        service.log(validAuditEntry),
      ).resolves.not.toThrow();
    });

    it.each([
      'PATIENT_PROFILE_VIEW',
      'INTAKE_RECORD_ACCESS',
      'FACE_EMBEDDING_VIEW',
      'PATIENT_SEARCH',
      'SESSION_VIEW',
    ])('should log %s action correctly', async (action) => {
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'log-3' });

      await service.log({
        ...validAuditEntry,
        action,
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action }),
      });
    });

    it.each(['RECEPTIONIST', 'DOCTOR', 'ADMIN', 'SYSTEM'] as const)(
      'should handle %s user role',
      async (actorRole) => {
        mockPrisma.auditLog.create.mockResolvedValue({ id: 'log-4' });

        await service.log({
          ...validAuditEntry,
          actorRole,
        });

        expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
          data: expect.objectContaining({ actorRole }),
        });
      },
    );
  });

  // ─── Get Patient Access Logs ─────────────────────────────────

  describe('getPatientAccessLogs', () => {
    const patientId = 'patient-456';

    it('should return paginated access logs for a patient', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          action: 'PATIENT_PROFILE_VIEW',
          actorId: 'doctor-1',
          actorRole: 'DOCTOR',
          resourceType: 'patient',
          resourceId: patientId,
          timestamp: new Date('2025-01-15T10:30:00Z'),
        },
        {
          id: 'log-2',
          action: 'INTAKE_RECORD_ACCESS',
          actorId: 'reception-1',
          actorRole: 'RECEPTIONIST',
          resourceType: 'patient',
          resourceId: patientId,
          timestamp: new Date('2025-01-15T09:00:00Z'),
        },
      ];

      mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs);
      mockPrisma.auditLog.count.mockResolvedValue(10);

      const result = await service.getPatientAccessLogs(patientId);

      expect(result.data).toHaveLength(2);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 50,
        total: 10,
        totalPages: 1,
      });
    });

    it('should filter by patient resourceId and resource type', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await service.getPatientAccessLogs(patientId);

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            resourceId: patientId,
            resourceType: 'patient',
          },
        }),
      );
    });

    it('should support pagination with custom page and limit', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(100);

      const result = await service.getPatientAccessLogs(patientId, 3, 20);

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 40, // (3-1) * 20
          take: 20,
        }),
      );

      expect(result.pagination).toEqual({
        page: 3,
        limit: 20,
        total: 100,
        totalPages: 5,
      });
    });

    it('should order logs by timestamp descending (most recent first)', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await service.getPatientAccessLogs(patientId);

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { timestamp: 'desc' },
        }),
      );
    });

    it('should return empty data array when no logs exist', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      const result = await service.getPatientAccessLogs(patientId);

      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it('should calculate totalPages correctly for edge cases', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      // 1 item with limit 50 → 1 page
      mockPrisma.auditLog.count.mockResolvedValue(1);
      let result = await service.getPatientAccessLogs(patientId);
      expect(result.pagination.totalPages).toBe(1);

      // 0 items → 0 pages
      mockPrisma.auditLog.count.mockResolvedValue(0);
      result = await service.getPatientAccessLogs(patientId);
      expect(result.pagination.totalPages).toBe(0);

      // 51 items with limit 50 → 2 pages
      mockPrisma.auditLog.count.mockResolvedValue(51);
      result = await service.getPatientAccessLogs(patientId);
      expect(result.pagination.totalPages).toBe(2);
    });
  });
});
