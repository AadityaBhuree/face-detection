import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime value import
import { PrismaService } from '../../prisma/prisma.service';
import type { AuditLogInput, AuditLogQuery, AuditExportQuery } from '@jeevandata/shared-schemas';
import type { Prisma, AuditLog } from '@prisma/client';

/** Max rows a CSV export will return — protects against unbounded exports. */
const EXPORT_MAX_ROWS = 10_000;

/** Keys inside `details` that carry PHI and must be masked on export. */
const PHI_KEYS = new Set([
  'name',
  'firstname',
  'lastname',
  'fullname',
  'patientname',
  'mobile',
  'phone',
  'email',
  'aadhaar',
  'aadhaarref',
  'dob',
  'address',
  'city',
  'pincode',
]);

/** Default retention window when no env/config override is present. */
const DEFAULT_RETENTION_DAYS = 90;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

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

  // ─── HIPAA Audit Log Viewer ───────────────────────────────────

  private buildWhere(query: AuditLogQuery | AuditExportQuery): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = {};

    if (query.action) {
      where.action = { contains: query.action, mode: 'insensitive' };
    }
    if (query.actorId) {
      where.actorId = { contains: query.actorId, mode: 'insensitive' };
    }
    if (query.actorRole) {
      where.actorRole = query.actorRole;
    }
    if (query.resourceType) {
      where.resourceType = { contains: query.resourceType, mode: 'insensitive' };
    }
    if (query.resourceId) {
      where.resourceId = { contains: query.resourceId, mode: 'insensitive' };
    }
    if (query.from || query.to) {
      where.timestamp = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }

    return where;
  }

  /** Paginated, filterable audit log viewer. */
  async queryLogs(query: AuditLogQuery) {
    const where = this.buildWhere(query);
    const { page, limit } = query;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * CSV export with PHI anonymization: sensitive keys inside `details`
   * (name, mobile, aadhaar, email, dob, …) are masked before serialization.
   */
  async exportCsv(query: AuditExportQuery): Promise<{ filename: string; csv: string }> {
    const where = this.buildWhere(query);

    const logs = (await this.prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: EXPORT_MAX_ROWS,
    })) as AuditLog[];

    const header = 'timestamp,action,actorId,actorRole,resourceType,resourceId,ipAddress,details';
    const rows = logs.map((log) =>
      [
        new Date(log.timestamp).toISOString(),
        log.action,
        log.actorId,
        log.actorRole,
        log.resourceType,
        log.resourceId,
        log.ipAddress,
        JSON.stringify(this.anonymizeDetails((log.details ?? {}) as Record<string, unknown>)),
      ]
        .map(csvEscape)
        .join(','),
    );

    const csv = `\uFEFF${header}\n${rows.join('\n')}\n`;

    this.logger.log(`Exported audit log CSV (${rows.length} rows)`);
    return { filename: `audit-log-${Date.now()}.csv`, csv };
  }

  /**
   * Recursively masks PHI-bearing keys in the `details` JSON while keeping
   * the overall structure intact — safe for compliance exports.
   */
  private anonymizeDetails(value: unknown, key = ''): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.anonymizeDetails(item, key));
    }
    if (value !== null && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        out[k] = this.anonymizeDetails(v, k);
      }
      return out;
    }
    if (PHI_KEYS.has(key.toLowerCase())) {
      return '[REDACTED]';
    }
    return value;
  }

  // ─── PHI Access Summary ───────────────────────────────────────

  /** Per-patient, per-day summary of who accessed a patient's record. */
  async getPhiAccessSummary(patientId: string, days: number) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const logs = (await this.prisma.auditLog.findMany({
      where: {
        resourceId: patientId,
        resourceType: 'patient',
        timestamp: { gte: since },
      },
      select: { action: true, actorId: true, actorRole: true, timestamp: true },
      orderBy: { timestamp: 'desc' },
    })) as Array<{
      action: string;
      actorId: string;
      actorRole: string;
      timestamp: Date;
    }>;

    const dayKey = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const byDay = new Map<
      string,
      { date: string; accessCount: number; actors: Set<string>; actions: Map<string, number> }
    >();
    const allActors = new Set<string>();

    for (const log of logs) {
      const key = dayKey(new Date(log.timestamp));
      let bucket = byDay.get(key);
      if (!bucket) {
        bucket = { date: key, accessCount: 0, actors: new Set(), actions: new Map() };
        byDay.set(key, bucket);
      }
      bucket.accessCount += 1;
      bucket.actors.add(log.actorId);
      allActors.add(log.actorId);
      bucket.actions.set(log.action, (bucket.actions.get(log.action) ?? 0) + 1);
    }

    const perDay = Array.from(byDay.values())
      .map((b) => ({
        date: b.date,
        accessCount: b.accessCount,
        uniqueActors: b.actors.size,
        actors: Array.from(b.actors).sort(),
        actions: Object.fromEntries(b.actions),
      }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));

    return {
      patientId,
      days,
      totalAccesses: logs.length,
      uniqueActors: allActors.size,
      perDay,
    };
  }

  // ─── Retention Policy ─────────────────────────────────────────

  /** Retention window in days — env AUDIT_RETENTION_DAYS, default 90. */
  getRetentionDays(): number {
    return this.config.get<number>('audit.retentionDays') ?? DEFAULT_RETENTION_DAYS;
  }

  /**
   * Deletes audit logs older than the retention window (default 90 days,
   * configurable via env or an explicit override). Returns the deleted count.
   */
  async runRetentionCleanup(overrideDays?: number) {
    const retentionDays = overrideDays ?? this.getRetentionDays();
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const { count } = await this.prisma.auditLog.deleteMany({
      where: { timestamp: { lt: cutoff } },
    });

    this.logger.log(
      `Audit retention cleanup: deleted ${count} logs older than ${retentionDays} days`,
    );

    return { deleted: count, retentionDays, cutoff: cutoff.toISOString() };
  }
}

/** RFC-4180 style CSV field escaping (quotes + commas + newlines). */
function csvEscape(value: unknown): string {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
