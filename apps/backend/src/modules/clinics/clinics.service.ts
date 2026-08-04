import { Injectable, Logger, ConflictException, NotFoundException } from '@nestjs/common';
// NOTE: these must stay VALUE imports — NestJS DI resolves constructor
// params via emitDecoratorMetadata at runtime.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { CreateClinicInput, UpdateClinicInput } from '@jeevandata/shared-schemas';
import type { UserRole } from '@jeevandata/shared-types';
import type { ApiKeyActor } from '../api-keys/api-keys.service';

@Injectable()
export class ClinicsService {
  private readonly logger = new Logger(ClinicsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(data: CreateClinicInput, actor: ApiKeyActor) {
    const existing = await this.prisma.clinic.findUnique({
      where: { code: data.code },
    });
    if (existing) {
      throw new ConflictException(`Clinic code ${data.code} already exists`);
    }

    const clinic = await this.prisma.clinic.create({
      data: {
        name: data.name,
        code: data.code,
        address: data.address ?? null,
        phone: data.phone ?? null,
        email: data.email ?? null,
      },
    });

    await this.auditService.log({
      action: 'CLINIC_CREATED',
      actorId: actor.id,
      actorRole: actor.role as UserRole,
      resourceType: 'clinic',
      resourceId: clinic.id,
      details: { name: clinic.name, code: clinic.code },
      ipAddress: 'internal',
    });

    this.logger.log(`Created clinic ${clinic.code} (${clinic.name})`);
    return clinic;
  }

  async list(page: number, limit: number) {
    const [data, total] = await Promise.all([
      this.prisma.clinic.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.clinic.count(),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string) {
    const clinic = await this.prisma.clinic.findUnique({ where: { id } });
    if (!clinic) {
      throw new NotFoundException(`Clinic ${id} not found`);
    }
    return clinic;
  }

  async update(id: string, data: UpdateClinicInput, actor: ApiKeyActor) {
    const existing = await this.prisma.clinic.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Clinic ${id} not found`);
    }

    if (data.code && data.code !== existing.code) {
      const codeTaken = await this.prisma.clinic.findUnique({
        where: { code: data.code },
      });
      if (codeTaken) {
        throw new ConflictException(`Clinic code ${data.code} already exists`);
      }
    }

    const clinic = await this.prisma.clinic.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.code !== undefined ? { code: data.code } : {}),
        ...(data.address !== undefined ? { address: data.address ?? null } : {}),
        ...(data.phone !== undefined ? { phone: data.phone ?? null } : {}),
        ...(data.email !== undefined ? { email: data.email ?? null } : {}),
      },
    });

    await this.auditService.log({
      action: 'CLINIC_UPDATED',
      actorId: actor.id,
      actorRole: actor.role as UserRole,
      resourceType: 'clinic',
      resourceId: clinic.id,
      details: { name: clinic.name, code: clinic.code },
      ipAddress: 'internal',
    });

    this.logger.log(`Updated clinic ${clinic.code}`);
    return clinic;
  }

  async deactivate(id: string, actor: ApiKeyActor) {
    const existing = await this.prisma.clinic.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Clinic ${id} not found`);
    }

    await this.prisma.clinic.update({
      where: { id },
      data: { isActive: false },
    });

    await this.auditService.log({
      action: 'CLINIC_DEACTIVATED',
      actorId: actor.id,
      actorRole: actor.role as UserRole,
      resourceType: 'clinic',
      resourceId: existing.id,
      details: { name: existing.name, code: existing.code },
      ipAddress: 'internal',
    });

    this.logger.log(`Deactivated clinic ${existing.code}`);
    return { success: true, message: 'Clinic deactivated' };
  }
}
