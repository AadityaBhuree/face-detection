import { Controller, Post, Body, Get, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime value import
import { IntakeService } from './intake.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Public } from '../../common/decorators/public.decorator';
import {
  startIntakeSessionSchema,
  type StartIntakeSessionInput,
  intakeDataSchema,
  type IntakeDataInput,
} from '@jeevandata/shared-schemas';

@ApiTags('Intake')
@Controller('intake')
@Public()
export class IntakeController {
  constructor(private readonly intakeService: IntakeService) {}

  @Post('session')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Start an intake session',
    description: 'Creates a new session for a kiosk device.',
  })
  async startSession(
    @Body(new ZodValidationPipe(startIntakeSessionSchema))
    data: StartIntakeSessionInput,
  ) {
    return this.intakeService.startSession(data);
  }

  @Get('session/:id')
  @ApiOperation({
    summary: 'Get session details',
    description: 'Returns the full session state including the generated brief.',
  })
  @ApiParam({ name: 'id', description: 'Session UUID' })
  async getSession(@Param('id') id: string) {
    return this.intakeService.getSession(id);
  }

  @Post('session/:id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Complete a session with intake data',
    description:
      'Accepts the structured intake data, generates the clinical brief, and finalizes the session.',
  })
  @ApiParam({ name: 'id', description: 'Session UUID' })
  async completeSession(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(intakeDataSchema))
    intakeData: IntakeDataInput,
  ) {
    return this.intakeService.completeWithIntake(id, intakeData);
  }

  @Get('session/:id/status')
  @ApiOperation({ summary: 'Get live session status' })
  @ApiParam({ name: 'id', description: 'Session UUID' })
  async getSessionStatus(@Param('id') id: string) {
    return this.intakeService.getSessionStatus(id);
  }
}
