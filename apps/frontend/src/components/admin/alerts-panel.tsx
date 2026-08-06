'use client';

import type { MonitoredAlert, AlertSeverity } from '@/services/api';
import { cn } from '@/lib/utils';

interface AlertsPanelProps {
  alerts: MonitoredAlert[];
  className?: string;
}

const severityStyles: Record<AlertSeverity, { badge: string; dot: string; label: string }> = {
  ok: {
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    dot: 'bg-emerald-500',
    label: 'OK',
  },
  warning: {
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    dot: 'bg-amber-500',
    label: 'WARNING',
  },
  critical: {
    badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    dot: 'bg-red-500',
    label: 'CRITICAL',
  },
};

/**
 * Admin alerts panel — evaluates the Phase 6.8 thresholds (error rate > 1%,
 * face-match p95 > 2s, session timeout rate > 5%) with severity badges.
 */
export function AlertsPanel({ alerts, className }: AlertsPanelProps) {
  const critical = alerts.filter((a) => a.severity === 'critical').length;
  const warning = alerts.filter((a) => a.severity === 'warning').length;
  const active = critical + warning;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'h-2 w-2 animate-pulse rounded-full',
              active > 0 ? 'bg-amber-500' : 'bg-emerald-500',
            )}
          />
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {active > 0 ? `${critical} critical · ${warning} warning` : 'All systems nominal'}
          </span>
        </div>
      </div>

      {alerts.map((alert) => {
        const style = severityStyles[alert.severity];
        return (
          <div
            key={alert.key}
            className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                {alert.label}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">
                {alert.message}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                {alert.value}
                {alert.key === 'http_error_rate' || alert.key === 'session_timeout_rate'
                  ? '%'
                  : 'ms'}
                {' / '}
                {alert.threshold}
                {alert.key === 'http_error_rate' || alert.key === 'session_timeout_rate'
                  ? '%'
                  : 'ms'}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                  style.badge,
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} />
                {style.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
