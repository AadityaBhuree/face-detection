import { Controller, Post, Body, Get, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import type { TranscriptionService } from './transcription.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller('transcribe')
@Public()
export class TranscriptionController {
  constructor(private readonly transcriptionService: TranscriptionService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async transcribeAudio(@Body() data: { audioUrl: string; sessionId: string }) {
    return this.transcriptionService.transcribe(data);
  }

  @Get('session/:sessionId')
  async getSessionTranscript(
    @Param('sessionId') sessionId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 100,
  ) {
    return this.transcriptionService.getTranscript(sessionId, page, limit);
  }
}
