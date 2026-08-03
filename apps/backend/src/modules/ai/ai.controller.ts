import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime value import
import { AiService } from './ai.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Public } from '../../common/decorators/public.decorator';
import {
  aiIntakePromptSchema,
  aiBriefGenerateSchema,
  type AiIntakePromptInput,
  type AiBriefGenerateInput,
} from '@jeevandata/shared-schemas';

@ApiTags('AI')
@Controller('ai')
@Public()
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('intake-agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'One AI intake turn',
    description:
      'Sends the conversation history + latest patient input to the Gemini intake agent and returns the next empathetic response (one question at a time).',
  })
  async intakeAgent(
    @Body(new ZodValidationPipe(aiIntakePromptSchema))
    data: AiIntakePromptInput,
  ) {
    return this.aiService.processIntakeConversation(data);
  }

  @Post('brief')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate a clinical brief',
    description:
      'Produces the structured JSON brief (chief complaint, risk flags, vitals to check, ICD-10 hints) for a completed intake.',
  })
  async generateBrief(
    @Body(new ZodValidationPipe(aiBriefGenerateSchema))
    data: AiBriefGenerateInput,
  ) {
    return this.aiService.generateClinicalBrief(data);
  }
}
