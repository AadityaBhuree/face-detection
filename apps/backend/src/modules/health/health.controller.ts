import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { HealthService } from './health.service';

@Controller('health')
@Public()
@SkipThrottle()
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
    const result = await this.healthService.getReadiness();
    if (result.status === 'unhealthy') {
      throw new HttpException(result, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }

  /** Overall health summary */
  @Get()
  async getHealth() {
    const result = await this.healthService.getHealth();
    if (result.status === 'unhealthy') {
      throw new HttpException(result, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }
}
