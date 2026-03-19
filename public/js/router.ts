import type { ScreenRender } from './types.js';

interface RouteEntry {
  pattern: string;
  segments: string[];
  render: ScreenRender;
}

interface MatchResult {
  render: ScreenRender;
  params: Record<string, string>;
  pattern: string;
}

export interface Router {
  register(pattern: string, render: ScreenRender): void;
  navigate(path: string): void;
  start(): void;
  stop(): void;
  getCurrentPath(): string;
}

function parsePattern(pattern: string): string[] {
  return pattern.split('/').filter(Boolean);
}

function matchRoute(routes: RouteEntry[], path: string): MatchResult | null {
  const pathSegments = path.split('/').filter(Boolean);

  for (const route of routes) {
    if (route.segments.length !== pathSegments.length) continue;

    const params: Record<string, string> = {};
    let matched = true;

    for (let i = 0; i < route.segments.length; i++) {
      const seg = route.segments[i];
      if (seg.startsWith(':')) {
        params[seg.slice(1)] = pathSegments[i];
      } else if (seg !== pathSegments[i]) {
        matched = false;
        break;
      }
    }

    if (matched) {
      return { render: route.render, params, pattern: route.pattern };
    }
  }

  return null;
}

function getHashPath(): string {
  const hash = window.location.hash;
  if (!hash || hash === '#') return '/dashboard';
  // Strip leading '#'
  return hash.startsWith('#') ? hash.slice(1) : hash;
}

export function createRouter(container?: HTMLElement): Router {
  const routes: RouteEntry[] = [];
  let currentPath = '';
  let currentCleanup: (() => void) | null = null;
  let routerContainer: HTMLElement | null = null;
  let listening = false;

  function getContainer(): HTMLElement {
    if (routerContainer) return routerContainer;

    const appEl = container || document.getElementById('app');
    if (!appEl) throw new Error('Router: #app element not found');

    // Create a router-managed div inside #app
    let rc = appEl.querySelector<HTMLElement>('#router-view');
    if (!rc) {
      rc = document.createElement('div');
      rc.id = 'router-view';
      // Insert at beginning so nav stays below
      appEl.prepend(rc);
    }
    routerContainer = rc;
    return rc;
  }

  function render(path: string): void {
    if (path === currentPath) return;

    const match = matchRoute(routes, path);

    if (!match) {
      // Fallback to dashboard
      if (path !== '/dashboard') {
        navigate('/dashboard');
      }
      return;
    }

    // Cleanup previous screen
    if (currentCleanup) {
      try {
        currentCleanup();
      } catch (e) {
        console.error('[router] Cleanup error:', e);
      }
      currentCleanup = null;
    }

    const rc = getContainer();
    rc.innerHTML = '';

    currentPath = path;

    // Render new screen
    const cleanup = match.render(rc, match.params);
    if (typeof cleanup === 'function') {
      currentCleanup = cleanup;
    }
  }

  function onHashChange(): void {
    const path = getHashPath();
    render(path);
  }

  function navigate(path: string): void {
    window.location.hash = '#' + path;
    // hashchange event will trigger render
  }

  function register(pattern: string, renderFn: ScreenRender): void {
    routes.push({
      pattern,
      segments: parsePattern(pattern),
      render: renderFn,
    });
  }

  function start(): void {
    if (listening) return;
    listening = true;
    window.addEventListener('hashchange', onHashChange);
    // Initial render
    onHashChange();
  }

  function stop(): void {
    if (!listening) return;
    listening = false;
    window.removeEventListener('hashchange', onHashChange);
    if (currentCleanup) {
      try {
        currentCleanup();
      } catch (e) {
        console.error('[router] Cleanup error:', e);
      }
      currentCleanup = null;
    }
  }

  function getCurrentPath(): string {
    return currentPath;
  }

  return {
    register,
    navigate,
    start,
    stop,
    getCurrentPath,
  };
}
