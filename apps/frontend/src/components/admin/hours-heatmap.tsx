'use client';

import type { HourPoint } from '@/services/api';
import { cn } from '@/lib/utils';

interface HoursHeatmapProps {
  data: HourPoint[];
  className?: string;
}

/**
 * Peak clinic hours heatmap: 24 cells (0–23). Cell intensity is scaled
 * against the busiest hour, from slate (quiet) to jeevandata (peak).
 */
export function HoursHeatmap({ data, className }: HoursHeatmapProps) {
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <div className={cn('w-full', className)}>
      <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-12">
        {data.map((d) => {
          const ratio = d.count / max;
          const intensity =
            d.count === 0
              ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'
              : ratio >= 0.75
                ? 'bg-jeevandata-600 text-white dark:bg-jeevandata-400 dark:text-slate-950'
                : ratio >= 0.5
                  ? 'bg-jeevandata-400 text-white dark:bg-jeevandata-500 dark:text-white'
                  : ratio >= 0.25
                    ? 'bg-jeevandata-200 text-jeevandata-800 dark:bg-jeevandata-700/60 dark:text-jeevandata-100'
                    : 'bg-jeevandata-100 text-jeevandata-700 dark:bg-jeevandata-800/60 dark:text-jeevandata-300';
          return (
            <div
              key={d.hour}
              title={`${d.hour}:00 — ${d.count} sessions`}
              className={cn(
                'flex h-9 items-center justify-center rounded-md text-[10px] font-semibold transition-colors',
                intensity,
              )}
            >
              {d.hour}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
        <span>00:00</span>
        <span>Peak clinic hours</span>
        <span>23:00</span>
      </div>
    </div>
  );
}
