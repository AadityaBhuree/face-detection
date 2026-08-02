import { Injectable, Logger } from '@nestjs/common';
// ConfigService must stay a VALUE import: NestJS DI resolves constructor
// dependencies via emitDecoratorMetadata, which needs the runtime class.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { ConfigService } from '@nestjs/config';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { withRetry } from '@jeevandata/shared-utils';
import type { AiIntakePromptInput } from '@jeevandata/shared-schemas';

const BASE_SYSTEM_PROMPT = `You are a warm, professional medical intake assistant conducting a symptom intake conversation with a patient at a clinic. Your role is to gather structured clinical information through natural conversation.

Required information to collect:
1. Chief complaint (primary reason for visit)
2. Symptom onset and duration
3. Severity (1-10 scale)
4. Associated symptoms
5. Recent changes in medications or habits
6. Allergy status updates

Guidelines:
- Speak in a warm, empathetic tone
- Ask one question at a time
- Use the patient's history to ask context-aware follow-ups
- Never make a diagnosis or prescribe treatment
- If the patient reports emergency symptoms (chest pain, difficulty breathing, severe bleeding), escalate immediately
- Once all required information is gathered, summarize and confirm with the patient`;

const LANGUAGE_MAP: Record<string, string> = {
  en: 'Respond in English.',
  hi: 'कृपया हिंदी में बात करें। (Please respond in Hindi.)',
  mr: 'कृपया मराठीतून बोला. (Please respond in Marathi.)',
  es: 'Responda en español. (Please respond in Spanish.)',
};

@Injectable()
export class IntakeAgentService {
  private readonly logger = new Logger(IntakeAgentService.name);
  private readonly apiKey: string;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('google.apiKey')!;
    this.model = this.configService.get<string>('google.model', 'gemini-2.0-flash');
  }

  private buildSystemPrompt(language: string): string {
    const langInstruction = LANGUAGE_MAP[language] ?? LANGUAGE_MAP['en']!;
    return `${BASE_SYSTEM_PROMPT}

---

Patient language preference: ${language}
${langInstruction}`;
  }

  async processTurn(
    data: AiIntakePromptInput,
  ): Promise<{ response: string; intakeComplete: boolean }> {
    const systemPrompt = this.buildSystemPrompt(data.language ?? 'en');

    const messages = [
      { role: 'assistant' as const, content: systemPrompt },
      ...data.conversationHistory,
      { role: 'user' as const, content: data.currentInput },
    ];

    try {
      const result = await withRetry(() => this.callGemini(messages, systemPrompt), {
        maxAttempts: 3,
        baseDelayMs: 1000,
      });

      return result;
    } catch (error) {
      this.logger.error(`Intake agent conversation failed for session ${data.sessionId}`, error);
      throw error;
    }
  }

  private async callGemini(
    messages: Array<{ role: string; content: string }>,
    systemPrompt: string,
  ): Promise<{ response: string; intakeComplete: boolean }> {
    if (!this.apiKey) {
      // Fallback for development without API key
      return {
        response: 'I understand. Could you please tell me more about what brings you in today?',
        intakeComplete: false,
      };
    }

    // Gemini uses 'model' role instead of 'assistant'
    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : m.role,
      parts: [{ text: m.content }],
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          generationConfig: {
            maxOutputTokens: 1024,
          },
        }),
      },
    );

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(`Gemini API error: ${response.status} ${response.statusText} — ${errBody}`);
    }

    const result = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text: string }> };
        finishReason?: string;
      }>;
    };

    const candidate = result.candidates?.[0];
    const responseText = candidate?.content?.parts?.[0]?.text ?? '';
    const finishReason = candidate?.finishReason ?? '';
    // On Gemini, 'STOP' indicates the model naturally finished (intake complete)
    const intakeComplete = finishReason === 'STOP';

    return { response: responseText, intakeComplete };
  }
}
