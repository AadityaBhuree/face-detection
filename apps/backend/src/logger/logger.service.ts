import type { LoggerService } from '@nestjs/common';
import pino, { type Logger as PinoLogger, type Level } from 'pino';

export class Logger implements LoggerService {
  private readonly logger: PinoLogger;

  constructor(context?: string) {
    const level = (process.env.LOG_LEVEL ?? 'debug') as Level;
    const isDev = process.env.NODE_ENV !== 'production';

    this.logger = pino({
      level,
      name: context ?? 'Jeevandata',
      transport: isDev
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
      serializers: {
        req: (req) => ({
          method: req.method,
          url: req.url,
          correlationId: req.headers?.['x-correlation-id'],
          userAgent: req.headers?.['user-agent'],
        }),
        res: (res) => ({
          statusCode: res.statusCode,
        }),
        err: pino.stdSerializers.err,
        error: pino.stdSerializers.err,
      },
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'body.password',
          'body.token',
          'body.secret',
          'body.aadhaarRef',
          'body.aadhaar',
        ],
        censor: '[REDACTED]',
      },
    });
  }

  verbose(message: string, ...args: unknown[]): void {
    this.logger.trace(args, message);
  }

  debug(message: string, ...args: unknown[]): void {
    this.logger.debug(args, message);
  }

  log(message: string, ...args: unknown[]): void {
    this.logger.info(args, message);
  }

  warn(message: string, ...args: unknown[]): void {
    this.logger.warn(args, message);
  }

  error(message: string, ...args: unknown[]): void {
    this.logger.error(args, message);
  }

  fatal(message: string, ...args: unknown[]): void {
    this.logger.fatal(args, message);
  }

  child(context: string): Logger {
    return new Logger(context);
  }
}
