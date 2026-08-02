import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
// NOTE: the service imports below MUST stay as value imports (not
// `import type`) — NestJS DI relies on the emitted runtime metadata
// (emitDecoratorMetadata) to resolve constructor dependencies.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../../prisma/prisma.service';
import { SessionService } from '../session/session.service';
import { BriefGeneratorService } from '../ai/brief-generator.service';
import { AuditService } from '../audit/audit.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { StartIntakeSessionInput, IntakeDataInput } from '@jeevandata/shared-schemas';
import type { SessionStatus } from '@jeevandata/shared-types';
import type { Prisma } from '@prisma/client';

@Injectable()
export class IntakeService {
  private readonly logger = new Logger(IntakeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
    private readonly briefGenerator: BriefGeneratorService,
    private readonly auditService: AuditService,
  ) {}

  async startSession(data: StartIntakeSessionInput) {
    const session = await this.prisma.intakeSession.create({
      data: {
        patientId: data.patientId ?? null,
        status: 'INITIATED',
        deviceId: data.deviceId,
        metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    this.logger.log(`Intake session started: ${session.id}`);

    await this.auditService.log({
      action: 'INTAKE_SESSION_STARTED',
      actorId: 'system',
      actorRole: 'SYSTEM',
      resourceType: 'intake_session',
      resourceId: session.id,
      details: { deviceId: data.deviceId, hasPatient: !!data.patientId },
      ipAddress: 'internal',
    });

    return session;
  }

  async getSession(id: string) {
    const session = await this.prisma.intakeSession.findUnique({
      where: { id },
      include: {
        intakeRecords: true,
        transcripts: {
          orderBy: { timestampMs: 'asc' },
          take: 100,
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`Session ${id} not found`);
    }

    await this.auditService.log({
      action: 'INTAKE_SESSION_VIEW',
      actorId: 'system',
      actorRole: 'SYSTEM',
      resourceType: 'intake_session',
      resourceId: id,
      details: { status: session.status, transcriptCount: session.transcripts.length },
      ipAddress: 'internal',
    });

    return session;
  }

  async completeWithIntake(sessionId: string, intakeData: IntakeDataInput) {
    const session = await this.prisma.intakeSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    if (session.status === 'COMPLETED' || session.status === 'BRIEF_GENERATED') {
      throw new BadRequestException('Session is already completed');
    }

    await this.sessionService.updateStatus(sessionId, 'TRANSCRIBING' as SessionStatus);

    const brief = await this.generateBrief(session, intakeData);

    const intakeRecord = await this.prisma.intakeRecord.create({
      data: {
        sessionId,
        patientId: session.patientId ?? '',
        brief: brief as unknown as Prisma.InputJsonValue,
        intakeData: intakeData as Prisma.InputJsonValue,
      },
    });

    await this.sessionService.updateStatus(sessionId, 'BRIEF_GENERATED' as SessionStatus);

    this.logger.log(`Intake completed for session ${sessionId}`);

    await this.auditService.log({
      action: 'INTAKE_COMPLETED',
      actorId: 'system',
      actorRole: 'SYSTEM',
      resourceType: 'intake_record',
      resourceId: intakeRecord.id,
      details: {
        sessionId,
        patientId: session.patientId,
        chiefComplaint: intakeData.chiefComplaint.substring(0, 100),
      },
      ipAddress: 'internal',
    });

    return { session, intakeRecord, brief };
  }

  async getSessionStatus(id: string) {
    const session = await this.prisma.intakeSession.findUnique({
      where: { id },
      select: { id: true, status: true, updatedAt: true },
    });

    if (!session) {
      throw new NotFoundException(`Session ${id} not found`);
    }

    return session;
  }

  private async generateBrief(
    session: {
      id: string;
      patientId: string | null;
      // Prisma stores JSON metadata as JsonValue.
      metadata?: unknown;
    },
    intakeData: IntakeDataInput,
  ) {
    // Build transcript from the conversation turns
    // In production, this would be fetched from the database
    const transcript = await this.buildTranscript(session.id);

    // Language preference is captured at session start and stored in
    // the session metadata; default to English when absent.
    const language = this.extractLanguage(session.metadata);

    return this.briefGenerator.generate({
      sessionId: session.id,
      patientId: session.patientId ?? 'unknown',
      intakeData,
      transcript,
      patientHistory: '', // Could be populated from EHR/previous visits
      language,
    });
  }

  private extractLanguage(metadata: unknown): 'en' | 'hi' | 'mr' | 'es' {
    const candidate =
      metadata && typeof metadata === 'object'
        ? (metadata as Record<string, unknown>).language
        : undefined;
    if (candidate === 'hi' || candidate === 'mr' || candidate === 'es') {
      return candidate;
    }
    return 'en';
  }

  private async buildTranscript(sessionId: string): Promise<string> {
    try {
      const entries = await this.prisma.sessionTranscript.findMany({
        where: { sessionId },
        orderBy: { timestampMs: 'asc' },
        take: 200,
      });
      return entries.map((e) => `${e.speaker.toUpperCase()}: ${e.text}`).join('\n');
    } catch {
      this.logger.warn(
        `Could not fetch transcript for session ${sessionId}, using empty transcript`,
      );
      return '';
    }
  }
}
