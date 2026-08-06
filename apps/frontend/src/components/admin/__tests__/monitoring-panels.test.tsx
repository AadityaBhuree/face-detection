import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LatencyPanel } from '../latency-panel';
import { AlertsPanel } from '../alerts-panel';

describe('LatencyPanel', () => {
  const http = { p50: 40, p95: 120, p99: 250, count: 100 };
  const qdrant = { p50: 80, p95: 300, p99: 900, count: 25 };

  it('renders both latency rows', () => {
    render(<LatencyPanel http={http} qdrant={qdrant} />);

    expect(screen.getByText('HTTP requests')).toBeInTheDocument();
    expect(screen.getByText('Face match (Qdrant)')).toBeInTheDocument();
  });

  it('shows sample counts', () => {
    render(<LatencyPanel http={http} qdrant={qdrant} />);

    expect(screen.getByText('100 samples')).toBeInTheDocument();
    expect(screen.getByText('25 samples')).toBeInTheDocument();
  });

  it('renders p50/p95/p99 bars with values', () => {
    render(<LatencyPanel http={http} qdrant={qdrant} />);

    expect(screen.getByLabelText('p50: 40ms')).toBeInTheDocument();
    expect(screen.getByLabelText('p95: 120ms')).toBeInTheDocument();
    expect(screen.getByLabelText('p99: 250ms')).toBeInTheDocument();
  });

  it('handles an empty dataset without crashing', () => {
    render(<LatencyPanel http={{ p50: 0, p95: 0, p99: 0, count: 0 }} qdrant={qdrant} />);

    expect(screen.getByText('HTTP requests')).toBeInTheDocument();
  });
});

describe('AlertsPanel', () => {
  const healthyAlerts = [
    {
      key: 'http_error_rate',
      label: 'HTTP error rate (5xx, last 5 min)',
      severity: 'ok' as const,
      value: 0.2,
      threshold: 1,
      message: 'Error rate is within the 1% threshold',
    },
    {
      key: 'face_match_latency',
      label: 'Face match p95 latency',
      severity: 'ok' as const,
      value: 120,
      threshold: 2000,
      message: 'p95 face-match latency is 120ms (≤ 2s)',
    },
    {
      key: 'session_timeout_rate',
      label: 'Session timeout rate (24h)',
      severity: 'ok' as const,
      value: 0,
      threshold: 5,
      message: 'Session timeout rate is 0% (≤ 5%)',
    },
  ];

  it('shows all systems nominal when every alert is ok', () => {
    render(<AlertsPanel alerts={healthyAlerts} />);

    expect(screen.getByText('All systems nominal')).toBeInTheDocument();
    expect(screen.getByText('HTTP error rate (5xx, last 5 min)')).toBeInTheDocument();
    expect(screen.getByText('Face match p95 latency')).toBeInTheDocument();
    expect(screen.getByText('Session timeout rate (24h)')).toBeInTheDocument();
  });

  it('shows OK badge for healthy alerts', () => {
    render(<AlertsPanel alerts={healthyAlerts} />);

    expect(screen.getAllByText('OK')).toHaveLength(3);
  });

  it('shows warning badge and summary for a warning alert', () => {
    const withWarning = [
      ...healthyAlerts,
      {
        key: 'face_match_latency',
        label: 'Face match p95 latency',
        severity: 'warning' as const,
        value: 2400,
        threshold: 2000,
        message: 'p95 face-match latency 2400ms exceeds 2s threshold',
      },
    ];
    render(<AlertsPanel alerts={withWarning} />);

    expect(screen.getByText('0 critical · 1 warning')).toBeInTheDocument();
    expect(screen.getByText('WARNING')).toBeInTheDocument();
  });

  it('shows critical badge and summary for a critical alert', () => {
    const withCritical = [
      {
        key: 'http_error_rate',
        label: 'HTTP error rate (5xx, last 5 min)',
        severity: 'critical' as const,
        value: 2.4,
        threshold: 1,
        message: 'Error rate 2.4% exceeds 1% threshold',
      },
      ...healthyAlerts.slice(1),
    ];
    render(<AlertsPanel alerts={withCritical} />);

    expect(screen.getByText('1 critical · 0 warning')).toBeInTheDocument();
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
  });

  it('formats percentage thresholds correctly', () => {
    render(<AlertsPanel alerts={healthyAlerts} />);

    expect(screen.getByText('0% / 5%')).toBeInTheDocument();
    expect(screen.getByText('0.2% / 1%')).toBeInTheDocument();
    expect(screen.getByText('120ms / 2000ms')).toBeInTheDocument();
  });

  it('handles an empty alert list without crashing', () => {
    render(<AlertsPanel alerts={[]} />);

    expect(screen.getByText('All systems nominal')).toBeInTheDocument();
  });
});
