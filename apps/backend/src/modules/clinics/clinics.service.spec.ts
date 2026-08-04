/* eslint-disable @typescript-eslint/no-explicit-any -- test mocks */

import { ConflictException, NotFoundException } from '@nestjs/common';
import { ClinicsService } from './clinics.service';

// ─── Mocks ─────────────────────────────────────────────────────

const mockAuditService = {
  log: jest.fn().mockResolvedValue(undefined),
};

const mockPrisma = {
  clinic: {
    findUnique: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
} as any;

const actor = { id: 'admin-1', role: 'ADMIN' };

const clinicRow = {
  id: 'clinic-1',
  name: 'City Care Clinic',
  code: 'CITYCARE',
  address: null,
  phone: null,
  email: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('ClinicsService', () => {
  let service: ClinicsService;

  beforeEach(() => {
    // resetAllMocks also clears mockResolvedValueOnce queues that leak
    // across tests (clearAllMocks only clears call history).
    jest.resetAllMocks();
    mockAuditService.log.mockResolvedValue(undefined);
    service = new ClinicsService(mockPrisma, mockAuditService as any);
  });

  // ─── create ──────────────────────────────────────────────────

  describe('create', () => {
    it('should create a clinic and audit the action', async () => {
      mockPrisma.clinic.findUnique.mockResolvedValue(null);
      mockPrisma.clinic.create.mockResolvedValue(clinicRow);

      const result = await service.create({ name: 'City Care Clinic', code: 'CITYCARE' }, actor);

      expect(result).toEqual(clinicRow);
      expect(mockPrisma.clinic.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ code: 'CITYCARE', name: 'City Care Clinic' }),
      });
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CLINIC_CREATED', actorId: 'admin-1' }),
      );
    });

    it('should reject a duplicate clinic code', async () => {
      mockPrisma.clinic.findUnique.mockResolvedValue(clinicRow);

      await expect(
        service.create({ name: 'Another', code: 'CITYCARE' }, actor),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(mockPrisma.clinic.create).not.toHaveBeenCalled();
    });
  });

  // ─── list ────────────────────────────────────────────────────

  describe('list', () => {
    it('should return paginated clinics', async () => {
      mockPrisma.clinic.findMany.mockResolvedValue([clinicRow]);
      mockPrisma.clinic.count.mockResolvedValue(1);

      const result = await service.list(1, 10);

      expect(result.data).toEqual([clinicRow]);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });
  });

  // ─── getById ─────────────────────────────────────────────────

  describe('getById', () => {
    it('should return a clinic when found', async () => {
      mockPrisma.clinic.findUnique.mockResolvedValue(clinicRow);

      await expect(service.getById('clinic-1')).resolves.toEqual(clinicRow);
    });

    it('should throw NotFoundException when missing', async () => {
      mockPrisma.clinic.findUnique.mockResolvedValue(null);

      await expect(service.getById('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ─── update ──────────────────────────────────────────────────

  describe('update', () => {
    it('should update a clinic', async () => {
      mockPrisma.clinic.findUnique
        .mockResolvedValueOnce(clinicRow) // existing check
        .mockResolvedValueOnce(null); // code uniqueness check (code unchanged → skipped)
      mockPrisma.clinic.update.mockResolvedValue({
        ...clinicRow,
        name: 'City Care Plus',
      });

      const result = await service.update('clinic-1', { name: 'City Care Plus' }, actor);

      expect(result.name).toBe('City Care Plus');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CLINIC_UPDATED' }),
      );
    });

    it('should reject a code that is taken by another clinic', async () => {
      mockPrisma.clinic.findUnique
        .mockResolvedValueOnce(clinicRow) // existing
        .mockResolvedValueOnce({ id: 'clinic-2', code: 'OTHER' }); // code taken

      await expect(service.update('clinic-1', { code: 'OTHER' }, actor)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('should throw NotFoundException when the clinic is missing', async () => {
      mockPrisma.clinic.findUnique.mockResolvedValue(null);

      await expect(service.update('missing', { name: 'X' }, actor)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ─── deactivate ──────────────────────────────────────────────

  describe('deactivate', () => {
    it('should soft-deactivate a clinic', async () => {
      mockPrisma.clinic.findUnique.mockResolvedValue(clinicRow);

      const result = await service.deactivate('clinic-1', actor);

      expect(result.success).toBe(true);
      expect(mockPrisma.clinic.update).toHaveBeenCalledWith({
        where: { id: 'clinic-1' },
        data: { isActive: false },
      });
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CLINIC_DEACTIVATED' }),
      );
    });

    it('should throw NotFoundException when missing', async () => {
      mockPrisma.clinic.findUnique.mockResolvedValue(null);

      await expect(service.deactivate('missing', actor)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
