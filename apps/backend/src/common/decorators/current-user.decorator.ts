import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  clinicId?: string;
}

export const CurrentUser = createParamDecorator<
  keyof AuthenticatedUser | undefined,
  ExecutionContext
>((data, ctx) => {
  const request = ctx.switchToHttp().getRequest<Request>();
  const user = request.user as AuthenticatedUser | undefined;

  if (!user) return undefined;

  return data ? user[data] : user;
});
