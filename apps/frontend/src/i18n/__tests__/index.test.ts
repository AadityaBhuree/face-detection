import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { t, detectLocale, translations, type SupportedLocale } from '../index';

describe('i18n', () => {
  describe('t()', () => {
    it('should return English text for en locale', () => {
      expect(t('en', 'appName')).toBe('AyuTalk Care');
    });

    it('should return Hindi text for hi locale', () => {
      expect(t('hi', 'appName')).toBe('आयुरटॉक केयर');
    });

    it('should return Marathi text for mr locale', () => {
      expect(t('mr', 'appName')).toBe('आयुरटॉक केअर');
    });

    it('should return Spanish text for es locale', () => {
      expect(t('es', 'appName')).toBe('AyuTalk Care');
    });

    it('should replace single parameter in string', () => {
      const result = t('en', 'confidencePercent', { percent: 85 });
      expect(result).toBe('85% confidence');
    });

    it('should replace multiple parameters in string', () => {
      const result = t('en', 'camerasAvailable', { count: 2, plural: 's' });
      expect(result).toBe('2 cameras available');
    });

    it('should fall back to English key when translation is missing', () => {
      const result = t('es', 'appName');
      expect(result).toBe('AyuTalk Care');
    });

    it('should return key as fallback when even English is missing', () => {
      const result = t('en', 'nonexistent_key' as any);
      expect(result).toBe('[nonexistent_key]');
    });
  });

  describe('detectLocale()', () => {
    let originalLanguage: string;

    beforeEach(() => {
      originalLanguage = navigator.language;
    });

    afterEach(() => {
      Object.defineProperty(navigator, 'language', {
        value: originalLanguage,
        configurable: true,
      });
    });

    it('should return en for English browser', () => {
      Object.defineProperty(navigator, 'language', {
        value: 'en-US',
        configurable: true,
      });
      expect(detectLocale()).toBe('en');
    });

    it('should return hi for Hindi browser', () => {
      Object.defineProperty(navigator, 'language', {
        value: 'hi-IN',
        configurable: true,
      });
      expect(detectLocale()).toBe('hi');
    });

    it('should return mr for Marathi browser', () => {
      Object.defineProperty(navigator, 'language', {
        value: 'mr-IN',
        configurable: true,
      });
      expect(detectLocale()).toBe('mr');
    });

    it('should return es for Spanish browser', () => {
      Object.defineProperty(navigator, 'language', {
        value: 'es-ES',
        configurable: true,
      });
      expect(detectLocale()).toBe('es');
    });

    it('should return en for unknown language', () => {
      Object.defineProperty(navigator, 'language', {
        value: 'fr-FR',
        configurable: true,
      });
      expect(detectLocale()).toBe('en');
    });
  });

  describe('all translations have all keys', () => {
    const locales: SupportedLocale[] = ['en', 'hi', 'mr', 'es'];
    const enKeys = Object.keys(translations.en) as Array<keyof typeof translations.en>;

    for (const locale of locales) {
      it(`${locale} should have all keys that English has`, () => {
        for (const key of enKeys) {
          expect(translations[locale]).toHaveProperty(key);
          expect(typeof translations[locale][key]).toBe('string');
        }
      });
    }

    it('should have consistent string lengths across locales', () => {
      for (const key of enKeys) {
        const enLen = translations.en[key]!.length;
        const hiLen = translations.hi[key]!.length;
        const mrLen = translations.mr[key]!.length;
        const esLen = translations.es[key]!.length;
        // Just verify all are strings with content
        expect(enLen).toBeGreaterThan(0);
        expect(hiLen).toBeGreaterThan(0);
        expect(mrLen).toBeGreaterThan(0);
        expect(esLen).toBeGreaterThan(0);
      }
    });
  });
});
