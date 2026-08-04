'use client';

import type { FlowStage } from '@/services/api';
import { cn } from '@/lib/utils';

interface FlowBoardProps {
  stages: FlowStage[];
  total: number;
  className?: string;
}

const stageAccent: Record<string, string> = {
  waiting: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  in_intake:
    'bg-jeevandata-100 text-jeevandata-700 dark:bg-jeevandata-900/40 dark:text-jeevandata-300',
  triaged: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  with_doctor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

/**
 * Real-time patient flow board: waiting → in intake → triaged → with doctor,
 * with counts and a live indicator.
 */
export function FlowBoard({ stages, total, className }: FlowBoardProps) {
  return (
    <div className={cn('w-full', className)}>
      <div className="flex flex-wrap items-stretch gap-3">
        {stages.map((stage, i) => (
          <div key={stage.key} className="flex flex-1 items-center gap-3">
            <div
              className={cn(
                'flex min-w-0 flex-1 flex-col items-center rounded-xl px-3 py-3 text-center',
                stageAccent[stage.key] ?? 'bg-slate-100 dark:bg-slate-800',
              )}
            >
              <span className="text-xl font-bold">{stage.count}</span>
              <span className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-wide opacity-80">
                {stage.label}
              </span>
            </div>
            {i < stages.length - 1 && (
              <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">
                →
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
        {total} total session{total !== 1 ? 's' : ''} — updates in real time
      </p>
    </div>
  );
}
