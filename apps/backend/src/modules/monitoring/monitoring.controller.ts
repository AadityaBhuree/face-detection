import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime value import
import { MonitoringService } from './monitoring.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@jeevandata/shared-types';

@ApiTags('Monitoring')
@ApiBearerAuth('access-token')
@Controller('monitoring')
@Roles(UserRole.ADMIN, UserRole.SYSTEM)
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('latency')
  @ApiOperation({
    summary: 'API latency percentiles',
    description: 'p50/p95/p99 latency for HTTP requests and Qdrant operations (admin panel).',
  })
  getLatency() {
    return this.monitoringService.getLatency();
  }

  @Get('alerts')
  @ApiOperation({
    summary: 'Evaluated alert thresholds',
    description:
      'Current alert status for error rate (>1%), face-match p95 latency (>2s), and session timeout rate (>5%).',
  })
  async getAlerts() {
    return this.monitoringService.getAlerts();
  }
}
