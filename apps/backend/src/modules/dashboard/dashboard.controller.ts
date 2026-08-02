import { Controller, Get, Param, Query, Patch, HttpCode, HttpStatus } from '@nestjs/common';
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

@Controller()
@Public()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('dashboard/patient/:patientId/latest-brief')
  async getLatestBrief(
    @Param(new ZodValidationPipe(patientIdParamSchema))
    params: {
      patientId: string;
    },
  ) {
    return this.dashboardService.getLatestBrief(params.patientId);
  }

  @Get('dashboard/active-sessions')
  async getActiveSessions(
    @Query(new ZodValidationPipe(paginationQuerySchema))
    query: PaginationQuery,
  ) {
    return this.dashboardService.getActiveSessions(query.page, query.limit);
  }

  @Get('dashboard/recent-briefs')
  async getRecentBriefs(
    @Query(new ZodValidationPipe(paginationQuerySchema))
    query: PaginationQuery,
  ) {
    return this.dashboardService.getRecentBriefs(query.page, query.limit);
  }

  @Patch('brief/:id/review')
  @HttpCode(HttpStatus.OK)
  async markBriefReviewed(
    @Param(new ZodValidationPipe(uuidParamSchema))
    params: {
      id: string;
    },
  ) {
    return this.dashboardService.markBriefReviewed(params.id);
  }

  @Get('dashboard/patient/:patientId/history')
  async getPatientHistory(
    @Param(new ZodValidationPipe(patientIdParamSchema))
    params: { patientId: string },
    @Query(new ZodValidationPipe(patientHistoryQuerySchema))
    query: PatientHistoryQuery,
  ) {
    return this.dashboardService.getPatientHistory(params.patientId, query.page, query.limit);
  }
}
