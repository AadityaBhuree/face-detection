import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

// ─── Mocks ─────────────────────────────────────────────────────

interface ResponseMock {
  status: jest.Mock;
  json: jest.Mock;
}

function makeHost(response: ResponseMock, url = '/test') {
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ url }),
    }),
  };
  return host as unknown as ArgumentsHost;
}

function makeResponse(): ResponseMock {
  return {
    status: jest.fn().mockReturnThis() as jest.Mock,
    json: jest.fn() as jest.Mock,
  };
}

function jsonArg(response: ResponseMock) {
  return response.json.mock.calls[0]![0] as Record<string, unknown>;
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let response: ResponseMock;

  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(() => {
    // Silence the filter's logger during tests
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    response = makeResponse();
    filter = new HttpExceptionFilter();
  });

  // ─── HttpException handling ────────────────────────────────

  describe('catch with HttpException', () => {
    it('should map a string response body to HTTP_<status> code', () => {
      filter.catch(new NotFoundException('Patient not found'), makeHost(response));

      expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      const body = jsonArg(response);
      expect(body.status).toBe('error');
      expect((body.error as { code: string }).code).toBe('HTTP_404');
      expect((body.error as { message: string }).message).toBe('Patient not found');
      expect(body.path).toBe('/test');
      expect(typeof body.timestamp).toBe('string');
    });

    it('should preserve a custom code from the exception response object', () => {
      filter.catch(
        new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: { errors: [{ field: 'name' }] },
        }),
        makeHost(response),
      );

      expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      const body = jsonArg(response);
      expect((body.error as { code: string }).code).toBe('VALIDATION_ERROR');
      expect((body.error as { details: unknown }).details).toEqual({
        errors: [{ field: 'name' }],
      });
    });

    it('should flatten class-validator array messages into 400 VALIDATION_ERROR', () => {
      const validationMessages = ['name must be a string', 'age must be a number'];
      filter.catch(new BadRequestException(validationMessages), makeHost(response));

      expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      const body = jsonArg(response);
      expect((body.error as { code: string }).code).toBe('VALIDATION_ERROR');
      expect((body.error as { message: string }).message).toBe('Validation failed');
      expect((body.error as { details: { errors: string[] } }).details.errors).toEqual(
        validationMessages,
      );
    });

    it('should fall back to the exception message when the response body is malformed', () => {
      filter.catch(new ForbiddenException('Access denied'), makeHost(response));

      const body = jsonArg(response);
      expect(response.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
      expect((body.error as { message: string }).message).toBe('Access denied');
      expect((body.error as { code: string }).code).toBe('HTTP_403');
    });
  });

  // ─── Non-HttpException error handling ─────────────────────

  describe('catch with non-HttpException error', () => {
    it('should return 500 with the raw message in development', () => {
      process.env.NODE_ENV = 'development';

      filter.catch(new Error('db connection refused'), makeHost(response));

      expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      const body = jsonArg(response);
      expect((body.error as { code: string }).code).toBe('INTERNAL_SERVER_ERROR');
      expect((body.error as { message: string }).message).toBe('db connection refused');
    });

    it('should hide internal error details in production', () => {
      process.env.NODE_ENV = 'production';

      filter.catch(new Error('db connection refused'), makeHost(response));

      const body = jsonArg(response);
      expect((body.error as { message: string }).message).toBe('An unexpected error occurred');
    });

    it('should log unhandled errors with their stack', () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('boom');
      const loggerSpy = jest.spyOn(Logger.prototype, 'error');

      filter.catch(error, makeHost(response));

      expect(loggerSpy).toHaveBeenCalledWith('Unhandled exception: boom', error.stack);
    });
  });

  // ─── Unknown (non-Error) values ────────────────────────────

  describe('catch with unknown values', () => {
    it('should return 500 UNKNOWN_ERROR for non-Error thrown values', () => {
      filter.catch('something went wrong', makeHost(response));

      expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      const body = jsonArg(response);
      expect((body.error as { code: string }).code).toBe('UNKNOWN_ERROR');
      expect((body.error as { message: string }).message).toBe('An unknown error occurred');
    });

    it('should always include the request path in the response body', () => {
      filter.catch(new Error('boom'), makeHost(response, '/api/v1/face/search'));

      const body = jsonArg(response);
      expect(body.path).toBe('/api/v1/face/search');
    });
  });
});
