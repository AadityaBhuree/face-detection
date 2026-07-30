import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { withRetry } from '@ayutalk/shared-utils';
import type { AiBriefGenerateInput } from '@ayutalk/shared-schemas';
import type { ClinicalBrief } from '@ayutalk/shared-types';

const LANGUAGE_MAP: Record<string, string> = {
  en: 'Generate the brief in English.',
  hi: 'कृपया हिंदी में ब्रीफ तैयार करें। (Generate the brief in Hindi.)',
  mr: 'कृपया मराठीतून ब्रीफ तयार करा. (Generate the brief in Marathi.)',
  es: 'Genere el informe en español. (Generate the brief in Spanish.)',
};

const BRIEF_SYSTEM_PROMPT = `You are a clinical AI assistant that generates structured intake briefs for doctors. Given a patient's intake data, transcript, and medical history, produce a concise clinical brief following this schema:

{
  "summary": "2-3 sentence narrative of the patient's condition",
  "chiefComplaint": "Primary reason for visit",
  "riskFlags": ["Critical symptoms that need immediate attention"],
  "vitalsToCheck": ["Suggested vitals based on symptoms"],
  "suggestedFollowups": ["Follow-up questions for the doctor"],
  "medicationsNote": "Summary of medication changes",
  "icd10Hints": ["Preliminary ICD-10 code hints"]
}

Important:
- Highlight ANY risk flags (chest pain, shortness of breath, severe bleeding, suicidal ideation)
- This is preliminary - never make a definitive diagnosis
- Use clinical terminology appropriately
- Be concise - doctors need to read this in under 30 seconds`;

@Injectable()
export class BriefGeneratorService {
  private readonly logger = new Logger(BriefGeneratorService.name);
  private readonly apiKey: string;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('google.apiKey')!;
    this.model = this.configService.get<string>('google.model', 'gemini-2.0-flash');
  }

  async generate(data: AiBriefGenerateInput): Promise<ClinicalBrief> {
    const prompt = this.buildPrompt(data);

    try {
      const result = await withRetry(() => this.callGemini(prompt), {
        maxAttempts: 3,
        baseDelayMs: 1000,
      });
      return result;
    } catch (error) {
      this.logger.error(
        `Brief generation failed for session ${data.sessionId}`,
        error,
      );
      throw error;
    }
  }

  private buildPrompt(data: AiBriefGenerateInput): string {
    const langInstruction = LANGUAGE_MAP[data.language ?? 'en'] ?? LANGUAGE_MAP['en']!;
    return `
Patient History: ${data.patientHistory}

Intake Data:
- Chief Complaint: ${data.intakeData.chiefComplaint}
- Symptoms: ${JSON.stringify(data.intakeData.symptoms)}
- Associated Symptoms: ${data.intakeData.associated.join(', ')}
- Medication Changes: ${data.intakeData.medicationChanges}
- Allergy Updates: ${data.intakeData.allergyUpdates}
- Patient Notes: ${data.intakeData.patientNotes}

Full Transcript: ${data.transcript.slice(0, 10000)}

Patient language preference: ${data.language ?? 'en'}
${langInstruction}

Generate a structured clinical brief based on this information.`;
  }

  private async callGemini(prompt: string): Promise<ClinicalBrief> {
    if (!this.apiKey) {
      // Fallback for development
      return {
        summary: `Patient presents with chief complaint.`,
        chiefComplaint: '',
        riskFlags: [],
        vitalsToCheck: ['Blood Pressure', 'Heart Rate', 'Temperature'],
        suggestedFollowups: [],
        medicationsNote: 'See intake data',
        icd10Hints: [],
      };
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          systemInstruction: {
            parts: [{ text: BRIEF_SYSTEM_PROMPT }],
          },
          generationConfig: {
            maxOutputTokens: 4096,
          },
        }),
      },
    );

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(
        `Gemini API error: ${response.status} ${response.statusText} — ${errBody}`,
      );
    }

    const result = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text: string }> };
      }>;
    };

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return this.parseBriefResponse(text);
  }

  private parseBriefResponse(text: string): ClinicalBrief {
    try {
      // Try to parse JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary ?? '',
          chiefComplaint: parsed.chiefComplaint ?? '',
          riskFlags: parsed.riskFlags ?? [],
          vitalsToCheck: parsed.vitalsToCheck ?? [],
          suggestedFollowups: parsed.suggestedFollowups ?? [],
          medicationsNote: parsed.medicationsNote ?? '',
          icd10Hints: parsed.icd10Hints ?? [],
        };
      }
    } catch {
      this.logger.warn('Failed to parse brief response as JSON, using fallback');
    }

    return {
      summary: text.slice(0, 500),
      chiefComplaint: '',
      riskFlags: [],
      vitalsToCheck: ['Blood Pressure', 'Heart Rate', 'Temperature'],
      suggestedFollowups: [],
      medicationsNote: '',
      icd10Hints: [],
    };
  }
}
