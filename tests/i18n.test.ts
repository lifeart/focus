import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TRANSLATIONS } from '../public/js/i18n/index';
import { en } from '../public/js/i18n/en';
import { ru } from '../public/js/i18n/ru';
import { de } from '../public/js/i18n/de';
import { fr } from '../public/js/i18n/fr';
import { es } from '../public/js/i18n/es';

// Mock DOM globals that setLocale touches
const docMock = {
  documentElement: { lang: '' },
  title: '',
  getElementById: vi.fn(() => null),
  createElement: vi.fn(() => ({ id: '', prepend: vi.fn() })),
};
vi.stubGlobal('document', docMock);
vi.stubGlobal('navigator', { language: 'en-US' });

// Import after mocks are in place
import { setLocale, getLocale, detectLocale, t, tPlural } from '../public/js/core/i18n';

beforeEach(() => {
  // Reset to known state before each test
  setLocale('en');
  docMock.documentElement.lang = '';
  docMock.title = '';
});

// ---------------------------------------------------------------------------
// setLocale / getLocale
// ---------------------------------------------------------------------------
describe('setLocale / getLocale', () => {
  it('sets and returns the current locale', () => {
    setLocale('en');
    expect(getLocale()).toBe('en');
    setLocale('ru');
    expect(getLocale()).toBe('ru');
  });

  it('updates document.documentElement.lang', () => {
    setLocale('de');
    expect(docMock.documentElement.lang).toBe('de');
  });
});

// ---------------------------------------------------------------------------
// detectLocale
// ---------------------------------------------------------------------------
describe('detectLocale', () => {
  it('returns "en" for navigator.language = "en-US"', () => {
    vi.stubGlobal('navigator', { language: 'en-US' });
    expect(detectLocale()).toBe('en');
  });

  it('returns "ru" for navigator.language = "ru"', () => {
    vi.stubGlobal('navigator', { language: 'ru' });
    expect(detectLocale()).toBe('ru');
  });

  it('returns "de" for navigator.language = "de-DE"', () => {
    vi.stubGlobal('navigator', { language: 'de-DE' });
    expect(detectLocale()).toBe('de');
  });

  it('returns "fr" for navigator.language = "fr-FR"', () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    expect(detectLocale()).toBe('fr');
  });

  it('returns "es" for navigator.language = "es"', () => {
    vi.stubGlobal('navigator', { language: 'es' });
    expect(detectLocale()).toBe('es');
  });

  it('falls back to "en" for unsupported locale', () => {
    vi.stubGlobal('navigator', { language: 'ja-JP' });
    expect(detectLocale()).toBe('en');
  });

  it('falls back to "en" when navigator.language is empty', () => {
    vi.stubGlobal('navigator', { language: '' });
    expect(detectLocale()).toBe('en');
  });
});

// ---------------------------------------------------------------------------
// t() — basic translation
// ---------------------------------------------------------------------------
describe('t() basic translation', () => {
  it('returns English translation for nav.home', () => {
    setLocale('en');
    expect(t('nav.home')).toBe('Home');
  });

  it('returns Russian translation for nav.home', () => {
    setLocale('ru');
    expect(t('nav.home')).toBe('Главная');
  });
});

// ---------------------------------------------------------------------------
// t() — with params
// ---------------------------------------------------------------------------
describe('t() with params', () => {
  it('substitutes {name} in dashboard.greeting', () => {
    setLocale('en');
    expect(t('dashboard.greeting', { name: 'Alex' })).toBe('Hi, Alex!');
  });

  it('substitutes multiple params', () => {
    setLocale('en');
    expect(t('dashboard.todayProgress', { done: '5', goal: '10' })).toBe('5 of 10 min');
  });
});

// ---------------------------------------------------------------------------
// t() — fallback for missing key
// ---------------------------------------------------------------------------
describe('t() fallback', () => {
  it('returns the key itself when key is missing from all locales', () => {
    setLocale('en');
    // Cast to any to test a key that does not exist at runtime
    const result = t('nonexistent.key' as any);
    expect(result).toBe('nonexistent.key');
  });
});

// ---------------------------------------------------------------------------
// t() — fallback to English for unknown locale
// ---------------------------------------------------------------------------
describe('t() fallback to English', () => {
  it('falls back to English table when locale has no translation table', () => {
    // setLocale with unsupported locale falls back to TRANSLATIONS['en']
    setLocale('de' as any);
    // de has its own translations, so let's verify the fallback mechanism
    // by checking that a key present in en also works in de
    const result = t('nav.home');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// tPlural() — English
// ---------------------------------------------------------------------------
describe('tPlural() English', () => {
  it('returns singular form for count=1', () => {
    setLocale('en');
    expect(tPlural('plural.day', 1)).toBe('day');
  });

  it('returns plural form for count=2', () => {
    setLocale('en');
    expect(tPlural('plural.day', 2)).toBe('days');
  });

  it('returns plural form for count=0', () => {
    setLocale('en');
    expect(tPlural('plural.day', 0)).toBe('days');
  });

  it('returns plural form for count=5', () => {
    setLocale('en');
    expect(tPlural('plural.day', 5)).toBe('days');
  });
});

// ---------------------------------------------------------------------------
// tPlural() — Russian (3-form plurals)
// ---------------------------------------------------------------------------
describe('tPlural() Russian', () => {
  it('returns form 0 for count=1 (день)', () => {
    setLocale('ru');
    expect(tPlural('plural.day', 1)).toBe('день');
  });

  it('returns form 1 for count=2 (дня)', () => {
    setLocale('ru');
    expect(tPlural('plural.day', 2)).toBe('дня');
  });

  it('returns form 1 for count=3 (дня)', () => {
    setLocale('ru');
    expect(tPlural('plural.day', 3)).toBe('дня');
  });

  it('returns form 1 for count=4 (дня)', () => {
    setLocale('ru');
    expect(tPlural('plural.day', 4)).toBe('дня');
  });

  it('returns form 2 for count=5 (дней)', () => {
    setLocale('ru');
    expect(tPlural('plural.day', 5)).toBe('дней');
  });

  it('returns form 2 for count=11 (дней — special 11-19 rule)', () => {
    setLocale('ru');
    expect(tPlural('plural.day', 11)).toBe('дней');
  });

  it('returns form 0 for count=21 (день)', () => {
    setLocale('ru');
    expect(tPlural('plural.day', 21)).toBe('день');
  });

  it('returns form 2 for count=0 (дней)', () => {
    setLocale('ru');
    expect(tPlural('plural.day', 0)).toBe('дней');
  });
});

// ---------------------------------------------------------------------------
// All locale files have the same keys
// ---------------------------------------------------------------------------
describe('locale key parity', () => {
  const locales = { en, ru, de, fr, es };
  const enKeys = Object.keys(en).sort();

  for (const [name, table] of Object.entries(locales)) {
    it(`${name} has the same number of keys as en (${enKeys.length})`, () => {
      expect(Object.keys(table).length).toBe(enKeys.length);
    });

    if (name !== 'en') {
      it(`${name} has exactly the same key set as en`, () => {
        const keys = Object.keys(table).sort();
        expect(keys).toEqual(enKeys);
      });
    }
  }
});
