import { Module } from '@nestjs/common';
import { IntakeController } from './intake.controller';
import { IntakeService } from './intake.service';
import { SessionModule } from '../session/session.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [SessionModule, AiModule],
  controllers: [IntakeController],
  providers: [IntakeService],
  exports: [IntakeService],
})
export class IntakeModule {}
