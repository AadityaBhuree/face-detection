'use client';

import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  /** Short contextual line under the value, e.g. '+12% vs last week'. */
  hint?: string;
  icon?: ReactNode;
  /** Tailwind accent color class for the icon chip. */
  accent?: string;
  delay?: number;
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent = 'bg-jeevandata-500',
  delay = 0,
}: StatCardProps) {
  return (
    <Card className="animate-fade-in-up p-4" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
        {icon && (
          <div
            className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-white', accent)}
          >
            {icon}
          </div>
        )}
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{hint}</p>}
    </Card>
  );
}
