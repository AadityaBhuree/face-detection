import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import type { FaceEmbeddingInput, FaceSearchQuery } from '@ayutalk/shared-schemas';

const FACE_COLLECTION = 'face_embeddings';

@Injectable()
export class FaceService {
  private readonly logger = new Logger(FaceService.name);
  private readonly qdrant: QdrantClient;
  constructor(private readonly configService: ConfigService) {
    this.qdrant = new QdrantClient({
      url: this.configService.get<string>('qdrant.url')!,
      apiKey: this.configService.get<string>('qdrant.apiKey') ?? undefined,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.ensureCollection();
  }

  private async ensureCollection(): Promise<void> {
    const collections = await this.qdrant.getCollections();
    const exists = collections.collections.some(
      (c) => c.name === FACE_COLLECTION,
    );

    if (!exists) {
      await this.qdrant.createCollection(FACE_COLLECTION, {
        vectors: {
          size: 512,
          distance: 'Cosine',
        },
        optimizers_config: {
          indexing_threshold: 100,
        },
      });
      this.logger.log(`Created Qdrant collection: ${FACE_COLLECTION}`);
    }
  }

  async upsertEmbedding(data: FaceEmbeddingInput): Promise<void> {
    const pointId = `${data.patientId}_${Date.now()}`;

    await this.qdrant.upsert(FACE_COLLECTION, {
      wait: true,
      points: [
        {
          id: pointId,
          vector: data.vector,
          payload: {
            patient_id: data.patientId,
            captured_at: data.capturedAt ?? new Date().toISOString(),
          },
        },
      ],
    });

    this.logger.debug(`Upserted face embedding for patient ${data.patientId}`);
  }

  async searchByFace(
    query: FaceSearchQuery,
  ): Promise<Array<{ patientId: string; score: number; capturedAt: string }>> {
    const searchResult = await this.qdrant.search(FACE_COLLECTION, {
      vector: query.vector,
      limit: query.limit,
      score_threshold: query.threshold,
      with_payload: true,
    });

    return searchResult.map((hit) => ({
      patientId: (hit.payload?.patient_id as string) ?? '',
      score: hit.score ?? 0,
      capturedAt: (hit.payload?.captured_at as string) ?? '',
    }));
  }

  async getPatientEmbeddings(
    patientId: string,
  ): Promise<Array<{ id: string; capturedAt: string }>> {
    const result = await this.qdrant.scroll(FACE_COLLECTION, {
      filter: {
        must: [
          {
            key: 'patient_id',
            match: { value: patientId },
          },
        ],
      },
      limit: 10,
      with_payload: true,
      with_vector: false,
    });

    if (!result.points || result.points.length === 0) {
      throw new NotFoundException(
        `No embeddings found for patient ${patientId}`,
      );
    }

    return result.points.map((point) => ({
      id: String(point.id),
      capturedAt: (point.payload?.captured_at as string) ?? '',
    }));
  }
}
