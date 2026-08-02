import { Controller, Post, Body, Get, HttpCode, HttpStatus } from '@nestjs/common';
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

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body(new ZodValidationPipe(registerUserSchema))
    data: RegisterUserInput,
  ): Promise<AuthUser> {
    return this.authService.register(data);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginUserSchema))
    data: LoginUserInput,
  ) {
    return this.authService.login(data);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body(new ZodValidationPipe(refreshTokenSchema))
    data: RefreshTokenInput,
  ) {
    return this.authService.refresh(data.refreshToken);
  }

  @Get('profile')
  @HttpCode(HttpStatus.OK)
  async profile(@CurrentUser('id') userId: string): Promise<AuthUser> {
    return this.authService.getProfile(userId);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser('id') userId: string) {
    return this.authService.logout(userId);
  }
}
