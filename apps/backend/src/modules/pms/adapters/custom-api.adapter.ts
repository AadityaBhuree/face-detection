import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PmsSyncInput } from '@ayutalk/shared-schemas';
import type { PmsSyncAdapter, SyncResult } from './pms-sync-adapter';
import { withRetry } from '../utils/retry.util';

interface CustomPayload {
  sessionId: string;
  patientId: string;
  intakeRecordId: string;
  targetSystem: string;
  patientDemographics?: Record<string, unknown>;
  intakeData?: Record<string, unknown>;
  syncedAt: string;
}

@Injectable()
export class CustomApiAdapter implements PmsSyncAdapter {
  readonly targetSystem = 'custom';

  private readonly logger = new Logger(CustomApiAdapter.name);
  private readonly apiEndpoint: string;

  constructor(configService: ConfigService) {
    this.apiEndpoint = configService.get<string>('pms.customEndpoint', '');
  }

  async sync(
    data: PmsSyncInput & { intakeData?: Record<string, unknown>; patientDemographics?: Record<string, unknown> },
  ): Promise<SyncResult> {
    const startTime = Date.now();

    if (!this.apiEndpoint) {
      this.logger.warn('Custom API endpoint not configured — sync skipped');
      return { synced: false, target: 'custom', durationMs: Date.now() - startTime, error: 'Custom API endpoint not configured' };
    }

    try {
      const payload: CustomPayload = {
        sessionId: data.sessionId,
        patientId: data.patientId,
        intakeRecordId: data.intakeRecordId,
        targetSystem: 'custom',
        patientDemographics: data.patientDemographics,
        intakeData: data.intakeData,
        syncedAt: new Date().toISOString(),
      };

      const result = await withRetry(
        () => this.sendPayload(payload),
        { maxRetries: 3, baseDelayMs: 1_000, maxDelayMs: 10_000 },
        'CustomApiAdapter.sync',
      );

      this.logger.log(`Custom API sync completed: ${result.status} (${Date.now() - startTime}ms)`);

      return {
        synced: result.status >= 200 && result.status < 300,
        target: 'custom',
        externalId: result.externalId,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(`Custom API sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        synced: false,
        target: 'custom',
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Custom API sync failed',
      };
    }
  }

  private async sendPayload(
    _payload: CustomPayload,
  ): Promise<{ status: number; externalId?: string }> {
    // In production, send HTTP POST:
    // const response = await fetch(this.apiEndpoint, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${this.apiKey}`,
    //   },
    //   body: JSON.stringify(payload),
    // });
    // return { status: response.status, externalId: (await response.json())?.id };

    this.logger.log(`[MOCK] POST ${this.apiEndpoint}`);
    return { status: 200, externalId: `custom-sync-${Date.now()}` };
  }
}
