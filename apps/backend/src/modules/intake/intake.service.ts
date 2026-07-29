import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionService } from '../session/session.service';
import { BriefGeneratorService } from '../ai/brief-generator.service';
import { AuditService } from '../audit/audit.service';
import type { StartIntakeSessionInput, IntakeDataInput } from '@ayutalk/shared-schemas';

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
        metadata: (data.metadata ?? {}) as any,
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

    await this.sessionService.updateStatus(sessionId, 'TRANSCRIBING' as any);

    const brief = await this.generateBrief(session, intakeData);

    const intakeRecord = await this.prisma.intakeRecord.create({
      data: {
        sessionId,
        patientId: session.patientId ?? '',
        brief: brief as any,
        intakeData: intakeData as any,
      },
    });

    await this.sessionService.updateStatus(sessionId, 'BRIEF_GENERATED' as any);

    this.logger.log(`Intake completed for session ${sessionId}`);

    await this.auditService.log({
      action: 'INTAKE_COMPLETED',
      actorId: 'system',
      actorRole: 'SYSTEM',
      resourceType: 'intake_record',
      resourceId: intakeRecord.id,
      details: { sessionId, patientId: session.patientId, chiefComplaint: intakeData.chiefComplaint.substring(0, 100) },
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
    session: { id: string; patientId: string | null },
    intakeData: IntakeDataInput,
  ) {
    // Build transcript from the conversation turns
    // In production, this would be fetched from the database
    const transcript = await this.buildTranscript(session.id);

    return this.briefGenerator.generate({
      sessionId: session.id,
      patientId: session.patientId ?? 'unknown',
      intakeData,
      transcript,
      patientHistory: '', // Could be populated from EHR/previous visits
    });
  }

  private async buildTranscript(sessionId: string): Promise<string> {
    try {
      const entries = await this.prisma.sessionTranscript.findMany({
        where: { sessionId },
        orderBy: { timestampMs: 'asc' },
        take: 200,
      });
      return entries
        .map((e) => `${e.speaker.toUpperCase()}: ${e.text}`)
        .join('\n');
    } catch {
      this.logger.warn(
        `Could not fetch transcript for session ${sessionId}, using empty transcript`,
      );
      return '';
    }
  }
}
