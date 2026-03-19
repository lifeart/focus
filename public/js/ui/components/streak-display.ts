import { el } from '../renderer.js';

export interface StreakDisplayOptions {
  /** Array of 7 booleans, one per day (Mon-Sun), true = active */
  weekDays: boolean[];
  /** Number of days goal (e.g. 5) */
  weeklyGoal: number;
  /** Longest streak in days */
  longestStreak: number;
}

const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

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

    const label = el('span', { className: 'streak-display__day-label' }, [DAY_LABELS[i]]);

    dayWrapper.appendChild(dot);
    dayWrapper.appendChild(label);
    dotsRow.appendChild(dayWrapper);
  }
  wrapper.appendChild(dotsRow);

  // Progress text - positive framing
  const progressText = el('div', { className: 'streak-display__progress' }, [
    `${activeDays} из ${weeklyGoal} дней`,
  ]);
  wrapper.appendChild(progressText);

  // Longest streak
  if (longestStreak > 0) {
    const streakText = el('div', { className: 'streak-display__longest' }, [
      `Лучшая серия: ${longestStreak} ${getDayWord(longestStreak)}`,
    ]);
    wrapper.appendChild(streakText);
  }

  container.appendChild(wrapper);

  return () => {
    wrapper.remove();
  };
}

function getDayWord(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 19) return 'дней';
  if (last === 1) return 'день';
  if (last >= 2 && last <= 4) return 'дня';
  return 'дней';
}
