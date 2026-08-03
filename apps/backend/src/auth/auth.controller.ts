import { Controller, Post, Body, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
// AuthService must stay a VALUE import for NestJS DI (emitDecoratorMetadata).
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { AuthService } from './auth.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { AuthUser } from './auth.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  registerUserSchema,
  loginUserSchema,
  refreshTokenSchema,
  type RegisterUserInput,
  type LoginUserInput,
  type RefreshTokenInput,
} from '@jeevandata/shared-schemas';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a clinic user',
    description:
      'Creates a RECEPTIONIST account. Role and clinicId are never accepted from the client (no privilege escalation).',
  })
  @ApiBody({
    schema: {
      example: {
        name: 'Dr. Priya Sharma',
        email: 'doctor@jeevandata.com',
        password: 'StrongPass123',
      },
    },
  })
  async register(
    @Body(new ZodValidationPipe(registerUserSchema))
    data: RegisterUserInput,
  ): Promise<AuthUser> {
    return this.authService.register(data);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login with email + password',
    description:
      'Returns an access token, refresh token, and expiry. Use the access token as a Bearer token.',
  })
  @ApiBody({
    schema: {
      example: { email: 'doctor@jeevandata.com', password: 'StrongPass123' },
    },
  })
  async login(
    @Body(new ZodValidationPipe(loginUserSchema))
    data: LoginUserInput,
  ) {
    return this.authService.login(data);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate an expired access token',
    description:
      'Accepts a valid refresh token and issues a fresh access + refresh pair (rotation with reuse protection).',
  })
  @ApiBody({
    schema: { example: { refreshToken: 'your-refresh-token' } },
  })
  async refresh(
    @Body(new ZodValidationPipe(refreshTokenSchema))
    data: RefreshTokenInput,
  ) {
    return this.authService.refresh(data.refreshToken);
  }

  @Get('profile')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Requires a valid JWT access token.',
  })
  async profile(@CurrentUser('id') userId: string): Promise<AuthUser> {
    return this.authService.getProfile(userId);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Logout',
    description: 'Revokes all active refresh tokens for the current user.',
  })
  async logout(@CurrentUser('id') userId: string) {
    return this.authService.logout(userId);
  }
}
