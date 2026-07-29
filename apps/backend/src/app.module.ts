import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from './logger/logger.module';
import { CustomThrottlerGuard } from './common/guards/throttler.guard';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { FaceModule } from './modules/face/face.module';
import { IntakeModule } from './modules/intake/intake.module';
import { AiModule } from './modules/ai/ai.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { SessionModule } from './modules/session/session.module';
import { AuditModule } from './modules/audit/audit.module';
import { PmsModule } from './modules/pms/pms.module';
import { TranscriptionModule } from './modules/transcription/transcription.module';
import { HealthModule } from './modules/health/health.module';
import { OpenTelemetryModule } from './modules/opentelemetry/opentelemetry.module';
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
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('rateLimit.windowMs')!,
          limit: config.get<number>('rateLimit.maxRequests')!,
        },
      ],
    }),

    // ─── BullMQ (Background Jobs) ──────────────────────────────
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('redis.url'),
        },
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
        },
      }),
    }),

    // ─── Application Modules ───────────────────────────────────
    LoggerModule,
    PrismaModule,

    // ─── Auth ──────────────────────────────────────────────────
    AuthModule,

    // ─── Domain Modules ────────────────────────────────────────
    FaceModule,
    IntakeModule,
    AiModule,
    DashboardModule,
    SessionModule,
    AuditModule,
    PmsModule,
    TranscriptionModule,

    // ─── Rate Limiting Guard ───────────────────────────────────┐
    // Chained after JwtAuthGuard. Public routes (decorated with │
    // @Public) have throttling skipped via @SkipThrottle().      │
    //                                                            │
    // ─── OpenTelemetry / Tracing ────────────────────────────────┘
    OpenTelemetryModule,

    // ─── Health / Observability ────────────────────────────────
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
})
export class AppModule {}
