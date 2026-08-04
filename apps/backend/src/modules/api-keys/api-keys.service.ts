import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
// NOTE: these must stay VALUE imports — NestJS DI resolves constructor
// params via emitDecoratorMetadata at runtime.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { createHash, randomBytes } from 'node:crypto';
import type { CreateApiKeyInput } from '@jeevandata/shared-schemas';
import type { UserRole } from '@jeevandata/shared-types';

const KEY_PREFIX = 'jk';
const KEY_BYTES = 32; // 256-bit key → 43 base64url chars

export interface ApiKeyActor {
  id: string;
  role: string;
}

export interface ValidatedApiKey {
  id: string;
  name: string;
  prefix: string;
  clinicId: string | null;
}

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Generate a new API key. The raw key is returned EXACTLY ONCE — only
   * its SHA-256 hash and a short identifying prefix are persisted.
   */
  async generate(data: CreateApiKeyInput, actor: ApiKeyActor) {
    // The full key is `jk_<256-bit-random>`; its hash is stored, and the
    // leading segment doubles as the human-readable prefix in logs/UI.
    const rawKey = randomBytes(KEY_BYTES).toString('base64url');
    const apiKey = `${KEY_PREFIX}_${rawKey}`;
    const prefix = apiKey.slice(0, 15);
    const expiresAt = data.expiresInDays
      ? new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const record = await this.prisma.apiKey.create({
      data: {
        name: data.name,
        keyHash: this.hashKey(apiKey),
        prefix,
        clinicId: data.clinicId ?? null,
        expiresAt,
      },
    });

    await this.auditService.log({
      action: 'API_KEY_CREATED',
      actorId: actor.id,
      actorRole: actor.role as UserRole,
      resourceType: 'api_key',
      resourceId: record.id,
      details: { name: record.name, prefix: record.prefix },
      ipAddress: 'internal',
    });

    this.logger.log(`Created API key ${record.prefix} (${record.name})`);

    return {
      id: record.id,
      name: record.name,
      prefix: record.prefix,
      clinicId: record.clinicId,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      // The only time the full key is ever exposed.
      apiKey,
    };
  }

  /** List key metadata only — never hashes or raw keys. */
  async list() {
    return this.prisma.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        prefix: true,
        clinicId: true,
        isActive: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
        revokedAt: true,
      },
    });
  }

  async revoke(id: string, actor: ApiKeyActor) {
    const record = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundException(`API key ${id} not found`);
    }

    await this.prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date(), isActive: false },
    });

    await this.auditService.log({
      action: 'API_KEY_REVOKED',
      actorId: actor.id,
      actorRole: actor.role as UserRole,
      resourceType: 'api_key',
      resourceId: record.id,
      details: { name: record.name, prefix: record.prefix },
      ipAddress: 'internal',
    });

    this.logger.log(`Revoked API key ${record.prefix}`);

    return { success: true, message: 'API key revoked' };
  }

  /**
   * Validate a raw key from the X-API-Key header. Throws Unauthorized
   * for unknown, revoked, inactive, or expired keys. Fail-closed.
   */
  async validateKey(rawKey: string): Promise<ValidatedApiKey> {
    const record = await this.prisma.apiKey.findUnique({
      where: { keyHash: this.hashKey(rawKey) },
    });

    if (!record) {
      throw new UnauthorizedException('Invalid API key');
    }
    if (!record.isActive || record.revokedAt) {
      throw new UnauthorizedException('API key has been revoked');
    }
    if (record.expiresAt && record.expiresAt < new Date()) {
      throw new UnauthorizedException('API key has expired');
    }

    // Best-effort last-used tracking; never fail the request on it.
    await this.prisma.apiKey
      .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);

    return {
      id: record.id,
      name: record.name,
      prefix: record.prefix,
      clinicId: record.clinicId,
    };
  }

  private hashKey(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
  }
}
