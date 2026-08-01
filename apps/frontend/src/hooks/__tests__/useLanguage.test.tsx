import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LanguageProvider, useLanguage } from '../useLanguage';

const STORAGE_KEY = 'ayutalk-locale';

function LocaleConsumer() {
  const { locale, setLocale } = useLanguage();
  return <button onClick={() => setLocale('hi')}>{locale}</button>;
}

function TranslateConsumer() {
  const { locale, setLocale, t } = useLanguage();
  return (
    <button onClick={() => setLocale('hi')}>
      {locale}:{t('continue_')}
    </button>
  );
}

describe('useLanguage', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'en';
    // Reset navigator.language to the jsdom default before every test
    Object.defineProperty(window.navigator, 'language', {
      configurable: true,
      value: 'en-US',
    });
  });

  // ─── localStorage persistence ─────────────────────────────────

  it('persists the chosen locale to localStorage', () => {
    render(
      <LanguageProvider>
        <LocaleConsumer />
      </LanguageProvider>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(localStorage.getItem(STORAGE_KEY)).toBe('hi');
  });

  it('restores a persisted locale when mounting', async () => {
    localStorage.setItem(STORAGE_KEY, 'mr');
    render(
      <LanguageProvider>
        <LocaleConsumer />
      </LanguageProvider>,
    );
    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('mr');
    });
  });

  it('ignores invalid persisted values and falls back to detection', async () => {
    localStorage.setItem(STORAGE_KEY, 'fr');
    render(
      <LanguageProvider>
        <LocaleConsumer />
      </LanguageProvider>,
    );
    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('en');
    });
  });

  // ─── detectLocale fallback ────────────────────────────────────

  it('falls back to browser language detection when nothing is stored', async () => {
    render(
      <LanguageProvider>
        <LocaleConsumer />
      </LanguageProvider>,
    );
    // jsdom default navigator.language is 'en-US' → English
    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('en');
    });
  });

  it('adopts a supported browser language (Hindi)', async () => {
    Object.defineProperty(window.navigator, 'language', {
      configurable: true,
      value: 'hi-IN',
    });
    render(
      <LanguageProvider>
        <LocaleConsumer />
      </LanguageProvider>,
    );
    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('hi');
    });
  });

  // ─── Provider / no-provider modes ─────────────────────────────

  it('falls back to English when used outside the provider', () => {
    render(<LocaleConsumer />);
    expect(screen.getByRole('button')).toHaveTextContent('en');
  });

  it('treats setLocale as a no-op outside the provider', () => {
    render(<LocaleConsumer />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent('en');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('returns context values inside the provider', () => {
    render(
      <LanguageProvider>
        <LocaleConsumer />
      </LanguageProvider>,
    );
    expect(screen.getByRole('button')).toHaveTextContent('en');
  });

  it('translates with the active locale inside the provider', async () => {
    render(
      <LanguageProvider>
        <TranslateConsumer />
      </LanguageProvider>,
    );
    expect(screen.getByRole('button')).toHaveTextContent('en:Continue');

    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('hi:जारी रखें');
    });
  });

  it('translates in English when used outside the provider', () => {
    render(<TranslateConsumer />);
    expect(screen.getByRole('button')).toHaveTextContent('en:Continue');
  });

  // ─── document lang sync (accessibility) ───────────────────────

  it('syncs the document lang attribute with the active locale', () => {
    render(
      <LanguageProvider>
        <LocaleConsumer />
      </LanguageProvider>,
    );
    expect(document.documentElement.lang).toBe('en');

    fireEvent.click(screen.getByRole('button'));
    expect(document.documentElement.lang).toBe('hi');
  });

  it('restores the original lang attribute on unmount', () => {
    const { unmount } = render(
      <LanguageProvider>
        <LocaleConsumer />
      </LanguageProvider>,
    );
    unmount();
    expect(document.documentElement.lang).toBe('en');
  });
});
