import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCard } from '../stat-card';
import { VolumeChart } from '../volume-chart';
import { HoursHeatmap } from '../hours-heatmap';
import { FlowBoard } from '../flow-board';

describe('StatCard', () => {
  it('renders label, value and hint', () => {
    render(<StatCard label="Total Sessions" value={42} hint="Last 30 days" />);

    expect(screen.getByText('Total Sessions')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Last 30 days')).toBeInTheDocument();
  });

  it('renders the placeholder dash when no value', () => {
    render(<StatCard label="Total Sessions" value="—" />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

describe('VolumeChart', () => {
  it('renders one bar per day point', () => {
    const data = [
      { date: '2026-07-01', count: 5 },
      { date: '2026-07-02', count: 8 },
      { date: '2026-07-03', count: 2 },
    ];
    render(<VolumeChart data={data} />);

    expect(screen.getByLabelText('2026-07-02: 8 sessions')).toBeInTheDocument();
    expect(screen.getByText('Daily patient volume')).toBeInTheDocument();
    expect(screen.getByText('2026-07-01')).toBeInTheDocument();
    expect(screen.getByText('2026-07-03')).toBeInTheDocument();
  });

  it('handles an empty dataset without crashing', () => {
    render(<VolumeChart data={[]} />);
    expect(screen.getByText('Daily patient volume')).toBeInTheDocument();
  });

  it('handles all-zero data (max falls back to 1)', () => {
    render(
      <VolumeChart
        data={[
          { date: '2026-07-01', count: 0 },
          { date: '2026-07-02', count: 0 },
        ]}
      />,
    );
    expect(screen.getByLabelText('2026-07-01: 0 sessions')).toBeInTheDocument();
  });
});

describe('HoursHeatmap', () => {
  it('renders all 24 hours', () => {
    const data = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
    render(<HoursHeatmap data={data} />);

    expect(screen.getByTitle('0:00 — 0 sessions')).toBeInTheDocument();
    expect(screen.getByTitle('23:00 — 0 sessions')).toBeInTheDocument();
    expect(screen.getByText('Peak clinic hours')).toBeInTheDocument();
  });

  it('shows the session count in the cell title', () => {
    const data = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: hour === 10 ? 12 : 0,
    }));
    render(<HoursHeatmap data={data} />);

    expect(screen.getByTitle('10:00 — 12 sessions')).toBeInTheDocument();
  });
});

describe('FlowBoard', () => {
  const stages = [
    { key: 'waiting', label: 'Waiting', count: 2 },
    { key: 'in_intake', label: 'In Intake', count: 3 },
    { key: 'triaged', label: 'Triaged', count: 1 },
    { key: 'with_doctor', label: 'With Doctor', count: 4 },
  ];

  it('renders each stage with its count and total', () => {
    render(<FlowBoard stages={stages} total={10} />);

    expect(screen.getByText('Waiting')).toBeInTheDocument();
    expect(screen.getByText('In Intake')).toBeInTheDocument();
    expect(screen.getByText('10 total sessions — updates in real time')).toBeInTheDocument();
  });

  it('renders the failed stage when present', () => {
    const withFailed = [...stages, { key: 'failed', label: 'Failed / Timed Out', count: 1 }];
    render(<FlowBoard stages={withFailed} total={11} />);

    expect(screen.getByText('Failed / Timed Out')).toBeInTheDocument();
  });
});
