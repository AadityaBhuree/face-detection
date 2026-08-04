import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime value import
import { ApiKeyService } from '../../modules/api-keys/api-keys.service';

const API_KEY_HEADER = 'x-api-key';

/**
 * Authenticates external integrations via the `X-API-Key` header.
 * Validates the key against the `api_keys` table (SHA-256 hash lookup)
 * and attaches the resolved key metadata to `request.apiKey`.
 * Fail-closed: missing, invalid, revoked, or expired keys → 401.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers[API_KEY_HEADER];

    if (!apiKey || Array.isArray(apiKey) || apiKey.trim() === '') {
      throw new UnauthorizedException('Missing API key. Provide an X-API-Key header.');
    }

    const validated = await this.apiKeyService.validateKey(apiKey.trim());

    // Attach for downstream handlers / audit enrichment.
    (request as Request & { apiKey?: unknown }).apiKey = validated;

    return true;
  }
}
