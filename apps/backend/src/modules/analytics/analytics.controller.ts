import { Controller, Get, Query, Res, Header } from '@nestjs/common';
import { type Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime value import
import { AnalyticsService } from './analytics.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  analyticsRangeQuerySchema,
  analyticsExportQuerySchema,
  type AnalyticsRangeQuery,
  type AnalyticsExportQuery,
} from '@jeevandata/shared-schemas';
import { UserRole } from '@jeevandata/shared-types';

@ApiTags('Analytics')
@ApiBearerAuth('access-token')
@Controller('analytics')
@Roles(UserRole.ADMIN, UserRole.SYSTEM)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Roll-up clinic KPIs',
    description:
      'Total sessions, returning vs new patients, face match rate, average intake duration, and brief success rate for a rolling window.',
  })
  async getOverview(
    @Query(new ZodValidationPipe(analyticsRangeQuerySchema)) query: AnalyticsRangeQuery,
  ) {
    return this.analyticsService.getOverview(query.days, query.clinicId);
  }

  @Get('volume')
  @ApiOperation({
    summary: 'Daily patient volume',
    description: 'Zero-filled daily session counts for the window (used by the volume chart).',
  })
  async getVolume(
    @Query(new ZodValidationPipe(analyticsRangeQuerySchema)) query: AnalyticsRangeQuery,
  ) {
    return this.analyticsService.getVolume(query.days, query.clinicId);
  }

  @Get('hours')
  @ApiOperation({
    summary: 'Peak clinic hours',
    description: 'Sessions bucketed by hour of day (0–23) for the window (heatmap).',
  })
  async getHours(
    @Query(new ZodValidationPipe(analyticsRangeQuerySchema)) query: AnalyticsRangeQuery,
  ) {
    return this.analyticsService.getHours(query.days, query.clinicId);
  }

  @Get('flow')
  @ApiOperation({
    summary: 'Real-time patient flow board',
    description: 'Counts of sessions per pipeline stage (waiting → intake → triaged → doctor).',
  })
  async getFlow(
    @Query(new ZodValidationPipe(analyticsRangeQuerySchema)) query: AnalyticsRangeQuery,
  ) {
    return this.analyticsService.getFlow(query.clinicId);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({
    summary: 'Export daily volume as CSV',
    description: 'Downloads a CSV file (date,sessions) for the window.',
  })
  async exportCsv(
    @Query(new ZodValidationPipe(analyticsExportQuerySchema)) query: AnalyticsExportQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { filename, csv } = await this.analyticsService.exportCsv(query.days, query.clinicId);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return csv;
  }
}
