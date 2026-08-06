'use client';

import type { LatencyPoint } from '@/services/api';
import { cn } from '@/lib/utils';

interface LatencyPanelProps {
  http: LatencyPoint;
  qdrant: LatencyPoint;
  className?: string;
}

interface RowData {
  label: string;
  point: LatencyPoint;
  accent: string;
}

const formatMs = (v: number) => `${Math.round(v)}ms`;

function PercentileBar({ point, accent }: { point: LatencyPoint; accent: string }) {
  const max = Math.max(1, point.p95, point.p99);
  const width = (q: number) => `${Math.max(4, Math.round((q / max) * 100))}%`;

  const bars: Array<{ label: string; value: number; cls: string }> = [
    { label: 'p50', value: point.p50, cls: 'bg-emerald-500 dark:bg-emerald-400' },
    { label: 'p95', value: point.p95, cls: 'bg-amber-500 dark:bg-amber-400' },
    { label: 'p99', value: point.p99, cls: 'bg-red-500 dark:bg-red-400' },
  ];

  return (
    <div className="space-y-1.5">
      {bars.map((bar) => (
        <div key={bar.label} className="flex items-center gap-2">
          <span className="w-8 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
            {bar.label}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={cn('h-full rounded-full transition-all duration-500', bar.cls, accent)}
              style={{ width: width(bar.value) }}
              role="img"
              aria-label={`${bar.label}: ${formatMs(bar.value)}`}
            />
          </div>
          <span className="w-14 text-right font-mono text-[10px] text-slate-500 dark:text-slate-400">
            {formatMs(bar.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Admin latency panel — p50/p95/p99 for HTTP requests and Qdrant operations,
 * fed by GET /monitoring/latency (Phase 6.8).
 */
export function LatencyPanel({ http, qdrant, className }: LatencyPanelProps) {
  const rows: RowData[] = [
    { label: 'HTTP requests', point: http, accent: 'dark:bg-none' },
    { label: 'Face match (Qdrant)', point: qdrant, accent: 'dark:bg-none' },
  ];

  return (
    <div className={cn('space-y-4', className)}>
      {rows.map((row) => (
        <div
          key={row.label}
          className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/40"
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">{row.label}</p>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              {row.point.count} sample{row.point.count === 1 ? '' : 's'}
            </span>
          </div>
          <PercentileBar point={row.point} accent={row.accent} />
        </div>
      ))}
    </div>
  );
}
