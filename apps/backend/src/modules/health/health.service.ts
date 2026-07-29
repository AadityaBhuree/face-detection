import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { OpenTelemetryService } from '../opentelemetry/opentelemetry.service';
import { Redis } from 'ioredis';
import { QdrantClient } from '@qdrant/js-client-rest';

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

interface CheckResult {
  status: 'healthy' | 'unhealthy';
  latencyMs: number;
  error?: string;
}

@Injectable()
export class HealthService {
  private readonly startupTime: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly otel: OpenTelemetryService,
  ) {
    this.startupTime = Date.now();
  }

  /** Simple liveness — always returns healthy if the process is running */
  getLiveness(): { status: string; uptimeMs: number; timestamp: string } {
    return this.otel.withSpanSync('health.get-liveness', () => ({
      status: 'alive',
      uptimeMs: Date.now() - this.startupTime,
      timestamp: new Date().toISOString(),
    }));
  }

  /** Detailed readiness — checks all critical dependencies in parallel */
  async getReadiness(): Promise<HealthCheckResult> {
    return this.otel.withSpan('health.get-readiness', async () => {
      const [database, redis, qdrant] = await Promise.all([
        this.checkDatabase(),
        this.checkRedis(),
        this.checkQdrant(),
      ]);

      const checks: HealthCheckResult['checks'] = {
        database,
        redis,
        qdrant,
      };

      const allHealthy = Object.values(checks).every((c) => c.status === 'healthy');

      return {
        status: allHealthy ? 'healthy' : 'unhealthy',
        checks,
        timestamp: new Date().toISOString(),
      };
    });
  }

  /** Overall health — same as readiness but with a simpler response */
  async getHealth(): Promise<{
    status: string;
    uptimeMs: number;
    dependencies: string;
    timestamp: string;
  }> {
    return this.otel.withSpan('health.get-health', async () => {
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
    });
  }

  // ─── Individual Check Methods ──────────────────────────────────

  private async checkDatabase(): Promise<CheckResult> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'healthy', latencyMs: Date.now() - start };
    } catch (error) {
      return {
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Database connection failed',
      };
    }
  }

  private async checkRedis(): Promise<CheckResult> {
    const redisUrl = this.configService.get<string>('redis.url');
    if (!redisUrl) {
      return { status: 'unhealthy', latencyMs: 0, error: 'Redis URL not configured' };
    }

    const start = Date.now();
    try {
      const redis = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
      });

      const pingResult = await Promise.race([
        redis.ping(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Redis ping timed out after 3s')), 3_000).unref(),
        ),
      ]);

      await redis.quit();

      return {
        status: pingResult === 'PONG' ? 'healthy' : 'unhealthy',
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Redis connection failed',
      };
    }
  }

  private async checkQdrant(): Promise<CheckResult> {
    const qdrantUrl = this.configService.get<string>('qdrant.url');
    if (!qdrantUrl) {
      return { status: 'unhealthy', latencyMs: 0, error: 'Qdrant URL not configured' };
    }

    const start = Date.now();
    try {
      const qdrant = new QdrantClient({
        url: qdrantUrl,
        apiKey: this.configService.get<string>('qdrant.apiKey') || undefined,
      });

      await Promise.race([
        qdrant.getCollections(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Qdrant request timed out after 3s')), 3_000).unref(),
        ),
      ]);

      return {
        status: 'healthy',
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Qdrant connection failed',
      };
    }
  }
}
