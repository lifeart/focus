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
    data.version = CURRENT_DATA_VERSION;
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
