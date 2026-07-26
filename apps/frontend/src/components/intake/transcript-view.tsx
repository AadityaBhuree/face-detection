'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface TranscriptEntry {
  id: string;
  speaker: 'patient' | 'ai' | 'system';
  text: string;
  timestamp: number;
}

interface TranscriptViewProps {
  entries: TranscriptEntry[];
  onStartIntake: () => void;
}

export function TranscriptView({ entries, onStartIntake }: TranscriptViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  return (
    <div className="space-y-3">
      {entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="bg-ayutalk-100 dark:bg-ayutalk-900/50 mb-3 rounded-full p-3">
            <svg
              className="text-ayutalk-500 dark:text-ayutalk-400 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
              />
            </svg>
          </div>
          <p className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">
            Ready to begin the intake conversation
          </p>
          <p className="mb-4 text-xs text-slate-400 dark:text-slate-500">
            The AI assistant will ask about symptoms, duration, and medical history
          </p>
          <button
            onClick={onStartIntake}
            className="bg-ayutalk-500 hover:bg-ayutalk-600 rounded-lg px-4 py-2 text-sm font-medium text-white transition-all"
          >
            Start AI Intake
          </button>
        </div>
      )}

      {entries.map((entry) => (
        <div
          key={entry.id}
          className={cn('flex gap-3', entry.speaker === 'patient' && 'flex-row-reverse')}
        >
          {/* Avatar */}
          <div
            className={cn(
              'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold',
              entry.speaker === 'ai' &&
                'bg-ayutalk-100 text-ayutalk-600 dark:bg-ayutalk-900/50 dark:text-ayutalk-400',
              entry.speaker === 'patient' &&
                'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
              entry.speaker === 'system' &&
                'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
            )}
          >
            {entry.speaker === 'ai' ? 'AI' : entry.speaker === 'patient' ? 'P' : 'S'}
          </div>

          {/* Message */}
          <div
            className={cn(
              'max-w-[80%] rounded-xl px-4 py-2.5 text-sm',
              entry.speaker === 'ai' &&
                'bg-ayutalk-50 dark:bg-ayutalk-950/50 rounded-bl-sm text-slate-800 dark:text-slate-200',
              entry.speaker === 'patient' &&
                'rounded-br-sm bg-emerald-50 text-slate-800 dark:bg-emerald-950/50 dark:text-slate-200',
              entry.speaker === 'system' &&
                'rounded-br-sm bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
            )}
          >
            <p className="leading-relaxed">{entry.text}</p>
            <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
              {new Date(entry.timestamp).toLocaleTimeString()}
            </p>
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
