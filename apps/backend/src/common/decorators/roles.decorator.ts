import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@ayutalk/shared-types';

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);
