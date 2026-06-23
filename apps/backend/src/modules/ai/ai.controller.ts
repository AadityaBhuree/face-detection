import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AiService } from './ai.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  aiIntakePromptSchema,
  aiBriefGenerateSchema,
  type AiIntakePromptInput,
  type AiBriefGenerateInput,
} from '@ayutalk/shared-schemas';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('intake-agent')
  @HttpCode(HttpStatus.OK)
  async intakeAgent(
    @Body(new ZodValidationPipe(aiIntakePromptSchema))
    data: AiIntakePromptInput,
  ) {
    return this.aiService.processIntakeConversation(data);
  }

  @Post('brief')
  @HttpCode(HttpStatus.OK)
  async generateBrief(
    @Body(new ZodValidationPipe(aiBriefGenerateSchema))
    data: AiBriefGenerateInput,
  ) {
    return this.aiService.generateClinicalBrief(data);
  }
}
