import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { HealthService } from './health.service';

@Controller('health')
@Public()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /** Liveness probe — always returns 200 if the process is running */
  @Get('live')
  getLiveness() {
    return this.healthService.getLiveness();
  }

  /** Readiness probe — checks all critical dependencies (DB, Redis, Qdrant) */
  @Get('ready')
  async getReadiness() {
    return this.healthService.getReadiness();
  }

  /** Overall health summary */
  @Get()
  async getHealth() {
    return this.healthService.getHealth();
  }
}
