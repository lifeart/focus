import type { AppData, AppEvent, EventListener } from '../types.js';
import { createDefaultAppData } from '../constants.js';
import { loadAppData, saveAppData, onStorageChange } from './storage.js';

type ListenerEntry = {
  type: AppEvent['type'];
  fn: (event: any) => void;
};

export function createAppState() {
  let data: AppData = createDefaultAppData();
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  const listeners: ListenerEntry[] = [];
  let removeStorageListener: (() => void) | null = null;
  let removeBeforeUnload: (() => void) | null = null;

  function scheduleSave(): void {
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
    }
    saveTimer = setTimeout(() => {
      saveAppData(data);
      saveTimer = null;
    }, 1000);
  }

  function flush(): void {
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    saveAppData(data);
  }

  function subscribe<T extends AppEvent['type']>(
    type: T,
    listener: EventListener<T>,
  ): () => void {
    const entry: ListenerEntry = { type, fn: listener };
    listeners.push(entry);
    return () => {
      const idx = listeners.indexOf(entry);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  }

  function emit(event: AppEvent): void {
    for (const entry of listeners) {
      if (entry.type === event.type) {
        try {
          entry.fn(event);
        } catch (e) {
          console.error('[state] Listener error:', e);
        }
      }
    }
  }

  function getData(): AppData {
    return data;
  }

  function updateData(updater: (data: AppData) => void): void {
    updater(data);
    scheduleSave();
  }

  function init(): void {
    const loaded = loadAppData();
    if (loaded) {
      data = loaded;
    } else {
      data = createDefaultAppData();
    }

    // Setup beforeunload to flush pending saves
    const beforeUnloadHandler = () => flush();
    window.addEventListener('beforeunload', beforeUnloadHandler);
    removeBeforeUnload = () => window.removeEventListener('beforeunload', beforeUnloadHandler);

    // Cross-tab sync via storage event
    removeStorageListener = onStorageChange((newData) => {
      if (newData) {
        data = newData;
        emit({ type: 'data-imported' });
      }
    });
  }

  function resetData(): void {
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    data = createDefaultAppData();
    saveAppData(data);
    emit({ type: 'data-reset' });
  }

  function destroy(): void {
    flush();
    if (removeStorageListener) {
      removeStorageListener();
      removeStorageListener = null;
    }
    if (removeBeforeUnload) {
      removeBeforeUnload();
      removeBeforeUnload = null;
    }
    listeners.length = 0;
  }

  return {
    subscribe,
    emit,
    getData,
    updateData,
    flush,
    init,
    resetData,
    destroy,
  };
}
