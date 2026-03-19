import type { ScreenRender, ExerciseResult, Mood } from '../../types.js';
import { el, addClass, clear } from '../renderer.js';
import { appState } from '../../main.js';
import { EXERCISE_CONFIGS, SESSION_MOOD_KEY } from '../../constants.js';
import { getLevel, getLevelTitle, getXPProgress, updateStreak, getScoreTier, generateWeeklyChallenge, checkWeeklyChallenge } from '../../core/progression.js';
import { renderAvatar } from '../components/avatar.js';
import { renderStreakDisplay } from '../components/streak-display.js';
import { renderProgressBar } from '../components/progress-bar.js';
import { createDisposables } from '../../core/disposables.js';

// ─── Mood config ────────────────────────────────────────────────────

const MOOD_OPTIONS: { mood: Mood; emoji: string; label: string }[] = [
  { mood: 'energized', emoji: '\u26A1', label: '\u042D\u043D\u0435\u0440\u0433\u0438\u044F' },
  { mood: 'calm', emoji: '\uD83D\uDE0C', label: '\u0421\u043F\u043E\u043A\u043E\u0439\u0441\u0442\u0432\u0438\u0435' },
  { mood: 'tired', emoji: '\uD83D\uDE34', label: '\u0423\u0441\u0442\u0430\u043B\u043E\u0441\u0442\u044C' },
  { mood: 'stressed', emoji: '\uD83D\uDE30', label: '\u0421\u0442\u0440\u0435\u0441\u0441' },
];

// ─── Time ago helper ────────────────────────────────────────────────

function timeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return '\u0442\u043E\u043B\u044C\u043A\u043E \u0447\u0442\u043E';
  if (minutes < 60) return `${minutes} \u043C\u0438\u043D \u043D\u0430\u0437\u0430\u0434`;
  if (hours < 24) return `${hours} ${hourWord(hours)} \u043D\u0430\u0437\u0430\u0434`;
  if (days === 1) return '\u0432\u0447\u0435\u0440\u0430';
  if (days < 7) return `${days} ${dayWord(days)} \u043D\u0430\u0437\u0430\u0434`;
  return `${Math.floor(days / 7)} \u043D\u0435\u0434. \u043D\u0430\u0437\u0430\u0434`;
}

function hourWord(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 19) return '\u0447\u0430\u0441\u043E\u0432';
  if (last === 1) return '\u0447\u0430\u0441';
  if (last >= 2 && last <= 4) return '\u0447\u0430\u0441\u0430';
  return '\u0447\u0430\u0441\u043E\u0432';
}

function dayWord(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 19) return '\u0434\u043D\u0435\u0439';
  if (last === 1) return '\u0434\u0435\u043D\u044C';
  if (last >= 2 && last <= 4) return '\u0434\u043D\u044F';
  return '\u0434\u043D\u0435\u0439';
}

// ─── Week days helper ───────────────────────────────────────────────

function getCurrentWeekDays(activityDays: string[]): boolean[] {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  const result: boolean[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    result.push(activityDays.includes(iso));
  }
  return result;
}

// ─── Today's training minutes ───────────────────────────────────────

function getTodayMinutes(exerciseHistory: ExerciseResult[]): number {
  const todayStr = new Date().toISOString().slice(0, 10);
  let totalMs = 0;
  for (const r of exerciseHistory) {
    const rDate = new Date(r.timestamp).toISOString().slice(0, 10);
    if (rDate === todayStr) {
      totalMs += r.durationMs;
    }
  }
  return Math.floor(totalMs / 60000);
}

// ─── Mood modal ─────────────────────────────────────────────────────

function showMoodModal(disposables: ReturnType<typeof createDisposables>): void {
  const overlay = el('div', { className: 'mood-modal-overlay' });
  const modal = el('div', { className: 'mood-modal' });

  const title = el('h3', { className: 'mood-modal__title' }, [
    '\u041A\u0430\u043A \u0442\u044B \u0441\u0435\u0431\u044F \u0447\u0443\u0432\u0441\u0442\u0432\u0443\u0435\u0448\u044C?',
  ]);
  modal.appendChild(title);

  const options = el('div', { className: 'mood-modal__options' });

  for (const opt of MOOD_OPTIONS) {
    const btn = el('button', { className: 'mood-modal__btn' }, [
      el('span', { className: 'mood-modal__emoji' }, [opt.emoji]),
      el('span', { className: 'mood-modal__label' }, [opt.label]),
    ]);

    disposables.addListener(btn, 'click', () => {
      sessionStorage.setItem(SESSION_MOOD_KEY, opt.mood);
      overlay.remove();
      window.location.hash = '#/exercises';
    });

    options.appendChild(btn);
  }

  modal.appendChild(options);
  overlay.appendChild(modal);

  disposables.addListener(overlay, 'click', (e: Event) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });

  document.body.appendChild(overlay);
  disposables.addCleanup(() => overlay.remove());
}

// ─── Dashboard screen ───────────────────────────────────────────────

export const renderDashboard: ScreenRender = (container, _params) => {
  const disposables = createDisposables();
  const data = appState.getData();
  const { profile, progression, settings, exerciseHistory } = data;

  addClass(container, 'screen', 'screen--dashboard');

  const grid = el('div', { className: 'bento-grid' });

  // ── 1. Greeting card ──────────────────────────────────────────────

  const level = getLevel(progression.totalXP);
  const levelTitle = getLevelTitle(level);

  const avatarContainer = el('div');
  const cleanupAvatar = renderAvatar(avatarContainer, {
    level: profile.avatarLevel,
    color: profile.avatarColor,
    size: 96,
  });
  disposables.addCleanup(cleanupAvatar);

  const greeting = el('div', { className: 'card bento-grid__item--wide' }, [
    el('div', { className: 'flex flex--between' }, [
      el('div', null, [
        el('h1', { className: 'card__title card__title--xl' }, [
          `\u041F\u0440\u0438\u0432\u0435\u0442, ${profile.name || '\u0414\u0440\u0443\u0433'}!`,
        ]),
        el('p', { className: 'card__subtitle' }, [
          `\u0423\u0440\u043E\u0432\u0435\u043D\u044C ${level} \u00B7 ${levelTitle}`,
        ]),
      ]),
      avatarContainer,
    ]),
  ]);
  grid.appendChild(greeting);

  // ── 2. XP Progress card ───────────────────────────────────────────

  const xpProgress = getXPProgress(progression.totalXP);
  const xpCard = el('div', { className: 'card bento-grid__item--wide' }, [
    el('div', { className: 'card__header' }, [
      el('h3', { className: 'card__title' }, ['\u041E\u043F\u044B\u0442']),
      el('span', { className: 'badge badge--primary' }, [`${xpProgress.current} / ${xpProgress.required} XP`]),
    ]),
  ]);
  const cleanupProgress = renderProgressBar(xpCard, {
    value: xpProgress.current,
    max: xpProgress.required,
    showPercent: true,
    color: profile.avatarColor,
  });
  disposables.addCleanup(cleanupProgress);
  grid.appendChild(xpCard);

  // ── 3. Weekly Goal card ───────────────────────────────────────────

  const streakInfo = updateStreak(progression.activityDays);
  const weekDays = getCurrentWeekDays(progression.activityDays);
  const weeklyCard = el('div', { className: 'card bento-grid__item--wide' }, [
    el('h3', { className: 'card__title' }, ['\u041D\u0435\u0434\u0435\u043B\u044C\u043D\u0430\u044F \u0446\u0435\u043B\u044C']),
  ]);
  const cleanupStreak = renderStreakDisplay(weeklyCard, {
    weekDays,
    weeklyGoal: 5,
    longestStreak: streakInfo.longestStreak,
  });
  disposables.addCleanup(cleanupStreak);
  grid.appendChild(weeklyCard);

  // ── 4. Daily Progress card ────────────────────────────────────────

  const todayMinutes = getTodayMinutes(exerciseHistory);
  const dailyGoal = settings.dailyGoalMinutes;
  const dailyCard = el('div', { className: 'card' }, [
    el('h3', { className: 'card__title' }, ['\u0421\u0435\u0433\u043E\u0434\u043D\u044F']),
  ]);
  const cleanupDaily = renderProgressBar(dailyCard, {
    value: todayMinutes,
    max: dailyGoal,
    label: `${todayMinutes} \u0438\u0437 ${dailyGoal} \u043C\u0438\u043D`,
    showPercent: false,
  });
  disposables.addCleanup(cleanupDaily);
  grid.appendChild(dailyCard);

  // ── 5. Weekly Challenge card ──────────────────────────────────────

  // Auto-generate weekly challenge if none exists or if it's a new week
  const today = new Date();
  const mondayOfWeek = (() => {
    const d = new Date(today);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  })();

  let weeklyChallenge = progression.weeklyChallenge;
  if (!weeklyChallenge || weeklyChallenge.weekStart !== mondayOfWeek) {
    weeklyChallenge = generateWeeklyChallenge();
    appState.updateData((d) => {
      d.progression.weeklyChallenge = weeklyChallenge;
    });
  }

  const challengeComplete = checkWeeklyChallenge(weeklyChallenge, progression);

  const challengeCard = el('div', { className: 'card' }, [
    el('div', { className: 'card__header' }, [
      el('h3', { className: 'card__title' }, ['\u041D\u0435\u0434\u0435\u043B\u044C\u043D\u044B\u0439 \u0432\u044B\u0437\u043E\u0432']),
      challengeComplete
        ? el('span', { className: 'badge badge--success' }, ['\u0412\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u043E!'])
        : el('span', { className: 'badge badge--primary' }, [`${weeklyChallenge.progress}/${weeklyChallenge.target}`]),
    ]),
    el('p', { className: 'card__subtitle' }, [weeklyChallenge.description]),
  ]);

  const cleanupChallenge = renderProgressBar(challengeCard, {
    value: weeklyChallenge.progress,
    max: weeklyChallenge.target,
    showPercent: false,
  });
  disposables.addCleanup(cleanupChallenge);
  grid.appendChild(challengeCard);

  // ── 6. Quick Start button ─────────────────────────────────────────

  const quickStartCard = el('div', { className: 'card bento-grid__item--wide' });
  const startBtn = el('button', { className: 'btn btn--primary btn--lg btn--full' }, [
    '\u041D\u0430\u0447\u0430\u0442\u044C \u0442\u0440\u0435\u043D\u0438\u0440\u043E\u0432\u043A\u0443',
  ]);

  disposables.addListener(startBtn, 'click', () => {
    const hasMood = sessionStorage.getItem(SESSION_MOOD_KEY);
    if (!hasMood) {
      showMoodModal(disposables);
    } else {
      window.location.hash = '#/exercises';
    }
  });

  quickStartCard.appendChild(startBtn);
  grid.appendChild(quickStartCard);

  // ── 7. Recent Activity card ───────────────────────────────────────

  const activityCard = el('div', { className: 'card bento-grid__item--wide' }, [
    el('h3', { className: 'card__title' }, ['\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0435 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B']),
  ]);

  if (exerciseHistory.length === 0) {
    const emptyState = el('div', { className: 'empty-state' }, [
      el('p', { className: 'empty-state__text' }, [
        '\u0414\u043E \u043F\u0435\u0440\u0432\u043E\u0433\u043E \u0431\u0435\u0439\u0434\u0436\u0430 \u043E\u0434\u043D\u0430 \u0441\u0435\u0441\u0441\u0438\u044F!',
      ]),
      el('p', { className: 'empty-state__hint' }, [
        '\u041D\u0430\u0436\u043C\u0438 \u043A\u043D\u043E\u043F\u043A\u0443 \u0432\u044B\u0448\u0435 \u0438 \u043D\u0430\u0447\u043D\u0438 \u0441\u0432\u043E\u0439 \u043F\u0443\u0442\u044C \u043A \u043C\u0430\u0441\u0442\u0435\u0440\u0441\u0442\u0432\u0443!',
      ]),
    ]);
    activityCard.appendChild(emptyState);
  } else {
    const recent = exerciseHistory.slice(-5).reverse();
    const list = el('div', { className: 'activity-list' });

    for (const result of recent) {
      const config = EXERCISE_CONFIGS[result.exerciseId];
      const tier = getScoreTier(result.score);
      const item = el('div', { className: 'activity-item' }, [
        el('div', { className: 'activity-item__icon' }, [config?.icon || '\u2753']),
        el('div', { className: 'activity-item__info' }, [
          el('span', { className: 'activity-item__name' }, [config?.name || result.exerciseId]),
          el('span', { className: 'activity-item__time' }, [timeAgo(result.timestamp)]),
        ]),
        el('div', { className: 'activity-item__score' }, [
          el('span', { className: 'activity-item__score-value' }, [`${result.score}`]),
          el('span', { className: 'activity-item__score-tier' }, [tier.label]),
        ]),
      ]);
      list.appendChild(item);
    }

    activityCard.appendChild(list);
  }

  grid.appendChild(activityCard);

  // ── Assemble ──────────────────────────────────────────────────────

  container.appendChild(grid);

  return () => {
    disposables.dispose();
  };
};
