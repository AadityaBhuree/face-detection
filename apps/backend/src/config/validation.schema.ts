import { z } from 'zod';

/**
 * ────────────────────────────────────────────────────────────────
 * Environment Validation Schema (Zod)
 * ────────────────────────────────────────────────────────────────
 * Validates all configuration environment variables at bootstrap.
 * - Development / test: every var has a sensible default (matching
 *   `configuration.ts`), so the app boots with zero setup friction.
 * - Production: critical vars are REQUIRED and placeholders are
 *   rejected — the process fails fast with a clear, actionable
 *   message listing exactly what is missing.
 *
 * Wired into `ConfigModule.forRoot({ validate: validateEnv })`.
 */

// Shared defaults — kept in sync with `configuration.ts`.
const DEFAULTS = {
  APP_NAME: 'Jeevandata',
  APP_PORT: '4000',
  FRONTEND_URL: 'http://localhost:3000',
  BACKEND_URL: 'http://localhost:4000',
  DATABASE_URL: 'postgresql://jeevandata:jeevandata_secret@localhost:5432/jeevandata?schema=public',
  REDIS_URL: 'redis://default:redis_secret@localhost:6379',
  QDRANT_URL: 'http://localhost:6333',
  QDRANT_API_KEY: '',
  R2_ENDPOINT: 'http://localhost:9000',
  R2_REGION: 'auto',
  R2_ACCESS_KEY_ID: 'minioadmin',
  R2_SECRET_ACCESS_KEY: 'minioadmin',
  R2_PUBLIC_BUCKET: 'jeevandata-media',
  R2_AUDIO_PREFIX: 'audio',
  R2_FACE_PREFIX: 'faces',
  GOOGLE_GEMINI_API_KEY: '',
  GEMINI_MODEL: 'gemini-2.0-flash',
  ANTHROPIC_API_KEY: '',
  ANTHROPIC_MODEL: 'claude-sonnet-4-20250514',
  OPENAI_API_KEY: '',
  WHISPER_API_URL: 'http://localhost:9001/inference',
  JWT_SECRET: 'change-this-to-a-strong-random-secret',
  JWT_REFRESH_SECRET: 'change-this-to-a-different-random-secret',
  JWT_EXPIRATION: '24h',
  SESSION_INACTIVITY_TIMEOUT_MS: '600000',
  SESSION_AUTO_CLOSE_MS: '600000',
  CORS_ORIGINS: 'http://localhost:3000',
  RATE_LIMIT_WINDOW_MS: '60000',
  RATE_LIMIT_MAX_REQUESTS: '100',
  FACE_MATCH_THRESHOLD: '0.82',
  FACE_EMBEDDING_DIM: '512',
  LIVENESS_THRESHOLD: '0.7',
  AUDIO_AUTO_DELETE_DAYS: '30',
  AUDIO_FORMAT: 'opus',
  AUDIO_SAMPLE_RATE: '48000',
  ARCHIVAL_COLD_AFTER_DAYS: '90',
  AUDIT_RETENTION_DAYS: '90',
  PMS_FHIR_ENDPOINT: '',
  PMS_CUSTOM_ENDPOINT: '',
  PMS_API_KEY: '',
  PMS_CACHE_TTL_MS: '86400000',
  OTEL_ENABLED: 'true',
  OTEL_SERVICE_NAME: 'jeevandata-api',
  OTEL_EXPORTER_TYPE: 'jaeger',
  OTEL_ENDPOINT: 'http://localhost:14268/api/traces',
  OTEL_OTLP_ENDPOINT: 'http://localhost:4318/v1/traces',
  OTEL_SAMPLE_RATE: '1.0',
  LOG_LEVEL: 'debug',
  LOG_FORMAT: 'json',
} as const;

const optionalString = (fallback: string) => z.string().trim().default(fallback);

const optionalInt = (fallback: string) =>
  z.coerce
    .number()
    .int()
    .refine((n) => Number.isFinite(n), { message: 'must be an integer' })
    .default(Number(fallback));

const optionalFloat = (fallback: string) =>
  z.coerce
    .number()
    .refine((n) => Number.isFinite(n), { message: 'must be a number' })
    .default(Number(fallback));

// Accepts common truthy/falsy spellings and normalizes to a real boolean
// (matches the previous lenient `!== 'false'` behavior in configuration.ts).
const BOOLEAN_TRUE = new Set(['true', '1', 'yes', 'on', 'y']);
const BOOLEAN_FALSE = new Set(['false', '0', 'no', 'off', 'n']);

const optionalBool = (fallback: 'true' | 'false') =>
  z
    .preprocess(
      (val) => {
        if (typeof val !== 'string') return val;
        const normalized = val.trim().toLowerCase();
        if (BOOLEAN_TRUE.has(normalized)) return 'true';
        if (BOOLEAN_FALSE.has(normalized)) return 'false';
        return val;
      },
      z.enum(['true', 'false']).default(fallback),
    )
    .transform((v) => v === 'true');

const envSchema = z
  .object({
    // ── Application ─────────────────────────────────────────────
    NODE_ENV: z.enum(['development', 'test', 'production', 'staging']).default('development'),
    APP_NAME: optionalString(DEFAULTS.APP_NAME),
    APP_PORT: optionalInt(DEFAULTS.APP_PORT).refine((n) => n > 0 && n < 65536, {
      message: 'APP_PORT must be between 1 and 65535',
    }),
    FRONTEND_URL: optionalString(DEFAULTS.FRONTEND_URL),
    BACKEND_URL: optionalString(DEFAULTS.BACKEND_URL),

    // ── Database / Cache / Vector ───────────────────────────────
    DATABASE_URL: optionalString(DEFAULTS.DATABASE_URL),
    REDIS_URL: optionalString(DEFAULTS.REDIS_URL),
    QDRANT_URL: optionalString(DEFAULTS.QDRANT_URL),
    QDRANT_API_KEY: optionalString(DEFAULTS.QDRANT_API_KEY),

    // ── Object storage (R2 / MinIO) ─────────────────────────────
    R2_ENDPOINT: optionalString(DEFAULTS.R2_ENDPOINT),
    R2_REGION: optionalString(DEFAULTS.R2_REGION),
    R2_ACCESS_KEY_ID: optionalString(DEFAULTS.R2_ACCESS_KEY_ID),
    R2_SECRET_ACCESS_KEY: optionalString(DEFAULTS.R2_SECRET_ACCESS_KEY),
    R2_PUBLIC_BUCKET: optionalString(DEFAULTS.R2_PUBLIC_BUCKET),
    R2_AUDIO_PREFIX: optionalString(DEFAULTS.R2_AUDIO_PREFIX),
    R2_FACE_PREFIX: optionalString(DEFAULTS.R2_FACE_PREFIX),

    // ── AI providers ────────────────────────────────────────────
    GOOGLE_GEMINI_API_KEY: optionalString(DEFAULTS.GOOGLE_GEMINI_API_KEY),
    GEMINI_MODEL: optionalString(DEFAULTS.GEMINI_MODEL),
    ANTHROPIC_API_KEY: optionalString(DEFAULTS.ANTHROPIC_API_KEY),
    ANTHROPIC_MODEL: optionalString(DEFAULTS.ANTHROPIC_MODEL),
    OPENAI_API_KEY: optionalString(DEFAULTS.OPENAI_API_KEY),
    WHISPER_API_URL: optionalString(DEFAULTS.WHISPER_API_URL),

    // ── JWT / Session ───────────────────────────────────────────
    JWT_SECRET: optionalString(DEFAULTS.JWT_SECRET),
    JWT_REFRESH_SECRET: optionalString(DEFAULTS.JWT_REFRESH_SECRET),
    JWT_EXPIRATION: optionalString(DEFAULTS.JWT_EXPIRATION),
    SESSION_INACTIVITY_TIMEOUT_MS: optionalInt(DEFAULTS.SESSION_INACTIVITY_TIMEOUT_MS),
    SESSION_AUTO_CLOSE_MS: optionalInt(DEFAULTS.SESSION_AUTO_CLOSE_MS),

    // ── Security / Rate limit ───────────────────────────────────
    CORS_ORIGINS: optionalString(DEFAULTS.CORS_ORIGINS),
    RATE_LIMIT_WINDOW_MS: optionalInt(DEFAULTS.RATE_LIMIT_WINDOW_MS),
    RATE_LIMIT_MAX_REQUESTS: optionalInt(DEFAULTS.RATE_LIMIT_MAX_REQUESTS),

    // ── Face recognition ────────────────────────────────────────
    FACE_MATCH_THRESHOLD: optionalFloat(DEFAULTS.FACE_MATCH_THRESHOLD).refine(
      (n) => n >= 0 && n <= 1,
      {
        message: 'FACE_MATCH_THRESHOLD must be between 0 and 1',
      },
    ),
    FACE_EMBEDDING_DIM: optionalInt(DEFAULTS.FACE_EMBEDDING_DIM).refine(
      (n) => n >= 64 && n <= 4096,
      { message: 'FACE_EMBEDDING_DIM must be between 64 and 4096' },
    ),
    LIVENESS_THRESHOLD: optionalFloat(DEFAULTS.LIVENESS_THRESHOLD).refine((n) => n >= 0 && n <= 1, {
      message: 'LIVENESS_THRESHOLD must be between 0 and 1',
    }),

    // ── Audio / archival ────────────────────────────────────────
    AUDIO_AUTO_DELETE_DAYS: optionalInt(DEFAULTS.AUDIO_AUTO_DELETE_DAYS),
    AUDIO_FORMAT: optionalString(DEFAULTS.AUDIO_FORMAT),
    AUDIO_SAMPLE_RATE: optionalInt(DEFAULTS.AUDIO_SAMPLE_RATE),
    ARCHIVAL_COLD_AFTER_DAYS: optionalInt(DEFAULTS.ARCHIVAL_COLD_AFTER_DAYS),
    AUDIT_RETENTION_DAYS: optionalInt(DEFAULTS.AUDIT_RETENTION_DAYS).refine(
      (n) => n >= 1 && n <= 3650,
      {
        message: 'AUDIT_RETENTION_DAYS must be between 1 and 3650',
      },
    ),

    // ── PMS / EMR sync ──────────────────────────────────────────
    PMS_FHIR_ENDPOINT: optionalString(DEFAULTS.PMS_FHIR_ENDPOINT),
    PMS_CUSTOM_ENDPOINT: optionalString(DEFAULTS.PMS_CUSTOM_ENDPOINT),
    PMS_API_KEY: optionalString(DEFAULTS.PMS_API_KEY),
    PMS_CACHE_TTL_MS: optionalInt(DEFAULTS.PMS_CACHE_TTL_MS),

    // ── OpenTelemetry ───────────────────────────────────────────
    OTEL_ENABLED: optionalBool(DEFAULTS.OTEL_ENABLED),
    OTEL_SERVICE_NAME: optionalString(DEFAULTS.OTEL_SERVICE_NAME),
    OTEL_EXPORTER_TYPE: optionalString(DEFAULTS.OTEL_EXPORTER_TYPE),
    OTEL_ENDPOINT: optionalString(DEFAULTS.OTEL_ENDPOINT),
    OTEL_OTLP_ENDPOINT: optionalString(DEFAULTS.OTEL_OTLP_ENDPOINT),
    OTEL_SAMPLE_RATE: optionalFloat(DEFAULTS.OTEL_SAMPLE_RATE),

    // ── Logging ─────────────────────────────────────────────────
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('debug'),
    LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
  })
  .superRefine((data, ctx) => {
    // Production-only requirements — fail fast on weak placeholders.
    if (data.NODE_ENV !== 'production') return;
    if (
      data.JWT_SECRET === 'change-this-to-a-strong-random-secret' ||
      data.JWT_SECRET.length < 16
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET must be a strong, random secret (>= 16 chars) in production',
      });
    }

    if (
      data.JWT_REFRESH_SECRET === 'change-this-to-a-different-random-secret' ||
      data.JWT_REFRESH_SECRET.length < 16
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_REFRESH_SECRET'],
        message: 'JWT_REFRESH_SECRET must be a strong, random secret (>= 16 chars) in production',
      });
    }
  });

export type ValidatedEnv = z.infer<typeof envSchema>;

/**
 * NestJS `ConfigModule.forRoot({ validate })` hook.
 * Throws an Error with a human-readable list of every invalid or
 * missing (production) variable — fail fast, never boot half-configured.
 */
// Vars that MUST be provided explicitly in production — defaults are
// development-only and must never be silently accepted in prod.
const PRODUCTION_REQUIRED: ReadonlyArray<string> = [
  'DATABASE_URL',
  'REDIS_URL',
  'QDRANT_URL',
  'GOOGLE_GEMINI_API_KEY',
];

function collectProductionIssues(raw: Record<string, unknown>): Array<string> {
  if (raw.NODE_ENV !== 'production') return [];

  const missing = PRODUCTION_REQUIRED.filter(
    (name) => !raw[name] || String(raw[name]).trim() === '',
  );

  return missing.map((name) => `${name} is required when NODE_ENV=production`);
}

/**
 * NestJS `ConfigModule.forRoot({ validate })` hook.
 * Throws an Error with a human-readable list of every invalid or
 * missing (production) variable — fail fast, never boot half-configured.
 */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const result = envSchema.safeParse(config);

  // Production requirement checks run against the RAW input so that
  // unset vars (which would otherwise fall back to dev defaults) are
  // correctly flagged as missing.
  const productionIssues = collectProductionIssues(config);

  const allIssues: Array<string> = [
    ...(result.success
      ? []
      : result.error.issues.map(
          (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
        )),
    ...productionIssues,
  ];

  if (allIssues.length > 0) {
    const formatted = allIssues.map((msg) => `  • ${msg}`).join('\n');
    throw new Error(`Environment validation failed — fix the following and restart:\n${formatted}`);
  }

  // Return the normalized + defaulted env so ConfigService sees
  // validated, typed values (not raw strings).
  return result.data as unknown as Record<string, unknown>;
}

/** Directly expose the parsed defaults for tests / tooling. */
export const parsedEnv = envSchema.parse;
