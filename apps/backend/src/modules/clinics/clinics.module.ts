import { Module } from '@nestjs/common';
import { ClinicsController } from './clinics.controller';
import { ClinicsService } from './clinics.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [ClinicsController],
  providers: [ClinicsService],
  exports: [ClinicsService],
})
export class ClinicsModule {}
