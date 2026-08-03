import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

// ─── Mocks ─────────────────────────────────────────────────────

const reflectorMock = {
  getAllAndOverride: jest.fn(),
};

const contextMock = {
  getHandler: jest.fn(() => ({}) as never),
  getClass: jest.fn(() => ({}) as never),
};

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new JwtAuthGuard(reflectorMock as unknown as Reflector);
  });

  // ─── Public route handling ─────────────────────────────────

  describe('handleRequest', () => {
    it('should allow public routes without throwing when no user is attached', () => {
      reflectorMock.getAllAndOverride.mockReturnValue(true);

      const result = guard.handleRequest(null, false, null, contextMock as never);

      expect(result).toBe(false);
      expect(reflectorMock.getAllAndOverride).toHaveBeenCalledWith('isPublic', [
        contextMock.getHandler(),
        contextMock.getClass(),
      ]);
    });

    it('should return the authenticated user on public routes', () => {
      reflectorMock.getAllAndOverride.mockReturnValue(true);
      const user = { id: 'u-1', role: 'DOCTOR' };

      const result = guard.handleRequest(null, user, null, contextMock as never);

      expect(result).toBe(user);
    });

    // ─── Non-public (protected) routes ────────────────────────

    it('should throw the underlying error when a strategy error occurs', () => {
      reflectorMock.getAllAndOverride.mockReturnValue(false);
      const strategyError = new Error('token expired');

      expect(() => guard.handleRequest(strategyError, null, null, contextMock as never)).toThrow(
        strategyError,
      );
    });

    it('should throw UnauthorizedException when no user is resolved on a protected route', () => {
      reflectorMock.getAllAndOverride.mockReturnValue(false);

      expect(() => guard.handleRequest(null, false, null, contextMock as never)).toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException with a clear message for missing user', () => {
      reflectorMock.getAllAndOverride.mockReturnValue(false);

      let thrown: unknown;
      try {
        guard.handleRequest(null, false, null, contextMock as never);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(UnauthorizedException);
      expect((thrown as UnauthorizedException).message).toBe('Invalid or expired token');
    });

    it('should return the user on a protected route when authentication succeeds', () => {
      reflectorMock.getAllAndOverride.mockReturnValue(false);
      const user = { id: 'u-2', email: 'doctor@jeevandata.com', role: 'DOCTOR' };

      const result = guard.handleRequest(null, user, null, contextMock as never);

      expect(result).toBe(user);
    });

    it('should pass through non-boolean public override values (metadata not set)', () => {
      // Reflector returns undefined when no @Public() is present — treated as non-public
      reflectorMock.getAllAndOverride.mockReturnValue(undefined);

      const user = { id: 'u-3', role: 'RECEPTIONIST' };
      const result = guard.handleRequest(null, user, null, contextMock as never);

      expect(result).toBe(user);
    });

    it('should reject when metadata is undefined and no user is present', () => {
      reflectorMock.getAllAndOverride.mockReturnValue(undefined);

      expect(() => guard.handleRequest(null, false, null, contextMock as never)).toThrow(
        UnauthorizedException,
      );
    });
  });
});
