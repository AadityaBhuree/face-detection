'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { type SupportedLocale, type Translations, detectLocale, t as translate } from '@/i18n';

interface LanguageContextType {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

const STORAGE_KEY = 'jeevandata-locale';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>('en');

  // Initialize from localStorage or browser detection
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as SupportedLocale | null;
    if (stored && ['en', 'hi', 'mr', 'es'].includes(stored)) {
      setLocaleState(stored);
    } else {
      setLocaleState(detectLocale());
    }
  }, []);

  // Keep <html lang> in sync so screen readers switch pronunciation/
  // prosody to the active language. Restores the original value on unmount.
  useEffect(() => {
    const html = document.documentElement;
    const prevLang = html.lang;
    html.lang = locale;
    return () => {
      html.lang = prevLang;
    };
  }, [locale]);

  const setLocale = useCallback((newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
    } catch {
      // localStorage may be unavailable
    }
  }, []);

  const contextT = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      translate(locale, key as keyof Translations, params),
    [locale],
  );

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t: contextT }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    // Fallback for when no provider is set (use default English)
    return {
      locale: 'en',
      setLocale: () => {},
      t: (key, params) => translate('en', key as keyof Translations, params),
    };
  }
  return ctx;
}
