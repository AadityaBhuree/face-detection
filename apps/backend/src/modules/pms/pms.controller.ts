import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime value import
import { PmsService } from './pms.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Public } from '../../common/decorators/public.decorator';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime value import
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { pmsSyncSchema, type PmsSyncInput } from '@jeevandata/shared-schemas';

@ApiTags('PMS Sync')
@ApiSecurity('api-key')
@Controller('sync')
@Public()
export class PmsController {
  constructor(private readonly pmsService: PmsService) {}

  @Post('pms')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Push intake data to the PMS/EMR',
    description:
      'Synchronizes an intake record to the connected EMR via the FHIR or custom adapter (retry with backoff).',
  })
  @UseGuards(ApiKeyGuard)
  async syncToPms(
    @Body(new ZodValidationPipe(pmsSyncSchema))
    data: PmsSyncInput,
  ) {
    return this.pmsService.syncToPms(data);
  }

  @Post('patient-context')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Load patient context from the PMS',
    description:
      'Pulls patient history/medications into the read-through cache for offline resilience.',
  })
  @UseGuards(ApiKeyGuard)
  async loadPatientContext(@Body() data: { patientId: string }) {
    return this.pmsService.loadPatientContext(data.patientId);
  }
}
