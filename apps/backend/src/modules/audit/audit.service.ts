import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuditLogInput } from '@ayutalk/shared-schemas';

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
          details: (data.details ?? {}) as any,
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

  async getPatientAccessLogs(
    patientId: string,
    page = 1,
    limit = 50,
  ) {
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
