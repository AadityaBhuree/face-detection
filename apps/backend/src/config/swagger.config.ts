import { type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * ────────────────────────────────────────────────────────────────
 * Swagger / OpenAPI Setup
 * ────────────────────────────────────────────────────────────────
 * Exposes interactive API documentation at `/api/docs`.
 *
 * Security posture:
 * - Disabled in production by default (fail-closed).
 * - Opt in with `SWAGGER_ENABLED=true` in production when a docs
 *   deployment is explicitly wanted.
 * - In development/test the docs are always available.
 */
export function setupSwagger(app: INestApplication): void {
  const configService = app.get(ConfigService);
  const isProduction = configService.get('NODE_ENV') === 'production';
  const swaggerEnabled = configService.get('SWAGGER_ENABLED', 'false') === 'true';

  if (isProduction && !swaggerEnabled) {
    return;
  }

  const config = new DocumentBuilder()
    .setTitle('Jeevandata API')
    .setDescription('AI-powered smart clinic intake system — REST API documentation')
    .setVersion('0.1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Paste your JWT access token (obtained from POST /auth/login)',
      },
      'access-token',
    )
    .addTag('Auth', 'Clinic user authentication (register, login, refresh)')
    .addTag('Face', 'Face recognition, vector search & patient registration')
    .addTag('Intake', 'AI intake session lifecycle')
    .addTag('AI', 'Conversational intake agent & clinical brief generation')
    .addTag('Dashboard', 'Doctor dashboard: sessions, briefs, patient history')
    .addTag('Transcription', 'Whisper speech-to-text transcription')
    .addTag('PMS Sync', 'EMR/PMS synchronization & patient context')
    .addTag('Health', 'Liveness, readiness & overall health checks')
    .addTag('API Keys', 'External integration keys (ADMIN/SYSTEM)')
    .addTag('Clinics', 'Clinic multi-tenancy management (ADMIN/SYSTEM)')
    .addTag('Analytics', 'Admin analytics: KPIs, volume, peak hours, flow board (ADMIN/SYSTEM)')
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for external integrations (PMS sync)',
      },
      'api-key',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'Jeevandata API Docs',
  });
}
