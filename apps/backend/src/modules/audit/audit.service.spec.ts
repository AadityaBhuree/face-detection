import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuditService } from './audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuditLogInput } from '@jeevandata/shared-schemas';

// ─── Mocks ─────────────────────────────────────────────────────

const mockPrisma = {
  auditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    deleteMany: jest.fn(),
  },
};

const mockConfig = {
  get: jest.fn().mockReturnValue(90),
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
        { provide: ConfigService, useValue: mockConfig },
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
      mockPrisma.auditLog.create.mockRejectedValue(new Error('Database connection error'));

      // Should not throw despite DB error
      await expect(service.log(validAuditEntry)).resolves.not.toThrow();
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

  // ─── Filtered Log Viewer ─────────────────────────────────────

  describe('queryLogs', () => {
    it('should pass through filters to the where clause', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await service.queryLogs({
        action: 'profile',
        actorId: 'doc',
        actorRole: 'DOCTOR',
        resourceType: 'patient',
        from: '2026-01-01',
        to: '2026-01-31',
        page: 2,
        limit: 25,
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            action: { contains: 'profile', mode: 'insensitive' },
            actorId: { contains: 'doc', mode: 'insensitive' },
            actorRole: 'DOCTOR',
            resourceType: { contains: 'patient', mode: 'insensitive' },
            timestamp: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-01-31'),
            },
          },
          skip: 25, // (2-1) * 25
          take: 25,
          orderBy: { timestamp: 'desc' },
        }),
      );
    });

    it('should omit the timestamp range when no dates are given', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await service.queryLogs({ page: 1, limit: 50 });

      const args = mockPrisma.auditLog.findMany.mock.calls[0][0];
      expect(args.where.timestamp).toBeUndefined();
    });

    it('should return pagination metadata', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([{ id: 'log-1' }]);
      mockPrisma.auditLog.count.mockResolvedValue(75);

      const result = await service.queryLogs({ page: 2, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.pagination).toEqual({
        page: 2,
        limit: 20,
        total: 75,
        totalPages: 4,
      });
    });
  });

  // ─── CSV Export & Anonymization ──────────────────────────────

  describe('exportCsv', () => {
    it('should generate a BOM-prefixed CSV with all log columns', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          action: 'PATIENT_PROFILE_VIEW',
          actorId: 'user-123',
          actorRole: 'DOCTOR',
          resourceType: 'patient',
          resourceId: 'patient-456',
          details: { browser: 'Chrome' },
          ipAddress: '192.168.1.1',
          timestamp: new Date('2026-07-15T10:30:00Z'),
        },
      ]);

      const { filename, csv } = await service.exportCsv({});

      expect(filename).toMatch(/^audit-log-\d+\.csv$/);
      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).toContain(
        'timestamp,action,actorId,actorRole,resourceType,resourceId,ipAddress,details',
      );
      expect(csv).toContain('PATIENT_PROFILE_VIEW');
      expect(csv).toContain('user-123');
      expect(csv).toContain('2026-07-15T10:30:00.000Z');
    });

    it('should redact PHI keys in the details JSON but keep structure', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          action: 'PATIENT_PROFILE_VIEW',
          actorId: 'user-123',
          actorRole: 'ADMIN',
          resourceType: 'patient',
          resourceId: 'patient-456',
          details: {
            patient: { name: 'Rahul Sharma', mobile: '+919876543210' },
            aadhaar: '1234',
            browser: 'Chrome',
          },
          ipAddress: '192.168.1.1',
          timestamp: new Date('2026-07-15T10:30:00Z'),
        },
      ]);

      const { csv } = await service.exportCsv({});

      // PHI values must not appear anywhere in the output
      expect(csv).not.toContain('Rahul Sharma');
      expect(csv).not.toContain('+919876543210');
      expect(csv).not.toContain('1234');
      // Structure preserved with masked values
      expect(csv).toContain('[REDACTED]');
      // Non-PHI values survive
      expect(csv).toContain('Chrome');
    });

    it('should RFC-4180 escape the details JSON cell (quotes doubled, wrapped in quotes)', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          action: 'PATIENT_SEARCH',
          actorId: 'user-1',
          actorRole: 'RECEPTIONIST',
          resourceType: 'patient',
          resourceId: 'patient-1',
          details: { note: 'has, "quotes"' },
          ipAddress: '10.0.0.1',
          timestamp: new Date('2026-07-15T10:30:00Z'),
        },
      ]);

      const { csv } = await service.exportCsv({});

      // The JSON cell is wrapped in quotes and inner quotes are doubled
      expect(csv).toContain('10.0.0.1,"{""note""');
      // The original "quotes" value is preserved (backslash-escaped by JSON)
      expect(csv).toContain('has, ');
    });

    it('should cap exports at 10,000 rows', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      await service.exportCsv({});

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10_000 }),
      );
    });
  });

  // ─── PHI Access Summary ──────────────────────────────────────

  describe('getPhiAccessSummary', () => {
    it('should group accesses per patient by day', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([
        {
          action: 'PATIENT_PROFILE_VIEW',
          actorId: 'doctor-1',
          actorRole: 'DOCTOR',
          timestamp: new Date('2026-07-15T10:30:00Z'),
        },
        {
          action: 'PATIENT_PROFILE_VIEW',
          actorId: 'doctor-1',
          actorRole: 'DOCTOR',
          timestamp: new Date('2026-07-15T14:00:00Z'),
        },
        {
          action: 'INTAKE_RECORD_ACCESS',
          actorId: 'reception-1',
          actorRole: 'RECEPTIONIST',
          timestamp: new Date('2026-07-14T09:00:00Z'),
        },
      ]);

      const result = await service.getPhiAccessSummary('patient-456', 30);

      expect(result.totalAccesses).toBe(3);
      expect(result.uniqueActors).toBe(2);
      expect(result.perDay).toHaveLength(2);

      expect(result.perDay[0]!.date).toBe('2026-07-15');
      expect(result.perDay[0]!.accessCount).toBe(2);
      expect(result.perDay[0]!.uniqueActors).toBe(1);
      expect(result.perDay[0]!.actors).toEqual(['doctor-1']);
      expect(result.perDay[0]!.actions).toEqual({ PATIENT_PROFILE_VIEW: 2 });

      expect(result.perDay[1]!.date).toBe('2026-07-14');
      expect(result.perDay[1]!.actions).toEqual({ INTAKE_RECORD_ACCESS: 1 });
    });

    it('should sort days newest first', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([
        {
          action: 'A',
          actorId: 'u1',
          actorRole: 'ADMIN',
          timestamp: new Date('2026-07-10T10:00:00Z'),
        },
        {
          action: 'B',
          actorId: 'u2',
          actorRole: 'DOCTOR',
          timestamp: new Date('2026-07-12T10:00:00Z'),
        },
      ]);

      const result = await service.getPhiAccessSummary('patient-1', 30);

      expect(result.perDay.map((d) => d.date)).toEqual(['2026-07-12', '2026-07-10']);
    });

    it('should filter by resourceType patient and the rolling window', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      await service.getPhiAccessSummary('patient-456', 7);

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            resourceId: 'patient-456',
            resourceType: 'patient',
            timestamp: { gte: expect.any(Date) },
          },
        }),
      );
    });
  });

  // ─── Retention Policy ────────────────────────────────────────

  describe('retention', () => {
    it('should return the configured retention days', () => {
      mockConfig.get.mockReturnValue(120);
      expect(service.getRetentionDays()).toBe(120);
    });

    it('should default to 90 days when config is missing', () => {
      mockConfig.get.mockReturnValue(undefined);
      expect(service.getRetentionDays()).toBe(90);
    });

    it('should delete logs older than the retention window', async () => {
      mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 5 });

      const result = await service.runRetentionCleanup(90);

      expect(mockPrisma.auditLog.deleteMany).toHaveBeenCalledWith({
        where: { timestamp: { lt: expect.any(Date) } },
      });
      expect(result).toEqual({
        deleted: 5,
        retentionDays: 90,
        cutoff: expect.any(String),
      });
    });

    it('should use the configured default when no override given', async () => {
      mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 0 });
      mockConfig.get.mockReturnValue(30);

      await service.runRetentionCleanup();

      expect(mockPrisma.auditLog.deleteMany).toHaveBeenCalledWith({
        where: { timestamp: { lt: expect.any(Date) } },
      });
      // Verify the cutoff matches a 30-day window
      const cutoff = mockPrisma.auditLog.deleteMany.mock.calls[0][0].where.timestamp.lt;
      const expected = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      expect(Math.abs(cutoff.getTime() - expected.getTime())).toBeLessThan(5000);
    });
  });
});
