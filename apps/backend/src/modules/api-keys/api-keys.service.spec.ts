/* eslint-disable @typescript-eslint/no-explicit-any -- test mocks */

import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ApiKeyService } from './api-keys.service';

// ─── Mocks ─────────────────────────────────────────────────────

const mockAuditService = {
  log: jest.fn().mockResolvedValue(undefined),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = {
  apiKey: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
} as any;

const actor = { id: 'user-1', role: 'ADMIN' };

describe('ApiKeyService', () => {
  let service: ApiKeyService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ApiKeyService(mockPrisma, mockAuditService as any);
  });

  // ─── generate ────────────────────────────────────────────────

  describe('generate', () => {
    it('should create a key with a SHA-256 hash and jk_ prefix, returning the raw key once', async () => {
      mockPrisma.apiKey.create.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) => ({
          id: 'key-1',
          ...data,
          createdAt: new Date(),
        }),
      );

      const result = await service.generate({ name: 'pms-integration' }, actor);

      expect(result.apiKey).toMatch(/^jk_[A-Za-z0-9_-]+$/);
      expect(result.id).toBe('key-1');
      expect(result.name).toBe('pms-integration');

      const created = mockPrisma.apiKey.create.mock.calls[0]![0].data;
      // The stored hash covers the FULL key (prefix included) — what the
      // integrator sends must match what validateKey hashes.
      expect(created.keyHash).toBe(createHash('sha256').update(result.apiKey).digest('hex'));
      expect(created.prefix).toBe(result.apiKey.slice(0, 15));
      expect(created.expiresAt).toBeNull();
    });

    it('should set expiresAt when expiresInDays is provided', async () => {
      mockPrisma.apiKey.create.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) => ({
          id: 'key-1',
          ...data,
          createdAt: new Date(),
        }),
      );

      await service.generate({ name: 'short-lived', expiresInDays: 30 }, actor);

      const created = mockPrisma.apiKey.create.mock.calls[0]![0].data;
      expect(created.expiresAt).toBeInstanceOf(Date);
      const diffMs = created.expiresAt.getTime() - Date.now();
      expect(diffMs).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
      expect(diffMs).toBeLessThan(31 * 24 * 60 * 60 * 1000);
    });

    it('should audit key creation', async () => {
      mockPrisma.apiKey.create.mockResolvedValue({
        id: 'key-1',
        name: 'x',
        prefix: 'jk_test',
        clinicId: null,
        createdAt: new Date(),
      });

      await service.generate({ name: 'x' }, actor);

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'API_KEY_CREATED',
          actorId: 'user-1',
          resourceType: 'api_key',
        }),
      );
    });
  });

  // ─── list ────────────────────────────────────────────────────

  describe('list', () => {
    it('should return metadata rows ordered by createdAt desc', async () => {
      const rows = [
        { id: 'k1', name: 'a', prefix: 'jk_a', clinicId: null },
        { id: 'k2', name: 'b', prefix: 'jk_b', clinicId: null },
      ];
      mockPrisma.apiKey.findMany.mockResolvedValue(rows);

      const result = await service.list();

      expect(result).toEqual(rows);
      expect(mockPrisma.apiKey.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });
  });

  // ─── revoke ──────────────────────────────────────────────────

  describe('revoke', () => {
    it('should revoke an existing key (soft)', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue({ id: 'k1', prefix: 'jk_a' });

      const result = await service.revoke('k1', actor);

      expect(result.success).toBe(true);
      expect(mockPrisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'k1' },
        data: expect.objectContaining({ revokedAt: expect.any(Date), isActive: false }),
      });
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'API_KEY_REVOKED' }),
      );
    });

    it('should throw NotFoundException for an unknown key', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue(null);

      await expect(service.revoke('missing', actor)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ─── validateKey ─────────────────────────────────────────────

  describe('validateKey', () => {
    const rawKey = 'jk_validkey1234567890';
    const hash = createHash('sha256').update(rawKey).digest('hex');

    it('should return key metadata and touch lastUsedAt for a valid key', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue({
        id: 'k1',
        name: 'pms',
        prefix: 'jk_valid',
        clinicId: null,
        isActive: true,
        revokedAt: null,
        expiresAt: null,
      });
      mockPrisma.apiKey.update.mockResolvedValue({});

      const result = await service.validateKey(rawKey);

      expect(result).toEqual({
        id: 'k1',
        name: 'pms',
        prefix: 'jk_valid',
        clinicId: null,
      });
      expect(mockPrisma.apiKey.findUnique).toHaveBeenCalledWith({
        where: { keyHash: hash },
      });
      expect(mockPrisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'k1' },
        data: { lastUsedAt: expect.any(Date) },
      });
    });

    it('should reject an unknown key', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue(null);

      await expect(service.validateKey('nope')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('should reject a revoked key', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue({
        id: 'k1',
        isActive: false,
        revokedAt: new Date(),
        expiresAt: null,
      });

      await expect(service.validateKey(rawKey)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('should not throw when the lastUsedAt update fails (best-effort)', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue({
        id: 'k1',
        isActive: true,
        revokedAt: null,
        expiresAt: null,
      });
      mockPrisma.apiKey.update.mockRejectedValue(new Error('db down'));

      await expect(service.validateKey(rawKey)).resolves.toEqual(
        expect.objectContaining({ id: 'k1' }),
      );
    });

    it('should reject an expired key', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue({
        id: 'k1',
        isActive: true,
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.validateKey(rawKey)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
