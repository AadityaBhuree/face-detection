import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
// ConfigService must stay a VALUE import: NestJS DI resolves the
// constructor param via emitDecoratorMetadata (import type erases it).
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { ConfigService } from '@nestjs/config';
/* eslint-enable @typescript-eslint/consistent-type-imports */

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret')!,
    });
  }

  async validate(payload: JwtPayload): Promise<{ id: string; email: string; role: string }> {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
