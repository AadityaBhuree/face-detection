import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageProvider, useLanguage } from '../useLanguage';

function LanguageConsumer() {
  const { locale, setLocale } = useLanguage();
  return <button onClick={() => setLocale('hi')}>{locale}</button>;
}

describe('useLanguage — document lang sync (accessibility)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'en';
  });

  it('syncs the document lang attribute with the active locale', () => {
    render(
      <LanguageProvider>
        <LanguageConsumer />
      </LanguageProvider>,
    );
    expect(document.documentElement.lang).toBe('en');

    fireEvent.click(screen.getByRole('button'));
    expect(document.documentElement.lang).toBe('hi');
  });

  it('restores the original lang attribute on unmount', () => {
    const { unmount } = render(
      <LanguageProvider>
        <LanguageConsumer />
      </LanguageProvider>,
    );
    unmount();
    expect(document.documentElement.lang).toBe('en');
  });
});
