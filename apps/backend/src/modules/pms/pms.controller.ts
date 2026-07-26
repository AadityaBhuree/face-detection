import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import type { PmsService } from './pms.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Public } from '../../common/decorators/public.decorator';
import { pmsSyncSchema, type PmsSyncInput } from '@ayutalk/shared-schemas';

@Controller('sync')
@Public()
export class PmsController {
  constructor(private readonly pmsService: PmsService) {}

  @Post('pms')
  @HttpCode(HttpStatus.OK)
  async syncToPms(
    @Body(new ZodValidationPipe(pmsSyncSchema))
    data: PmsSyncInput,
  ) {
    return this.pmsService.syncToPms(data);
  }

  @Post('patient-context')
  @HttpCode(HttpStatus.OK)
  async loadPatientContext(@Body() data: { patientId: string }) {
    return this.pmsService.loadPatientContext(data.patientId);
  }
}
