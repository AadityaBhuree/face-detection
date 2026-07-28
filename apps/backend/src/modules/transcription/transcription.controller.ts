import { Controller, Post, Body, Get, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { TranscriptionService } from './transcription.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Public } from '../../common/decorators/public.decorator';
import {
  transcribeAudioSchema,
  paginationQuerySchema,
  sessionIdParamSchema,
  type TranscribeAudioInput,
  type PaginationQuery,
} from '@ayutalk/shared-schemas';

@Controller('transcribe')
@Public()
export class TranscriptionController {
  constructor(private readonly transcriptionService: TranscriptionService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async transcribeAudio(
    @Body(new ZodValidationPipe(transcribeAudioSchema))
    data: TranscribeAudioInput,
  ) {
    return this.transcriptionService.transcribe(data);
  }

  @Get('session/:sessionId')
  async getSessionTranscript(
    @Param(new ZodValidationPipe(sessionIdParamSchema))
    params: { sessionId: string },
    @Query(new ZodValidationPipe(paginationQuerySchema))
    query: PaginationQuery,
  ) {
    return this.transcriptionService.getTranscript(params.sessionId, query.page, query.limit);
  }
}
