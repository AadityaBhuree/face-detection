import { validateEnv, parsedEnv } from './validation.schema';

describe('validateEnv', () => {
  it('returns a validated object when all vars are valid', () => {
    const result = validateEnv({
      NODE_ENV: 'development',
      APP_PORT: '4100',
      FACE_MATCH_THRESHOLD: '0.85',
    });

    expect(result).toBeDefined();
    expect(result.APP_PORT).toBe(4100);
    expect(result.FACE_MATCH_THRESHOLD).toBe(0.85);
    expect(result.NODE_ENV).toBe('development');
  });

  it('applies documented defaults for unset vars (dev-friendly)', () => {
    const result = validateEnv({});

    expect(result.NODE_ENV).toBe('development');
    expect(result.APP_PORT).toBe(4000);
    expect(result.FACE_MATCH_THRESHOLD).toBe(0.82);
    expect(result.RATE_LIMIT_MAX_REQUESTS).toBe(100);
    expect(result.OTEL_ENABLED).toBe(true);
  });

  it('coerces numeric and boolean string values', () => {
    const result = validateEnv({
      APP_PORT: '8080',
      RATE_LIMIT_WINDOW_MS: '30000',
      OTEL_ENABLED: 'false',
    });

    expect(result.APP_PORT).toBe(8080);
    expect(result.RATE_LIMIT_WINDOW_MS).toBe(30000);
    expect(result.OTEL_ENABLED).toBe(false);
  });

  it('accepts common truthy/falsy spellings for booleans', () => {
    expect(validateEnv({ OTEL_ENABLED: '1' }).OTEL_ENABLED).toBe(true);
    expect(validateEnv({ OTEL_ENABLED: 'yes' }).OTEL_ENABLED).toBe(true);
    expect(validateEnv({ OTEL_ENABLED: '0' }).OTEL_ENABLED).toBe(false);
    expect(validateEnv({ OTEL_ENABLED: 'off' }).OTEL_ENABLED).toBe(false);
  });

  it('throws a descriptive error for invalid enum values', () => {
    expect(() => validateEnv({ NODE_ENV: 'banana' })).toThrow(/Environment validation failed/);
  });

  it('throws for out-of-range numeric values', () => {
    expect(() => validateEnv({ FACE_MATCH_THRESHOLD: '1.5' })).toThrow(/FACE_MATCH_THRESHOLD/);
    expect(() => validateEnv({ APP_PORT: '99999' })).toThrow(/APP_PORT/);
  });

  it('throws for invalid numeric input (non-numeric string)', () => {
    expect(() => validateEnv({ APP_PORT: 'not-a-number' })).toThrow(
      /Environment validation failed/,
    );
  });

  describe('production enforcement', () => {
    it('passes when all production-required secrets are present', () => {
      const result = validateEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://prod:secret@db:5432/jeevandata',
        REDIS_URL: 'redis://prod:secret@redis:6379',
        QDRANT_URL: 'http://qdrant:6333',
        GOOGLE_GEMINI_API_KEY: 'AIza-valid-prod-key',
        JWT_SECRET: 'a-very-strong-32-char-random-secret!!',
        JWT_REFRESH_SECRET: 'a-different-32-char-random-secret!!',
      });

      expect(result.NODE_ENV).toBe('production');
      expect(result.JWT_SECRET).toBe('a-very-strong-32-char-random-secret!!');
    });

    it('rejects a weak refresh secret in production', () => {
      expect(() =>
        validateEnv({
          NODE_ENV: 'production',
          DATABASE_URL: 'postgresql://x',
          REDIS_URL: 'redis://x',
          QDRANT_URL: 'http://x',
          GOOGLE_GEMINI_API_KEY: 'key',
          JWT_SECRET: 'a-very-strong-32-char-random-secret!!',
          JWT_REFRESH_SECRET: 'short',
        }),
      ).toThrow(/JWT_REFRESH_SECRET/);
    });

    it('fails fast listing every missing required secret', () => {
      let error: Error | undefined;
      try {
        validateEnv({
          NODE_ENV: 'production',
          JWT_SECRET: 'a-very-strong-32-char-random-secret!!',
        });
      } catch (e) {
        error = e as Error;
      }

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/DATABASE_URL/);
      expect(error!.message).toMatch(/REDIS_URL/);
      expect(error!.message).toMatch(/QDRANT_URL/);
      expect(error!.message).toMatch(/GOOGLE_GEMINI_API_KEY/);
    });

    it('rejects the placeholder JWT secret in production', () => {
      expect(() =>
        validateEnv({
          NODE_ENV: 'production',
          DATABASE_URL: 'postgresql://x',
          REDIS_URL: 'redis://x',
          QDRANT_URL: 'http://x',
          GOOGLE_GEMINI_API_KEY: 'key',
          JWT_SECRET: 'change-this-to-a-strong-random-secret',
          JWT_REFRESH_SECRET: 'a-different-32-char-random-secret!!',
        }),
      ).toThrow(/JWT_SECRET/);
    });

    it('does NOT require production secrets in development', () => {
      expect(() =>
        validateEnv({
          NODE_ENV: 'development',
        }),
      ).not.toThrow();
    });
  });
});

describe('parsedEnv', () => {
  it('parses a full valid env object', () => {
    const parsed = parsedEnv({
      NODE_ENV: 'test',
      GOOGLE_GEMINI_API_KEY: 'test-key',
    });

    expect(parsed.NODE_ENV).toBe('test');
    expect(parsed.GOOGLE_GEMINI_API_KEY).toBe('test-key');
  });
});
