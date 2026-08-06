import { Controller, Get, Header } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { MetricsService } from './metrics.service';

/**
 * PrometheusController — exposes the MetricsService registry for scraping.
 *
 * Returns raw Prometheus exposition text (never the JSON envelope) so
 * Prometheus/Grafana can consume it directly. Public + unthrottled so
 * scrapers are never blocked by rate limiting or auth.
 */
@Controller()
export class PrometheusController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('metrics')
  @Public()
  @SkipThrottle()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async getMetrics(): Promise<string> {
    // Returns the raw exposition text; the TransformInterceptor skips
    // the JSON envelope for this route (see transform.interceptor.ts).
    return this.metrics.getMetricsText();
  }
}
