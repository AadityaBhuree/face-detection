import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SessionService } from './session.service';
import { SessionGateway } from './session.gateway';
import { SessionTimeoutWorker, SESSION_TIMEOUT_QUEUE } from './session-timeout.worker';
import { TranscriptionModule } from '../transcription/transcription.module';

@Module({
  imports: [
    TranscriptionModule,
    BullModule.registerQueue({
      name: SESSION_TIMEOUT_QUEUE,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    }),
  ],
  providers: [SessionService, SessionGateway, SessionTimeoutWorker],
  exports: [SessionService, SessionGateway],
})
export class SessionModule {}
