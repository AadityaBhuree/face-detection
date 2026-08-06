import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

/** Latency percentiles for a monitored operation (milliseconds). */
export interface LatencyPercentiles {
  p50: number;
  p95: number;
  p99: number;
  count: number;
}

/** A single evaluated alert — ok, warning, or critical. */
export interface MonitoredAlert {
  key: string;
  label: string;
  severity: 'ok' | 'warning' | 'critical';
  value: number;
  threshold: number;
  message: string;
}

export interface LatencySnapshot {
  http: LatencyPercentiles;
  qdrant: LatencyPercentiles;
}

// ─── Alert thresholds (Phase 6.8 spec) ────────────────────────
const ERROR_RATE_THRESHOLD = 0.01; // 1%
const FACE_LATENCY_P95_THRESHOLD_MS = 2000; // 2s
const SESSION_TIMEOUT_RATE_THRESHOLD = 0.05; // 5%

const ERROR_WINDOW_MS = 5 * 60 * 1000; // error-rate window: last 5 minutes
const MAX_SAMPLES = 2000; // latency ring buffer cap
const MIN_ERROR_SAMPLES = 20; // minimum requests before the error-rate alert is meaningful
const MIN_LATENCY_SAMPLES = 5; // minimum samples before the latency alert is meaningful

interface OutcomeSample {
  ts: number;
  isError: boolean;
}

/**
 * MetricsService — Prometheus instrumentation for the Jeevandata API.
 *
 * Exposes a Prometheus registry (scraped at GET /metrics) plus in-memory
 * rolling windows used by the MonitoringModule for latency percentiles
 * (p50/p95/p99) and the alert thresholds. Marked @Global via
 * OpenTelemetryModule so any module can inject it.
 */
@Injectable()
export class MetricsService {
  private readonly registry = new Registry();

  // ─── Prometheus metrics ──────────────────────────────────────
  private readonly httpRequestsTotal: Counter<string>;
  private readonly httpRequestDuration: Histogram<string>;
  private readonly httpErrorsTotal: Counter<string>;
  private readonly qdrantLatency: Histogram<string>;
  private readonly faceSearchLatency: Histogram<string>;
  private readonly activeSessions: Gauge<string>;
  private readonly sessionTimeoutsTotal: Counter<string>;

  // ─── In-memory rolling windows (for percentiles + error rate) ─
  private readonly outcomeWindow: OutcomeSample[] = [];
  private readonly httpDurationSamples: number[] = [];
  private readonly qdrantLatencySamples: number[] = [];

  constructor() {
    // Node.js runtime defaults (heap, event loop, GC, CPU) — scoped to our registry.
    collectDefaultMetrics({ register: this.registry });

    this.httpRequestsTotal = new Counter({
      name: 'jeevandata_http_requests_total',
      help: 'Total HTTP requests handled',
      labelNames: ['method', 'route', 'status'] as const,
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'jeevandata_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route'] as const,
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.httpErrorsTotal = new Counter({
      name: 'jeevandata_http_errors_total',
      help: 'Total HTTP 5xx errors handled',
      labelNames: ['method', 'route'] as const,
      registers: [this.registry],
    });

    this.qdrantLatency = new Histogram({
      name: 'jeevandata_qdrant_latency_seconds',
      help: 'Qdrant operation latency in seconds',
      labelNames: ['operation'] as const,
      buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });

    this.faceSearchLatency = new Histogram({
      name: 'jeevandata_face_search_latency_seconds',
      help: 'Face recognition search latency in seconds',
      labelNames: ['operation'] as const,
      buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });

    this.activeSessions = new Gauge({
      name: 'jeevandata_active_sessions',
      help: 'Current number of active intake sessions',
      registers: [this.registry],
    });

    this.sessionTimeoutsTotal = new Counter({
      name: 'jeevandata_session_timeouts_total',
      help: 'Total intake sessions that timed out',
      registers: [this.registry],
    });
  }

  // ─── HTTP request recording ──────────────────────────────────

  /** Record one HTTP request outcome (called by MetricsInterceptor). */
  recordHttpRequest(method: string, route: string, statusCode: number, durationMs: number): void {
    const status = String(statusCode);
    this.httpRequestsTotal.inc({ method, route, status });
    this.httpRequestDuration.observe({ method, route }, durationMs / 1000);

    const isError = statusCode >= 500;
    if (isError) {
      this.httpErrorsTotal.inc({ method, route });
    }

    this.pushSample(this.httpDurationSamples, durationMs);
    this.pushOutcome(isError);
  }

  /** Qdrant / vector search latency (called by FaceService). */
  recordQdrantLatency(operation: string, durationMs: number): void {
    this.qdrantLatency.observe({ operation }, durationMs / 1000);
    this.pushSample(this.qdrantLatencySamples, durationMs);
  }

  /** Face recognition search latency (called by FaceService). */
  recordFaceSearchLatency(operation: string, durationMs: number): void {
    this.faceSearchLatency.observe({ operation }, durationMs / 1000);
  }

  // ─── Session gauges ──────────────────────────────────────────

  setActiveSessions(count: number): void {
    this.activeSessions.set(count);
  }

  incrementSessionTimeouts(): void {
    this.sessionTimeoutsTotal.inc();
  }

  // ─── Aggregations (monitoring endpoints) ─────────────────────

  /** p50/p95/p99 over the recent HTTP + Qdrant latency windows (ms). */
  getLatencySnapshot(): LatencySnapshot {
    return {
      http: this.percentiles(this.httpDurationSamples),
      qdrant: this.percentiles(this.qdrantLatencySamples),
    };
  }

  /** Fraction of 5xx responses within the last 5 minutes (0..1). */
  getErrorRate(): { rate: number; sampleCount: number } {
    const cutoff = Date.now() - ERROR_WINDOW_MS;
    let errors = 0;
    let total = 0;
    for (const sample of this.outcomeWindow) {
      if (sample.ts < cutoff) continue;
      total += 1;
      if (sample.isError) errors += 1;
    }
    return { rate: total === 0 ? 0 : errors / total, sampleCount: total };
  }

  /** Evaluate the Phase 6.8 alert thresholds. */
  evaluateAlerts(): MonitoredAlert[] {
    const { rate: errorRate, sampleCount } = this.getErrorRate();
    const qdrant = this.percentiles(this.qdrantLatencySamples);
    const sessionTimeoutRate = 0; // resolved from DB in MonitoringService

    // Minimum-sample guards: a single 5xx among a handful of requests (or a
    // single slow search) must not fire a false alert in a low-traffic clinic.
    const errorAlertFlagged = sampleCount >= MIN_ERROR_SAMPLES && errorRate > ERROR_RATE_THRESHOLD;
    const latencyAlertFlagged =
      qdrant.count >= MIN_LATENCY_SAMPLES && qdrant.p95 > FACE_LATENCY_P95_THRESHOLD_MS;

    const errorAlert: MonitoredAlert = {
      key: 'http_error_rate',
      label: 'HTTP error rate (5xx, last 5 min)',
      severity: errorAlertFlagged ? 'critical' : 'ok',
      value: Math.round(errorRate * 1000) / 10,
      threshold: ERROR_RATE_THRESHOLD * 100,
      message: errorAlertFlagged
        ? `Error rate ${(errorRate * 100).toFixed(1)}% exceeds ${ERROR_RATE_THRESHOLD * 100}% threshold`
        : 'Error rate is within the 1% threshold',
    };

    const latencyAlert: MonitoredAlert = {
      key: 'face_match_latency',
      label: 'Face match p95 latency',
      severity: latencyAlertFlagged ? 'warning' : 'ok',
      value: Math.round(qdrant.p95),
      threshold: FACE_LATENCY_P95_THRESHOLD_MS,
      message: latencyAlertFlagged
        ? `p95 face-match latency ${Math.round(qdrant.p95)}ms exceeds 2s threshold`
        : `p95 face-match latency is ${Math.round(qdrant.p95)}ms (≤ 2s)`,
    };

    const timeoutAlert: MonitoredAlert = {
      key: 'session_timeout_rate',
      label: 'Session timeout rate (24h)',
      severity: 'ok',
      value: Math.round(sessionTimeoutRate * 1000) / 10,
      threshold: SESSION_TIMEOUT_RATE_THRESHOLD * 100,
      message: 'Session timeout rate resolved from intake sessions',
    };

    return [errorAlert, latencyAlert, timeoutAlert];
  }

  // ─── Prometheus scrape ───────────────────────────────────────

  /** Raw Prometheus exposition text for GET /metrics. */
  async getMetricsText(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Reset all counters, histograms, gauges and rolling windows.
   * Primarily used between E2E tests so state does not leak across
   * assertions.
   */
  reset(): void {
    this.httpRequestsTotal.reset();
    this.httpErrorsTotal.reset();
    this.httpRequestDuration.reset();
    this.qdrantLatency.reset();
    this.faceSearchLatency.reset();
    this.activeSessions.reset();
    this.sessionTimeoutsTotal.reset();
    this.outcomeWindow.length = 0;
    this.httpDurationSamples.length = 0;
    this.qdrantLatencySamples.length = 0;
  }

  get registryInstance(): Registry {
    return this.registry;
  }

  // ─── Internals ───────────────────────────────────────────────

  private pushSample(samples: number[], valueMs: number): void {
    samples.push(valueMs);
    if (samples.length > MAX_SAMPLES) {
      samples.splice(0, samples.length - MAX_SAMPLES);
    }
  }

  private pushOutcome(isError: boolean): void {
    this.outcomeWindow.push({ ts: Date.now(), isError });
    // Opportunistic pruning — drops stale samples outside the 5-min window.
    const cutoff = Date.now() - ERROR_WINDOW_MS;
    while (this.outcomeWindow.length > 0 && this.outcomeWindow[0]!.ts < cutoff) {
      this.outcomeWindow.shift();
    }
    if (this.outcomeWindow.length > MAX_SAMPLES) {
      this.outcomeWindow.splice(0, this.outcomeWindow.length - MAX_SAMPLES);
    }
  }

  /**
   * Nearest-rank percentiles with linear interpolation across the two
   * bracketing samples (standard percentile semantics). Samples are a
   * time-ordered ring buffer of durations; ordering is irrelevant here.
   */
  private percentiles(samples: number[]): LatencyPercentiles {
    if (samples.length === 0) {
      return { p50: 0, p95: 0, p99: 0, count: 0 };
    }
    const sorted = [...samples].sort((a, b) => a - b);

    const at = (q: number): number => {
      const pos = q * (sorted.length - 1);
      const lo = Math.floor(pos);
      const hi = Math.ceil(pos);
      if (lo === hi) return sorted[lo]!;
      const frac = pos - lo;
      return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * frac;
    };

    return {
      p50: Math.round(at(0.5)),
      p95: Math.round(at(0.95)),
      p99: Math.round(at(0.99)),
      count: samples.length,
    };
  }
}
