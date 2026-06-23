import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IntakeService } from './intake.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  startIntakeSessionSchema,
  type StartIntakeSessionInput,
  intakeDataSchema,
  type IntakeDataInput,
} from '@ayutalk/shared-schemas';

@Controller('intake')
export class IntakeController {
  constructor(private readonly intakeService: IntakeService) {}

  @Post('session')
  @HttpCode(HttpStatus.CREATED)
  async startSession(
    @Body(new ZodValidationPipe(startIntakeSessionSchema))
    data: StartIntakeSessionInput,
  ) {
    return this.intakeService.startSession(data);
  }

  @Get('session/:id')
  async getSession(@Param('id') id: string) {
    return this.intakeService.getSession(id);
  }

  @Post('session/:id/complete')
  @HttpCode(HttpStatus.OK)
  async completeSession(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(intakeDataSchema))
    intakeData: IntakeDataInput,
  ) {
    return this.intakeService.completeWithIntake(id, intakeData);
  }

  @Get('session/:id/status')
  async getSessionStatus(@Param('id') id: string) {
    return this.intakeService.getSessionStatus(id);
  }
}
