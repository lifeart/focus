import type { Disposables } from '../types.js';

export function createDisposables(): Disposables {
  const cleanups: (() => void)[] = [];

  const disposables: Disposables = {
    addTimeout(id: ReturnType<typeof globalThis.setTimeout>): void {
      cleanups.push(() => clearTimeout(id));
    },

    addInterval(id: ReturnType<typeof globalThis.setInterval>): void {
      cleanups.push(() => clearInterval(id));
    },

    addRAF(id: number): void {
      cleanups.push(() => cancelAnimationFrame(id));
    },

    addListener(el: EventTarget, event: string, handler: EventListenerOrEventListenerObject): void {
      el.addEventListener(event, handler);
      cleanups.push(() => el.removeEventListener(event, handler));
    },

    addCleanup(fn: () => void): void {
      cleanups.push(fn);
    },

    setTimeout(fn: () => void, ms: number): ReturnType<typeof globalThis.setTimeout> {
      const id = globalThis.setTimeout(fn, ms);
      disposables.addTimeout(id);
      return id;
    },

    setInterval(fn: () => void, ms: number): ReturnType<typeof globalThis.setInterval> {
      const id = globalThis.setInterval(fn, ms);
      disposables.addInterval(id);
      return id;
    },

    requestAnimationFrame(fn: FrameRequestCallback): number {
      const id = globalThis.requestAnimationFrame(fn);
      disposables.addRAF(id);
      return id;
    },

    dispose(): void {
      // LIFO order
      for (let i = cleanups.length - 1; i >= 0; i--) {
        try {
          cleanups[i]();
        } catch {
          // ignore errors during cleanup
        }
      }
      cleanups.length = 0;
    },
  };

  return disposables;
}
