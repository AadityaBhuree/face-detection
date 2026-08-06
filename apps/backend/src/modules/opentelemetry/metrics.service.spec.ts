import { Test, type TestingModule } from '@nestjs/testing';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsService],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
  });

  describe('recordHttpRequest', () => {
    it('should record request counters for success and error statuses', () => {
      service.recordHttpRequest('GET', '/health', 200, 12);
      service.recordHttpRequest('POST', '/face/search', 500, 300);

      // No throw + error path increments the error counter and outcome window
      const { rate, sampleCount } = service.getErrorRate();
      expect(sampleCount).toBe(2);
      expect(rate).toBe(0.5);
    });

    it('should expose the histogram for /metrics scraping', async () => {
      service.recordHttpRequest('GET', '/health', 200, 12);
      const text = await service.getMetricsText();

      expect(text).toContain('jeevandata_http_requests_total');
      expect(text).toContain('jeevandata_http_request_duration_seconds');
      expect(text).toContain('route="/health"');
    });
  });

  describe('error rate', () => {
    it('should return 0 when no requests have been recorded', () => {
      expect(service.getErrorRate()).toEqual({ rate: 0, sampleCount: 0 });
    });

    it('should count only 5xx responses as errors', () => {
      service.recordHttpRequest('GET', '/a', 200, 5);
      service.recordHttpRequest('GET', '/b', 404, 5);
      service.recordHttpRequest('GET', '/c', 503, 5);

      const { rate } = service.getErrorRate();
      expect(rate).toBeCloseTo(1 / 3);
    });
  });

  describe('latency percentiles', () => {
    it('should return zeros when no samples exist', () => {
      const snapshot = service.getLatencySnapshot();
      expect(snapshot.http).toEqual({ p50: 0, p95: 0, p99: 0, count: 0 });
      expect(snapshot.qdrant).toEqual({ p50: 0, p95: 0, p99: 0, count: 0 });
    });

    it('should compute p50/p95/p99 from the sample ring buffer', () => {
      // Record 100 requests at 10..109 ms (uniform)
      for (let i = 10; i < 110; i++) {
        service.recordHttpRequest('GET', '/x', 200, i);
      }

      const { http } = service.getLatencySnapshot();
      expect(http.count).toBe(100);
      // p50 of 10..109 (interpolated) ≈ 60, p95 ≈ 105, p99 ≈ 108
      expect(http.p50).toBeGreaterThanOrEqual(55);
      expect(http.p50).toBeLessThanOrEqual(65);
      expect(http.p95).toBeGreaterThanOrEqual(100);
      expect(http.p99).toBeGreaterThanOrEqual(105);
    });

    it('should track Qdrant latency separately', () => {
      service.recordQdrantLatency('search', 150);
      service.recordQdrantLatency('search', 250);

      const { qdrant } = service.getLatencySnapshot();
      expect(qdrant.count).toBe(2);
      // Interpolated: p50=(150+250)/2=200, p95≈245, p99≈249
      expect(qdrant.p50).toBe(200);
      expect(qdrant.p95).toBe(245);
      expect(qdrant.p99).toBe(249);
    });
  });

  describe('alert evaluation', () => {
    it('should flag critical when error rate exceeds 1%', () => {
      // 2 errors out of 100 → 2% > 1%
      for (let i = 0; i < 98; i++) service.recordHttpRequest('GET', '/x', 200, 5);
      service.recordHttpRequest('GET', '/x', 500, 5);
      service.recordHttpRequest('GET', '/x', 503, 5);

      const alerts = service.evaluateAlerts();
      const errorAlert = alerts.find((a) => a.key === 'http_error_rate')!;
      expect(errorAlert.severity).toBe('critical');
    });

    it('should NOT flag critical when error rate exceeds 1% but sample count is tiny', () => {
      // 1 request, 1 error → 100% but below the MIN_ERROR_SAMPLES guard → no false alarm
      service.recordHttpRequest('GET', '/x', 500, 5);

      const alerts = service.evaluateAlerts();
      const errorAlert = alerts.find((a) => a.key === 'http_error_rate')!;
      expect(errorAlert.severity).toBe('ok');
    });

    it('should flag warning when face-match p95 exceeds 2s', () => {
      // 10% of searches take 2.5s → p95 lands above the 2s threshold
      for (let i = 0; i < 100; i++) {
        service.recordQdrantLatency('search', i < 90 ? 100 : 2500);
      }

      const alerts = service.evaluateAlerts();
      const latencyAlert = alerts.find((a) => a.key === 'face_match_latency')!;
      expect(latencyAlert.severity).toBe('warning');
      expect(latencyAlert.value).toBeGreaterThanOrEqual(2000);
    });

    it('should NOT flag warning on a single slow search (min-sample guard)', () => {
      // 1 slow search + 3 fast = 4 samples < MIN_LATENCY_SAMPLES → no false alarm,
      // even though interpolated p95 would exceed the 2s threshold.
      service.recordQdrantLatency('search', 2500);
      for (let i = 0; i < 3; i++) service.recordQdrantLatency('search', 100);

      const alerts = service.evaluateAlerts();
      const latencyAlert = alerts.find((a) => a.key === 'face_match_latency')!;
      expect(latencyAlert.severity).toBe('ok');
    });

    it('should return ok for all alerts on a healthy system', () => {
      service.recordHttpRequest('GET', '/health', 200, 10);
      service.recordQdrantLatency('search', 120);

      const alerts = service.evaluateAlerts();
      expect(alerts.every((a) => a.severity === 'ok')).toBe(true);
    });

    it('should include all three Phase 6.8 alert keys', () => {
      const alerts = service.evaluateAlerts();
      expect(alerts.map((a) => a.key)).toEqual([
        'http_error_rate',
        'face_match_latency',
        'session_timeout_rate',
      ]);
    });
  });

  describe('session gauges', () => {
    it('should set the active sessions gauge without throwing', () => {
      expect(() => service.setActiveSessions(5)).not.toThrow();
      expect(() => service.incrementSessionTimeouts()).not.toThrow();
    });
  });
});
