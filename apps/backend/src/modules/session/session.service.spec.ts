import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SessionService } from './session.service';
import { PrismaService } from '../../prisma/prisma.service';

// ─── Mocks ─────────────────────────────────────────────────────

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
};

jest.mock('ioredis', () => ({
  Redis: jest.fn(() => mockRedis),
}));

const mockPrisma = {
  intakeSession: {
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
};

describe('SessionService', () => {
  let service: SessionService;
  let prisma: typeof mockPrisma;
  let configService: ConfigService;

  const mockConfig = {
    'redis.url': 'redis://localhost:6379',
    'session.inactivityTimeoutMs': 600000,
    'session.autoCloseMs': 600000,
  };

  const validSessionId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => mockConfig[key]),
          },
        },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
    prisma = module.get(PrismaService);
    configService = module.get<ConfigService>(ConfigService);
  });

  // ─── FSM: Valid Transitions ─────────────────────────────────

  describe('updateStatus — valid transitions', () => {
    const validTransitions: Array<{ from: string; to: string }> = [
      { from: 'INITIATED', to: 'FACE_MATCHED' },
      { from: 'FACE_MATCHED', to: 'CONTEXT_LOADED' },
      { from: 'CONTEXT_LOADED', to: 'INTAKE_IN_PROGRESS' },
      { from: 'INTAKE_IN_PROGRESS', to: 'TRANSCRIBING' },
      { from: 'TRANSCRIBING', to: 'BRIEF_GENERATED' },
      { from: 'BRIEF_GENERATED', to: 'SYNCED' },
      { from: 'SYNCED', to: 'COMPLETED' },
    ];

    it.each(validTransitions)(
      'should allow transition from $from to $to',
      async ({ from, to }) => {
        mockPrisma.intakeSession.findUnique.mockResolvedValue({
          id: validSessionId,
          status: from,
          updatedAt: new Date(),
        });
        mockPrisma.intakeSession.update.mockResolvedValue({
          id: validSessionId,
          status: to,
        });
        mockRedis.set.mockResolvedValue('OK');

        await expect(
          service.updateStatus(validSessionId, to as any),
        ).resolves.not.toThrow();

        expect(mockPrisma.intakeSession.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: validSessionId },
            data: expect.objectContaining({
              status: to,
            }),
          }),
        );
      },
    );

    it('should set endedAt when transitioning to COMPLETED', async () => {
      mockPrisma.intakeSession.findUnique.mockResolvedValue({
        id: validSessionId,
        status: 'SYNCED',
        updatedAt: new Date(),
      });
      mockPrisma.intakeSession.update.mockResolvedValue({
        id: validSessionId,
        status: 'COMPLETED',
      });

      await service.updateStatus(validSessionId, 'COMPLETED' as any);

      expect(mockPrisma.intakeSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'COMPLETED',
            endedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should cache status in Redis with 900s TTL after update', async () => {
      mockPrisma.intakeSession.findUnique.mockResolvedValue({
        id: validSessionId,
        status: 'INITIATED',
        updatedAt: new Date(),
      });
      mockPrisma.intakeSession.update.mockResolvedValue({
        id: validSessionId,
        status: 'FACE_MATCHED',
      });

      await service.updateStatus(validSessionId, 'FACE_MATCHED' as any);

      expect(mockRedis.set).toHaveBeenCalledWith(
        `session:${validSessionId}:status`,
        'FACE_MATCHED',
        'EX',
        900,
      );
    });
  });

  // ─── FSM: Invalid Transitions ────────────────────────────────

  describe('updateStatus — invalid transitions', () => {
    const invalidTransitions: Array<{ from: string; to: string }> = [
      { from: 'INITIATED', to: 'COMPLETED' },
      { from: 'INITIATED', to: 'BRIEF_GENERATED' },
      { from: 'FACE_MATCHED', to: 'TRANSCRIBING' },
      { from: 'INTAKE_IN_PROGRESS', to: 'FACE_MATCHED' },
      { from: 'COMPLETED', to: 'INITIATED' },
      { from: 'FAILED', to: 'INITIATED' },
      { from: 'TIMED_OUT', to: 'INITIATED' },
    ];

    it.each(invalidTransitions)(
      'should reject transition from $from to $to',
      async ({ from, to }) => {
        mockPrisma.intakeSession.findUnique.mockResolvedValue({
          id: validSessionId,
          status: from,
          updatedAt: new Date(),
        });

        await expect(
          service.updateStatus(validSessionId, to as any),
        ).rejects.toThrow(BadRequestException);

        expect(mockPrisma.intakeSession.update).not.toHaveBeenCalled();
        expect(mockRedis.set).not.toHaveBeenCalled();
      },
    );
  });

  // ─── FSM: Session Not Found ──────────────────────────────────

  describe('updateStatus — session not found', () => {
    it('should throw NotFoundException when session does not exist', async () => {
      mockPrisma.intakeSession.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus(validSessionId, 'FACE_MATCHED' as any),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.intakeSession.update).not.toHaveBeenCalled();
    });
  });

  // ─── Redis Caching ───────────────────────────────────────────

  describe('Redis cache operations', () => {
    describe('getCachedStatus', () => {
      it('should return cached status from Redis', async () => {
        mockRedis.get.mockResolvedValue('INTAKE_IN_PROGRESS');

        const status = await service.getCachedStatus(validSessionId);

        expect(status).toBe('INTAKE_IN_PROGRESS');
        expect(mockRedis.get).toHaveBeenCalledWith(
          `session:${validSessionId}:status`,
        );
      });

      it('should return null when no cached status exists', async () => {
        mockRedis.get.mockResolvedValue(null);

        const status = await service.getCachedStatus(validSessionId);

        expect(status).toBeNull();
      });
    });

    describe('cachePatientContext', () => {
      it('should store patient context in Redis with 15min TTL', async () => {
        mockRedis.setex.mockResolvedValue('OK');

        const context = { name: 'Test Patient', riskFlags: ['flag1'] };
        await service.cachePatientContext(validSessionId, context);

        expect(mockRedis.setex).toHaveBeenCalledWith(
          `session:${validSessionId}:context`,
          900,
          JSON.stringify(context),
        );
      });
    });

    describe('getCachedPatientContext', () => {
      it('should return parsed context from Redis', async () => {
        const context = { name: 'Test Patient' };
        mockRedis.get.mockResolvedValue(JSON.stringify(context));

        const result = await service.getCachedPatientContext(validSessionId);

        expect(result).toEqual(context);
      });

      it('should return null when no cached context exists', async () => {
        mockRedis.get.mockResolvedValue(null);

        const result = await service.getCachedPatientContext(validSessionId);

        expect(result).toBeNull();
      });
    });
  });

  // ─── Inactivity Timeout ──────────────────────────────────────

  describe('handleInactivityTimeout', () => {
    it('should transition to TIMED_OUT when session has been inactive beyond timeout', async () => {
      const oldDate = new Date(Date.now() - 700000); // 11.6 minutes ago
      mockPrisma.intakeSession.findUnique.mockResolvedValue({
        id: validSessionId,
        status: 'INTAKE_IN_PROGRESS',
        updatedAt: oldDate,
      });
      mockPrisma.intakeSession.update.mockResolvedValue({
        id: validSessionId,
        status: 'TIMED_OUT',
      });

      await service.handleInactivityTimeout(validSessionId);

      expect(mockPrisma.intakeSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'TIMED_OUT' }),
        }),
      );
    });

    it('should NOT timeout a session that is still active', async () => {
      const recentDate = new Date(); // now
      mockPrisma.intakeSession.findUnique.mockResolvedValue({
        id: validSessionId,
        status: 'INTAKE_IN_PROGRESS',
        updatedAt: recentDate,
      });

      await service.handleInactivityTimeout(validSessionId);

      expect(mockPrisma.intakeSession.update).not.toHaveBeenCalled();
    });

    it('should NOT timeout a COMPLETED session', async () => {
      mockPrisma.intakeSession.findUnique.mockResolvedValue({
        id: validSessionId,
        status: 'COMPLETED',
        updatedAt: new Date(Date.now() - 9999999),
      });

      await service.handleInactivityTimeout(validSessionId);

      expect(mockPrisma.intakeSession.update).not.toHaveBeenCalled();
    });

    it('should NOT timeout a FAILED session', async () => {
      mockPrisma.intakeSession.findUnique.mockResolvedValue({
        id: validSessionId,
        status: 'FAILED',
        updatedAt: new Date(Date.now() - 9999999),
      });

      await service.handleInactivityTimeout(validSessionId);

      expect(mockPrisma.intakeSession.update).not.toHaveBeenCalled();
    });

    it('should silently return when session does not exist', async () => {
      mockPrisma.intakeSession.findUnique.mockResolvedValue(null);

      await expect(
        service.handleInactivityTimeout(validSessionId),
      ).resolves.not.toThrow();

      expect(mockPrisma.intakeSession.update).not.toHaveBeenCalled();
    });
  });
});
