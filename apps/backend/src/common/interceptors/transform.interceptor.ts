import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

import type { Request } from 'express';

interface WrappedResponse<T> {
  status: 'success';
  data: T;
  timestamp: string;
  path: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, WrappedResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<WrappedResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();

    // Raw-text endpoints (Prometheus scrape, CSV exports) must NOT be
    // wrapped in the JSON envelope — return their payload untouched.
    if (request.path?.startsWith('/metrics')) {
      return next.handle() as Observable<WrappedResponse<T>>;
    }

    return next.handle().pipe(
      map((data) => ({
        status: 'success' as const,
        data,
        timestamp: new Date().toISOString(),
        path: request.url,
      })),
    );
  }
}
