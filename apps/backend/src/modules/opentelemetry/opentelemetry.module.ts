import { Global, Module } from '@nestjs/common';
import { OpenTelemetryService } from './opentelemetry.service';

/**
 * OpenTelemetry Module
 *
 * Provides OpenTelemetryService for manual tracing across all modules.
 * Marked as @Global so services in any module can inject it without
 * importing OpenTelemetryModule explicitly.
 */
@Global()
@Module({
  providers: [OpenTelemetryService],
  exports: [OpenTelemetryService],
})
export class OpenTelemetryModule {}
