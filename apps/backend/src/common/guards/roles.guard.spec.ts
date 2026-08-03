import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@jeevandata/shared-types';
import { RolesGuard } from './roles.guard';

// ─── Mocks ─────────────────────────────────────────────────────

const reflectorMock = {
  getAllAndOverride: jest.fn(),
};

function makeContext(user: unknown) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
  };
}

describe('RolesGuard', () => {
  let guard: RolesGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new RolesGuard(reflectorMock as unknown as Reflector);
  });

  describe('canActivate', () => {
    it('should allow access when no roles are required (metadata absent)', () => {
      reflectorMock.getAllAndOverride.mockReturnValue(undefined);

      const result = guard.canActivate(makeContext({ role: UserRole.RECEPTIONIST }) as never);

      expect(result).toBe(true);
    });

    it('should allow access when the required roles array is empty', () => {
      reflectorMock.getAllAndOverride.mockReturnValue([]);

      const result = guard.canActivate(makeContext({ role: UserRole.DOCTOR }) as never);

      expect(result).toBe(true);
    });

    it('should deny with ForbiddenException when no user is attached to the request', () => {
      reflectorMock.getAllAndOverride.mockReturnValue([UserRole.DOCTOR]);

      expect(() => guard.canActivate(makeContext(undefined) as never)).toThrow(ForbiddenException);
    });

    it('should deny with ForbiddenException and a clear message when no user is attached', () => {
      reflectorMock.getAllAndOverride.mockReturnValue([UserRole.DOCTOR]);

      let thrown: unknown;
      try {
        guard.canActivate(makeContext(null) as never);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(ForbiddenException);
      expect((thrown as ForbiddenException).message).toBe('Authentication required');
    });

    it('should deny when the user role is not in the required list', () => {
      reflectorMock.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

      let thrown: unknown;
      try {
        guard.canActivate(makeContext({ role: UserRole.RECEPTIONIST }) as never);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(ForbiddenException);
      expect((thrown as ForbiddenException).message).toContain('ADMIN');
    });

    it('should list all required roles in the denial message', () => {
      reflectorMock.getAllAndOverride.mockReturnValue([UserRole.ADMIN, UserRole.SYSTEM]);

      let thrown: unknown;
      try {
        guard.canActivate(makeContext({ role: UserRole.RECEPTIONIST }) as never);
      } catch (error) {
        thrown = error;
      }

      expect((thrown as ForbiddenException).message).toBe(
        'Access denied. Required role: ADMIN or SYSTEM',
      );
    });

    it('should allow access when the user role matches a required role', () => {
      reflectorMock.getAllAndOverride.mockReturnValue([UserRole.DOCTOR, UserRole.ADMIN]);

      const result = guard.canActivate(makeContext({ role: UserRole.DOCTOR }) as never);

      expect(result).toBe(true);
    });

    it('should deny access for SYSTEM role when it is not in the required list', () => {
      reflectorMock.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

      expect(() => guard.canActivate(makeContext({ role: UserRole.SYSTEM }) as never)).toThrow(
        ForbiddenException,
      );
    });
  });
});
