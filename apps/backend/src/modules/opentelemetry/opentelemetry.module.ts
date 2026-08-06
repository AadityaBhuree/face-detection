import { Global, Module } from '@nestjs/common';
import { OpenTelemetryService } from './opentelemetry.service';
import { MetricsService } from './metrics.service';
import { PrometheusController } from './prometheus.controller';

/**
 * OpenTelemetry Module
 *
 * Provides OpenTelemetryService for manual tracing and MetricsService for
 * Prometheus instrumentation across all modules. Marked as @Global so
 * services in any module can inject them without importing the module
 * explicitly. PrometheusController exposes GET /metrics for scraping.
 */
@Global()
@Module({
  controllers: [PrometheusController],
  providers: [OpenTelemetryService, MetricsService],
  exports: [OpenTelemetryService, MetricsService],
})
export class OpenTelemetryModule {}
