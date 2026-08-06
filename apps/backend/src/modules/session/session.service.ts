import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime value import
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime value import
import { PrismaService } from '../../prisma/prisma.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime value import
import { MetricsService } from '../opentelemetry/metrics.service';
import { Redis } from 'ioredis';
import type { SessionStatus } from '@jeevandata/shared-types';

const VALID_TRANSITIONS: Record<string, string[]> = {
  INITIATED: ['FACE_MATCHED', 'FAILED', 'TIMED_OUT'],
  FACE_MATCHED: ['CONTEXT_LOADED', 'FAILED', 'TIMED_OUT'],
  CONTEXT_LOADED: ['INTAKE_IN_PROGRESS', 'FAILED', 'TIMED_OUT'],
  INTAKE_IN_PROGRESS: ['TRANSCRIBING', 'FAILED', 'TIMED_OUT'],
  TRANSCRIBING: ['BRIEF_GENERATED', 'FAILED', 'TIMED_OUT'],
  BRIEF_GENERATED: ['SYNCED', 'FAILED', 'TIMED_OUT'],
  SYNCED: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  FAILED: [],
  TIMED_OUT: [],
};

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly metrics: MetricsService,
  ) {
    this.redis = new Redis(this.configService.get<string>('redis.url')!);
  }

  async updateStatus(sessionId: string, newStatus: SessionStatus): Promise<void> {
    const session = await this.prisma.intakeSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    const allowedTransitions = VALID_TRANSITIONS[session.status];
    if (!allowedTransitions?.includes(newStatus)) {
      throw new BadRequestException(`Invalid state transition: ${session.status} → ${newStatus}`);
    }

    await this.prisma.intakeSession.update({
      where: { id: sessionId },
      data: {
        status: newStatus,
        ...(newStatus === 'COMPLETED' ? { endedAt: new Date() } : {}),
      },
    });

    await this.redis.set(`session:${sessionId}:status`, newStatus, 'EX', 900);

    // Track timeouts for the session-timeout-rate alert (Phase 6.8).
    if (newStatus === 'TIMED_OUT') {
      this.metrics.incrementSessionTimeouts();
    }

    this.logger.debug(`Session ${sessionId} status: ${session.status} → ${newStatus}`);
  }

  async getCachedStatus(sessionId: string): Promise<string | null> {
    return this.redis.get(`session:${sessionId}:status`);
  }

  async cachePatientContext(sessionId: string, context: Record<string, unknown>): Promise<void> {
    await this.redis.setex(`session:${sessionId}:context`, 900, JSON.stringify(context));
  }

  async getCachedPatientContext(sessionId: string): Promise<Record<string, unknown> | null> {
    const cached = await this.redis.get(`session:${sessionId}:context`);
    return cached ? JSON.parse(cached) : null;
  }

  async handleInactivityTimeout(sessionId: string): Promise<void> {
    const timeoutMs = this.configService.get<number>('session.inactivityTimeoutMs', 600000);
    const session = await this.prisma.intakeSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.status === 'COMPLETED' || session.status === 'FAILED') {
      return;
    }

    const inactiveDuration = Date.now() - new Date(session.updatedAt).getTime();
    if (inactiveDuration >= timeoutMs) {
      await this.updateStatus(sessionId, 'TIMED_OUT' as SessionStatus);
      this.logger.warn(`Session ${sessionId} timed out due to inactivity`);
    }
  }
}
