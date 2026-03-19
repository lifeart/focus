import { el, addClass, removeClass } from '../renderer.js';
import { t } from '../../core/i18n.js';
import type { TranslationKey } from '../../i18n/keys.js';

interface NavItem {
  path: string;
  labelKey: TranslationKey;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    path: '/dashboard',
    labelKey: 'nav.home',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  },
  {
    path: '/exercises',
    labelKey: 'nav.exercises',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
  },
  {
    path: '/stats',
    labelKey: 'nav.stats',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  },
  {
    path: '/settings',
    labelKey: 'nav.settings',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  },
];

function isActive(itemPath: string, currentPath: string): boolean {
  if (itemPath === '/dashboard') {
    return currentPath === '/' || currentPath === '/dashboard';
  }
  // Exact match only — prevents /exercises matching /exercises-foo
  return currentPath === itemPath;
}

export function renderNav(
  container: HTMLElement,
  currentPath: string,
  onNavigate: (path: string) => void,
): () => void {
  const nav = el('nav', { className: 'nav' });

  for (const item of NAV_ITEMS) {
    const label = t(item.labelKey);
    const btn = el('button', {
      className: 'nav__item' + (isActive(item.path, currentPath) ? ' nav__item--active' : ''),
      'aria-label': label,
    });
    btn.setAttribute('data-nav-path', item.path);

    const iconSpan = el('span', { className: 'nav__icon' });
    iconSpan.innerHTML = item.icon;

    const labelSpan = el('span', { className: 'nav__label' }, [label]);

    btn.appendChild(iconSpan);
    btn.appendChild(labelSpan);

    btn.addEventListener('click', () => {
      onNavigate(item.path);
    });

    nav.appendChild(btn);
  }

  container.appendChild(nav);

  return () => {
    nav.remove();
  };
}

export function updateNavActive(container: HTMLElement, currentPath: string): void {
  const items = container.querySelectorAll<HTMLElement>('.nav__item[data-nav-path]');
  items.forEach((item) => {
    const path = item.getAttribute('data-nav-path') || '';
    if (isActive(path, currentPath)) {
      addClass(item, 'nav__item--active');
    } else {
      removeClass(item, 'nav__item--active');
    }
  });
}
