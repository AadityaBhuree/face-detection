/**
 * ────────────────────────────────────────────────────────────────
 * Frontend Structured Logger
 * ────────────────────────────────────────────────────────────────
 * A tiny, dependency-free logging facade used instead of raw
 * `console.*` calls across the frontend.
 *
 * Behaviour:
 * - Level filtering via `NEXT_PUBLIC_LOG_LEVEL` (debug|info|warn|error),
 *   defaulting to `info` (see `env.ts`).
 * - `debug` calls are suppressed entirely in production builds.
 * - `error` calls can carry an `Error` (serialized with name/message/stack).
 * - All calls accept an optional structured context object, serialized
 *   inline so logs stay machine-parseable.
 *
 * Never use `console.*` directly in app code — import `logger` here.
 */

import { env } from './env';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: unknown;
}

const LEVEL_RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const pad = (n: number): string => String(n).padStart(2, '0');

function timestamp(): string {
  const d = new Date();
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

function enabled(level: LogLevel): boolean {
  // debug is never emitted in production builds
  if (env.isProduction && level === 'debug') return false;
  return LEVEL_RANK[level] >= LEVEL_RANK[env.logLevel];
}

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: unknown;
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { value: error };
}

function emit(entry: LogEntry): void {
  if (!enabled(entry.level)) return;

  const { level, message, context, error } = entry;
  const prefix = `[${timestamp()}] [${level.toUpperCase()}] ${message}`;

  const meta: LogContext = {};
  if (context) Object.assign(meta, context);
  if (error !== undefined) meta.error = serializeError(error);

  const line = Object.keys(meta).length > 0 ? `${prefix} ${JSON.stringify(meta)}` : prefix;

  switch (level) {
    case 'debug':
      // eslint-disable-next-line no-console
      console.debug(line);
      break;
    case 'warn':
      // eslint-disable-next-line no-console
      console.warn(line);
      break;
    case 'error':
      // eslint-disable-next-line no-console
      console.error(line);
      break;
    default:
      // eslint-disable-next-line no-console
      console.info(line);
  }
}

export const logger = {
  debug: (message: string, context?: LogContext): void =>
    emit({ level: 'debug', message, context }),
  info: (message: string, context?: LogContext): void => emit({ level: 'info', message, context }),
  warn: (message: string, context?: LogContext): void => emit({ level: 'warn', message, context }),
  error: (message: string, error?: unknown, context?: LogContext): void =>
    emit({ level: 'error', message, error, context }),
};
