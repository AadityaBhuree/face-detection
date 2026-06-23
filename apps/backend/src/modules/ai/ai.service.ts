import { Injectable, Logger } from '@nestjs/common';
import { IntakeAgentService } from './intake-agent.service';
import { BriefGeneratorService } from './brief-generator.service';
import { SessionGateway } from '../session/session.gateway';
import type { AiIntakePromptInput, AiBriefGenerateInput } from '@ayutalk/shared-schemas';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly intakeAgent: IntakeAgentService,
    private readonly briefGenerator: BriefGeneratorService,
    private readonly sessionGateway: SessionGateway,
  ) {}

  async processIntakeConversation(data: AiIntakePromptInput) {
    this.logger.debug(
      `Processing intake conversation for session ${data.sessionId}`,
    );

    // Emit the patient's current input via WebSocket so doctor dashboards
    // receive it in real-time (even before the AI responds)
    this.sessionGateway.emitConversationTurn(
      data.sessionId,
      'patient',
      data.currentInput,
    );

    // Process the AI intake turn
    const result = await this.intakeAgent.processTurn(data);

    // Emit the AI's response via WebSocket so doctor dashboards
    // see the full conversation in real-time
    this.sessionGateway.emitConversationTurn(
      data.sessionId,
      'ai',
      result.response,
    );

    return result;
  }

  async generateClinicalBrief(data: AiBriefGenerateInput) {
    this.logger.debug(`Generating clinical brief for session ${data.sessionId}`);
    return this.briefGenerator.generate(data);
  }
}
