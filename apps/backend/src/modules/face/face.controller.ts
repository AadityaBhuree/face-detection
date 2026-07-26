import { Controller, Post, Body, Get, Param, HttpCode, HttpStatus } from '@nestjs/common';
import type { FaceService } from './face.service';
import type { FaceRegistrationService } from './face-registration.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Public } from '../../common/decorators/public.decorator';
import {
  faceEmbeddingSchema,
  faceSearchQuerySchema,
  type FaceEmbeddingInput,
  type FaceSearchQuery,
} from '@ayutalk/shared-schemas';
import type { RegisterPatientDto, SearchByFaceDto } from './dto/register-patient.dto';

@Controller('face')
@Public()
export class FaceController {
  constructor(
    private readonly faceService: FaceService,
    private readonly registrationService: FaceRegistrationService,
  ) {}

  @Post('embedding')
  @HttpCode(HttpStatus.CREATED)
  async upsertEmbedding(
    @Body(new ZodValidationPipe(faceEmbeddingSchema))
    data: FaceEmbeddingInput,
  ) {
    return this.faceService.upsertEmbedding(data);
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  async searchByFace(
    @Body(new ZodValidationPipe(faceSearchQuerySchema))
    query: FaceSearchQuery,
  ) {
    return this.faceService.searchByFace(query);
  }

  @Post('search-with-details')
  @HttpCode(HttpStatus.OK)
  async searchWithDetails(@Body() query: SearchByFaceDto) {
    return this.registrationService.searchWithDetails(query.vector, query.threshold, query.limit);
  }

  @Post('register-patient')
  @HttpCode(HttpStatus.CREATED)
  async registerPatient(@Body() data: RegisterPatientDto) {
    return this.registrationService.registerPatient(data);
  }

  @Get(':patientId/embeddings')
  async getPatientEmbeddings(@Param('patientId') patientId: string) {
    return this.faceService.getPatientEmbeddings(patientId);
  }
}
