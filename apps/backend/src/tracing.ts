// ─── OpenTelemetry Tracing Initialization ──────────────────────
// IMPORTANT: This file must be imported FIRST in main.ts before
// any NestJS code to ensure auto-instrumentation hooks are applied.
//
// Usage in main.ts:
//   import './tracing';  // MUST be the first import

import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchSpanProcessor, NodeTracerProvider, TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-node';

// ─── Configuration (from env vars with sensible defaults) ──────

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME ?? 'ayutalk-care-api';
const OTEL_ENABLED = process.env.OTEL_ENABLED !== 'false';
const OTEL_EXPORTER_TYPE = process.env.OTEL_EXPORTER_TYPE ?? 'jaeger'; // 'jaeger' | 'otlp' | 'console'
const OTEL_ENDPOINT =
  process.env.OTEL_ENDPOINT ?? 'http://localhost:14268/api/traces';
const OTEL_OTLP_ENDPOINT =
  process.env.OTEL_OTLP_ENDPOINT ?? 'http://localhost:4318/v1/traces';
const OTEL_LOG_LEVEL =
  (process.env.OTEL_LOG_LEVEL as keyof typeof DiagLogLevel) ?? 'WARN';
const OTEL_SAMPLE_RATE = parseFloat(process.env.OTEL_SAMPLE_RATE ?? '1.0');

// Enable diagnostic logging
diag.setLogger(
  new DiagConsoleLogger(),
  DiagLogLevel[OTEL_LOG_LEVEL as keyof typeof DiagLogLevel] ?? DiagLogLevel.WARN,
);

// ─── Early exit if disabled ────────────────────────────────────
if (!OTEL_ENABLED) {
  diag.info('[Tracing] OpenTelemetry is disabled (OTEL_ENABLED=false)');
} else {
  initializeTracing();
}

// ─── Initialization (only runs when enabled) ────────────────────
function initializeTracing(): void {
  // Declare provider at function scope so shutdown() can access it
  let provider: NodeTracerProvider;

  // ─── Resource (service identity) ───────────────────────────────
  const resource = resourceFromAttributes({
    'service.name': SERVICE_NAME,
    'service.version': process.env.APP_VERSION ?? '0.1.0',
    'deployment.environment': process.env.NODE_ENV ?? 'development',
    'service.namespace': 'AyuTalk',
  });

  // ─── Exporter Selection ────────────────────────────────────────
  // Note: OTel SDK v2.x passes spanProcessors via constructor, not addSpanProcessor()

  if (OTEL_EXPORTER_TYPE === 'console') {
    provider = new NodeTracerProvider({ resource });
    provider.register();
    registerInstrumentations({
      instrumentations: [
        new HttpInstrumentation({
          ignoreIncomingRequestHook: (request) => {
            const url = (request as { url?: string }).url ?? '';
            return url === '/health/live' || url === '/health/ready';
          },
        }),
        new ExpressInstrumentation(),
        new NestInstrumentation(),
        new PinoInstrumentation({
          logKeys: {
            traceId: 'trace_id',
            spanId: 'span_id',
            traceFlags: 'trace_flags',
          },
        }),
      ],
    });
    diag.info(
      '[Tracing] Console mode — spans injected into pino logs, no exporter',
    );
  } else if (OTEL_EXPORTER_TYPE === 'otlp') {
    const exporter = new OTLPTraceExporter({
      url: OTEL_OTLP_ENDPOINT,
      headers: {},
    });
    provider = new NodeTracerProvider({
      resource,
      sampler:
        OTEL_SAMPLE_RATE < 1.0
          ? new TraceIdRatioBasedSampler(OTEL_SAMPLE_RATE)
          : undefined,
      spanProcessors: [
        new BatchSpanProcessor(exporter, {
          maxQueueSize: 2048,
          maxExportBatchSize: 512,
          scheduledDelayMillis: 5000,
          exportTimeoutMillis: 30000,
        }),
      ],
    });
    provider.register();
    registerInstrumentations({
      instrumentations: [
        new HttpInstrumentation({
          ignoreIncomingRequestHook: (request) => {
            const url = (request as { url?: string }).url ?? '';
            return url === '/health/live' || url === '/health/ready';
          },
        }),
        new ExpressInstrumentation(),
        new NestInstrumentation(),
        new PinoInstrumentation({
          logKeys: {
            traceId: 'trace_id',
            spanId: 'span_id',
            traceFlags: 'trace_flags',
          },
        }),
      ],
    });
    diag.info(
      `[Tracing] OTLP exporter — endpoint=${OTEL_OTLP_ENDPOINT}, sampleRate=${OTEL_SAMPLE_RATE}`,
    );
  } else {
    // Default: Jaeger exporter (UDP/HTTP Thrift)
    const exporter = new JaegerExporter({
      endpoint: OTEL_ENDPOINT,
      tags: [],
    });
    provider = new NodeTracerProvider({
      resource,
      sampler:
        OTEL_SAMPLE_RATE < 1.0
          ? new TraceIdRatioBasedSampler(OTEL_SAMPLE_RATE)
          : undefined,
      spanProcessors: [
        new BatchSpanProcessor(exporter, {
          maxQueueSize: 2048,
          maxExportBatchSize: 512,
          scheduledDelayMillis: 5000,
          exportTimeoutMillis: 30000,
        }),
      ],
    });
    provider.register();
    registerInstrumentations({
      instrumentations: [
        new HttpInstrumentation({
          ignoreIncomingRequestHook: (request) => {
            const url = (request as { url?: string }).url ?? '';
            return url === '/health/live' || url === '/health/ready';
          },
        }),
        new ExpressInstrumentation(),
        new NestInstrumentation(),
        new PinoInstrumentation({
          logKeys: {
            traceId: 'trace_id',
            spanId: 'span_id',
            traceFlags: 'trace_flags',
          },
        }),
      ],
    });
    diag.info(
      `[Tracing] Jaeger exporter — endpoint=${OTEL_ENDPOINT}, sampleRate=${OTEL_SAMPLE_RATE}`,
    );
  }

  // ─── Graceful Shutdown ─────────────────────────────────────────
  const shutdown = (): void => {
    provider
      .shutdown()
      .catch((err: unknown) => diag.error('[Tracing] Shutdown error', err));
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
