import { Controller, Post, Body, Get, Param, HttpCode, HttpStatus, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime value import
import { FaceService } from './face.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime value import
import { FaceRegistrationService } from './face-registration.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@jeevandata/shared-types';
import {
  faceEmbeddingSchema,
  faceSearchQuerySchema,
  type FaceEmbeddingInput,
  type FaceSearchQuery,
} from '@jeevandata/shared-schemas';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime value import
import { RegisterPatientDto, SearchByFaceDto } from './dto/register-patient.dto';

@ApiTags('Face')
@ApiBearerAuth('access-token')
@Controller('face')
export class FaceController {
  constructor(
    private readonly faceService: FaceService,
    private readonly registrationService: FaceRegistrationService,
  ) {}

  @Public()
  @Post('embedding')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Upsert a face embedding',
    description: 'Stores a 512-dim L2-normalized embedding vector for an existing patient.',
  })
  async upsertEmbedding(
    @Body(new ZodValidationPipe(faceEmbeddingSchema))
    data: FaceEmbeddingInput,
  ) {
    return this.faceService.upsertEmbedding(data);
  }

  @Public()
  @Post('search')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Raw face search',
    description: 'Cosine-similarity search against Qdrant. Rate limited to 10 req/min.',
  })
  async searchByFace(
    @Body(new ZodValidationPipe(faceSearchQuerySchema))
    query: FaceSearchQuery,
  ) {
    return this.faceService.searchByFace(query);
  }

  @Public()
  @Post('search-with-details')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Search face + return patient details',
    description:
      'Matches a vector and returns the full patient record when the score meets the threshold (default 0.82). Rate limited to 10 req/min.',
  })
  async searchWithDetails(@Body() query: SearchByFaceDto) {
    return this.registrationService.searchWithDetails(query.vector, query.threshold, query.limit);
  }

  @Post('register-patient')
  @Roles(UserRole.RECEPTIONIST, UserRole.DOCTOR)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new patient with a face embedding',
    description:
      'Requires explicit consent (consent=true). Stores the embedding in Qdrant and the patient record in PostgreSQL.',
  })
  async registerPatient(
    @Body() data: RegisterPatientDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.registrationService.registerPatient(data, idempotencyKey);
  }

  @Get(':patientId/embeddings')
  @Roles(UserRole.RECEPTIONIST, UserRole.DOCTOR)
  @ApiOperation({
    summary: "List a patient's embeddings",
    description: 'Returns the embedding history (capturedAt timestamps) for a patient.',
  })
  @ApiParam({
    name: 'patientId',
    description: 'Patient UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  async getPatientEmbeddings(@Param('patientId') patientId: string) {
    return this.faceService.getPatientEmbeddings(patientId);
  }
}
