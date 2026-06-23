import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

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
