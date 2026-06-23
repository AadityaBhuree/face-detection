import { Module } from '@nestjs/common';
import { SessionService } from './session.service';
import { SessionGateway } from './session.gateway';
import { TranscriptionModule } from '../transcription/transcription.module';

@Module({
  imports: [TranscriptionModule],
  providers: [SessionService, SessionGateway],
  exports: [SessionService, SessionGateway],
})
export class SessionModule {}
