import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { logger } from '../logger';

describe('logger', () => {
  const spies: Record<string, ReturnType<typeof vi.spyOn>> = {};

  beforeEach(() => {
    spies.info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    spies.warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    spies.error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    spies.debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    Object.values(spies).forEach((spy) => spy.mockRestore());
  });

  it('should emit info messages through console.info', () => {
    logger.info('session started', { sessionId: 's-1' });

    expect(spies.info).toHaveBeenCalledTimes(1);
    const line = spies.info.mock.calls[0]![0] as string;
    expect(line).toContain('[INFO]');
    expect(line).toContain('session started');
    expect(line).toContain('"sessionId":"s-1"');
  });

  it('should suppress debug messages at the default info level', () => {
    logger.debug('noisy detail');

    expect(spies.debug).not.toHaveBeenCalled();
  });

  it('should emit warn messages with context', () => {
    logger.warn('detection skipped', { frame: 42 });

    expect(spies.warn).toHaveBeenCalledTimes(1);
    const line = spies.warn.mock.calls[0]![0] as string;
    expect(line).toContain('[WARN]');
    expect(line).toContain('"frame":42');
  });

  it('should serialize Error objects with name, message, and stack', () => {
    const error = new Error('boom');

    logger.error('operation failed', error);

    expect(spies.error).toHaveBeenCalledTimes(1);
    const line = spies.error.mock.calls[0]![0] as string;
    expect(line).toContain('[ERROR]');
    expect(line).toContain('"name":"Error"');
    expect(line).toContain('"message":"boom"');
    expect(line).toContain('"stack"');
  });

  it('should merge context and error into a single structured line', () => {
    logger.error('identity search failed', new Error('timeout'), {
      patientId: 'p-1',
    });

    const line = spies.error.mock.calls[0]![0] as string;
    expect(line).toContain('"patientId":"p-1"');
    expect(line).toContain('"message":"timeout"');
  });

  it('should include a timestamp in every emitted line', () => {
    logger.info('plain message');

    const line = spies.info.mock.calls[0]![0] as string;
    expect(line).toMatch(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] \[INFO\]/);
  });

  it('should emit a plain line without a meta object when there is no context', () => {
    logger.info('no meta');

    const line = spies.info.mock.calls[0]![0] as string;
    expect(line).toMatch(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] \[INFO\] no meta$/);
  });
});
