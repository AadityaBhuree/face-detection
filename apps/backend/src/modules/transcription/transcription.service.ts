import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);
  private readonly whisperApiUrl: string;
  private readonly openaiApiKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {
    this.whisperApiUrl = this.configService.get<string>(
      'openai.whisperApiUrl',
      'http://localhost:9001/inference',
    );
    this.openaiApiKey = this.configService.get<string>(
      'openai.apiKey',
      '',
    );
  }

  async transcribe(data: { audioUrl: string; sessionId: string }) {
    this.logger.debug(
      `Transcribing audio for session ${data.sessionId}: ${data.audioUrl}`,
    );

    // In production, this fetches audio from R2 and sends to Whisper
    // For development, returns a placeholder
    const text = '[Transcription placeholder - Whisper integration pending]';

    await this.prisma.sessionTranscript.create({
      data: {
        sessionId: data.sessionId,
        speaker: 'patient',
        text,
        timestampMs: Date.now(),
      },
    });

    await this.auditService.log({
      action: 'TRANSCRIPTION_CREATED',
      actorId: 'system',
      actorRole: 'SYSTEM',
      resourceType: 'session_transcript',
      resourceId: data.sessionId,
      details: { audioUrl: data.audioUrl, isPlaceholder: true },
      ipAddress: 'internal',
    });

    return { sessionId: data.sessionId, text, isFinal: true };
  }

  /**
   * Transcribe an audio buffer by sending it to the Whisper API.
   * Supports both OpenAI Whisper API and whisper.cpp local server.
   */
  async transcribeBuffer(
    audioBuffer: Buffer,
    sessionId: string,
  ): Promise<{ text: string; isFinal: boolean }> {
    try {
      const text = await this.callWhisperApi(audioBuffer);

      // Persist the transcribed text
      await this.prisma.sessionTranscript.create({
        data: {
          sessionId,
          speaker: 'patient',
          text,
          timestampMs: BigInt(Date.now()),
        },
      });

      await this.auditService.log({
        action: 'TRANSCRIPTION_BUFFER_COMPLETED',
        actorId: 'system',
        actorRole: 'SYSTEM',
        resourceType: 'session_transcript',
        resourceId: sessionId,
        details: { audioSizeBytes: audioBuffer.length, textLength: text.length },
        ipAddress: 'internal',
      });

      return { text, isFinal: true };
    } catch (error) {
      this.logger.error(
        `Whisper transcription failed for session ${sessionId}`,
        error,
      );

      await this.auditService.log({
        action: 'TRANSCRIPTION_FAILED',
        actorId: 'system',
        actorRole: 'SYSTEM',
        resourceType: 'session_transcript',
        resourceId: sessionId,
        details: { error: error instanceof Error ? error.message : 'Unknown error', audioSizeBytes: audioBuffer.length },
        ipAddress: 'internal',
      });

      throw error;
    }
  }

  private async callWhisperApi(audioBuffer: Buffer): Promise<string> {
    // If OpenAI API key is configured, use OpenAI Whisper API
    if (this.openaiApiKey) {
      return this.callOpenAiWhisper(audioBuffer);
    }

    // Otherwise, try whisper.cpp local server
    return this.callWhisperCpp(audioBuffer);
  }

  private async callOpenAiWhisper(audioBuffer: Buffer): Promise<string> {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/webm' });
    formData.append('file', blob, 'recording.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');
    formData.append('response_format', 'text');

    const response = await fetch(
      'https://api.openai.com/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.openaiApiKey}`,
        },
        body: formData as any,
      },
    );

    if (!response.ok) {
      throw new Error(
        `OpenAI Whisper API error: ${response.status} ${response.statusText}`,
      );
    }

    return response.text();
  }

  private async callWhisperCpp(audioBuffer: Buffer): Promise<string> {
    const response = await fetch(this.whisperApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/webm',
      },
      body: new Uint8Array(audioBuffer) as any,
    });

    if (!response.ok) {
      throw new Error(
        `whisper.cpp API error: ${response.status} ${response.statusText}`,
      );
    }

    const result = (await response.json()) as { text?: string };
    return result.text?.trim() ?? '';
  }

  async getTranscript(sessionId: string, page: number, limit: number) {
    const session = await this.prisma.intakeSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    const [transcripts, total] = await Promise.all([
      this.prisma.sessionTranscript.findMany({
        where: { sessionId },
        orderBy: { timestampMs: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.sessionTranscript.count({
        where: { sessionId },
      }),
    ]);

    await this.auditService.log({
      action: 'TRANSCRIPT_VIEW',
      actorId: 'system',
      actorRole: 'SYSTEM',
      resourceType: 'session_transcript',
      resourceId: sessionId,
      details: { transcriptCount: transcripts.length, total, page, limit },
      ipAddress: 'internal',
    });

    return {
      data: transcripts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
