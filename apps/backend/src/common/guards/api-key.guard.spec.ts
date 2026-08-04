/* eslint-disable @typescript-eslint/no-explicit-any -- test mocks */

import { UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';

// ─── Mock ApiKeyService ────────────────────────────────────────

const mockApiKeyService = {
  validateKey: jest.fn(),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createContext(headers: Record<string, unknown>): any {
  // Single shared request object so the guard's mutation is observable.
  const request = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  };
}

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new ApiKeyGuard(mockApiKeyService as any);
  });

  it('should throw Unauthorized when the X-API-Key header is missing', async () => {
    const context = createContext({});

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(mockApiKeyService.validateKey).not.toHaveBeenCalled();
  });

  it('should throw Unauthorized for an empty X-API-Key header', async () => {
    const context = createContext({ 'x-api-key': '   ' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('should throw Unauthorized for an array X-API-Key header', async () => {
    const context = createContext({ 'x-api-key': ['k1', 'k2'] });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('should validate a valid key and attach it to the request', async () => {
    const validated = {
      id: 'k1',
      name: 'pms',
      prefix: 'jk_valid',
      clinicId: null,
    };
    mockApiKeyService.validateKey.mockResolvedValue(validated);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const context = createContext({ 'x-api-key': 'jk_validkey123' }) as any;
    const request = context.switchToHttp().getRequest();

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(mockApiKeyService.validateKey).toHaveBeenCalledWith('jk_validkey123');
    expect(request.apiKey).toEqual(validated);
  });

  it('should propagate UnauthorizedException from the service (invalid key)', async () => {
    mockApiKeyService.validateKey.mockRejectedValue(new UnauthorizedException('Invalid API key'));

    const context = createContext({ 'x-api-key': 'bad-key' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
