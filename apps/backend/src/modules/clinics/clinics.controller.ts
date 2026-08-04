import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
// ClinicsService must stay a VALUE import for NestJS DI (emitDecoratorMetadata).
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { ClinicsService } from './clinics.service';
import type { ApiKeyActor } from '../api-keys/api-keys.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import {
  createClinicSchema,
  updateClinicSchema,
  clinicIdParamSchema,
  paginationQuerySchema,
  type CreateClinicInput,
  type UpdateClinicInput,
  type ClinicIdParam,
  type PaginationQuery,
} from '@jeevandata/shared-schemas';
import { UserRole } from '@jeevandata/shared-types';

@ApiTags('Clinics')
@ApiBearerAuth('access-token')
@Controller('clinics')
@Roles(UserRole.ADMIN, UserRole.SYSTEM)
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a clinic',
    description: 'ADMIN/SYSTEM only. Clinic code must be unique (uppercase alphanumeric).',
  })
  async create(
    @Body(new ZodValidationPipe(createClinicSchema))
    data: CreateClinicInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const actor: ApiKeyActor = { id: user.id, role: user.role };
    return this.clinicsService.create(data, actor);
  }

  @Get()
  @ApiOperation({ summary: 'List clinics (paginated)' })
  async list(@Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery) {
    return this.clinicsService.list(query.page, query.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a clinic by id' })
  async getById(@Param(new ZodValidationPipe(clinicIdParamSchema)) params: ClinicIdParam) {
    return this.clinicsService.getById(params.id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a clinic' })
  async update(
    @Param(new ZodValidationPipe(clinicIdParamSchema)) params: ClinicIdParam,
    @Body(new ZodValidationPipe(updateClinicSchema)) data: UpdateClinicInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const actor: ApiKeyActor = { id: user.id, role: user.role };
    return this.clinicsService.update(params.id, data, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a clinic (soft delete)' })
  async deactivate(
    @Param(new ZodValidationPipe(clinicIdParamSchema)) params: ClinicIdParam,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const actor: ApiKeyActor = { id: user.id, role: user.role };
    return this.clinicsService.deactivate(params.id, actor);
  }
}
