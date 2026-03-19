import { el } from '../renderer.js';
import { t, tPlural } from '../../core/i18n.js';
import type { TranslationKey } from '../../i18n/keys.js';

export interface StreakDisplayOptions {
  /** Array of 7 booleans, one per day (Mon-Sun), true = active */
  weekDays: boolean[];
  /** Number of days goal (e.g. 5) */
  weeklyGoal: number;
  /** Longest streak in days */
  longestStreak: number;
}

const DAY_KEYS: TranslationKey[] = [
  'day.mon', 'day.tue', 'day.wed', 'day.thu', 'day.fri', 'day.sat', 'day.sun',
];

export function renderStreakDisplay(
  container: HTMLElement,
  options: StreakDisplayOptions,
): () => void {
  const { weekDays, weeklyGoal, longestStreak } = options;
  const activeDays = weekDays.filter(Boolean).length;

  const wrapper = el('div', { className: 'streak-display' });

  // Week dots row
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

  // Progress text - positive framing
  const progressText = el('div', { className: 'streak-display__progress' }, [
    t('streak.daysOf', { done: activeDays, goal: weeklyGoal }),
  ]);
  wrapper.appendChild(progressText);

  // Longest streak
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
