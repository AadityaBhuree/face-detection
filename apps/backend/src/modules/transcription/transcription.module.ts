import { Module } from '@nestjs/common';
import { TranscriptionService } from './transcription.service';
import { TranscriptionController } from './transcription.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [TranscriptionController],
  providers: [TranscriptionService],
  exports: [TranscriptionService],
})
export class TranscriptionModule {}
