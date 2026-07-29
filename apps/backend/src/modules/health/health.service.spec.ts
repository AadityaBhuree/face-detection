import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthService } from './health.service';
import { PrismaService } from '../../prisma/prisma.service';
import { OpenTelemetryService } from '../opentelemetry/opentelemetry.service';

// ─── Mocks ─────────────────────────────────────────────────────

const mockPrisma = {
  $queryRaw: jest.fn(),
};

const mockOpenTelemetryService = {
  withSpan: jest.fn().mockImplementation(async (_name: string, fn: () => Promise<unknown>) => fn()),
  withSpanSync: jest.fn().mockImplementation((_name: string, fn: () => unknown) => fn()),
};

const mockRedisInstance = {
  ping: jest.fn().mockResolvedValue('PONG'),
  quit: jest.fn().mockResolvedValue('OK'),
  on: jest.fn(),
  connect: jest.fn(),
};

jest.mock('ioredis', () => ({
  Redis: jest.fn(() => mockRedisInstance),
}));

const mockQdrantInstance = {
  getCollections: jest.fn().mockResolvedValue({ collections: [] }),
};

jest.mock('@qdrant/js-client-rest', () => ({
  QdrantClient: jest.fn(() => mockQdrantInstance),
}));

describe('HealthService', () => {
  let service: HealthService;

  const mockConfig: Record<string, unknown> = {
    'redis.url': 'redis://localhost:6379',
    'qdrant.url': 'http://localhost:6333',
    'qdrant.apiKey': '',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Reset singleton mock implementations (clearAllMocks doesn't undo mockRejectedValue)
    mockRedisInstance.ping.mockResolvedValue('PONG');
    mockRedisInstance.quit.mockResolvedValue('OK');
    mockQdrantInstance.getCollections.mockResolvedValue({ collections: [] });

    // Reset config to defaults
    mockConfig['redis.url'] = 'redis://localhost:6379';
    mockConfig['qdrant.url'] = 'http://localhost:6333';
    mockConfig['qdrant.apiKey'] = '';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => mockConfig[key]),
          },
        },
        { provide: OpenTelemetryService, useValue: mockOpenTelemetryService },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  // ─── Liveness ─────────────────────────────────────────────

  describe('getLiveness', () => {
    it('should return alive status with uptime and timestamp', () => {
      const result = service.getLiveness();

      expect(result).toHaveProperty('status', 'alive');
      expect(result).toHaveProperty('uptimeMs');
      expect(typeof result.uptimeMs).toBe('number');
      expect(result.uptimeMs).toBeGreaterThanOrEqual(0);
      expect(result).toHaveProperty('timestamp');
      expect(typeof result.timestamp).toBe('string');
    });

    it('should return increasing uptime on subsequent calls', () => {
      const first = service.getLiveness();
      const second = service.getLiveness();

      expect(second.uptimeMs).toBeGreaterThanOrEqual(first.uptimeMs);
    });

    it('should return a valid ISO timestamp', () => {
      const result = service.getLiveness();
      const timestamp = new Date(result.timestamp);
      expect(timestamp.getTime()).toBeGreaterThan(0);
    });
  });

  // ─── Readiness ────────────────────────────────────────────

  describe('getReadiness', () => {
    it('should return healthy when all dependencies are up', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);

      const mockRedis = jest.requireMock('ioredis').Redis;
      const mockRedisInstance = mockRedis();
      mockRedisInstance.ping.mockResolvedValue('PONG');
      mockRedisInstance.quit.mockResolvedValue('OK');

      const mockQdrant = jest.requireMock('@qdrant/js-client-rest').QdrantClient;
      const mockQdrantInstance = mockQdrant();
      mockQdrantInstance.getCollections.mockResolvedValue({ collections: [] });

      const result = await service.getReadiness();

      expect(result.status).toBe('healthy');
      expect(result.checks).toHaveProperty('database');
      expect(result.checks).toHaveProperty('redis');
      expect(result.checks).toHaveProperty('qdrant');
      expect(result.checks.database!.status).toBe('healthy');
      expect(result.checks.redis!.status).toBe('healthy');
      expect(result.checks.qdrant!.status).toBe('healthy');
      expect(result.checks.database!.latencyMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.timestamp).toBe('string');
    });

    it('should return unhealthy when database fails', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));

      const mockRedis = jest.requireMock('ioredis').Redis;
      const mockRedisInstance = mockRedis();
      mockRedisInstance.ping.mockResolvedValue('PONG');
      mockRedisInstance.quit.mockResolvedValue('OK');

      const mockQdrant = jest.requireMock('@qdrant/js-client-rest').QdrantClient;
      const mockQdrantInstance = mockQdrant();
      mockQdrantInstance.getCollections.mockResolvedValue({ collections: [] });

      const result = await service.getReadiness();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.database!.status).toBe('unhealthy');
      expect(result.checks.database!.error).toBe('Connection refused');
      expect(result.checks.redis!.status).toBe('healthy');
      expect(result.checks.qdrant!.status).toBe('healthy');
    });

    it('should return unhealthy when Redis ping fails', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);

      const mockRedis = jest.requireMock('ioredis').Redis;
      const mockRedisInstance = mockRedis();
      mockRedisInstance.ping.mockRejectedValue(new Error('Connection refused'));
      mockRedisInstance.quit.mockResolvedValue('OK');

      const mockQdrant = jest.requireMock('@qdrant/js-client-rest').QdrantClient;
      const mockQdrantInstance = mockQdrant();
      mockQdrantInstance.getCollections.mockResolvedValue({ collections: [] });

      const result = await service.getReadiness();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.database!.status).toBe('healthy');
      expect(result.checks.redis!.status).toBe('unhealthy');
      expect(result.checks.redis!.error).toBeDefined();
      expect(result.checks.qdrant!.status).toBe('healthy');
    });

    it('should return unhealthy when Qdrant fails', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);

      const mockRedis = jest.requireMock('ioredis').Redis;
      const mockRedisInstance = mockRedis();
      mockRedisInstance.ping.mockResolvedValue('PONG');
      mockRedisInstance.quit.mockResolvedValue('OK');

      const mockQdrant = jest.requireMock('@qdrant/js-client-rest').QdrantClient;
      const mockQdrantInstance = mockQdrant();
      mockQdrantInstance.getCollections.mockRejectedValue(new Error('Connection refused'));

      const result = await service.getReadiness();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.database!.status).toBe('healthy');
      expect(result.checks.redis!.status).toBe('healthy');
      expect(result.checks.qdrant!.status).toBe('unhealthy');
      expect(result.checks.qdrant!.error).toBe('Connection refused');
    });

    it('should return unhealthy when Redis URL is not configured', async () => {
      mockConfig['redis.url'] = '';
      mockPrisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);

      const mockQdrant = jest.requireMock('@qdrant/js-client-rest').QdrantClient;
      const mockQdrantInstance = mockQdrant();
      mockQdrantInstance.getCollections.mockResolvedValue({ collections: [] });

      const result = await service.getReadiness();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.database!.status).toBe('healthy');
      expect(result.checks.redis!.status).toBe('unhealthy');
      expect(result.checks.redis!.error).toBe('Redis URL not configured');
      expect(result.checks.qdrant!.status).toBe('healthy');
    });

    it('should include latencyMs for each check', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);

      const mockRedis = jest.requireMock('ioredis').Redis;
      const mockRedisInstance = mockRedis();
      mockRedisInstance.ping.mockResolvedValue('PONG');
      mockRedisInstance.quit.mockResolvedValue('OK');

      const mockQdrant = jest.requireMock('@qdrant/js-client-rest').QdrantClient;
      const mockQdrantInstance = mockQdrant();
      mockQdrantInstance.getCollections.mockResolvedValue({ collections: [] });

      const result = await service.getReadiness();

      expect(result.checks.database!.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.checks.redis!.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.checks.qdrant!.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should include database error details on failure', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Timeout'));

      const mockRedis = jest.requireMock('ioredis').Redis;
      const mockRedisInstance = mockRedis();
      mockRedisInstance.ping.mockResolvedValue('PONG');
      mockRedisInstance.quit.mockResolvedValue('OK');

      const mockQdrant = jest.requireMock('@qdrant/js-client-rest').QdrantClient;
      const mockQdrantInstance = mockQdrant();
      mockQdrantInstance.getCollections.mockResolvedValue({ collections: [] });

      const result = await service.getReadiness();

      expect(result.checks.database!.error).toBe('Timeout');
    });
  });

  // ─── Health ───────────────────────────────────────────────

  describe('getHealth', () => {
    it('should return healthy summary when all deps are healthy', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);

      const mockRedis = jest.requireMock('ioredis').Redis;
      const mockRedisInstance = mockRedis();
      mockRedisInstance.ping.mockResolvedValue('PONG');
      mockRedisInstance.quit.mockResolvedValue('OK');

      const mockQdrant = jest.requireMock('@qdrant/js-client-rest').QdrantClient;
      const mockQdrantInstance = mockQdrant();
      mockQdrantInstance.getCollections.mockResolvedValue({ collections: [] });

      const result = await service.getHealth();

      expect(result.status).toBe('healthy');
      expect(result.dependencies).toBe('3/3 healthy');
      expect(result.uptimeMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.timestamp).toBe('string');
    });

    it('should return unhealthy summary with partial dependency count', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Down'));
      mockConfig['redis.url'] = '';

      const mockQdrant = jest.requireMock('@qdrant/js-client-rest').QdrantClient;
      const mockQdrantInstance = mockQdrant();
      mockQdrantInstance.getCollections.mockResolvedValue({ collections: [] });

      const result = await service.getHealth();

      expect(result.status).toBe('unhealthy');
      expect(result.dependencies).toBe('1/3 healthy');
    });

    it('should report 0/3 when all dependencies are down', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Down'));
      mockConfig['redis.url'] = '';

      const mockQdrant = jest.requireMock('@qdrant/js-client-rest').QdrantClient;
      const mockQdrantInstance = mockQdrant();
      mockQdrantInstance.getCollections.mockRejectedValue(new Error('Down'));

      const result = await service.getHealth();

      expect(result.status).toBe('unhealthy');
      expect(result.dependencies).toBe('0/3 healthy');
    });

    it('should preserve readiness timestamp in health result', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);

      const mockRedis = jest.requireMock('ioredis').Redis;
      const mockRedisInstance = mockRedis();
      mockRedisInstance.ping.mockResolvedValue('PONG');
      mockRedisInstance.quit.mockResolvedValue('OK');

      const mockQdrant = jest.requireMock('@qdrant/js-client-rest').QdrantClient;
      const mockQdrantInstance = mockQdrant();
      mockQdrantInstance.getCollections.mockResolvedValue({ collections: [] });

      const result = await service.getHealth();
      const parsed = new Date(result.timestamp);
      expect(parsed.getTime()).toBeGreaterThan(0);
    });
  });
});
