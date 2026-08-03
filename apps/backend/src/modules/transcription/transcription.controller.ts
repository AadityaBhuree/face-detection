import { Controller, Post, Body, Get, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime value import
import { TranscriptionService } from './transcription.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Public } from '../../common/decorators/public.decorator';
import {
  transcribeAudioSchema,
  paginationQuerySchema,
  sessionIdParamSchema,
  type TranscribeAudioInput,
  type PaginationQuery,
} from '@jeevandata/shared-schemas';

@ApiTags('Transcription')
@Controller('transcribe')
@Public()
export class TranscriptionController {
  constructor(private readonly transcriptionService: TranscriptionService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Transcribe audio',
    description:
      'Sends an audio buffer to the Whisper STT server and returns the transcribed text.',
  })
  async transcribeAudio(
    @Body(new ZodValidationPipe(transcribeAudioSchema))
    data: TranscribeAudioInput,
  ) {
    return this.transcriptionService.transcribe(data);
  }

  @Get('session/:sessionId')
  @ApiOperation({
    summary: 'Get session transcripts',
    description: 'Paginated transcript for an intake session.',
  })
  async getSessionTranscript(
    @Param(new ZodValidationPipe(sessionIdParamSchema))
    params: { sessionId: string },
    @Query(new ZodValidationPipe(paginationQuerySchema))
    query: PaginationQuery,
  ) {
    return this.transcriptionService.getTranscript(params.sessionId, query.page, query.limit);
  }
}
