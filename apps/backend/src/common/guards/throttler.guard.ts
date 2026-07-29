import { Injectable, HttpStatus, HttpException, type ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ThrottlerLimitDetail } from '@nestjs/throttler';

/**
 * Custom throttler guard that returns a structured JSON error response
 * instead of the default `ThrottlerException` text response.
 *
 * Response format:
 * ```json
 * {
 *   "statusCode": 429,
 *   "message": "Too many requests. Please try again later.",
 *   "error": "ThrottlerException"
 * }
 * ```
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  /**
   * Override to return a structured JSON error body when rate limit is exceeded.
   */
  protected async throwThrottlingException(
    _context: ExecutionContext,
    _throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Too many requests. Please try again later.',
        error: 'ThrottlerException',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
