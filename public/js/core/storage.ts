import type { AppData } from '../types.js';
import { APP_DATA_KEY, CURRENT_DATA_VERSION, createDefaultAppData } from '../constants.js';

const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

export function migrateSchema(data: any): AppData {
  // Forward-only migrations based on version number
  // Currently at version 1, no migrations needed yet.
  // Future migrations would be chained:
  // if (data.version < 2) { /* migrate v1 -> v2 */ data.version = 2; }
  // if (data.version < 3) { /* migrate v2 -> v3 */ data.version = 3; }

  if (!data.version) {
    data.version = 1;
  }

  // v1 -> v2: Add streak freeze fields
  if (data.version < 2) {
    if (data.progression) {
      if (data.progression.currentStreak === undefined) {
        data.progression.currentStreak = 0;
      }
      if (data.progression.streakFreezes === undefined) {
        data.progression.streakFreezes = 0;
      }
      if (!data.progression.streakFreezeUsedDays) {
        data.progression.streakFreezeUsedDays = [];
      }
      if (!data.progression.lastStreakCheckDate) {
        data.progression.lastStreakCheckDate = '';
      }
      if (!data.progression.streakFreezeEarnedAt) {
        data.progression.streakFreezeEarnedAt = [];
      }
    }
    // Ensure all progression fields have defaults
    const prog = data.progression;
    prog.totalXP = prog.totalXP ?? 0;
    prog.level = prog.level ?? 1;
    prog.longestStreak = prog.longestStreak ?? 0;
    prog.totalSessionCount = prog.totalSessionCount ?? 0;
    prog.totalFocusTimeMs = prog.totalFocusTimeMs ?? 0;
    prog.breathingSessions = prog.breathingSessions ?? 0;
    prog.recordsBroken = prog.recordsBroken ?? 0;
    prog.earnedBadges = prog.earnedBadges ?? [];
    prog.activityDays = prog.activityDays ?? [];
    prog.personalRecords = prog.personalRecords ?? {
      'go-no-go': 0, 'n-back': 0, 'flanker': 0,
      'visual-search': 0, 'breathing': 0, 'pomodoro': 0,
    };

    data.version = 2;
  }

  // Ensure history arrays exist
  data.history = data.history ?? [];
  data.exerciseHistory = data.exerciseHistory ?? [];

  // Ensure locale exists (added in i18n migration)
  if (data.settings && !data.settings.locale) {
    data.settings.locale = 'ru';
  }

  return data as AppData;
}

function pruneOldHistory(data: AppData): void {
  const cutoff = Date.now() - SIXTY_DAYS_MS;
  data.history = data.history.filter((s) => s.completedAt > cutoff);
  data.exerciseHistory = data.exerciseHistory.filter((r) => r.timestamp > cutoff);
}

export function loadAppData(): AppData | null {
  try {
    const raw = localStorage.getItem(APP_DATA_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      console.warn('[storage] Corrupted app data, returning null');
      return null;
    }
    return migrateSchema(parsed);
  } catch (e) {
    console.warn('[storage] Failed to load app data:', e);
    return null;
  }
}

export function saveAppData(data: AppData): boolean {
  try {
    localStorage.setItem(APP_DATA_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      // Prune history older than 60 days and retry
      pruneOldHistory(data);
      try {
        localStorage.setItem(APP_DATA_KEY, JSON.stringify(data));
        return true;
      } catch {
        console.warn('[storage] Still over quota after pruning');
        return false;
      }
    }
    console.warn('[storage] Failed to save app data:', e);
    return false;
  }
}

export function exportData(data: AppData): string {
  return JSON.stringify(data, null, 2);
}

export function importData(json: string): AppData | null {
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') {
      console.warn('[storage] Invalid import data format');
      return null;
    }
    // Basic validation: check required top-level keys
    if (!parsed.profile || !parsed.settings || !parsed.progression || !parsed.difficulty) {
      console.warn('[storage] Import data missing required fields');
      return null;
    }
    // Validate critical field types
    if (!Array.isArray(parsed.history)) parsed.history = [];
    if (!Array.isArray(parsed.exerciseHistory)) parsed.exerciseHistory = [];
    if (typeof parsed.progression !== 'object' || parsed.progression === null) return null;
    if (!Array.isArray(parsed.progression.activityDays)) parsed.progression.activityDays = [];
    if (!Array.isArray(parsed.progression.earnedBadges)) parsed.progression.earnedBadges = [];
    if (typeof parsed.progression.totalXP !== 'number') parsed.progression.totalXP = 0;
    return migrateSchema(parsed);
  } catch (e) {
    console.warn('[storage] Failed to parse import data:', e);
    return null;
  }
}

export function onStorageChange(callback: (data: AppData | null) => void): () => void {
  const handler = (event: StorageEvent) => {
    if (event.key !== APP_DATA_KEY) return;
    if (event.newValue === null) {
      callback(null);
      return;
    }
    try {
      const parsed = JSON.parse(event.newValue);
      callback(migrateSchema(parsed));
    } catch {
      callback(null);
    }
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}
