import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PmsSyncInput } from '@ayutalk/shared-schemas';
import type { PmsSyncAdapter, SyncResult } from './pms-sync-adapter';
import { withRetry } from '../utils/retry.util';

interface FhirPatient {
  resourceType: 'Patient';
  id: string;
  identifier: Array<{ system: string; value: string }>;
  name: Array<{ use: string; family: string; given: string[] }>;
  birthDate: string;
  telecom: Array<{ system: string; value: string; use: string }>;
}

interface FhirEncounter {
  resourceType: 'Encounter';
  id: string;
  status: string;
  class: { system: string; code: string; display: string };
  subject: { reference: string };
  period: { start: string };
  reasonCode: Array<{ coding: Array<{ system: string; code: string; display: string }>; text: string }>;
}

interface FhirObservation {
  resourceType: 'Observation';
  id: string;
  status: string;
  category: Array<{ coding: Array<{ system: string; code: string; display: string }> }>;
  code: { coding: Array<{ system: string; code: string; display: string }>; text: string };
  subject: { reference: string };
  effectiveDateTime: string;
  valueString?: string;
  interpretation?: Array<{ coding: Array<{ system: string; code: string; display: string }> }>;
}

@Injectable()
export class HL7FHIRAdapter implements PmsSyncAdapter {
  readonly targetSystem = 'hl7_fhir';

  private readonly logger = new Logger(HL7FHIRAdapter.name);
  private readonly fhirEndpoint: string;

  constructor(configService: ConfigService) {
    this.fhirEndpoint = configService.get<string>('pms.fhirEndpoint', '');
  }

  async sync(
    data: PmsSyncInput & { intakeData?: Record<string, unknown>; patientDemographics?: Record<string, unknown> },
  ): Promise<SyncResult> {
    const startTime = Date.now();

    if (!this.fhirEndpoint) {
      this.logger.warn('FHIR endpoint not configured — sync skipped');
      return { synced: false, target: 'hl7_fhir', durationMs: Date.now() - startTime, error: 'FHIR endpoint not configured' };
    }

    try {
      // Build FHIR R4 bundle
      const bundle = this.buildFHIRBundle(data);
      this.logger.debug(`FHIR bundle built with ${bundle.entry?.length ?? 0} resources`);

      // Send with retry
      const result = await withRetry(
        () => this.sendBundle(bundle),
        { maxRetries: 3, baseDelayMs: 1_000, maxDelayMs: 10_000 },
        'HL7FHIRAdapter.sync',
      );

      this.logger.log(`FHIR sync completed: ${result.status} (${Date.now() - startTime}ms)`);

      return {
        synced: result.status >= 200 && result.status < 300,
        target: 'hl7_fhir',
        externalId: result.externalId,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(`FHIR sync failed after retries: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        synced: false,
        target: 'hl7_fhir',
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'FHIR sync failed',
      };
    }
  }

  /**
   * Build a FHIR R4 Bundle transaction with Patient, Encounter, and Observation resources.
   */
  private buildFHIRBundle(
    data: PmsSyncInput & { intakeData?: Record<string, unknown>; patientDemographics?: Record<string, unknown> },
  ): { resourceType: 'Bundle'; type: string; entry: Array<{ resource: FhirPatient | FhirEncounter | FhirObservation; request: { method: string; url: string } }> } {
    const timestamp = new Date().toISOString();
    const demos = data.patientDemographics ?? {};
    const intake = data.intakeData ?? {};
    const entry: Array<{ resource: FhirPatient | FhirEncounter | FhirObservation; request: { method: string; url: string } }> = [];

    // ─── Patient Resource ─────────────────────────────────────
    const patientResource: FhirPatient = {
      resourceType: 'Patient',
      id: data.patientId,
      identifier: [
        { system: 'https://ayutalk.care/patients', value: data.patientId },
      ],
      name: [
        {
          use: 'official',
          family: (demos as any).name?.split(' ').slice(1).join(' ') ?? 'Unknown',
          given: [(demos as any).name?.split(' ')[0] ?? 'Patient'],
        },
      ],
      birthDate: (demos as any).dob ?? '',
      telecom: (demos as any).mobile
        ? [{ system: 'phone', value: (demos as any).mobile, use: 'mobile' }]
        : [],
    };
    entry.push({
      resource: patientResource,
      request: { method: 'PUT', url: `Patient/${data.patientId}` },
    });

    // ─── Encounter Resource ───────────────────────────────────
    const encounterResource: FhirEncounter = {
      resourceType: 'Encounter',
      id: data.sessionId,
      status: 'finished',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'ambulatory',
      },
      subject: { reference: `Patient/${data.patientId}` },
      period: { start: timestamp },
      reasonCode: [
        {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: '18484000',
              display: 'Chief complaint (finding)',
            },
          ],
          text: (intake as any).chiefComplaint ?? 'Clinical intake via AyuTalk',
        },
      ],
    };
    entry.push({
      resource: encounterResource,
      request: { method: 'PUT', url: `Encounter/${data.sessionId}` },
    });

    // ─── Observation Resources ────────────────────────────────
    const symptoms = Array.isArray((intake as any).symptoms) ? (intake as any).symptoms : [];
    for (let i = 0; i < Math.min(symptoms.length, 20); i++) {
      const symptom = symptoms[i];
      const observationResource: FhirObservation = {
        resourceType: 'Observation',
        id: `${data.sessionId}-symptom-${i}`,
        status: 'final',
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'survey',
                display: 'Survey',
              },
            ],
          },
        ],
        code: {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: '404684003',
              display: 'Clinical finding (finding)',
            },
          ],
          text: symptom.name ?? `Symptom ${i + 1}`,
        },
        subject: { reference: `Patient/${data.patientId}` },
        effectiveDateTime: timestamp,
        valueString: `Severity: ${symptom.severity ?? 'N/A'}/10, Duration: ${symptom.duration ?? 'N/A'}`,
        interpretation: symptom.severity >= 8
          ? [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'H', display: 'High' }] }]
          : undefined,
      };
      entry.push({
        resource: observationResource,
        request: { method: 'PUT', url: `Observation/${data.sessionId}-symptom-${i}` },
      });
    }

    return {
      resourceType: 'Bundle',
      type: 'transaction',
      entry,
    };
  }

  /**
   * Send the FHIR bundle to the configured endpoint.
   * In production this sends an HTTP POST. For now, logs and returns a mock success.
   */
  private async sendBundle(
    bundle: ReturnType<HL7FHIRAdapter['buildFHIRBundle']>,
  ): Promise<{ status: number; externalId?: string }> {
    // In production:
    // const response = await fetch(this.fhirEndpoint, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/fhir+json',
    //     'Authorization': `Bearer ${this.apiKey}`,
    //   },
    //   body: JSON.stringify(bundle),
    // });
    // return { status: response.status, externalId: (await response.json())?.id };

    this.logger.log(`[MOCK] POST ${this.fhirEndpoint} — ${bundle.entry.length} resources`);
    return { status: 200, externalId: `fhir-bundle-${Date.now()}` };
  }
}
