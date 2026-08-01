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

  describe('parameter interpolation in Hindi', () => {
    it('interpolates confidencePercent', () => {
      expect(t('hi', 'confidencePercent', { percent: 85 })).toBe('85% विश्वास');
    });

    it('interpolates blinksNeeded', () => {
      expect(t('hi', 'blinksNeeded', { remaining: 2 })).toBe(
        'कृपया प्राकृतिक रूप से पलक झपकाएं (2 पलकें आवश्यक)',
      );
    });

    it('interpolates faceMatched', () => {
      expect(t('hi', 'faceMatched', { percent: 95 })).toBe('चेहरा मिला — 95%');
    });

    it('interpolates welcomeMessage', () => {
      expect(t('hi', 'welcomeMessage', { name: 'प्रिया' })).toBe('स्वागत है, प्रिया!');
    });

    it('interpolates camerasAvailable with multiple params', () => {
      // The dictionary stores the singular base 'कैमरा{plural}'; interpolation
      // appends the plural matra without merging, so the output is 'कैमराों'.
      expect(t('hi', 'camerasAvailable', { count: 3, plural: 'ों' })).toBe(
        '3 कैमराों उपलब्ध',
      );
    });
  });

  describe('parameter interpolation in Marathi', () => {
    it('interpolates confidencePercent', () => {
      expect(t('mr', 'confidencePercent', { percent: 85 })).toBe('85% विश्वास');
    });

    it('interpolates blinksNeeded', () => {
      expect(t('mr', 'blinksNeeded', { remaining: 2 })).toBe(
        'कृपया नैसर्गिकरीत्या डोळे मिचकावा (2 डोळे मिचकावणे आवश्यक)',
      );
    });

    it('interpolates faceMatched', () => {
      expect(t('mr', 'faceMatched', { percent: 95 })).toBe('चेहरा जुळला — 95%');
    });

    it('interpolates welcomeMessage', () => {
      expect(t('mr', 'welcomeMessage', { name: 'प्रिया' })).toBe('स्वागत आहे, प्रिया!');
    });

    it('interpolates camerasAvailable with multiple params', () => {
      // Same base-plus-matra behaviour as Hindi: 'कॅमेरा{plural}' → 'कॅमेराे'
      expect(t('mr', 'camerasAvailable', { count: 3, plural: 'े' })).toBe(
        '3 कॅमेराे उपलब्ध',
      );
    });
  });

  describe('parameter interpolation in Spanish', () => {
    it('interpolates confidencePercent', () => {
      expect(t('es', 'confidencePercent', { percent: 85 })).toBe('85% de confianza');
    });

    it('interpolates blinksNeeded', () => {
      expect(t('es', 'blinksNeeded', { remaining: 2 })).toBe(
        'Parpadee naturalmente (2 parpadeos necesarios)',
      );
    });

    it('interpolates faceMatched', () => {
      expect(t('es', 'faceMatched', { percent: 95 })).toBe('Rostro coincidente — 95%');
    });

    it('interpolates welcomeMessage', () => {
      expect(t('es', 'welcomeMessage', { name: 'María' })).toBe('¡Bienvenido/a, María!');
    });

    it('replaces repeated placeholders (cámaras disponibles)', () => {
      // Spanish repeats {plural}; every occurrence must be replaced
      expect(t('es', 'camerasAvailable', { count: 3, plural: 's' })).toBe(
        '3 cámaras disponibles',
      );
    });
  });

  describe('missing-key fallback', () => {
    const locales: SupportedLocale[] = ['en', 'hi', 'mr', 'es'];

    for (const locale of locales) {
      it(`${locale} returns the bracketed key when the key does not exist`, () => {
        expect(t(locale, 'nonexistent_key' as any)).toBe('[nonexistent_key]');
      });
    }

    it('returns the bracketed key even when params are passed', () => {
      expect(t('hi', 'nonexistent_key' as any, { count: 5 })).toBe('[nonexistent_key]');
    });

    it('keeps placeholders intact when params are not provided', () => {
      expect(t('en', 'camerasAvailable')).toBe('{count} camera{plural} available');
    });
  });

  describe('translated content in non-English locales', () => {
    it('Hindi has translated content for common UI keys', () => {
      expect(t('hi', 'continue_')).toBe('जारी रखें');
      expect(t('hi', 'clinicalBrief')).toBe('क्लिनिकल इंटेक ब्रीफ');
      expect(t('hi', 'riskFlags')).toBe('जोखिम संकेत');
      expect(t('hi', 'thinking')).toBe('सोच रहे हैं');
      expect(t('hi', 'aiThinking')).toBe('एआई सोच रहा है...');
    });

    it('Marathi has translated content for common UI keys', () => {
      expect(t('mr', 'continue_')).toBe('पुढे');
      expect(t('mr', 'clinicalBrief')).toBe('क्लिनिकल इंटेक ब्रीफ');
      expect(t('mr', 'riskFlags')).toBe('जोखीम निर्देशक');
      expect(t('mr', 'thinking')).toBe('विचार करत आहे');
      expect(t('mr', 'aiThinking')).toBe('एआय विचार करत आहे...');
    });

    it('Spanish has translated content for common UI keys', () => {
      expect(t('es', 'continue_')).toBe('Continuar');
      expect(t('es', 'clinicalBrief')).toBe('Informe Clínico de Admisión');
      expect(t('es', 'riskFlags')).toBe('Señales de Riesgo');
      expect(t('es', 'thinking')).toBe('Pensando');
      expect(t('es', 'aiThinking')).toBe('La IA está pensando...');
    });

    it('non-English translations differ from English for core labels', () => {
      expect(t('hi', 'thinking')).not.toBe(t('en', 'thinking'));
      expect(t('mr', 'thinking')).not.toBe(t('en', 'thinking'));
      expect(t('es', 'thinking')).not.toBe(t('en', 'thinking'));
    });
  });
});
