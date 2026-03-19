import type { ScreenRender, ExerciseResult, ExerciseId, Mood } from '../../types.js';
import { el, addClass } from '../renderer.js';
import { EXERCISE_CONFIGS, SESSION_RESULT_KEY, SESSION_BONUS_KEY, SESSION_MOOD_KEY, SESSION_POST_MOOD_KEY, SESSION_CELEBRATIONS_KEY } from '../../constants.js';
import { getScoreTier, getLevel, getLevelTitle } from '../../core/progression.js';
import { appState, getSoundManager } from '../../main.js';
import { createDisposables } from '../../core/disposables.js';
import { t, td } from '../../core/i18n.js';
import { createConfetti } from '../components/confetti.js';
import { showCelebrations } from '../components/celebration-overlay.js';
import type { CelebrationData } from '../components/celebration-overlay.js';

const MOOD_KEYS: { mood: Mood; emoji: string; labelKey: 'mood.energized' | 'mood.calm' | 'mood.tired' | 'mood.stressed' }[] = [
  { mood: 'energized', emoji: '\u26A1', labelKey: 'mood.energized' },
  { mood: 'calm', emoji: '\uD83D\uDE0C', labelKey: 'mood.calm' },
  { mood: 'tired', emoji: '\uD83D\uDE34', labelKey: 'mood.tired' },
  { mood: 'stressed', emoji: '\uD83D\uDE30', labelKey: 'mood.stressed' },
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
    const preLabel = td(`mood.${pre}`).toLowerCase();
    const postLabel = td(`mood.${post}`).toLowerCase();
    return t('results.moodImproved', { pre: preLabel, post: postLabel });
  } else if (postRank === preRank) {
    return t('results.moodStable');
  } else if (preRank >= 2) {
    return t('results.moodPositive');
  } else {
    return t('results.moodKeepGoing');
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
  return `${Math.round(v)} ${t('metric.ms')}`;
}

function formatSeconds(v: number): string {
  return `${v.toFixed(1)} ${t('metric.sec')}`;
}

function getMetricsForExercise(result: ExerciseResult): MetricRow[] {
  const m = result.metrics;
  const id = result.exerciseId;

  switch (id) {
    case 'go-no-go':
      return [
        { label: t('metric.accuracy'), value: formatPercent(m.accuracy) },
        { label: t('metric.commissionErrors'), value: String(m.commissionErrors ?? 0) },
        { label: t('metric.omissions'), value: String(m.omissionErrors ?? 0) },
        { label: t('metric.avgRT'), value: m.meanRT != null ? formatMs(m.meanRT) : '—' },
        { label: t('metric.rtVariability'), value: m.rtVariability != null ? m.rtVariability.toFixed(2) : '—' },
        { label: t('metric.lapseRate'), value: m.lapseRate != null ? formatPercent(m.lapseRate) : '—' },
      ];

    case 'n-back': {
      const rows: MetricRow[] = [
        { label: t('metric.hits'), value: String(m.hits ?? 0) },
        { label: t('metric.omissions'), value: String(m.misses ?? 0) },
        { label: t('metric.falseAlarms'), value: String(m.falseAlarms ?? 0) },
        { label: t('metric.dPrime'), value: m.dPrime != null ? m.dPrime.toFixed(2) : '—' },
        { label: t('metric.accuracy'), value: formatPercent(m.accuracy) },
        { label: t('metric.rtVariability'), value: m.rtVariability != null ? m.rtVariability.toFixed(2) : '—' },
        { label: t('metric.lapseRate'), value: m.lapseRate != null ? formatPercent(m.lapseRate) : '—' },
      ];
      if (m.lureTrials != null && m.lureTrials > 0) {
        rows.push({ label: t('metric.lureTrials'), value: String(m.lureTrials) });
        rows.push({ label: t('metric.lureFalseAlarms'), value: String(m.lureFalseAlarms ?? 0) });
      }
      return rows;
    }

    case 'flanker': {
      const rows: MetricRow[] = [
        { label: t('metric.accuracy'), value: formatPercent(m.accuracy) },
        { label: t('metric.rtCongruent'), value: m.rtCongruent != null ? formatMs(m.rtCongruent) : '—' },
        { label: t('metric.rtIncongruent'), value: m.rtIncongruent != null ? formatMs(m.rtIncongruent) : '—' },
        { label: t('metric.interference'), value: m.interferenceScore != null ? formatMs(m.interferenceScore) : '—' },
        { label: t('metric.rtVariability'), value: m.rtVariability != null ? m.rtVariability.toFixed(2) : '—' },
        { label: t('metric.lapseRate'), value: m.lapseRate != null ? formatPercent(m.lapseRate) : '—' },
      ];
      if (m.rtNeutral != null && m.rtNeutral > 0) {
        rows.push({ label: t('metric.rtNeutral'), value: formatMs(m.rtNeutral) });
        rows.push({ label: t('metric.facilitation'), value: m.facilitationScore != null ? formatMs(m.facilitationScore) : '—' });
        rows.push({ label: t('metric.inhibitionCost'), value: m.inhibitionCost != null ? formatMs(m.inhibitionCost) : '—' });
      }
      return rows;
    }

    case 'visual-search':
      return [
        { label: t('metric.accuracy'), value: formatPercent(m.accuracy) },
        { label: t('metric.searchTime'), value: m.searchTime != null ? formatSeconds(m.searchTime / 1000) : '—' },
        { label: t('metric.itemsPerSec'), value: m.itemsPerSecond != null ? m.itemsPerSecond.toFixed(2) : '—' },
        { label: t('metric.searchSlope'), value: m.searchSlope != null ? `${m.searchSlope.toFixed(1)} ${t('metric.msPerItem')}` : '—' },
        { label: t('metric.rtVariability'), value: m.rtVariability != null ? m.rtVariability.toFixed(2) : '—' },
        { label: t('metric.lapseRate'), value: m.lapseRate != null ? formatPercent(m.lapseRate) : '—' },
      ];

    case 'breathing':
      return [
        { label: t('metric.completedCycles'), value: String(m.correctTrials) },
        { label: t('metric.duration'), value: formatSeconds(result.durationMs / 1000) },
      ];

    case 'pomodoro':
      return [
        { label: t('metric.duration'), value: formatSeconds(result.durationMs / 1000) },
        { label: t('metric.completion'), value: formatPercent(m.accuracy) },
      ];

    default:
      return [
        { label: t('metric.accuracy'), value: formatPercent(m.accuracy) },
      ];
  }
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
        el('p', { className: 'empty-state__text' }, [t('results.noData')]),
        el('a', { href: '#/exercises', className: 'btn btn--primary' }, [t('results.toExercises')]),
      ]),
    );
    return () => disposables.dispose();
  }

  let result: ExerciseResult;
  try {
    result = JSON.parse(raw) as ExerciseResult;
  } catch {
    container.appendChild(el('p', { className: 'card__subtitle' }, [t('results.parseError')]));
    return () => disposables.dispose();
  }

  const config = EXERCISE_CONFIGS[result.exerciseId];
  if (!config) {
    container.appendChild(
      el('div', { className: 'empty-state' }, [
        el('p', { className: 'empty-state__text' }, [t('results.parseError')]),
        el('a', { href: '#/exercises', className: 'btn btn--primary' }, [t('results.toExercises')]),
      ]),
    );
    return () => disposables.dispose();
  }
  const tier = getScoreTier(result.score);
  const data = appState.getData();
  const currentLevel = getLevel(data.progression.totalXP);
  const levelTitle = getLevelTitle(currentLevel);
  const personalBest = data.progression.personalRecords[result.exerciseId] ?? 0;
  const isNewRecord = result.score > personalBest && personalBest > 0;

  const exerciseName = td(`exercise.${result.exerciseId}.name`);

  // ── Header: icon + exercise name ──
  const header = el('div', { className: 'flex flex--center flex--gap-sm' }, [
    el('span', { className: 'icon--2x' }, [config.icon]),
    el('h1', { className: 'screen__title' }, [exerciseName]),
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

  // ── Encouragement ──
  const encourageKeyMap: Record<string, string> = {
    'warmup': 'results.encourage.warmup',
    'good-start': 'results.encourage.goodStart',
    'great': 'results.encourage.great',
    'amazing': 'results.encourage.amazing',
    'perfect': 'results.encourage.perfect',
  };
  const encourageEl = el('p', { className: 'results-encouragement' }, [
    td(encourageKeyMap[tier.tier]),
  ]);

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
      t('results.bonusBanner'),
    ]);
  }

  // ── XP earned ──
  const xpEl = el('div', { className: 'results-xp' }, [
    `+${result.xpEarned} XP`,
  ]);

  // ── Level indicator ──
  const levelEl = el('div', { className: 'card__subtitle' }, [
    t('results.levelLabel', { level: currentLevel, title: levelTitle }),
  ]);

  // ── Personal record ──
  let recordEl: HTMLElement | null = null;
  if (isNewRecord) {
    recordEl = el('div', { className: 'record-banner' }, [
      t('results.newRecord'),
    ]);
  }

  // ── Post-session mood comparison ──
  const preMood = sessionStorage.getItem(SESSION_MOOD_KEY) as Mood | null;
  const moodSection = el('div', { className: 'card w-full max-w-sm' });
  const moodTitle = el('h3', { className: 'card__title card__title--center' }, [
    t('results.moodNow'),
  ]);
  moodSection.appendChild(moodTitle);

  const moodOptionsContainer = el('div', { className: 'mood-modal__options' });
  const moodResultContainer = el('div', { className: 'card__subtitle text--center' });
  moodResultContainer.classList.add('hidden');

  for (const opt of MOOD_KEYS) {
    const btn = el('button', { className: 'mood-modal__btn' }, [
      el('span', { className: 'mood-modal__emoji' }, [opt.emoji]),
      el('span', { className: 'mood-modal__label' }, [t(opt.labelKey)]),
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
          el('p', null, [t('results.moodThanks')]),
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
    }, [t('results.playAgain')]),
    el('a', {
      href: '#/exercises',
      className: 'btn btn--secondary btn--full',
    }, [t('results.toExercises')]),
    el('a', {
      href: '#/dashboard',
      className: 'btn btn--ghost btn--full',
    }, [t('results.toHome')]),
  ]);

  // ── Assemble ──
  container.appendChild(header);
  container.appendChild(scoreSection);
  container.appendChild(encourageEl);
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

  // ── Celebration overlays (level-up, badges) ──
  try {
    const celebrationRaw = sessionStorage.getItem(SESSION_CELEBRATIONS_KEY);
    if (celebrationRaw) {
      sessionStorage.removeItem(SESSION_CELEBRATIONS_KEY);
      const celebrationData = JSON.parse(celebrationRaw) as CelebrationData;
      if (celebrationData.levelUp || (celebrationData.badges && celebrationData.badges.length > 0)) {
        const sound = getSoundManager();
        showCelebrations(celebrationData, sound, disposables);
      }
    }
  } catch {
    // ignore parse errors
  }

  return () => disposables.dispose();
};
