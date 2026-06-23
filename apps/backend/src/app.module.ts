import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from './logger/logger.module';
import { PrismaModule } from './prisma/prisma.module';
import { FaceModule } from './modules/face/face.module';
import { IntakeModule } from './modules/intake/intake.module';
import { AiModule } from './modules/ai/ai.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { SessionModule } from './modules/session/session.module';
import { AuditModule } from './modules/audit/audit.module';
import { PmsModule } from './modules/pms/pms.module';
import { TranscriptionModule } from './modules/transcription/transcription.module';
import { configuration } from './config/configuration';

@Module({
  imports: [
    // ─── Global Configuration ──────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env', '.env.local', '.env.development'],
    }),

    // ─── Rate Limiting ─────────────────────────────────────────
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60000),
        limit: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 100),
      },
    ]),

    // ─── Application Modules ───────────────────────────────────
    LoggerModule,
    PrismaModule,

    // ─── Domain Modules ────────────────────────────────────────
    FaceModule,
    IntakeModule,
    AiModule,
    DashboardModule,
    SessionModule,
    AuditModule,
    PmsModule,
    TranscriptionModule,
  ],
})
export class AppModule {}
