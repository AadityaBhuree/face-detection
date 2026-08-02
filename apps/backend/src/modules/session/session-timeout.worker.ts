import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import type { SessionStatus } from '@jeevandata/shared-types';
import { Logger, type OnModuleInit } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import type { PrismaService } from '../../prisma/prisma.service';
import type { SessionService } from './session.service';

export const SESSION_TIMEOUT_QUEUE = 'session-timeout';

/**
 * BullMQ worker that periodically checks for intake sessions that have
 * exceeded the inactivity timeout and transitions them to TIMED_OUT.
 *
 * Runs every 60 seconds (repeatable job). Queries the database for sessions
 * in a non-terminal active status whose `updatedAt` is older than the
 * configured `session.inactivityTimeoutMs` threshold.
 */
@Processor(SESSION_TIMEOUT_QUEUE, {
  concurrency: 1,
})
export class SessionTimeoutWorker extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(SessionTimeoutWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
    private readonly configService: ConfigService,
    @InjectQueue(SESSION_TIMEOUT_QUEUE)
    private readonly timeoutQueue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    // Remove any stale repeatable jobs from previous runs
    await this.timeoutQueue
      .removeRepeatable('session-timeout-sweep', { every: 60_000 })
      .catch(() => {
        // Expected on first run — no existing repeatable job to clean up
      });

    // Schedule the timeout sweep every 60 seconds
    await this.timeoutQueue.add(
      'session-timeout-sweep',
      {},
      {
        repeat: { every: 60_000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    this.logger.log('Session timeout sweep scheduled every 60 seconds');
  }

  async process(job: Job<void, void, string>): Promise<void> {
    this.logger.debug(`Timeout sweep #${job.id ?? '—'} started`);

    const timeoutMs = this.configService.get<number>('session.inactivityTimeoutMs', 600000); // 10 min default

    const cutoff = new Date(Date.now() - timeoutMs);

    try {
      // Find all sessions in a non-terminal active state that haven't
      // been updated within the timeout window
      const staleSessions = await this.prisma.intakeSession.findMany({
        where: {
          status: {
            notIn: ['COMPLETED', 'FAILED', 'TIMED_OUT'],
          },
          updatedAt: { lt: cutoff },
        },
        select: { id: true, status: true, updatedAt: true },
        orderBy: { updatedAt: 'asc' },
      });

      if (staleSessions.length === 0) {
        this.logger.debug('No stale sessions found');
        return;
      }

      this.logger.warn(`Found ${staleSessions.length} stale session(s) to time out`);

      let timedOut = 0;
      for (const session of staleSessions) {
        try {
          // Attempt an FSM-valid transition through the session service
          await this.sessionService.updateStatus(session.id, 'TIMED_OUT' as SessionStatus);
          timedOut++;
          this.logger.warn(
            `Session ${session.id} timed out (was ${session.status}, ` +
              `last activity: ${session.updatedAt.toISOString()})`,
          );
        } catch (error) {
          // If the transition fails (e.g. session was updated between
          // our query and the update), log and move on
          this.logger.warn(
            `Could not time out session ${session.id}: ` +
              (error instanceof Error ? error.message : String(error)),
          );
        }
      }

      this.logger.log(
        `Timeout sweep complete: ${timedOut}/${staleSessions.length} sessions timed out`,
      );
    } catch (error) {
      this.logger.error(
        'Session timeout sweep failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
