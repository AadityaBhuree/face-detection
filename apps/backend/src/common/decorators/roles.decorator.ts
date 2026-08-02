import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@jeevandata/shared-types';

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);
