import { Injectable, Logger, ConflictException, UnauthorizedException } from '@nestjs/common';
// NOTE: the injected service imports below MUST stay value imports
// (not `import type`) — NestJS DI resolves constructor dependencies
// via emitDecoratorMetadata at runtime.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../modules/audit/audit.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import * as bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import type { RegisterUserInput, LoginUserInput } from '@jeevandata/shared-schemas';
import type { UserRole } from '@jeevandata/shared-types';

const BCRYPT_ROUNDS = 10;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  clinicId: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  type: 'access' | 'refresh';
  clinicId?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly refreshSecret: string;
  private readonly accessTtlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {
    // Dedicated refresh secret (never derived from the access secret).
    this.refreshSecret =
      this.configService.get<string>('jwt.refreshSecret') ??
      `${this.configService.get<string>('jwt.secret')}-refresh`;
    this.accessTtlSeconds = this.parseTtl(this.configService.get<string>('jwt.expiration', '24h'));
  }

  // ─── Register ────────────────────────────────────────────────
  async register(data: RegisterUserInput): Promise<AuthUser> {
    const existing = await this.prisma.clinicUser.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException(`An account with email ${data.email} already exists`);
    }

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

    // Public registration always creates a RECEPTIONIST account — role
    // promotion is handled by authenticated admin flows (RBAC, Phase 4.2).
    const user = await this.prisma.clinicUser.create({
      data: {
        email: data.email.toLowerCase(),
        name: data.name,
        passwordHash,
        role: 'RECEPTIONIST',
        clinicId: null,
      },
    });

    this.logger.log(`Registered new clinic user: ${user.email} (${user.role})`);

    await this.auditService.log({
      action: 'AUTH_USER_REGISTERED',
      actorId: user.id,
      actorRole: user.role,
      resourceType: 'clinic_user',
      resourceId: user.id,
      details: { email: user.email },
      ipAddress: 'internal',
    });

    return this.toAuthUser(user);
  }

  // ─── Login ───────────────────────────────────────────────────
  async login(data: LoginUserInput): Promise<{ user: AuthUser } & TokenPair> {
    const email = data.email.toLowerCase();

    const user = await this.prisma.clinicUser.findUnique({
      where: { email },
    });

    if (!user) {
      // Uniform message: don't leak which emails are registered.
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated. Contact your administrator.');
    }

    const passwordValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.prisma.clinicUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.issueTokens(
      user.id,
      user.email,
      user.role as UserRole,
      user.clinicId ?? undefined,
    );

    await this.auditService.log({
      action: 'AUTH_USER_LOGIN',
      actorId: user.id,
      actorRole: user.role,
      resourceType: 'clinic_user',
      resourceId: user.id,
      details: { email: user.email },
      ipAddress: 'internal',
    });

    this.logger.log(`User logged in: ${user.email}`);

    return { user: this.toAuthUser(user), ...tokens };
  }

  // ─── Refresh ─────────────────────────────────────────────────
  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Token is not a refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    const user = await this.prisma.clinicUser.findUnique({
      where: { id: stored.userId },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account is no longer active');
    }

    // Atomically revoke the used token. If another request already
    // consumed it (token reuse / replay), the count is 0 → reject.
    const revoked = await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count === 0) {
      this.logger.warn(`Refresh token reuse detected for user ${stored.userId} — rejecting`);
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    const tokens = await this.issueTokens(
      user.id,
      user.email,
      user.role as UserRole,
      user.clinicId ?? undefined,
    );

    await this.auditService.log({
      action: 'AUTH_TOKEN_REFRESHED',
      actorId: user.id,
      actorRole: user.role,
      resourceType: 'clinic_user',
      resourceId: user.id,
      details: { email: user.email },
      ipAddress: 'internal',
    });

    return tokens;
  }

  // ─── Profile ─────────────────────────────────────────────────
  async getProfile(userId: string): Promise<AuthUser> {
    const user = await this.prisma.clinicUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Account not found');
    }

    return this.toAuthUser(user);
  }

  // ─── Logout (revoke all refresh tokens) ─────────────────────
  async logout(userId: string): Promise<{ success: boolean }> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    this.logger.log(`Logged out user ${userId}`);
    return { success: true };
  }

  // ─── Internals ───────────────────────────────────────────────
  private async issueTokens(
    userId: string,
    email: string,
    role: UserRole,
    clinicId?: string,
  ): Promise<TokenPair> {
    const accessPayload: JwtPayload = {
      sub: userId,
      email,
      role,
      type: 'access',
      ...(clinicId ? { clinicId } : {}),
    };

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      expiresIn: this.accessTtlSeconds,
    });

    const refreshPayload: JwtPayload = {
      sub: userId,
      email,
      role,
      type: 'refresh',
      ...(clinicId ? { clinicId } : {}),
    };
    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: this.refreshSecret,
      expiresIn: Math.floor(REFRESH_TTL_MS / 1000),
    });

    // Store only the SHA-256 hash of the refresh token (revocable,
    // never reusable if the DB leaks).
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashToken(refreshToken),
        userId,
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
    });

    return { accessToken, refreshToken, expiresIn: this.accessTtlSeconds };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  // Accepts the Prisma model shape; role enum is structurally equal to
  // shared-types UserRole (they're separate nominal types, so cast).
  private toAuthUser(user: {
    id: string;
    email: string;
    name: string;
    role: string;
    clinicId: string | null;
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      clinicId: user.clinicId,
    };
  }

  private parseTtl(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl.trim());
    if (!match) return 86400; // 24h default
    const value = parseInt(match[1]!, 10);
    switch (match[2]) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return value;
    }
  }
}
