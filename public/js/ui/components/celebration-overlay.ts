import { el } from '../renderer.js';
import { t } from '../../core/i18n.js';
import { createConfetti } from './confetti.js';
import { BADGE_DEFINITIONS } from '../../constants.js';
import type { SoundManager, EarnedBadge, Disposables, ThemeId } from '../../types.js';

// ─── Types ────────────────────────────────────────────────────────────

export interface CelebrationData {
  levelUp?: {
    newLevel: number;
    title: string;
    unlockedThemes: ThemeId[];
    unlockedAvatarLevel: boolean;
  };
  badges: EarnedBadge[];
  currentLevel?: number;
}

// ─── Constants ────────────────────────────────────────────────────────

const OVERLAY_TIMEOUT_EARLY_MS = 2500; // levels 1-10: frequent level-ups
const OVERLAY_TIMEOUT_LATE_MS = 4000;  // levels 11+: rare level-ups
const MAX_OVERLAYS = 3;

function getOverlayTimeout(level: number): number {
  return level <= 10 ? OVERLAY_TIMEOUT_EARLY_MS : OVERLAY_TIMEOUT_LATE_MS;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function dismissOverlay(overlay: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    overlay.classList.add('celebration-overlay--dismiss');
    const onEnd = (): void => {
      if (overlay.parentNode) overlay.remove();
      resolve();
    };
    overlay.addEventListener('animationend', onEnd, { once: true });
    // Fallback in case animationend doesn't fire
    setTimeout(() => {
      if (overlay.parentNode) overlay.remove();
      resolve();
    }, 400);
  });
}

function tryVibrate(pattern: number[]): void {
  try {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch {
    // ignore
  }
}

// ─── Level-Up Overlay ─────────────────────────────────────────────────

function showLevelUpOverlay(
  data: NonNullable<CelebrationData['levelUp']>,
  sound: SoundManager,
  disposables: Disposables,
): Promise<void> {
  return new Promise((resolve) => {
    let resolved = false;
    const done = (): void => {
      if (resolved) return;
      resolved = true;
      dismissOverlay(overlay).then(resolve);
    };

    const unlockItems: (Node | string)[] = [];
    for (const theme of data.unlockedThemes) {
      unlockItems.push(
        el('div', null, [t('celebration.unlockedTheme', { theme: t(`theme.${theme}` as any) })]),
      );
    }
    if (data.unlockedAvatarLevel) {
      unlockItems.push(el('div', null, [t('celebration.unlockedAvatar')]));
    }

    const unlocksEl = unlockItems.length > 0
      ? el('div', { className: 'celebration__unlocks' }, unlockItems)
      : null;

    const children: (Node | string)[] = [
      el('div', { className: 'celebration__icon' }, ['\u2B50']),
      el('div', { className: 'celebration__heading' }, [t('celebration.levelUp')]),
      el('div', { className: 'celebration__level' }, [t('celebration.newLevel', { level: data.newLevel })]),
      el('div', { className: 'celebration__title' }, [t('celebration.levelTitle', { title: data.title })]),
    ];
    if (unlocksEl) children.push(unlocksEl);
    children.push(
      el('div', { className: 'celebration__dismiss-hint' }, [t('celebration.tapToDismiss')]),
    );

    const overlay = el('div', { className: 'celebration-overlay' }, children);

    document.body.appendChild(overlay);
    disposables.addCleanup(() => { if (overlay.parentNode) overlay.remove(); });

    // Sound & haptics
    sound.playLevelUp();
    tryVibrate([100, 50, 200]);

    // Confetti
    createConfetti(overlay, disposables);

    // Dismiss on click/tap
    disposables.addListener(overlay, 'click', done);

    // Auto-dismiss (shorter for early levels where level-ups are frequent)
    disposables.setTimeout(done, getOverlayTimeout(data.newLevel));
  });
}

// ─── Badge Overlay ────────────────────────────────────────────────────

function showBadgeOverlay(
  badge: EarnedBadge,
  sound: SoundManager,
  disposables: Disposables,
  level: number,
): Promise<void> {
  return new Promise((resolve) => {
    let resolved = false;
    const done = (): void => {
      if (resolved) return;
      resolved = true;
      dismissOverlay(overlay).then(resolve);
    };

    const badgeDef = BADGE_DEFINITIONS.find((d) => d.id === badge.id);
    const badgeIcon = badgeDef?.icon ?? '\uD83C\uDFC5';
    const badgeName = t(`badge.${badge.id}.name` as any);
    const badgeDesc = t(`badge.${badge.id}.${badge.tier}` as any);
    const tierLabel = t(`badgeTier.${badge.tier}` as any);

    const tierClass = `celebration__tier celebration__tier--${badge.tier}`;

    const children: (Node | string)[] = [
      el('div', { className: 'celebration__badge-icon' }, [badgeIcon]),
      el('div', { className: 'celebration__heading' }, [t('celebration.badgeEarned')]),
      el('div', { className: 'celebration__badge-name' }, [badgeName]),
      el('div', { className: tierClass }, [t('celebration.badgeTier', { tier: tierLabel })]),
      el('div', { className: 'celebration__badge-desc' }, [badgeDesc]),
    ];

    // Share button (only if navigator.share available)
    if (typeof navigator !== 'undefined' && navigator.share) {
      const shareBtn = el('button', {
        className: 'btn btn--secondary celebration__share-btn',
      }, [t('celebration.share')]);

      disposables.addListener(shareBtn, 'click', (e: Event) => {
        e.stopPropagation(); // Don't dismiss on share click
        const shareText = t('celebration.shareText', { badge: badgeName, tier: tierLabel });
        navigator.share({ title: 'Focus', text: shareText }).catch(() => { /* ignore */ });
      });
      children.push(shareBtn);
    }

    children.push(
      el('div', { className: 'celebration__dismiss-hint' }, [t('celebration.tapToDismiss')]),
    );

    const overlay = el('div', { className: 'celebration-overlay' }, children);

    document.body.appendChild(overlay);
    disposables.addCleanup(() => { if (overlay.parentNode) overlay.remove(); });

    // Sound & haptics
    sound.playBadge();
    tryVibrate([50, 30, 50]);

    // Dismiss on click/tap
    disposables.addListener(overlay, 'click', done);

    // Auto-dismiss (shorter for early levels where celebrations are frequent)
    disposables.setTimeout(done, getOverlayTimeout(level));
  });
}

// ─── Orchestrator ─────────────────────────────────────────────────────

export async function showCelebrations(
  data: CelebrationData,
  sound: SoundManager,
  disposables: Disposables,
): Promise<void> {
  let overlayCount = 0;
  const level = data.levelUp?.newLevel ?? data.currentLevel ?? 1;

  if (data.levelUp && overlayCount < MAX_OVERLAYS) {
    overlayCount++;
    await showLevelUpOverlay(data.levelUp, sound, disposables);
  }

  for (const badge of data.badges) {
    if (overlayCount >= MAX_OVERLAYS) break;
    overlayCount++;
    await showBadgeOverlay(badge, sound, disposables, level);
  }
}
