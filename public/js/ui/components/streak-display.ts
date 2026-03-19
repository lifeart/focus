import { el } from '../renderer.js';
import { t, tPlural } from '../../core/i18n.js';
import type { TranslationKey } from '../../i18n/keys.js';
import { STREAK_FREEZE_MAX } from '../../constants.js';

export interface StreakDisplayOptions {
  /** Array of 7 booleans, one per day (Mon-Sun), true = active */
  weekDays: boolean[];
  /** Number of days goal (e.g. 5) */
  weeklyGoal: number;
  /** Longest streak in days */
  longestStreak: number;
  /** Current ongoing streak */
  currentStreak: number;
  /** Number of banked streak freezes (0-3) */
  streakFreezes: number;
  /** Whether a freeze was consumed this session (show "Streak saved!" banner) */
  streakSaved: boolean;
  /** Whether the streak was lost this session */
  streakLost: boolean;
  /** Whether streak is at risk (no freezes, no session today, streak > 0) */
  streakAtRisk: boolean;
}

const DAY_KEYS: TranslationKey[] = [
  'day.mon', 'day.tue', 'day.wed', 'day.thu', 'day.fri', 'day.sat', 'day.sun',
];

export function renderStreakDisplay(
  container: HTMLElement,
  options: StreakDisplayOptions,
): () => void {
  const {
    weekDays,
    weeklyGoal,
    longestStreak,
    currentStreak,
    streakFreezes,
    streakSaved,
    streakLost,
    streakAtRisk,
  } = options;
  const activeDays = weekDays.filter(Boolean).length;

  const wrapper = el('div', { className: 'streak-display' });

  // ── Current streak counter (large) ──────────────────────────────
  const streakCounter = el('div', { className: 'streak-display__counter' });
  if (currentStreak > 0) {
    const fireIcon = el('span', { className: 'streak-display__fire' }, ['\uD83D\uDD25']);
    const streakNum = el('span', { className: 'streak-display__number' }, [`${currentStreak}`]);
    const unit = tPlural('plural.day', currentStreak);
    const streakLabel = el('span', { className: 'streak-display__label' }, [
      t('streak.current', { n: currentStreak, unit }),
    ]);
    streakCounter.appendChild(fireIcon);
    streakCounter.appendChild(streakNum);
    streakCounter.appendChild(streakLabel);
  } else {
    const streakLabel = el('span', { className: 'streak-display__label streak-display__label--zero' }, [
      t('streak.currentZero'),
    ]);
    streakCounter.appendChild(streakLabel);
  }
  wrapper.appendChild(streakCounter);

  // ── Freeze indicators ───────────────────────────────────────────
  const freezeRow = el('div', { className: 'streak-display__freezes' });
  for (let i = 0; i < STREAK_FREEZE_MAX; i++) {
    const isFilled = i < streakFreezes;
    const snowflake = el('span', {
      className: 'streak-display__freeze-icon' + (isFilled ? ' streak-display__freeze-icon--active' : ''),
    }, ['\u2744\uFE0F']);
    freezeRow.appendChild(snowflake);
  }
  const freezeLabel = el('span', { className: 'streak-display__freeze-label' }, [
    t('streak.freezes', { n: streakFreezes, max: STREAK_FREEZE_MAX }),
  ]);
  freezeRow.appendChild(freezeLabel);
  wrapper.appendChild(freezeRow);

  // ── Status banners ──────────────────────────────────────────────
  if (streakSaved) {
    const banner = el('div', { className: 'streak-display__banner streak-display__banner--saved' }, [
      '\u2744\uFE0F ', t('streak.saved'),
    ]);
    wrapper.appendChild(banner);
  }

  if (streakLost) {
    const banner = el('div', { className: 'streak-display__banner streak-display__banner--lost' }, [
      t('streak.lost'),
    ]);
    wrapper.appendChild(banner);
  }

  if (streakAtRisk && !streakSaved && !streakLost) {
    const banner = el('div', { className: 'streak-display__banner streak-display__banner--risk' }, [
      t('streak.atRisk'),
    ]);
    wrapper.appendChild(banner);
  }

  // ── Week dots row ───────────────────────────────────────────────
  const dotsRow = el('div', { className: 'streak-display__dots' });
  for (let i = 0; i < 7; i++) {
    const dayWrapper = el('div', { className: 'streak-display__day' });

    const dot = el('div', {
      className: 'streak-display__dot' + (weekDays[i] ? ' streak-display__dot--active' : ''),
    });

    const label = el('span', { className: 'streak-display__day-label' }, [t(DAY_KEYS[i])]);

    dayWrapper.appendChild(dot);
    dayWrapper.appendChild(label);
    dotsRow.appendChild(dayWrapper);
  }
  wrapper.appendChild(dotsRow);

  // ── Progress text ───────────────────────────────────────────────
  const progressText = el('div', { className: 'streak-display__progress' }, [
    t('streak.daysOf', { done: activeDays, goal: weeklyGoal }),
  ]);
  wrapper.appendChild(progressText);

  // ── Longest streak ──────────────────────────────────────────────
  if (longestStreak > 0) {
    const unit = tPlural('plural.day', longestStreak);
    const streakText = el('div', { className: 'streak-display__longest' }, [
      t('streak.bestStreak', { n: longestStreak, unit }),
    ]);
    wrapper.appendChild(streakText);
  }

  container.appendChild(wrapper);

  return () => {
    wrapper.remove();
  };
}
