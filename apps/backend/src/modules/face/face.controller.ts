import { Controller, Post, Body, Get, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime value import
import { FaceService } from './face.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime value import
import { FaceRegistrationService } from './face-registration.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Public } from '../../common/decorators/public.decorator';
import {
  faceEmbeddingSchema,
  faceSearchQuerySchema,
  type FaceEmbeddingInput,
  type FaceSearchQuery,
} from '@jeevandata/shared-schemas';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime value import
import { RegisterPatientDto, SearchByFaceDto } from './dto/register-patient.dto';

@ApiTags('Face')
@Controller('face')
@Public()
export class FaceController {
  constructor(
    private readonly faceService: FaceService,
    private readonly registrationService: FaceRegistrationService,
  ) {}

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
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new patient with a face embedding',
    description:
      'Requires explicit consent (consent=true). Stores the embedding in Qdrant and the patient record in PostgreSQL.',
  })
  async registerPatient(@Body() data: RegisterPatientDto) {
    return this.registrationService.registerPatient(data);
  }

  @Get(':patientId/embeddings')
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
