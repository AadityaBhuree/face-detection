import { Module } from '@nestjs/common';
import { PmsService } from './pms.service';
import { PmsController } from './pms.controller';
import { HL7FHIRAdapter } from './adapters/hl7-fhir.adapter';
import { CustomApiAdapter } from './adapters/custom-api.adapter';

@Module({
  controllers: [PmsController],
  providers: [PmsService, HL7FHIRAdapter, CustomApiAdapter],
  exports: [PmsService],
})
export class PmsModule {}
