'use client';

import { useState, useRef, useEffect } from 'react';
import type { SupportedLocale } from '@/i18n';
import { cn } from '@/lib/utils';
import { Languages } from 'lucide-react';

interface LanguageSelectorProps {
  currentLocale: SupportedLocale;
  onLocaleChange: (locale: SupportedLocale) => void;
  className?: string;
  compact?: boolean;
}

const LOCALES: Array<{ code: SupportedLocale; label: string; native: string; flag: string }> = [
  { code: 'en', label: 'English', native: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
  { code: 'mr', label: 'Marathi', native: 'मराठी', flag: '🇮🇳' },
  { code: 'es', label: 'Spanish', native: 'Español', flag: '🇪🇸' },
];

export function LanguageSelector({
  currentLocale,
  onLocaleChange,
  className,
  compact = false,
}: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const current = LOCALES.find((l) => l.code === currentLocale) ?? LOCALES[0]!;

  function handleSelect(code: SupportedLocale) {
    onLocaleChange(code);
    setIsOpen(false);
  }

  if (compact) {
    return (
      <div ref={ref} className={cn('relative', className)}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          title={current.label}
        >
          <Languages className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{current.flag}</span>
        </button>
        {isOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
            {LOCALES.map((locale) => (
              <button
                key={locale.code}
                onClick={() => handleSelect(locale.code)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors',
                  locale.code === currentLocale
                    ? 'bg-ayutalk-50 text-ayutalk-700 dark:bg-ayutalk-900/30 dark:text-ayutalk-300'
                    : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800',
                )}
              >
                <span className="text-base">{locale.flag}</span>
                <span>{locale.native}</span>
                <span className="ml-auto text-[10px] text-slate-400">{locale.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
      >
        <Languages className="h-3.5 w-3.5" />
        <span>{current.flag}</span>
        <span>{current.native}</span>
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {LOCALES.map((locale) => (
            <button
              key={locale.code}
              onClick={() => handleSelect(locale.code)}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                locale.code === currentLocale
                  ? 'bg-ayutalk-50 text-ayutalk-700 dark:bg-ayutalk-900/30 dark:text-ayutalk-300'
                  : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800',
              )}
            >
              <span className="text-lg">{locale.flag}</span>
              <div>
                <p className="font-medium">{locale.native}</p>
                <p className="text-[10px] text-slate-400">{locale.label}</p>
              </div>
              {locale.code === currentLocale && (
                <div className="ml-auto h-2 w-2 rounded-full bg-ayutalk-500" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
