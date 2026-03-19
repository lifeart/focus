import type { Locale } from '../types.js';
import type { TranslationTable, TranslationKey } from '../i18n/keys.js';
import { TRANSLATIONS } from '../i18n/index.js';

let currentLocale: Locale = 'ru';
let currentTable: TranslationTable = TRANSLATIONS['ru'];

export function initI18n(locale: Locale): void {
  setLocale(locale);
}

export function setLocale(locale: Locale): void {
  currentLocale = locale;
  currentTable = TRANSLATIONS[locale] || TRANSLATIONS['ru'];
  document.documentElement.lang = locale;
  document.title = t('app.title');
}

export function getLocale(): Locale {
  return currentLocale;
}

export function detectLocale(): Locale {
  const lang = (navigator.language || '').slice(0, 2).toLowerCase();
  const supported: Locale[] = ['ru', 'en', 'de', 'fr', 'es'];
  return supported.includes(lang as Locale) ? (lang as Locale) : 'en';
}

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  let text = currentTable[key] ?? TRANSLATIONS['ru'][key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return text;
}

export function tPlural(key: TranslationKey, count: number, params?: Record<string, string | number>): string {
  const raw = currentTable[key] ?? TRANSLATIONS['ru'][key] ?? '';
  const forms = raw.split('|');
  const form = selectPluralForm(currentLocale, count, forms);
  let result = form;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return result;
}

function selectPluralForm(locale: Locale, n: number, forms: string[]): string {
  if (locale === 'ru') {
    const abs = Math.abs(n) % 100;
    const last = abs % 10;
    if (abs >= 11 && abs <= 19) return forms[2] ?? forms[0];
    if (last === 1) return forms[0];
    if (last >= 2 && last <= 4) return forms[1] ?? forms[0];
    return forms[2] ?? forms[0];
  }
  if (locale === 'fr') {
    return (n === 0 || n === 1) ? forms[0] : (forms[1] ?? forms[0]);
  }
  // en, de, es
  return n === 1 ? forms[0] : (forms[1] ?? forms[0]);
}
