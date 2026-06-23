import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { PmsSyncInput } from '@ayutalk/shared-schemas';
import type { PatientContext } from '@ayutalk/shared-types';

@Injectable()
export class PmsService {
  private readonly logger = new Logger(PmsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async syncToPms(data: PmsSyncInput): Promise<{ synced: boolean; target: string }> {
    this.logger.log(
      `Syncing intake ${data.intakeRecordId} to PMS system: ${data.targetSystem}`,
    );

    // TODO: Implement actual HL7 FHIR or custom adapter push
    // This will be connected to the clinic's PMS/EMR system
    if (data.targetSystem === 'hl7_fhir') {
      return this.syncViaHL7FHIR(data);
    }

    return this.syncViaCustomAdapter(data);
  }

  private async syncViaHL7FHIR(
    _data: PmsSyncInput,
  ): Promise<{ synced: boolean; target: string }> {
    this.logger.warn('HL7 FHIR sync adapter not yet implemented');
    // Placeholder for FHIR R4 bundle creation and POST to EHR endpoint
    return { synced: false, target: 'hl7_fhir' };
  }

  private async syncViaCustomAdapter(
    _data: PmsSyncInput,
  ): Promise<{ synced: boolean; target: string }> {
    this.logger.warn('Custom PMS adapter not yet implemented');
    return { synced: false, target: 'custom' };
  }

  async loadPatientContext(patientId: string): Promise<PatientContext | null> {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      this.logger.warn(`Patient ${patientId} not found for context loading`);
      return null;
    }

    // Load patient context - in production this pulls from PMS/EMR
    return {
      patientId: patient.id,
      demographics: {
        id: patient.id,
        name: patient.name,
        dob: patient.dob.toISOString().split('T')[0] ?? '',
        mobile: patient.mobile,
      },
      visitHistory: [],
      chronicConditions: [],
      currentMedications: [],
      upcomingAppointment: null,
      riskFlags: [],
    };
  }
}
