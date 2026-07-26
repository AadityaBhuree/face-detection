import { Controller, Get, Param, Query, Patch, HttpCode, HttpStatus } from '@nestjs/common';
import type { DashboardService } from './dashboard.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller()
@Public()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('dashboard/patient/:patientId/latest-brief')
  async getLatestBrief(@Param('patientId') patientId: string) {
    return this.dashboardService.getLatestBrief(patientId);
  }

  @Get('dashboard/active-sessions')
  async getActiveSessions(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.dashboardService.getActiveSessions(page, limit);
  }

  @Get('dashboard/recent-briefs')
  async getRecentBriefs(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.dashboardService.getRecentBriefs(page, limit);
  }

  @Patch('brief/:id/review')
  @HttpCode(HttpStatus.OK)
  async markBriefReviewed(@Param('id') id: string) {
    return this.dashboardService.markBriefReviewed(id);
  }

  @Get('dashboard/patient/:patientId/history')
  async getPatientHistory(
    @Param('patientId') patientId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.dashboardService.getPatientHistory(patientId, page, limit);
  }
}
