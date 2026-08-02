/**
 * ────────────────────────────────────────────────────────────────
 * Frontend Environment Validation (NEXT_PUBLIC_*)
 * ────────────────────────────────────────────────────────────────
 * Central access point for all client-side environment variables.
 * - Values are read from `process.env.NEXT_PUBLIC_*` (inlined by
 *   Next.js at build time).
 * - Development/test fall back to local defaults so the app runs
 *   with zero setup.
 * - Production builds fail fast with a clear message listing every
 *   missing required variable (call `validateEnv()` in app startup).
 *
 * Never import `process.env` directly elsewhere — use this module.
 */

export interface ClientEnv {
  apiUrl: string;
  wsUrl: string;
  /** Client log level; defaults to 'info'. */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  /** Whether the build is a production build. */
  isProduction: boolean;
}

const DEFAULTS = {
  NEXT_PUBLIC_API_URL: 'http://localhost:4000',
  NEXT_PUBLIC_WS_URL: 'http://localhost:4000',
  NEXT_PUBLIC_LOG_LEVEL: 'info',
} as const;

const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;

export function resolveEnv(raw: Record<string, string | undefined> = process.env): ClientEnv {
  const isProduction = raw.NODE_ENV === 'production';

  const apiUrl = raw.NEXT_PUBLIC_API_URL ?? DEFAULTS.NEXT_PUBLIC_API_URL;
  const wsUrl = raw.NEXT_PUBLIC_WS_URL ?? DEFAULTS.NEXT_PUBLIC_WS_URL;

  const logLevelRaw = (raw.NEXT_PUBLIC_LOG_LEVEL ?? DEFAULTS.NEXT_PUBLIC_LOG_LEVEL) as string;
  const logLevel = (
    LOG_LEVELS.includes(logLevelRaw as never) ? logLevelRaw : 'info'
  ) as ClientEnv['logLevel'];

  return { apiUrl, wsUrl, logLevel, isProduction };
}

/**
 * Fail-fast validation for production builds. Throws an Error naming
 * every missing required `NEXT_PUBLIC_*` variable so a misconfigured
 * build dies at startup instead of failing at runtime.
 */
export function validateEnv(raw: Record<string, string | undefined> = process.env): ClientEnv {
  const env = resolveEnv(raw);

  if (!env.isProduction) return env;

  const missing: string[] = [];
  if (!raw.NEXT_PUBLIC_API_URL) missing.push('NEXT_PUBLIC_API_URL');
  if (!raw.NEXT_PUBLIC_WS_URL) missing.push('NEXT_PUBLIC_WS_URL');

  if (missing.length > 0) {
    throw new Error(
      `Frontend environment validation failed — missing required ` +
        `variables in production build:\n` +
        missing.map((m) => `  • ${m}`).join('\n') +
        `\nAdd them to your build environment (e.g. Vercel, Docker).`,
    );
  }

  return env;
}

/**
 * Typed environment snapshot — use everywhere.
 * Calls `validateEnv` (not `resolveEnv`) so production builds fail
 * fast at build time when required NEXT_PUBLIC_* vars are missing.
 * Safe in dev/test: validation returns early unless NODE_ENV is
 * 'production'.
 */
export const env: ClientEnv = validateEnv();
