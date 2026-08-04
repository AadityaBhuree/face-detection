'use client';

import type { VolumePoint } from '@/services/api';
import { cn } from '@/lib/utils';

interface VolumeChartProps {
  data: VolumePoint[];
  className?: string;
}

const CHART_HEIGHT = 160;
const BAR_MAX_WIDTH = 24;

/**
 * Dependency-free bar chart. Each day is a bar; the value is labelled on
 * hover via a <title>. Bars are sized relative to the max day count.
 */
export function VolumeChart({ data, className }: VolumeChartProps) {
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-end gap-1" style={{ height: CHART_HEIGHT }}>
        {data.map((d) => {
          const height = Math.max(2, Math.round((d.count / max) * CHART_HEIGHT));
          return (
            <div
              key={d.date}
              className="group relative flex flex-1 items-end justify-center"
              style={{ maxWidth: BAR_MAX_WIDTH }}
            >
              <div
                className="bg-jeevandata-500 hover:bg-jeevandata-600 dark:bg-jeevandata-600 dark:hover:bg-jeevandata-500 w-full rounded-t transition-all"
                style={{ height }}
                role="img"
                aria-label={`${d.date}: ${d.count} sessions`}
              />
              <div
                className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 dark:bg-white dark:text-slate-900"
                role="tooltip"
              >
                {d.count}
              </div>
            </div>
          );
        })}
      </div>
      {/* Axis labels */}
      <div className="mt-2 flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
        <span>{data[0]?.date}</span>
        <span>Daily patient volume</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}
