import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveEnv, validateEnv } from '../env';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('resolveEnv', () => {
  it('returns localhost defaults when no NEXT_PUBLIC vars are set', () => {
    const env = resolveEnv({});

    expect(env.apiUrl).toBe('http://localhost:4000');
    expect(env.wsUrl).toBe('http://localhost:4000');
    expect(env.logLevel).toBe('info');
    expect(env.isProduction).toBe(false);
  });

  it('uses provided NEXT_PUBLIC values', () => {
    const env = resolveEnv({
      NEXT_PUBLIC_API_URL: 'https://api.ayutalk.care',
      NEXT_PUBLIC_WS_URL: 'https://ws.ayutalk.care',
      NEXT_PUBLIC_LOG_LEVEL: 'debug',
    });

    expect(env.apiUrl).toBe('https://api.ayutalk.care');
    expect(env.wsUrl).toBe('https://ws.ayutalk.care');
    expect(env.logLevel).toBe('debug');
  });

  it('falls back to info for an invalid log level', () => {
    const env = resolveEnv({ NEXT_PUBLIC_LOG_LEVEL: 'verbose' });
    expect(env.logLevel).toBe('info');
  });

  it('detects production builds from NODE_ENV', () => {
    const env = resolveEnv({ NODE_ENV: 'production' });
    expect(env.isProduction).toBe(true);
  });
});

describe('validateEnv', () => {
  it('passes in development without throwing', () => {
    expect(() => validateEnv({ NODE_ENV: 'development' })).not.toThrow();
  });

  it('returns the resolved env in production when vars are present', () => {
    const env = validateEnv({
      NODE_ENV: 'production',
      NEXT_PUBLIC_API_URL: 'https://api.ayutalk.care',
      NEXT_PUBLIC_WS_URL: 'https://ws.ayutalk.care',
    });

    expect(env.apiUrl).toBe('https://api.ayutalk.care');
    expect(env.isProduction).toBe(true);
  });

  it('throws listing every missing var in production', () => {
    expect(() => validateEnv({ NODE_ENV: 'production' })).toThrow(/NEXT_PUBLIC_API_URL/);
    expect(() => validateEnv({ NODE_ENV: 'production' })).toThrow(/NEXT_PUBLIC_WS_URL/);
  });

  it('throws with a descriptive production message', () => {
    let error: Error | undefined;
    try {
      validateEnv({ NODE_ENV: 'production' });
    } catch (e) {
      error = e as Error;
    }

    expect(error).toBeDefined();
    expect(error!.message).toMatch(/Frontend environment validation failed/);
    expect(error!.message).toMatch(/production build/);
  });
});
