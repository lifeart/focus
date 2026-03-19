import type { ScreenRender, ExerciseId, BadgeTier } from '../../types.js';
import { el, addClass } from '../renderer.js';
import { appState } from '../../main.js';
import { EXERCISE_CONFIGS, BADGE_DEFINITIONS } from '../../constants.js';
import { getLevel, getLevelTitle } from '../../core/progression.js';
import { renderLineChart, renderCalendarHeatmap } from '../components/chart.js';
import { renderBadgeCard } from '../components/badge-card.js';
import { renderWeeklyRecap } from '../components/weekly-recap.js';
import { createDisposables } from '../../core/disposables.js';
import { t } from '../../core/i18n.js';
import { getBaselineComparison } from '../../core/baseline.js';

function formatFocusTime(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return `${hours} ч ${minutes} ${t('stats.min')}`;
  }
  return `${minutes} ${t('stats.min')}`;
}

export const renderStats: ScreenRender = (container, _params) => {
  const disposables = createDisposables();
  addClass(container, 'screen');

  const data = appState.getData();
  const { progression, exerciseHistory } = data;

  // Empty state
  if (exerciseHistory.length === 0) {
    const emptyState = el('div', { className: 'empty-state' }, [
      el('div', { className: 'empty-state__icon' }, ['\u{1F4CA}']),
      el('p', { className: 'empty-state__text' }, [t('stats.empty')]),
    ]);
    container.appendChild(emptyState);
    return () => disposables.dispose();
  }

  // Title
  const title = el('div', { className: 'screen__header' }, [
    el('h1', { className: 'screen__title' }, [t('stats.title')]),
  ]);
  container.appendChild(title);

  // ─── 1. Summary cards ──────────────────────────────────────────────
  const level = getLevel(progression.totalXP);
  const levelTitle = getLevelTitle(level);

  const summaryRow = el('div', { className: 'stats-summary' }, [
    el('div', { className: 'card' }, [
      el('div', { className: 'stat-value' }, [String(progression.totalSessionCount)]),
      el('div', { className: 'stat-label' }, [t('stats.sessions')]),
    ]),
    el('div', { className: 'card' }, [
      el('div', { className: 'stat-value' }, [formatFocusTime(progression.totalFocusTimeMs)]),
      el('div', { className: 'stat-label' }, [t('stats.focusTime')]),
    ]),
    el('div', { className: 'card' }, [
      el('div', { className: 'stat-value' }, [String(progression.earnedBadges.length)]),
      el('div', { className: 'stat-label' }, [t('stats.awards')]),
    ]),
    el('div', { className: 'card' }, [
      el('div', { className: 'stat-value' }, [String(level)]),
      el('div', { className: 'stat-label' }, [levelTitle]),
    ]),
  ]);
  container.appendChild(summaryRow);

  // ─── 2. Score chart (last 30 days) ─────────────────────────────────
  const chartCard = el('div', { className: 'card' }, [
    el('h2', { className: 'card__title' }, [t('stats.results30d')]),
  ]);

  const canvas = el('canvas', { width: 600, height: 250, className: 'canvas--responsive' });
  chartCard.appendChild(canvas);
  container.appendChild(chartCard);

  // Group exerciseHistory by date, average scores per day (last 30 days)
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const dailyScores = new Map<string, number[]>();
  for (const result of exerciseHistory) {
    const d = new Date(result.timestamp);
    if (d >= thirtyDaysAgo) {
      const dateStr = d.toISOString().slice(0, 10);
      if (!dailyScores.has(dateStr)) {
        dailyScores.set(dateStr, []);
      }
      dailyScores.get(dateStr)!.push(result.score);
    }
  }

  // Build labels and values for all 30 days
  const labels: string[] = [];
  const values: number[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayLabel = `${d.getDate()}.${d.getMonth() + 1}`;

    const scores = dailyScores.get(dateStr);
    if (scores && scores.length > 0) {
      labels.push(dayLabel);
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      values.push(Math.round(avg));
    } else {
      labels.push(dayLabel);
      values.push(0);
    }
  }

  // Only show labels for every ~5th day to avoid clutter
  const filteredLabels = labels.map((l, i) => (i % 5 === 0 || i === labels.length - 1) ? l : '');

  renderLineChart(canvas, { labels: filteredLabels, values });

  // ─── 3. Calendar heatmap ───────────────────────────────────────────
  const calendarCard = el('div', { className: 'card' }, [
    el('h2', { className: 'card__title' }, [t('stats.activity')]),
  ]);
  container.appendChild(calendarCard);

  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const cleanupHeatmap = renderCalendarHeatmap(
    calendarCard,
    progression.activityDays,
    currentMonth,
    currentYear,
  );
  disposables.addCleanup(cleanupHeatmap);

  // ─── 4. Exercise breakdown ─────────────────────────────────────────
  const breakdownCard = el('div', { className: 'card' }, [
    el('h2', { className: 'card__title' }, [t('stats.exercises')]),
  ]);

  // Group exercise history by exerciseId, sum durations
  const exerciseTimes = new Map<ExerciseId, number>();
  for (const result of exerciseHistory) {
    const current = exerciseTimes.get(result.exerciseId) || 0;
    exerciseTimes.set(result.exerciseId, current + result.durationMs);
  }

  const maxTime = Math.max(...exerciseTimes.values(), 1);

  const breakdownList = el('div', { className: 'stats-breakdown' });
  for (const [exerciseId, timeMs] of exerciseTimes.entries()) {
    const config = EXERCISE_CONFIGS[exerciseId];
    if (!config) continue;

    const barWidth = Math.max(5, Math.round((timeMs / maxTime) * 100));
    const timeFormatted = formatFocusTime(timeMs);
    const exerciseName = t(`exercise.${exerciseId}.name` as any);

    const row = el('div', { className: 'stats-breakdown__row' }, [
      el('div', { className: 'stats-breakdown__info' }, [
        el('span', { className: 'stats-breakdown__icon' }, [config.icon]),
        el('span', { className: 'stats-breakdown__name' }, [exerciseName]),
        el('span', { className: 'stats-breakdown__time' }, [timeFormatted]),
      ]),
      el('div', { className: 'stats-breakdown__bar-bg' }, [
        el('div', { className: 'stats-breakdown__bar', style: `width: ${barWidth}%` }),
      ]),
    ]);
    breakdownList.appendChild(row);
  }
  breakdownCard.appendChild(breakdownList);
  container.appendChild(breakdownCard);

  // ─── 4b. Baseline comparison ──────────────────────────────────────
  if (data.baseline) {
    const baselineCard = el('div', { className: 'card' }, [
      el('h2', { className: 'card__title' }, [t('baseline.improvement')]),
    ]);

    const baselineList = el('div', { className: 'stats-breakdown' });
    // For each exercise that has both a baseline and recent results, show improvement
    for (const baselineResult of data.baseline.exercises) {
      const exerciseId = baselineResult.exerciseId;
      const config = EXERCISE_CONFIGS[exerciseId];
      if (!config) continue;

      // Find the most recent result for this exercise
      const latestResult = [...exerciseHistory]
        .reverse()
        .find(r => r.exerciseId === exerciseId);
      if (!latestResult) continue;

      const comparison = getBaselineComparison(data.baseline, latestResult);
      if (!comparison) continue;

      const sign = comparison.improvement >= 0 ? '+' : '';
      const exerciseName = t(`exercise.${exerciseId}.name` as any);

      const row = el('div', { className: 'stats-breakdown__row' }, [
        el('div', { className: 'stats-breakdown__info' }, [
          el('span', { className: 'stats-breakdown__icon' }, [config.icon]),
          el('span', { className: 'stats-breakdown__name' }, [exerciseName]),
          el('span', { className: 'stats-breakdown__time' }, [
            `${comparison.baselineScore} → ${comparison.currentScore} (${sign}${comparison.improvement})`,
          ]),
        ]),
      ]);
      baselineList.appendChild(row);
    }

    if (baselineList.childElementCount > 0) {
      baselineCard.appendChild(baselineList);
      container.appendChild(baselineCard);
    }
  }

  // ─── 5. All badges ─────────────────────────────────────────────────
  const badgesCard = el('div', { className: 'card' }, [
    el('h2', { className: 'card__title' }, [t('stats.badges')]),
  ]);

  const badgesGrid = el('div', { className: 'stats-badges' });

  // Build a map of earned badge id -> highest tier
  const earnedMap = new Map<string, BadgeTier>();
  for (const earned of progression.earnedBadges) {
    const existing = earnedMap.get(earned.id);
    if (!existing || tierRank(earned.tier) > tierRank(existing)) {
      earnedMap.set(earned.id, earned.tier);
    }
  }

  for (const badge of BADGE_DEFINITIONS) {
    const earnedTier = earnedMap.get(badge.id) || null;
    const cleanupBadge = renderBadgeCard(badgesGrid, badge, earnedTier);
    disposables.addCleanup(cleanupBadge);
  }

  badgesCard.appendChild(badgesGrid);
  container.appendChild(badgesCard);

  // ─── 6. Weekly Recap ──────────────────────────────────────────────
  const cleanupRecap = renderWeeklyRecap(container, data);
  if (cleanupRecap) disposables.addCleanup(cleanupRecap);

  return () => disposables.dispose();
};

function tierRank(tier: BadgeTier): number {
  switch (tier) {
    case 'bronze': return 1;
    case 'silver': return 2;
    case 'gold': return 3;
  }
}
