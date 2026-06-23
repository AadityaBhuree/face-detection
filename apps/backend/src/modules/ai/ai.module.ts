import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { IntakeAgentService } from './intake-agent.service';
import { BriefGeneratorService } from './brief-generator.service';
import { SessionModule } from '../session/session.module';

@Module({
  imports: [SessionModule],
  controllers: [AiController],
  providers: [AiService, IntakeAgentService, BriefGeneratorService],
  exports: [AiService, IntakeAgentService, BriefGeneratorService],
})
export class AiModule {}
