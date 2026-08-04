import { Controller, Post, Get, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
// ApiKeyService must stay a VALUE import for NestJS DI (emitDecoratorMetadata).
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { ApiKeyService, type ApiKeyActor } from './api-keys.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import {
  createApiKeySchema,
  apiKeyIdParamSchema,
  type CreateApiKeyInput,
  type ApiKeyIdParam,
} from '@jeevandata/shared-schemas';
import { UserRole } from '@jeevandata/shared-types';

@ApiTags('API Keys')
@ApiBearerAuth('access-token')
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeyService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SYSTEM)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Generate an API key',
    description:
      'Admin/SYSTEM only. Returns the raw key exactly once — copy it now, only its hash is stored.',
  })
  async create(
    @Body(new ZodValidationPipe(createApiKeySchema))
    data: CreateApiKeyInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const actor: ApiKeyActor = { id: user.id, role: user.role };
    return this.apiKeysService.generate(data, actor);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SYSTEM)
  @ApiOperation({
    summary: 'List API keys',
    description: 'Metadata only — hashes and raw keys are never exposed.',
  })
  async list() {
    return this.apiKeysService.list();
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SYSTEM)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke an API key' })
  async revoke(
    @Param(new ZodValidationPipe(apiKeyIdParamSchema))
    params: ApiKeyIdParam,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const actor: ApiKeyActor = { id: user.id, role: user.role };
    return this.apiKeysService.revoke(params.id, actor);
  }
}
