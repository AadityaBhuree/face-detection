import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime value import
import { PrismaService } from '../../prisma/prisma.service';
import type { AuditLogInput } from '@jeevandata/shared-schemas';
import type { Prisma } from '@prisma/client';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(data: AuditLogInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: data.action,
          actorId: data.actorId,
          actorRole: data.actorRole,
          resourceType: data.resourceType,
          resourceId: data.resourceId,
          details: (data.details ?? {}) as unknown as Prisma.InputJsonValue,
          ipAddress: data.ipAddress,
        },
      });

      this.logger.debug(
        `Audit log: ${data.actorRole}:${data.actorId} ${data.action} on ${data.resourceType}:${data.resourceId}`,
      );
    } catch (error) {
      this.logger.error('Failed to write audit log', error);
      // Never throw from audit - failure should not block operations
    }
  }

  async getPatientAccessLogs(patientId: string, page = 1, limit = 50) {
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { resourceId: patientId, resourceType: 'patient' },
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({
        where: { resourceId: patientId, resourceType: 'patient' },
      }),
    ]);

    return {
      data: logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
