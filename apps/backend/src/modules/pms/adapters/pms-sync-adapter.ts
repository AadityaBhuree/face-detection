import type { PmsSyncInput } from '@ayutalk/shared-schemas';

export interface SyncResult {
  synced: boolean;
  target: string;
  externalId?: string;
  resourceType?: 'Patient' | 'Encounter' | 'Observation';
  durationMs?: number;
  error?: string;
}

export interface PmsSyncAdapter {
  readonly targetSystem: string;
  sync(data: PmsSyncInput & { intakeData?: Record<string, unknown>; patientDemographics?: Record<string, unknown> }): Promise<SyncResult>;
}
