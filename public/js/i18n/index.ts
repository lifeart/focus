import type { Locale } from '../types.js';
import type { TranslationTable } from './keys.js';
import { ru } from './ru.js';
import { en } from './en.js';
import { de } from './de.js';
import { fr } from './fr.js';
import { es } from './es.js';

export const TRANSLATIONS: Record<Locale, TranslationTable> = { ru, en, de, fr, es };
