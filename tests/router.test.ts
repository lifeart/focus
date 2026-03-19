import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock DOM / window globals required by the router
// ---------------------------------------------------------------------------
let hashChangeListeners: Array<() => void> = [];
let currentHash = '';

const windowMock = {
  location: {
    get hash() { return currentHash; },
    set hash(v: string) {
      currentHash = v;
      // Simulate hashchange event
      for (const fn of hashChangeListeners) fn();
    },
  },
  addEventListener: vi.fn((event: string, handler: () => void) => {
    if (event === 'hashchange') hashChangeListeners.push(handler);
  }),
  removeEventListener: vi.fn((event: string, handler: () => void) => {
    if (event === 'hashchange') {
      hashChangeListeners = hashChangeListeners.filter(h => h !== handler);
    }
  }),
};
vi.stubGlobal('window', windowMock);

const containerEl = {
  id: 'app',
  innerHTML: '',
  querySelector: vi.fn(() => null),
  prepend: vi.fn(),
  createElement: vi.fn(),
};

// The router calls getContainer -> document.getElementById('app')
// then creates a #router-view child.
const routerViewEl = {
  id: 'router-view',
  innerHTML: '',
};

const docMock = {
  getElementById: vi.fn(() => containerEl),
  createElement: vi.fn(() => routerViewEl),
};
vi.stubGlobal('document', docMock);

// When querySelector('#router-view') returns null the first time,
// the router creates a new div. After that it caches it.
containerEl.querySelector = vi.fn(() => null) as any;
containerEl.prepend = vi.fn();

import { createRouter } from '../public/js/router';

beforeEach(() => {
  currentHash = '';
  hashChangeListeners = [];
  routerViewEl.innerHTML = '';
  containerEl.querySelector = vi.fn(() => null) as any;
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Route registration and matching
// ---------------------------------------------------------------------------
describe('route registration and matching', () => {
  it('calls render when navigating to a registered route', () => {
    const renderFn = vi.fn();
    const router = createRouter();
    router.register('/foo', renderFn);
    router.start();

    router.navigate('/foo');

    expect(renderFn).toHaveBeenCalled();
    const [container, params] = renderFn.mock.calls[0];
    expect(params).toEqual({});
  });

  it('does not call render for unregistered route (falls back to /dashboard)', () => {
    const dashboardRender = vi.fn();
    const router = createRouter();
    router.register('/dashboard', dashboardRender);
    router.start(); // initial render goes to /dashboard since hash is empty

    expect(dashboardRender).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Param extraction
// ---------------------------------------------------------------------------
describe('param extraction', () => {
  it('extracts :exerciseId from /play/:exerciseId', () => {
    const renderFn = vi.fn();
    const router = createRouter();
    router.register('/play/:exerciseId', renderFn);
    router.start();

    router.navigate('/play/flanker');

    expect(renderFn).toHaveBeenCalled();
    const params = renderFn.mock.calls[0][1];
    expect(params).toEqual({ exerciseId: 'flanker' });
  });

  it('extracts multiple params', () => {
    const renderFn = vi.fn();
    const router = createRouter();
    router.register('/section/:sectionId/item/:itemId', renderFn);
    router.start();

    router.navigate('/section/abc/item/123');

    expect(renderFn).toHaveBeenCalled();
    const params = renderFn.mock.calls[0][1];
    expect(params).toEqual({ sectionId: 'abc', itemId: '123' });
  });
});

// ---------------------------------------------------------------------------
// No match falls back to dashboard
// ---------------------------------------------------------------------------
describe('fallback to dashboard', () => {
  it('navigates to /dashboard when no route matches', () => {
    const dashboardRender = vi.fn();
    const fooRender = vi.fn();
    const router = createRouter();
    router.register('/dashboard', dashboardRender);
    router.register('/foo', fooRender);
    router.start();

    // Navigate away from /dashboard first so we can detect the redirect back
    router.navigate('/foo');
    dashboardRender.mockClear();

    router.navigate('/nonexistent');

    // Should have redirected to /dashboard
    expect(currentHash).toBe('#/dashboard');
    expect(dashboardRender).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getCurrentPath
// ---------------------------------------------------------------------------
describe('getCurrentPath', () => {
  it('returns the current path after navigation', () => {
    const renderFn = vi.fn();
    const router = createRouter();
    router.register('/settings', renderFn);
    router.start();

    router.navigate('/settings');
    expect(router.getCurrentPath()).toBe('/settings');
  });

  it('returns /dashboard after start with empty hash', () => {
    const dashRender = vi.fn();
    const router = createRouter();
    router.register('/dashboard', dashRender);
    router.start();

    expect(router.getCurrentPath()).toBe('/dashboard');
  });
});

// ---------------------------------------------------------------------------
// stop() removes hashchange listener
// ---------------------------------------------------------------------------
describe('stop', () => {
  it('calls cleanup function and stops listening', () => {
    const cleanup = vi.fn();
    const renderFn = vi.fn(() => cleanup);
    const router = createRouter();
    router.register('/test', renderFn);
    router.register('/dashboard', vi.fn());
    router.start();

    router.navigate('/test');
    expect(renderFn).toHaveBeenCalled();

    router.stop();
    expect(cleanup).toHaveBeenCalled();
  });
});
