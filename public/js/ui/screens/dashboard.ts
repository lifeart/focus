import type { ScreenRender, ExerciseResult, Mood, DailyChallenge } from '../../types.js';
import { el, addClass, clear } from '../renderer.js';
import { appState } from '../../main.js';
import { EXERCISE_CONFIGS, SESSION_MOOD_KEY, SESSION_TYPE_KEY, XP_SOURCES } from '../../constants.js';
import { getLevel, getLevelTitle, getXPProgress, updateStreak, getScoreTier, generateWeeklyChallenge, checkWeeklyChallenge, generateDailyChallenge } from '../../core/progression.js';
import { renderAvatar } from '../components/avatar.js';
import { renderStreakDisplay } from '../components/streak-display.js';
import { renderProgressBar } from '../components/progress-bar.js';
import { createDisposables } from '../../core/disposables.js';
import { t, tPlural } from '../../core/i18n.js';
import { shouldPromptBaseline } from '../../core/baseline.js';

// ─── Mood config ────────────────────────────────────────────────────

const MOOD_KEYS: { mood: Mood; emoji: string; labelKey: 'mood.energized' | 'mood.calm' | 'mood.tired' | 'mood.stressed' }[] = [
  { mood: 'energized', emoji: '\u26A1', labelKey: 'mood.energized' },
  { mood: 'calm', emoji: '\uD83D\uDE0C', labelKey: 'mood.calm' },
  { mood: 'tired', emoji: '\uD83D\uDE34', labelKey: 'mood.tired' },
  { mood: 'stressed', emoji: '\uD83D\uDE30', labelKey: 'mood.stressed' },
];

// ─── Time ago helper ────────────────────────────────────────────────

function timeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return t('time.justNow');
  if (minutes < 60) return t('time.minAgo', { n: minutes });
  if (hours < 24) {
    const unit = tPlural('plural.hour', hours);
    return t('time.hoursAgo', { n: hours, unit });
  }
  if (days === 1) return t('time.yesterday');
  if (days < 7) {
    const unit = tPlural('plural.day', days);
    return t('time.daysAgo', { n: days, unit });
  }
  return t('time.weeksAgo', { n: Math.floor(days / 7) });
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
    t('dashboard.moodQuestion'),
  ]);
  modal.appendChild(title);

  const options = el('div', { className: 'mood-modal__options' });

  for (const opt of MOOD_KEYS) {
    const btn = el('button', { className: 'mood-modal__btn' }, [
      el('span', { className: 'mood-modal__emoji' }, [opt.emoji]),
      el('span', { className: 'mood-modal__label' }, [t(opt.labelKey)]),
    ]);

    disposables.addListener(btn, 'click', () => {
      sessionStorage.setItem(SESSION_MOOD_KEY, opt.mood);
      overlay.remove();
      window.location.hash = '#/session';
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
          t('dashboard.greeting', { name: profile.name || t('dashboard.defaultName') }),
        ]),
        el('p', { className: 'card__subtitle' }, [
          t('dashboard.levelLabel', { level, title: levelTitle }),
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
      el('h3', { className: 'card__title' }, [t('dashboard.xp')]),
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

  // Compute streak display flags
  const todayStr = new Date().toISOString().slice(0, 10);
  const hasTrainedToday = progression.activityDays.includes(todayStr);
  const streakSaved = sessionStorage.getItem('focus:streak_saved') === '1';
  const streakLost = sessionStorage.getItem('focus:streak_lost') === '1';
  const streakAtRisk = progression.currentStreak > 0 && !hasTrainedToday && progression.streakFreezes === 0;

  // Clear one-time flags after reading
  try {
    sessionStorage.removeItem('focus:streak_saved');
    sessionStorage.removeItem('focus:streak_lost');
  } catch {}

  const weeklyCard = el('div', { className: 'card bento-grid__item--wide' }, [
    el('h3', { className: 'card__title' }, [t('dashboard.weeklyGoal')]),
  ]);
  const cleanupStreak = renderStreakDisplay(weeklyCard, {
    weekDays,
    weeklyGoal: 5,
    longestStreak: streakInfo.longestStreak,
    currentStreak: progression.currentStreak,
    streakFreezes: progression.streakFreezes,
    streakSaved,
    streakLost,
    streakAtRisk,
  });
  disposables.addCleanup(cleanupStreak);
  grid.appendChild(weeklyCard);

  // ── 4. Daily Progress card ────────────────────────────────────────

  const todayMinutes = getTodayMinutes(exerciseHistory);
  const dailyGoal = settings.dailyGoalMinutes;
  const dailyCard = el('div', { className: 'card' }, [
    el('h3', { className: 'card__title' }, [t('dashboard.today')]),
  ]);
  const cleanupDaily = renderProgressBar(dailyCard, {
    value: todayMinutes,
    max: dailyGoal,
    label: t('dashboard.todayProgress', { done: todayMinutes, goal: dailyGoal }),
    showPercent: false,
  });
  disposables.addCleanup(cleanupDaily);
  grid.appendChild(dailyCard);

  // ── 4b. Daily Login Bonus ──────────────────────────────────────────

  const todayIso = new Date().toISOString().slice(0, 10);
  if (progression.lastDailyBonusDate !== todayIso) {
    const bonusAmount = XP_SOURCES.dailyLoginBonus;
    appState.updateData((d) => {
      if (d.progression.lastDailyBonusDate !== todayIso) {
        d.progression.totalXP += bonusAmount;
        d.progression.lastDailyBonusDate = todayIso;
      }
    });
    appState.emit({ type: 'daily-bonus', amount: bonusAmount });

    // Show brief bonus animation
    const bonusBanner = el('div', { className: 'daily-bonus-banner' }, [
      t('dashboard.dailyBonus', { xp: bonusAmount }),
    ]);
    grid.appendChild(bonusBanner);
    // Auto-remove after 3 seconds
    disposables.setTimeout(() => {
      bonusBanner.remove();
    }, 3000);
  }

  // ── 4c. Daily Challenge card ───────────────────────────────────────

  // Auto-generate daily challenge if none exists or if it's a new day
  {
    let dailyChallenge = progression.dailyChallenge;
    if (!dailyChallenge || dailyChallenge.date !== todayIso) {
      // Compute previous day's challenge type for "no repeat" filter
      const previousType = dailyChallenge?.type;
      // Check user history for difficulty guard
      const hasHistory = exerciseHistory.length > 0;
      const nBackLevel = data.difficulty['n-back']?.currentLevel || 1;
      dailyChallenge = generateDailyChallenge(todayIso, previousType, hasHistory, nBackLevel);
      appState.updateData((d) => {
        d.progression.dailyChallenge = dailyChallenge as DailyChallenge;
      });
    }

    // Daily challenge description key mapping
    const dailyChallengeDescKey = `dailyChallenge.${
      dailyChallenge.type === 'high-score-exercise' ? 'highScoreExercise'
      : dailyChallenge.type === 'complete-exercises' ? 'completeExercises'
      : dailyChallenge.type === 'beat-personal-best' ? 'beatPersonalBest'
      : dailyChallenge.type === 'train-minutes' ? 'trainMinutes'
      : dailyChallenge.type === 'multi-exercise-score' ? 'multiExerciseScore'
      : dailyChallenge.type === 'specific-exercise' ? 'specificExercise'
      : dailyChallenge.type === 'low-lapse-rate' ? 'lowLapseRate'
      : dailyChallenge.type === 'breathing-session' ? 'breathingSession'
      : dailyChallenge.type === 'fast-reaction' ? 'fastReaction'
      : dailyChallenge.type === 'n-back-level' ? 'nBackLevel'
      : dailyChallenge.type === 'streak-day' ? 'streakDay'
      : 'accuracyStreak'
    }` as any;

    const dailyChallengeCard = el('div', { className: 'card' }, [
      el('div', { className: 'card__header' }, [
        el('h3', { className: 'card__title' }, [t('dashboard.dailyChallenge')]),
        dailyChallenge.completed
          ? el('span', { className: 'badge badge--success' }, [t('dashboard.dailyChallengeComplete')])
          : el('span', { className: 'badge badge--primary' }, [`${dailyChallenge.progress}/${dailyChallenge.target}`]),
      ]),
      el('p', { className: 'card__subtitle' }, [t(dailyChallengeDescKey)]),
    ]);

    const cleanupDailyChallenge = renderProgressBar(dailyChallengeCard, {
      value: dailyChallenge.progress,
      max: dailyChallenge.target,
      showPercent: false,
    });
    disposables.addCleanup(cleanupDailyChallenge);
    grid.appendChild(dailyChallengeCard);
  }

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

  // Translate challenge description via key
  const challengeDescKey = `challenge.${weeklyChallenge.type === 'perfect-exercises' ? 'perfectExercises' : weeklyChallenge.type === 'total-sessions' ? 'totalSessions' : weeklyChallenge.type === 'focus-time' ? 'focusTime' : 'noErrors'}` as any;

  const challengeCard = el('div', { className: 'card' }, [
    el('div', { className: 'card__header' }, [
      el('h3', { className: 'card__title' }, [t('dashboard.weeklyChallenge')]),
      challengeComplete
        ? el('span', { className: 'badge badge--success' }, [t('dashboard.challengeComplete')])
        : el('span', { className: 'badge badge--primary' }, [`${weeklyChallenge.progress}/${weeklyChallenge.target}`]),
    ]),
    el('p', { className: 'card__subtitle' }, [t(challengeDescKey)]),
  ]);

  const cleanupChallenge = renderProgressBar(challengeCard, {
    value: weeklyChallenge.progress,
    max: weeklyChallenge.target,
    showPercent: false,
  });
  disposables.addCleanup(cleanupChallenge);
  grid.appendChild(challengeCard);

  // ── 5b. Baseline prompt ────────────────────────────────────────────

  if (data.onboardingComplete && shouldPromptBaseline(data.baseline, progression.totalSessionCount)) {
    const baselineCard = el('div', { className: 'card bento-grid__item--wide' }, [
      el('h3', { className: 'card__title' }, [t('baseline.title')]),
      el('p', { className: 'card__subtitle' }, [t('dashboard.baselinePrompt')]),
      el('a', {
        href: '#/play/baseline',
        className: 'btn btn--secondary btn--full',
      }, [t('dashboard.takeBaseline')]),
    ]);
    grid.appendChild(baselineCard);
  }

  // ── 6. Session type selector ─────────────────────────────────────

  const quickStartCard = el('div', { className: 'card bento-grid__item--wide' }, [
    el('h3', { className: 'card__title' }, [t('dashboard.chooseSession')]),
  ]);

  // Quick Start — primary, prominent
  const quickBtn = el('button', { className: 'btn btn--primary btn--lg btn--full session-type-btn' }, [
    el('span', { className: 'session-type-btn__icon' }, ['\u26A1']),
    el('span', { className: 'session-type-btn__text' }, [
      el('span', { className: 'session-type-btn__label' }, [t('dashboard.sessionQuick')]),
      el('span', { className: 'session-type-btn__desc' }, [t('dashboard.sessionQuickDesc')]),
    ]),
  ]);

  disposables.addListener(quickBtn, 'click', () => {
    sessionStorage.setItem(SESSION_TYPE_KEY, 'quick');
    window.location.hash = '#/session';
  });

  // Standard — secondary
  const standardBtn = el('button', { className: 'btn btn--secondary btn--full session-type-btn' }, [
    el('span', { className: 'session-type-btn__icon' }, ['\uD83C\uDFAF']),
    el('span', { className: 'session-type-btn__text' }, [
      el('span', { className: 'session-type-btn__label' }, [t('dashboard.sessionStandard')]),
      el('span', { className: 'session-type-btn__desc' }, [t('dashboard.sessionStandardDesc')]),
    ]),
  ]);

  disposables.addListener(standardBtn, 'click', () => {
    sessionStorage.setItem(SESSION_TYPE_KEY, 'standard');
    showMoodModal(disposables);
  });

  // Deep Focus — secondary
  const deepBtn = el('button', { className: 'btn btn--secondary btn--full session-type-btn' }, [
    el('span', { className: 'session-type-btn__icon' }, ['\uD83E\uDDE0']),
    el('span', { className: 'session-type-btn__text' }, [
      el('span', { className: 'session-type-btn__label' }, [t('dashboard.sessionDeep')]),
      el('span', { className: 'session-type-btn__desc' }, [t('dashboard.sessionDeepDesc')]),
    ]),
  ]);

  disposables.addListener(deepBtn, 'click', () => {
    sessionStorage.setItem(SESSION_TYPE_KEY, 'deep');
    showMoodModal(disposables);
  });

  quickStartCard.appendChild(quickBtn);
  quickStartCard.appendChild(standardBtn);
  quickStartCard.appendChild(deepBtn);
  grid.appendChild(quickStartCard);

  // ── 7. Recent Activity card ───────────────────────────────────────

  const activityCard = el('div', { className: 'card bento-grid__item--wide' }, [
    el('h3', { className: 'card__title' }, [t('dashboard.recentResults')]),
  ]);

  if (exerciseHistory.length === 0) {
    const emptyState = el('div', { className: 'empty-state' }, [
      el('p', { className: 'empty-state__text' }, [
        t('dashboard.emptyBadge'),
      ]),
      el('p', { className: 'empty-state__hint' }, [
        t('dashboard.emptyHint'),
      ]),
    ]);
    activityCard.appendChild(emptyState);
  } else {
    const recent = exerciseHistory.slice(-5).reverse();
    const list = el('div', { className: 'activity-list' });

    for (const result of recent) {
      const config = EXERCISE_CONFIGS[result.exerciseId];
      const tier = getScoreTier(result.score);
      const exerciseName = t(`exercise.${result.exerciseId}.name` as any);
      const tierLabel = tier.label;
      const item = el('div', { className: 'activity-item' }, [
        el('div', { className: 'activity-item__icon' }, [config?.icon || '\u2753']),
        el('div', { className: 'activity-item__info' }, [
          el('span', { className: 'activity-item__name' }, [exerciseName || result.exerciseId]),
          el('span', { className: 'activity-item__time' }, [timeAgo(result.timestamp)]),
        ]),
        el('div', { className: 'activity-item__score' }, [
          el('span', { className: 'activity-item__score-value' }, [`${result.score}`]),
          el('span', { className: 'activity-item__score-tier' }, [tierLabel]),
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
