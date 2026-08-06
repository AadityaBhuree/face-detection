import { Test, type TestingModule } from '@nestjs/testing';
import { MonitoringService } from './monitoring.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  MetricsService,
  type LatencySnapshot,
  type MonitoredAlert,
} from '../opentelemetry/metrics.service';

describe('MonitoringService', () => {
  let service: MonitoringService;
  let metrics: MetricsService;

  const mockPrisma = {
    intakeSession: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitoringService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        MetricsService,
      ],
    }).compile();

    service = module.get<MonitoringService>(MonitoringService);
    metrics = module.get<MetricsService>(MetricsService);
  });

  describe('getLatency', () => {
    it('should return the latency snapshot from the metrics service', () => {
      metrics.recordHttpRequest('GET', '/health', 200, 20);
      metrics.recordQdrantLatency('search', 150);

      const snapshot: LatencySnapshot = service.getLatency();
      expect(snapshot.http.count).toBe(1);
      expect(snapshot.http.p50).toBe(20);
      expect(snapshot.qdrant.count).toBe(1);
    });
  });

  describe('getAlerts', () => {
    it('should evaluate a healthy system as all ok', async () => {
      mockPrisma.intakeSession.findMany.mockResolvedValue([
        { status: 'COMPLETED' },
        { status: 'COMPLETED' },
      ]);

      metrics.recordHttpRequest('GET', '/health', 200, 10);
      metrics.recordQdrantLatency('search', 100);

      const alerts: MonitoredAlert[] = await service.getAlerts();
      expect(alerts.every((a) => a.severity === 'ok')).toBe(true);
    });

    it('should mark session timeout alert as warning when >5% of 24h sessions timed out', async () => {
      // 2 of 20 sessions timed out → 10% > 5%
      const statuses = Array.from({ length: 18 }, () => ({ status: 'COMPLETED' }));
      statuses.push({ status: 'TIMED_OUT' }, { status: 'TIMED_OUT' });
      mockPrisma.intakeSession.findMany.mockResolvedValue(statuses);

      const alerts = await service.getAlerts();
      const timeoutAlert = alerts.find((a) => a.key === 'session_timeout_rate')!;
      expect(timeoutAlert.severity).toBe('warning');
      expect(timeoutAlert.value).toBe(10);
      expect(timeoutAlert.message).toContain('exceeds 5%');
    });

    it('should keep session timeout alert ok when rate is within threshold', async () => {
      // 1 of 20 → 5% (not > 5%)
      const statuses = Array.from({ length: 19 }, () => ({ status: 'COMPLETED' }));
      statuses.push({ status: 'TIMED_OUT' });
      mockPrisma.intakeSession.findMany.mockResolvedValue(statuses);

      const alerts = await service.getAlerts();
      const timeoutAlert = alerts.find((a) => a.key === 'session_timeout_rate')!;
      expect(timeoutAlert.severity).toBe('ok');
      expect(timeoutAlert.value).toBe(5);
    });

    it('should return 0 timeout rate when no sessions exist in the window', async () => {
      mockPrisma.intakeSession.findMany.mockResolvedValue([]);

      const alerts = await service.getAlerts();
      const timeoutAlert = alerts.find((a) => a.key === 'session_timeout_rate')!;
      expect(timeoutAlert.value).toBe(0);
      expect(timeoutAlert.severity).toBe('ok');
    });

    it('should only query sessions started within the last 24 hours', async () => {
      mockPrisma.intakeSession.findMany.mockResolvedValue([]);

      await service.getAlerts();

      const where = mockPrisma.intakeSession.findMany.mock.calls[0]![0].where as {
        startedAt: { gte: Date };
      };
      expect(where.startedAt.gte).toBeInstanceOf(Date);
      // The window cutoff should be ~24h in the past (tolerating test runtime).
      const ageMs = Date.now() - where.startedAt.gte.getTime();
      expect(ageMs).toBeGreaterThan(23.5 * 60 * 60 * 1000);
      expect(ageMs).toBeLessThan(24.5 * 60 * 60 * 1000);
    });
  });
});
