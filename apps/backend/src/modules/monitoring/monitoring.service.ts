import { Injectable } from '@nestjs/common';
// NOTE: these must stay VALUE imports — NestJS DI resolves constructor
// params via emitDecoratorMetadata at runtime.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../../prisma/prisma.service';
import {
  MetricsService,
  type LatencySnapshot,
  type MonitoredAlert,
} from '../opentelemetry/metrics.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */

const TIMEOUT_RATE_THRESHOLD = 0.05; // 5%
const TIMEOUT_WINDOW_HOURS = 24;
const MIN_TIMEOUT_SESSIONS = 10; // minimum sessions before the timeout-rate alert is meaningful

/**
 * MonitoringService — serves the admin latency panel and evaluates the
 * Phase 6.8 alert thresholds:
 *   • HTTP error rate (5xx) > 1%          → critical
 *   • Face match p95 latency > 2s         → warning
 *   • Session timeout rate (24h) > 5%     → warning
 */
@Injectable()
export class MonitoringService {
  constructor(
    private readonly metrics: MetricsService,
    private readonly prisma: PrismaService,
  ) {}

  /** Latency percentiles (p50/p95/p99) for HTTP + Qdrant operations. */
  getLatency(): LatencySnapshot {
    return this.metrics.getLatencySnapshot();
  }

  /** Evaluate all alert thresholds, including the DB-backed timeout rate. */
  async getAlerts(): Promise<MonitoredAlert[]> {
    const alerts = this.metrics.evaluateAlerts();
    const { rate: timeoutRate, count: sessionCount } = await this.computeSessionTimeoutRate();

    return alerts.map((alert) => {
      if (alert.key !== 'session_timeout_rate') return alert;

      // Min-sample guard: a single timed-out session among a handful must
      // not fire a false warning in a low-traffic clinic.
      const flagged = sessionCount >= MIN_TIMEOUT_SESSIONS && timeoutRate > TIMEOUT_RATE_THRESHOLD;
      return {
        ...alert,
        severity: flagged ? 'warning' : 'ok',
        value: Math.round(timeoutRate * 1000) / 10,
        message: flagged
          ? `Session timeout rate ${(timeoutRate * 100).toFixed(1)}% exceeds 5% threshold (last ${TIMEOUT_WINDOW_HOURS}h)`
          : `Session timeout rate is ${(timeoutRate * 100).toFixed(1)}% (≤ 5%)`,
      };
    });
  }

  /**
   * Fraction of intake sessions started in the last 24h that ended in
   * TIMED_OUT. Returns { rate: 0, count: 0 } when there are no sessions
   * in the window.
   */
  private async computeSessionTimeoutRate(): Promise<{ rate: number; count: number }> {
    const since = new Date(Date.now() - TIMEOUT_WINDOW_HOURS * 60 * 60 * 1000);
    const sessions = (await this.prisma.intakeSession.findMany({
      where: { startedAt: { gte: since } },
      select: { status: true },
    })) as Array<{ status: string }>;

    if (sessions.length === 0) return { rate: 0, count: 0 };

    const timedOut = sessions.filter((s) => s.status === 'TIMED_OUT').length;
    return { rate: timedOut / sessions.length, count: sessions.length };
  }
}
