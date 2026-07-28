import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  checks: Record<
    string,
    {
      status: 'healthy' | 'unhealthy';
      latencyMs: number;
      error?: string;
    }
  >;
  timestamp: string;
}

@Injectable()
export class HealthService {
  private readonly startupTime: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.startupTime = Date.now();
  }

  /** Simple liveness — always returns healthy if the process is running */
  getLiveness(): { status: string; uptimeMs: number; timestamp: string } {
    return {
      status: 'alive',
      uptimeMs: Date.now() - this.startupTime,
      timestamp: new Date().toISOString(),
    };
  }

  /** Detailed readiness — checks all critical dependencies */
  async getReadiness(): Promise<HealthCheckResult> {
    const checks: HealthCheckResult['checks'] = {};

    // ─── Database (Prisma/PostgreSQL) ──────────────────────────
    const dbStart = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = {
        status: 'healthy',
        latencyMs: Date.now() - dbStart,
      };
    } catch (error) {
      checks.database = {
        status: 'unhealthy',
        latencyMs: Date.now() - dbStart,
        error: error instanceof Error ? error.message : 'Database connection failed',
      };
    }

    // ─── Redis ─────────────────────────────────────────────────
    const redisUrl = this.configService.get<string>('redis.url');
    if (redisUrl) {
      const redisStart = Date.now();
      try {
        // Dynamic import to avoid crash if ioredis is not installed
        const { Redis } = await import('ioredis');
        const redis = new Redis(redisUrl, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          retryStrategy: () => null,
        });

        // Set a timeout via Promise.race to avoid hanging
        const pingResult = await Promise.race([
          redis.ping(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Redis ping timed out after 3s')), 3_000).unref(),
          ),
        ]);

        await redis.quit();

        checks.redis = {
          status: pingResult === 'PONG' ? 'healthy' : 'unhealthy',
          latencyMs: Date.now() - redisStart,
        };
      } catch (error) {
        checks.redis = {
          status: 'unhealthy',
          latencyMs: Date.now() - redisStart,
          error: error instanceof Error ? error.message : 'Redis connection failed',
        };
      }
    } else {
      checks.redis = {
        status: 'unhealthy',
        latencyMs: 0,
        error: 'Redis URL not configured',
      };
    }

    // ─── Qdrant ────────────────────────────────────────────────
    const qdrantUrl = this.configService.get<string>('qdrant.url');
    if (qdrantUrl) {
      const qdrantStart = Date.now();
      try {
        const { QdrantClient } = await import('@qdrant/js-client-rest');
        const qdrant = new QdrantClient({
          url: qdrantUrl,
          apiKey: this.configService.get<string>('qdrant.apiKey') || undefined,
        });

        await Promise.race([
          qdrant.getCollections(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Qdrant ping timed out after 3s')), 3_000).unref(),
          ),
        ]);

        checks.qdrant = {
          status: 'healthy',
          latencyMs: Date.now() - qdrantStart,
        };
      } catch (error) {
        checks.qdrant = {
          status: 'unhealthy',
          latencyMs: Date.now() - qdrantStart,
          error: error instanceof Error ? error.message : 'Qdrant connection failed',
        };
      }
    } else {
      checks.qdrant = {
        status: 'unhealthy',
        latencyMs: 0,
        error: 'Qdrant URL not configured',
      };
    }

    const allHealthy = Object.values(checks).every((c) => c.status === 'healthy');

    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  /** Overall health — same as readiness but with a simpler response */
  async getHealth(): Promise<{ status: string; uptimeMs: number; dependencies: string; timestamp: string }> {
    const readiness = await this.getReadiness();

    const healthyCount = Object.values(readiness.checks).filter(
      (c) => c.status === 'healthy',
    ).length;
    const totalCount = Object.keys(readiness.checks).length;

    return {
      status: readiness.status,
      uptimeMs: Date.now() - this.startupTime,
      dependencies: `${healthyCount}/${totalCount} healthy`,
      timestamp: readiness.timestamp,
    };
  }
}
