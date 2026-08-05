import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Res,
  Header,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { type Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime value import
import { AuditService } from './audit.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@jeevandata/shared-types';
import {
  auditLogQuerySchema,
  auditExportQuerySchema,
  phiAccessSummaryQuerySchema,
  retentionCleanupSchema,
  patientIdParamSchema,
  type AuditLogQuery,
  type AuditExportQuery,
  type PhiAccessSummaryQuery,
  type RetentionCleanupInput,
} from '@jeevandata/shared-schemas';

@ApiTags('Audit')
@ApiBearerAuth('access-token')
@Controller('audit')
@Roles(UserRole.ADMIN, UserRole.SYSTEM)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @ApiOperation({
    summary: 'Filtered audit log viewer',
    description:
      'Paginated audit trail filtered by action, actor, role, resource, or date range (HIPAA compliance).',
  })
  async getLogs(@Query(new ZodValidationPipe(auditLogQuerySchema)) query: AuditLogQuery) {
    return this.auditService.queryLogs(query);
  }

  @Get('logs/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({
    summary: 'Export audit log as CSV (PHI anonymized)',
    description:
      'Downloads filtered audit log rows as CSV. PHI keys in the details JSON (name, mobile, aadhaar, email, …) are masked.',
  })
  async exportLogs(
    @Query(new ZodValidationPipe(auditExportQuerySchema)) query: AuditExportQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { filename, csv } = await this.auditService.exportCsv(query);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return csv;
  }

  @Get('patients/:patientId/access-summary')
  @ApiOperation({
    summary: 'PHI access summary per patient per day',
    description:
      'Who accessed a patient record, grouped by day over a rolling window (HIPAA accounting of disclosures).',
  })
  async getPhiAccessSummary(
    @Param(new ZodValidationPipe(patientIdParamSchema))
    params: { patientId: string },
    @Query(new ZodValidationPipe(phiAccessSummaryQuerySchema)) query: PhiAccessSummaryQuery,
  ) {
    return this.auditService.getPhiAccessSummary(params.patientId, query.days);
  }

  @Get('retention')
  @ApiOperation({
    summary: 'Current audit log retention policy',
    description: 'Returns the configured retention window in days (default 90).',
  })
  getRetention() {
    return { retentionDays: this.auditService.getRetentionDays() };
  }

  @Post('retention/cleanup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Run retention cleanup',
    description:
      'Deletes audit logs older than the retention window (config default 90 days, or an explicit override).',
  })
  async runRetentionCleanup(
    @Body(new ZodValidationPipe(retentionCleanupSchema)) body: RetentionCleanupInput,
  ) {
    return this.auditService.runRetentionCleanup(body.days);
  }
}
