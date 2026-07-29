import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { trace, Span, SpanStatusCode, type Tracer } from '@opentelemetry/api';

/**
 * OpenTelemetry Service
 *
 * Provides manual tracing helpers for services that need custom spans.
 * Usage:
 *   @Injectable()
 *   class MyService {
 *     constructor(private readonly otel: OpenTelemetryService) {}
 *
 *     async doWork() {
 *       return this.otel.withSpan('my-service.do-work', async (span) => {
 *         span.setAttribute('work.id', '123');
 *         const result = await someAsyncWork();
 *         span.setAttribute('result.size', result.length);
 *         return result;
 *       });
 *     }
 *   }
 */
@Injectable()
export class OpenTelemetryService implements OnModuleDestroy {
  private readonly logger = new Logger(OpenTelemetryService.name);
  private readonly tracer: Tracer;

  constructor() {
    this.tracer = trace.getTracer('ayutalk-care-api', process.env.APP_VERSION ?? '0.1.0');
  }

  /**
   * Get the underlying OpenTelemetry Tracer instance for advanced use cases.
   */
  getTracer(): Tracer {
    return this.tracer;
  }

  /**
   * Execute an async function within a named span.
   * The span is automatically ended when the function completes or throws.
   * On throw, the span status is set to ERROR with the error message.
   *
   * @param name - Span name (e.g., 'face-service.search-embeddings')
   * @param fn - Async function that receives the active span
   * @param attributes - Optional attributes to set on the span
   * @returns The return value of fn
   */
  async withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    attributes?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    return this.tracer.startActiveSpan(name, async (span: Span) => {
      try {
        // Set initial attributes
        if (attributes) {
          for (const [key, value] of Object.entries(attributes)) {
            if (value !== undefined) {
              span.setAttribute(key, value);
            }
          }
        }

        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message,
        });
        span.recordException(error instanceof Error ? error : new Error(String(error)));
        throw error; // Re-throw — caller handles
      } finally {
        span.end();
      }
    });
  }

  /**
   * Execute a synchronous function within a named span.
   */
  withSpanSync<T>(
    name: string,
    fn: (span: Span) => T,
    attributes?: Record<string, string | number | boolean | undefined>,
  ): T {
    return this.tracer.startActiveSpan(name, (span: Span) => {
      try {
        if (attributes) {
          for (const [key, value] of Object.entries(attributes)) {
            if (value !== undefined) {
              span.setAttribute(key, value);
            }
          }
        }

        const result = fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message,
        });
        span.recordException(error instanceof Error ? error : new Error(String(error)));
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Get the current trace ID from the active span context.
   * Returns null if no span is active.
   */
  getCurrentTraceId(): string | null {
    const span = trace.getActiveSpan();
    if (!span) return null;
    return span.spanContext().traceId;
  }

  /**
   * Check if tracing is currently active (has an active span).
   */
  isActive(): boolean {
    return trace.getActiveSpan() !== null;
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down OpenTelemetry SDK...');
    // The global provider shutdown is handled in tracing.ts
  }
}
