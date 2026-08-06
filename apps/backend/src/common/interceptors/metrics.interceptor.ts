import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime value import
import { MetricsService } from '../../modules/opentelemetry/metrics.service';

/**
 * MetricsInterceptor — records every HTTP request into the Prometheus
 * MetricsService (counters, duration histogram, error counter).
 *
 * Registered as a global APP_INTERCEPTOR in AppModule. The /metrics route
 * itself is skipped so scrape traffic does not pollute the request metrics.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();

    // Normalize the route label to the matched Express route pattern
    // (e.g. /face/search) when available; fall back to the raw path so
    // label cardinality stays bounded (no query strings, no UUIDs).
    const route = request.route?.path ?? request.path ?? '/unknown';
    if (route.startsWith('/metrics')) {
      return next.handle();
    }

    const start = process.hrtime.bigint();
    const { method } = request;

    return next.handle().pipe(
      tap({
        next: () => {
          const response = ctx.getResponse<Response>();
          this.metrics.recordHttpRequest(method, route, response.statusCode, this.elapsedMs(start));
        },
        error: (error: Error & { status?: number }) => {
          this.metrics.recordHttpRequest(method, route, error.status ?? 500, this.elapsedMs(start));
        },
      }),
    );
  }

  private elapsedMs(start: bigint): number {
    return Number(process.hrtime.bigint() - start) / 1e6;
  }
}
