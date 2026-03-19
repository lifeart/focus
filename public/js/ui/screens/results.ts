import type { ScreenRender, ExerciseResult, ExerciseId, Mood } from '../../types.js';
import { el, addClass } from '../renderer.js';
import { EXERCISE_CONFIGS, SESSION_RESULT_KEY, SESSION_BONUS_KEY, SESSION_MOOD_KEY, SESSION_POST_MOOD_KEY } from '../../constants.js';
import { getScoreTier, getLevel, getLevelTitle } from '../../core/progression.js';
import { appState } from '../../main.js';
import { createDisposables } from '../../core/disposables.js';

const MOOD_OPTIONS: { mood: Mood; emoji: string; label: string }[] = [
  { mood: 'energized', emoji: '\u26A1', label: '\u042D\u043D\u0435\u0440\u0433\u0438\u044F' },
  { mood: 'calm', emoji: '\uD83D\uDE0C', label: '\u0421\u043F\u043E\u043A\u043E\u0439\u0441\u0442\u0432\u0438\u0435' },
  { mood: 'tired', emoji: '\uD83D\uDE34', label: '\u0423\u0441\u0442\u0430\u043B\u043E\u0441\u0442\u044C' },
  { mood: 'stressed', emoji: '\uD83D\uDE30', label: '\u0421\u0442\u0440\u0435\u0441\u0441' },
];

const MOOD_RANK: Record<Mood, number> = {
  stressed: 0,
  tired: 1,
  calm: 2,
  energized: 3,
};

function getMoodComparisonMessage(pre: Mood, post: Mood): string {
  const preRank = MOOD_RANK[pre];
  const postRank = MOOD_RANK[post];

  if (postRank > preRank) {
    // Improved
    const preLabel = MOOD_OPTIONS.find((o) => o.mood === pre)!.label.toLowerCase();
    const postLabel = MOOD_OPTIONS.find((o) => o.mood === post)!.label.toLowerCase();
    return `\u0422\u044B \u043D\u0430\u0447\u0430\u043B\u0430 \u0441 "${preLabel}", \u0430 \u0441\u0435\u0439\u0447\u0430\u0441 "${postLabel}"! \u0422\u0440\u0435\u043D\u0438\u0440\u043E\u0432\u043A\u0430 \u043F\u043E\u043C\u043E\u0433\u0430\u0435\u0442!`;
  } else if (postRank === preRank) {
    return '\u041E\u0442\u043B\u0438\u0447\u043D\u0430\u044F \u0441\u0442\u0430\u0431\u0438\u043B\u044C\u043D\u043E\u0441\u0442\u044C!';
  } else if (preRank >= 2) {
    // Was positive, went down
    return '\u041F\u0440\u0435\u043A\u0440\u0430\u0441\u043D\u043E\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D\u0438\u0435! \u0422\u0430\u043A \u0434\u0435\u0440\u0436\u0430\u0442\u044C!';
  } else {
    return '\u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0430\u0439 \u0442\u0440\u0435\u043D\u0438\u0440\u043E\u0432\u043A\u0438 \u2014 \u0441\u0442\u0430\u043D\u0435\u0442 \u043B\u0443\u0447\u0448\u0435!';
  }
}

// ─── Metric display helpers ─────────────────────────────────────────

interface MetricRow {
  label: string;
  value: string;
}

function formatPercent(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function formatMs(v: number): string {
  return `${Math.round(v)} мс`;
}

function formatSeconds(v: number): string {
  return `${v.toFixed(1)} с`;
}

function getMetricsForExercise(result: ExerciseResult): MetricRow[] {
  const m = result.metrics;
  const id = result.exerciseId;

  switch (id) {
    case 'go-no-go':
      return [
        { label: 'Точность', value: formatPercent(m.accuracy) },
        { label: 'Ложные нажатия', value: String(m.commissionErrors ?? 0) },
        { label: 'Пропуски', value: String(m.omissionErrors ?? 0) },
        { label: 'Среднее время реакции', value: m.meanRT != null ? formatMs(m.meanRT) : '—' },
        { label: 'Вариабельность RT', value: m.rtVariability != null ? m.rtVariability.toFixed(2) : '—' },
      ];

    case 'n-back':
      return [
        { label: 'Попадания', value: String(m.hits ?? 0) },
        { label: 'Пропуски', value: String(m.misses ?? 0) },
        { label: 'Ложные тревоги', value: String(m.falseAlarms ?? 0) },
        { label: 'd-prime', value: m.dPrime != null ? m.dPrime.toFixed(2) : '—' },
        { label: 'Точность', value: formatPercent(m.accuracy) },
      ];

    case 'flanker':
      return [
        { label: 'Точность', value: formatPercent(m.accuracy) },
        { label: 'RT конгруэнтные', value: m.rtCongruent != null ? formatMs(m.rtCongruent) : '—' },
        { label: 'RT инконгруэнтные', value: m.rtIncongruent != null ? formatMs(m.rtIncongruent) : '—' },
        { label: 'Интерференция', value: m.interferenceScore != null ? formatMs(m.interferenceScore) : '—' },
      ];

    case 'visual-search':
      return [
        { label: 'Точность', value: formatPercent(m.accuracy) },
        { label: 'Время поиска', value: m.searchTime != null ? formatSeconds(m.searchTime / 1000) : '—' },
        { label: 'Элементов/сек', value: m.itemsPerSecond != null ? m.itemsPerSecond.toFixed(2) : '—' },
      ];

    case 'breathing':
      return [
        { label: 'Завершённые циклы', value: String(m.correctTrials) },
        { label: 'Длительность', value: formatSeconds(result.durationMs / 1000) },
      ];

    case 'pomodoro':
      return [
        { label: 'Длительность', value: formatSeconds(result.durationMs / 1000) },
        { label: 'Завершённость', value: formatPercent(m.accuracy) },
      ];

    default:
      return [
        { label: 'Точность', value: formatPercent(m.accuracy) },
      ];
  }
}

// ─── Confetti ───────────────────────────────────────────────────────

const CONFETTI_COLORS = [
  '#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF',
  '#9B59B6', '#FF8C42', '#00D2FF', '#FF4081',
];

function createConfetti(container: HTMLElement, disposables: ReturnType<typeof createDisposables>): void {
  const overlay = el('div', { className: 'confetti-container confetti-container--clickable' });

  for (let i = 0; i < 30; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    const size = 6 + Math.random() * 8;
    const left = Math.random() * 100;
    const delay = Math.random() * 2;
    const duration = 2 + Math.random() * 2;

    piece.style.cssText = `
      left:${left}%;
      top:-10px;
      width:${size}px;
      height:${size}px;
      background:${color};
      border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
      animation:confetti-fall ${duration}s ease-in ${delay}s forwards;
    `;
    piece.style.opacity = '1';

    overlay.appendChild(piece);
  }

  container.appendChild(overlay);

  const dismiss = (): void => {
    overlay.remove();
  };

  disposables.addListener(overlay, 'click', dismiss);

  // Auto-remove after animations finish
  disposables.setTimeout(() => {
    if (overlay.parentNode) overlay.remove();
  }, 5000);
}

// ─── Render ─────────────────────────────────────────────────────────

export const renderResults: ScreenRender = (container, _params) => {
  const disposables = createDisposables();
  addClass(container, 'screen', 'results-screen');

  // Read result from sessionStorage
  const raw = sessionStorage.getItem(SESSION_RESULT_KEY);
  if (!raw) {
    container.appendChild(
      el('div', { className: 'empty-state' }, [
        el('p', { className: 'empty-state__text' }, ['Нет данных о результате.']),
        el('a', { href: '#/exercises', className: 'btn btn--primary' }, ['К упражнениям']),
      ]),
    );
    return () => disposables.dispose();
  }

  let result: ExerciseResult;
  try {
    result = JSON.parse(raw) as ExerciseResult;
  } catch {
    container.appendChild(el('p', { className: 'card__subtitle' }, ['Ошибка чтения результата.']));
    return () => disposables.dispose();
  }

  const config = EXERCISE_CONFIGS[result.exerciseId];
  const tier = getScoreTier(result.score);
  const data = appState.getData();
  const currentLevel = getLevel(data.progression.totalXP);
  const levelTitle = getLevelTitle(currentLevel);
  const personalBest = data.progression.personalRecords[result.exerciseId] ?? 0;
  const isNewRecord = result.score > personalBest && personalBest > 0;

  // ── Header: icon + exercise name ──
  const header = el('div', { className: 'flex flex--center flex--gap-sm' }, [
    el('span', { className: 'icon--2x' }, [config.icon]),
    el('h1', { className: 'screen__title' }, [config.name]),
  ]);

  // ── Score display ──
  const scoreValueEl = el('span', { className: 'results-score' });
  const scoreLabelEl = el('span', { className: 'results-tier' });

  const scoreSection = el('div', null, [
    scoreValueEl,
    scoreLabelEl,
  ]);

  // Score text: always show number + tier label
  scoreLabelEl.textContent = ` \u2014 ${tier.label}`;
  // Animate score roll-up
  let current = 0;
  const target = result.score;
  const step = Math.max(1, Math.floor(target / 50));
  const intervalId = disposables.setInterval(() => {
    current += step;
    if (current >= target) {
      current = target;
      clearInterval(intervalId);
    }
    scoreValueEl.textContent = `${current}%`;
  }, 20);

  // ── Metrics ──
  const metrics = getMetricsForExercise(result);
  const metricsItems = metrics.map((m) =>
    el('div', { className: 'results-metric' }, [
      el('span', { className: 'results-metric__value' }, [m.value]),
      el('span', { className: 'results-metric__label' }, [m.label]),
    ]),
  );
  const metricsSection = el('div', { className: 'results-metrics' }, metricsItems);

  // ── Bonus event banner ──
  const bonusEventFlag = sessionStorage.getItem(SESSION_BONUS_KEY) === '1';
  let bonusEl: HTMLElement | null = null;
  if (bonusEventFlag) {
    bonusEl = el('div', { className: 'bonus-banner' }, [
      '\u0411\u043E\u043D\u0443\u0441\u043D\u043E\u0435 \u0441\u043E\u0431\u044B\u0442\u0438\u0435! \u0414\u0432\u043E\u0439\u043D\u043E\u0439 XP! \u26A1',
    ]);
  }

  // ── XP earned ──
  const xpEl = el('div', { className: 'results-xp' }, [
    `+${result.xpEarned} XP`,
  ]);

  // ── Level indicator ──
  const levelEl = el('div', { className: 'card__subtitle' }, [
    `\u0423\u0440\u043E\u0432\u0435\u043D\u044C ${currentLevel} \u2014 ${levelTitle}`,
  ]);

  // ── Personal record ──
  let recordEl: HTMLElement | null = null;
  if (isNewRecord) {
    recordEl = el('div', { className: 'record-banner' }, [
      '\u041D\u043E\u0432\u044B\u0439 \u0440\u0435\u043A\u043E\u0440\u0434! \u{1F3C6}',
    ]);
  }

  // ── Post-session mood comparison ──
  const preMood = sessionStorage.getItem(SESSION_MOOD_KEY) as Mood | null;
  const moodSection = el('div', { className: 'card w-full max-w-sm' });
  const moodTitle = el('h3', { className: 'card__title card__title--center' }, [
    '\u041A\u0430\u043A \u0442\u044B \u0441\u0435\u0431\u044F \u0447\u0443\u0432\u0441\u0442\u0432\u0443\u0435\u0448\u044C \u0441\u0435\u0439\u0447\u0430\u0441?',
  ]);
  moodSection.appendChild(moodTitle);

  const moodOptionsContainer = el('div', { className: 'mood-modal__options' });
  const moodResultContainer = el('div', { className: 'card__subtitle text--center' });
  moodResultContainer.classList.add('hidden');

  for (const opt of MOOD_OPTIONS) {
    const btn = el('button', { className: 'mood-modal__btn' }, [
      el('span', { className: 'mood-modal__emoji' }, [opt.emoji]),
      el('span', { className: 'mood-modal__label' }, [opt.label]),
    ]);
    disposables.addListener(btn, 'click', () => {
      moodOptionsContainer.classList.add('hidden');
      moodResultContainer.classList.remove('hidden');
      if (preMood) {
        const message = getMoodComparisonMessage(preMood, opt.mood);
        moodResultContainer.appendChild(
          el('p', null, [message]),
        );
      } else {
        moodResultContainer.appendChild(
          el('p', null, ['\u0421\u043F\u0430\u0441\u0438\u0431\u043E \u0437\u0430 \u043E\u0442\u0432\u0435\u0442!']),
        );
      }
      // Store post-session mood
      try {
        sessionStorage.setItem(SESSION_POST_MOOD_KEY, opt.mood);
      } catch {
        // ignore
      }
    });
    moodOptionsContainer.appendChild(btn);
  }

  moodSection.appendChild(moodOptionsContainer);
  moodSection.appendChild(moodResultContainer);

  // ── Action buttons ──
  const buttonsSection = el('div', { className: 'results-actions' }, [
    el('a', {
      href: `#/play/${result.exerciseId}`,
      className: 'btn btn--primary btn--full',
    }, ['\u0415\u0449\u0451 \u0440\u0430\u0437']),
    el('a', {
      href: '#/exercises',
      className: 'btn btn--secondary btn--full',
    }, ['\u041A \u0443\u043F\u0440\u0430\u0436\u043D\u0435\u043D\u0438\u044F\u043C']),
    el('a', {
      href: '#/dashboard',
      className: 'btn btn--ghost btn--full',
    }, ['\u041D\u0430 \u0433\u043B\u0430\u0432\u043D\u0443\u044E']),
  ]);

  // ── Assemble ──
  container.appendChild(header);
  container.appendChild(scoreSection);
  container.appendChild(metricsSection);
  if (bonusEl) container.appendChild(bonusEl);
  container.appendChild(xpEl);
  container.appendChild(levelEl);
  if (recordEl) container.appendChild(recordEl);
  container.appendChild(moodSection);
  container.appendChild(buttonsSection);

  // ── Confetti for high scores ──
  if (result.score >= 80) {
    createConfetti(container, disposables);
  }

  return () => disposables.dispose();
};
