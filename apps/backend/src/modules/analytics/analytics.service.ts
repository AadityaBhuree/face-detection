import { Injectable, Logger } from '@nestjs/common';
// NOTE: these must stay VALUE imports — NestJS DI resolves constructor
// params via emitDecoratorMetadata at runtime.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */

const TERMINAL_STATUSES = ['COMPLETED', 'FAILED', 'TIMED_OUT'];

/** Pipeline stages for the real-time patient flow board. */
export const FLOW_STAGES = [
  { key: 'waiting', label: 'Waiting', statuses: ['INITIATED', 'FACE_MATCHED', 'CONTEXT_LOADED'] },
  { key: 'in_intake', label: 'In Intake', statuses: ['INTAKE_IN_PROGRESS', 'TRANSCRIBING'] },
  { key: 'triaged', label: 'Triaged', statuses: ['BRIEF_GENERATED', 'SYNCED'] },
  { key: 'with_doctor', label: 'With Doctor', statuses: ['COMPLETED'] },
  { key: 'failed', label: 'Failed / Timed Out', statuses: ['FAILED', 'TIMED_OUT'] },
] as const;

export type FlowStageKey = (typeof FLOW_STAGES)[number]['key'];

interface SessionRow {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
  patientId: string | null;
  status: string;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private whereInWindow(days: number, clinicId?: string) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return {
      ...(clinicId ? { clinicId } : {}),
      startedAt: { gte: since },
    };
  }

  private async fetchSessions(days: number, clinicId?: string): Promise<SessionRow[]> {
    return this.prisma.intakeSession.findMany({
      where: this.whereInWindow(days, clinicId),
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        patientId: true,
        status: true,
      },
    }) as Promise<SessionRow[]>;
  }

  /** Roll-up KPI summary for the admin header cards. */
  async getOverview(days: number, clinicId?: string) {
    const sessions = await this.fetchSessions(days, clinicId);

    const total = sessions.length;
    const returning = sessions.filter((s) => s.patientId).length;
    const faceMatchRate = total > 0 ? Math.round((returning / total) * 1000) / 10 : 0;

    const withEnd = sessions.filter((s) => s.endedAt);
    const totalMinutes = withEnd.reduce((sum, s) => {
      const ms = s.endedAt!.getTime() - s.startedAt.getTime();
      return sum + Math.max(0, ms / 60000);
    }, 0);
    const avgIntakeMinutes =
      withEnd.length > 0 ? Math.round((totalMinutes / withEnd.length) * 10) / 10 : 0;

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const briefCount = await this.prisma.intakeRecord.count({
      where: { generatedAt: { gte: since } },
    });
    const briefSuccessRate = total > 0 ? Math.round((briefCount / total) * 1000) / 10 : 0;

    const active = sessions.filter((s) => !TERMINAL_STATUSES.includes(s.status)).length;

    await this.auditService.log({
      action: 'ANALYTICS_OVERVIEW_VIEW',
      actorId: 'system',
      actorRole: 'ADMIN',
      resourceType: 'analytics',
      resourceId: 'overview',
      details: { days, clinicId, total },
      ipAddress: 'internal',
    });

    return {
      days,
      totalSessions: total,
      returningPatients: returning,
      newPatients: total - returning,
      faceMatchRate,
      avgIntakeMinutes,
      briefSuccessRate,
      activeSessions: active,
    };
  }

  /** Daily patient volume for the window, zero-filled for gaps. */
  async getVolume(days: number, clinicId?: string) {
    const sessions = await this.fetchSessions(days, clinicId);

    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const buckets = new Map<string, number>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      buckets.set(dayKey(d), 0);
    }
    sessions.forEach((s) => {
      const key = dayKey(s.startedAt);
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
    });

    const data = Array.from(buckets.entries()).map(([date, count]) => ({ date, count }));

    await this.auditService.log({
      action: 'ANALYTICS_VOLUME_VIEW',
      actorId: 'system',
      actorRole: 'ADMIN',
      resourceType: 'analytics',
      resourceId: 'volume',
      details: { days, clinicId, points: data.length },
      ipAddress: 'internal',
    });

    return { days, data };
  }

  /** Peak clinic hours: sessions bucketed by hour of day (0–23). */
  async getHours(days: number, clinicId?: string) {
    const sessions = await this.fetchSessions(days, clinicId);

    const hours = new Array(24).fill(0);
    sessions.forEach((s) => {
      hours[s.startedAt.getHours()] += 1;
    });

    const data = hours.map((count, hour) => ({ hour, count }));

    await this.auditService.log({
      action: 'ANALYTICS_HOURS_VIEW',
      actorId: 'system',
      actorRole: 'ADMIN',
      resourceType: 'analytics',
      resourceId: 'hours',
      details: { days, clinicId },
      ipAddress: 'internal',
    });

    return { days, data };
  }

  /** Real-time patient flow board: sessions per pipeline stage. */
  async getFlow(clinicId?: string) {
    const where = clinicId ? { clinicId } : {};
    const sessions = (await this.prisma.intakeSession.findMany({
      where,
      select: { status: true },
    })) as Array<{ status: string }>;

    const stages = FLOW_STAGES.map((stage) => ({
      key: stage.key,
      label: stage.label,
      count: sessions.filter((s) => (stage.statuses as readonly string[]).includes(s.status))
        .length,
    }));
    const total = sessions.length;

    await this.auditService.log({
      action: 'ANALYTICS_FLOW_VIEW',
      actorId: 'system',
      actorRole: 'ADMIN',
      resourceType: 'analytics',
      resourceId: 'flow',
      details: { clinicId, total },
      ipAddress: 'internal',
    });

    return { total, stages };
  }

  /** CSV export of daily volume (BOM-prefixed for Excel). */
  async exportCsv(days: number, clinicId?: string): Promise<{ filename: string; csv: string }> {
    const { data } = await this.getVolume(days, clinicId);

    const header = 'date,sessions';
    const rows = data.map((d) => `${d.date},${d.count}`);
    const csv = `\uFEFF${header}\n${rows.join('\n')}\n`;

    await this.auditService.log({
      action: 'ANALYTICS_CSV_EXPORT',
      actorId: 'system',
      actorRole: 'ADMIN',
      resourceType: 'analytics',
      resourceId: 'export',
      details: { days, clinicId, rows: data.length },
      ipAddress: 'internal',
    });

    this.logger.log(`Exported analytics CSV (${data.length} rows)`);
    return { filename: `analytics-${days}d.csv`, csv };
  }
}
