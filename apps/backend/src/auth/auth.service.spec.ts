import { Test, type TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../modules/audit/audit.service';

// bcryptjs exports a frozen module — mock it instead of spying.
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$2a$10$hashedpassword1234567890abcdefghijklmnop'),
  compare: jest.fn().mockResolvedValue(true),
}));

// ─── Mocks ─────────────────────────────────────────────────────

const mockPrisma = {
  clinicUser: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  refreshToken: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
};

const mockJwtService = {
  signAsync: jest.fn(),
  verifyAsync: jest.fn(),
};

const mockAuditService = {
  log: jest.fn().mockResolvedValue(undefined),
};

// ─── Test Data ─────────────────────────────────────────────────

const mockUser = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'doctor@ayutalk.com',
  name: 'Dr. Priya Sharma',
  passwordHash: '$2a$10$hashedpassword1234567890abcdefghijklmnop',
  role: 'DOCTOR',
  clinicId: 'clinic-001',
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const registerInput = {
  name: 'Dr. Priya Sharma',
  email: 'doctor@ayutalk.com',
  password: 'StrongPass123',
};

const loginInput = {
  email: 'doctor@ayutalk.com',
  password: 'StrongPass123',
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: unknown) => {
              const config: Record<string, string> = {
                'jwt.secret': 'test-secret-key',
                'jwt.refreshSecret': 'test-refresh-secret-key',
                'jwt.expiration': '24h',
              };
              return config[key] ?? fallback;
            }),
          },
        },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ─── Register ────────────────────────────────────────────────

  describe('register', () => {
    it('should create a user with a hashed password (never plaintext)', async () => {
      mockPrisma.clinicUser.findUnique.mockResolvedValue(null);
      mockPrisma.clinicUser.create.mockResolvedValue(mockUser);

      const result = await service.register(registerInput);

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        role: mockUser.role,
        clinicId: mockUser.clinicId,
      });
      // passwordHash must never be returned
      expect(result).not.toHaveProperty('passwordHash');

      const createCall = mockPrisma.clinicUser.create.mock.calls[0][0];
      expect(createCall.data.email).toBe('doctor@ayutalk.com');
      expect(createCall.data.passwordHash).not.toBe('StrongPass123');
      expect(createCall.data.passwordHash).toMatch(/^\$2[aby]\$/);
    });

    it('should always create RECEPTIONIST accounts (no privilege escalation)', async () => {
      mockPrisma.clinicUser.findUnique.mockResolvedValue(null);
      mockPrisma.clinicUser.create.mockResolvedValue(mockUser);

      // Even if a role/clinicId were somehow passed, they are ignored
      await service.register(
        registerInput as typeof registerInput & {
          role: string;
          clinicId: string;
        },
      );

      const createCall = mockPrisma.clinicUser.create.mock.calls[0][0];
      expect(createCall.data.role).toBe('RECEPTIONIST');
      expect(createCall.data.clinicId).toBeNull();
    });

    it('should reject duplicate email with ConflictException', async () => {
      mockPrisma.clinicUser.findUnique.mockResolvedValue(mockUser);

      await expect(service.register(registerInput)).rejects.toThrow(ConflictException);
      expect(mockPrisma.clinicUser.create).not.toHaveBeenCalled();
    });

    it('should lowercase the email before checking and storing', async () => {
      mockPrisma.clinicUser.findUnique.mockResolvedValue(null);
      mockPrisma.clinicUser.create.mockResolvedValue(mockUser);

      await service.register({ ...registerInput, email: 'DOCTOR@AYUTALK.COM' });

      expect(mockPrisma.clinicUser.findUnique).toHaveBeenCalledWith({
        where: { email: 'doctor@ayutalk.com' },
      });
    });

    it('should audit the registration event', async () => {
      mockPrisma.clinicUser.findUnique.mockResolvedValue(null);
      mockPrisma.clinicUser.create.mockResolvedValue(mockUser);

      await service.register(registerInput);

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'AUTH_USER_REGISTERED',
          resourceId: mockUser.id,
        }),
      );
    });
  });

  // ─── Login ───────────────────────────────────────────────────

  describe('login', () => {
    it('should return user + token pair on valid credentials', async () => {
      mockPrisma.clinicUser.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.signAsync
        .mockResolvedValueOnce('access-token-123')
        .mockResolvedValueOnce('refresh-token-456');
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' });
      mockPrisma.clinicUser.update.mockResolvedValue(mockUser);

      const result = await service.login(loginInput);

      expect(result.user.email).toBe('doctor@ayutalk.com');
      expect(result.accessToken).toBe('access-token-123');
      expect(result.refreshToken).toBe('refresh-token-456');
      expect(result.expiresIn).toBe(86400);
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw UnauthorizedException for unknown email', async () => {
      mockPrisma.clinicUser.findUnique.mockResolvedValue(null);

      await expect(service.login(loginInput)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      mockPrisma.clinicUser.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginInput)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for deactivated account', async () => {
      mockPrisma.clinicUser.findUnique.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      await expect(service.login(loginInput)).rejects.toThrow(UnauthorizedException);
    });

    it('should update lastLoginAt on successful login', async () => {
      mockPrisma.clinicUser.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.signAsync.mockResolvedValueOnce('access').mockResolvedValueOnce('refresh');
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' });
      mockPrisma.clinicUser.update.mockResolvedValue(mockUser);

      await service.login(loginInput);

      expect(mockPrisma.clinicUser.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { lastLoginAt: expect.any(Date) },
      });
    });
  });

  // ─── Refresh ─────────────────────────────────────────────────

  describe('refresh', () => {
    const refreshToken = 'refresh-token-456';
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');

    it('should rotate the token and issue a new pair', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: mockUser.id,
        email: mockUser.email,
        role: 'DOCTOR',
        type: 'refresh',
      });
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        tokenHash,
        userId: mockUser.id,
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
      });
      mockPrisma.clinicUser.findUnique.mockResolvedValue(mockUser);
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
      mockJwtService.signAsync
        .mockResolvedValueOnce('new-access')
        .mockResolvedValueOnce('new-refresh');
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 'rt-2' });

      const result = await service.refresh(refreshToken);

      expect(result.accessToken).toBe('new-access');
      expect(result.refreshToken).toBe('new-refresh');
      // Old token revoked atomically (rotation + reuse protection)
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should reject a replayed (already-consumed) refresh token', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: mockUser.id,
        email: mockUser.email,
        role: 'DOCTOR',
        type: 'refresh',
      });
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        tokenHash,
        userId: mockUser.id,
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
      });
      mockPrisma.clinicUser.findUnique.mockResolvedValue(mockUser);
      // Another request already consumed this token
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.refresh(refreshToken)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject an invalid/expired refresh token', async () => {
      mockJwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await expect(service.refresh(refreshToken)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject a token that is not of type refresh', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: mockUser.id,
        email: mockUser.email,
        role: 'DOCTOR',
        type: 'access',
      });

      await expect(service.refresh(refreshToken)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject a revoked refresh token', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: mockUser.id,
        email: mockUser.email,
        role: 'DOCTOR',
        type: 'refresh',
      });
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        tokenHash,
        userId: mockUser.id,
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: new Date(),
      });

      await expect(service.refresh(refreshToken)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject an expired stored token', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: mockUser.id,
        email: mockUser.email,
        role: 'DOCTOR',
        type: 'refresh',
      });
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        tokenHash,
        userId: mockUser.id,
        expiresAt: new Date(Date.now() - 1000),
        revokedAt: null,
      });

      await expect(service.refresh(refreshToken)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject refresh for a deactivated user', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: mockUser.id,
        email: mockUser.email,
        role: 'DOCTOR',
        type: 'refresh',
      });
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        tokenHash,
        userId: mockUser.id,
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
      });
      mockPrisma.clinicUser.findUnique.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      await expect(service.refresh(refreshToken)).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── Profile ─────────────────────────────────────────────────

  describe('getProfile', () => {
    it('should return the sanitized user profile', async () => {
      mockPrisma.clinicUser.findUnique.mockResolvedValue(mockUser);

      const result = await service.getProfile(mockUser.id);

      expect(result.email).toBe('doctor@ayutalk.com');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw UnauthorizedException when user does not exist', async () => {
      mockPrisma.clinicUser.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('550e8400-e29b-41d4-a716-446655440999')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ─── Logout ──────────────────────────────────────────────────

  describe('logout', () => {
    it('should revoke all active refresh tokens for the user', async () => {
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.logout(mockUser.id);

      expect(result).toEqual({ success: true });
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
