import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getLatestBrief(patientId: string) {
    const record = await this.prisma.intakeRecord.findFirst({
      where: { patientId },
      orderBy: { generatedAt: 'desc' },
      include: {
        session: {
          select: {
            id: true,
            startedAt: true,
            status: true,
          },
        },
      },
    });

    if (!record) {
      throw new NotFoundException(
        `No intake records found for patient ${patientId}`,
      );
    }

    await this.auditService.log({
      action: 'DASHBOARD_BRIEF_VIEW',
      actorId: 'system',
      actorRole: 'SYSTEM',
      resourceType: 'intake_record',
      resourceId: record.id,
      details: { patientId, sessionId: record.sessionId },
      ipAddress: 'internal',
    });

    return {
      id: record.id,
      sessionId: record.sessionId,
      patientId: record.patientId,
      brief: record.brief,
      intakeData: record.intakeData,
      session: record.session,
      generatedAt: record.generatedAt,
    };
  }

  async getActiveSessions(page: number, limit: number) {
    const [sessions, total] = await Promise.all([
      this.prisma.intakeSession.findMany({
        where: {
          status: {
            notIn: ['COMPLETED', 'FAILED', 'TIMED_OUT'],
          },
        },
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          patient: {
            select: {
              id: true,
              name: true,
              dob: true,
            },
          },
        },
      }),
      this.prisma.intakeSession.count({
        where: {
          status: {
            notIn: ['COMPLETED', 'FAILED', 'TIMED_OUT'],
          },
        },
      }),
    ]);

    await this.auditService.log({
      action: 'DASHBOARD_ACTIVE_SESSIONS_VIEW',
      actorId: 'system',
      actorRole: 'SYSTEM',
      resourceType: 'dashboard',
      resourceId: 'active-sessions',
      details: { sessionCount: sessions.length, total, page, limit },
      ipAddress: 'internal',
    });

    return {
      data: sessions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getRecentBriefs(page: number, limit: number) {
    const [records, total] = await Promise.all([
      this.prisma.intakeRecord.findMany({
        orderBy: { generatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          session: {
            select: {
              id: true,
              startedAt: true,
              status: true,
            },
          },
          patient: {
            select: {
              id: true,
              name: true,
              dob: true,
            },
          },
        },
      }),
      this.prisma.intakeRecord.count(),
    ]);

    await this.auditService.log({
      action: 'DASHBOARD_RECENT_BRIEFS_VIEW',
      actorId: 'system',
      actorRole: 'SYSTEM',
      resourceType: 'dashboard',
      resourceId: 'recent-briefs',
      details: { briefCount: records.length, total, page, limit },
      ipAddress: 'internal',
    });

    return {
      data: records,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async markBriefReviewed(briefId: string) {
    const record = await this.prisma.intakeRecord.findUnique({
      where: { id: briefId },
    });

    if (!record) {
      throw new NotFoundException(`Brief ${briefId} not found`);
    }

    // Update the session status to COMPLETED
    await this.prisma.intakeSession.update({
      where: { id: record.sessionId },
      data: { status: 'COMPLETED' },
    });

    this.logger.log(`Brief ${briefId} reviewed, session ${record.sessionId} completed`);

    await this.auditService.log({
      action: 'DASHBOARD_BRIEF_REVIEWED',
      actorId: 'system',
      actorRole: 'SYSTEM',
      resourceType: 'intake_record',
      resourceId: briefId,
      details: { sessionId: record.sessionId, patientId: record.patientId },
      ipAddress: 'internal',
    });

    return { success: true, message: 'Brief marked as reviewed' };
  }

  async getPatientHistory(patientId: string, page: number, limit: number) {
    const [records, total] = await Promise.all([
      this.prisma.intakeRecord.findMany({
        where: { patientId },
        orderBy: { generatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          session: {
            select: {
              id: true,
              startedAt: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.intakeRecord.count({
        where: { patientId },
      }),
    ]);

    await this.auditService.log({
      action: 'DASHBOARD_PATIENT_HISTORY_VIEW',
      actorId: 'system',
      actorRole: 'SYSTEM',
      resourceType: 'patient',
      resourceId: patientId,
      details: { recordCount: records.length, total, page, limit },
      ipAddress: 'internal',
    });

    return {
      data: records,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
