import { Controller, Get, Param, Query, Patch, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime value import
import { DashboardService } from './dashboard.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Public } from '../../common/decorators/public.decorator';
import {
  paginationQuerySchema,
  patientHistoryQuerySchema,
  uuidParamSchema,
  patientIdParamSchema,
  type PaginationQuery,
  type PatientHistoryQuery,
} from '@jeevandata/shared-schemas';

@ApiTags('Dashboard')
@Controller()
@Public()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('dashboard/patient/:patientId/latest-brief')
  @ApiOperation({ summary: 'Latest clinical brief for a patient' })
  async getLatestBrief(
    @Param(new ZodValidationPipe(patientIdParamSchema))
    params: {
      patientId: string;
    },
  ) {
    return this.dashboardService.getLatestBrief(params.patientId);
  }

  @Get('dashboard/active-sessions')
  @ApiOperation({
    summary: 'List active intake sessions',
    description: 'Paginated list of sessions currently in intake.',
  })
  async getActiveSessions(
    @Query(new ZodValidationPipe(paginationQuerySchema))
    query: PaginationQuery,
  ) {
    return this.dashboardService.getActiveSessions(query.page, query.limit);
  }

  @Get('dashboard/recent-briefs')
  @ApiOperation({
    summary: 'List recently generated briefs',
    description: 'Paginated list of the latest clinical briefs for the doctor.',
  })
  async getRecentBriefs(
    @Query(new ZodValidationPipe(paginationQuerySchema))
    query: PaginationQuery,
  ) {
    return this.dashboardService.getRecentBriefs(query.page, query.limit);
  }

  @Patch('brief/:id/review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a brief as reviewed' })
  async markBriefReviewed(
    @Param(new ZodValidationPipe(uuidParamSchema))
    params: {
      id: string;
    },
  ) {
    return this.dashboardService.markBriefReviewed(params.id);
  }

  @Get('dashboard/patient/:patientId/history')
  @ApiOperation({
    summary: 'Full visit history for a patient',
    description: 'Paginated consultation history used to load patient context before intake.',
  })
  async getPatientHistory(
    @Param(new ZodValidationPipe(patientIdParamSchema))
    params: { patientId: string },
    @Query(new ZodValidationPipe(patientHistoryQuerySchema))
    query: PatientHistoryQuery,
  ) {
    return this.dashboardService.getPatientHistory(params.patientId, query.page, query.limit);
  }
}
