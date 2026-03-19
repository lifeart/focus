import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { calculateXP, getLevel, getLevelTitle, getXPProgress, updateStreak, getScoreTier } from '../public/js/core/progression';
import { setLocale, getLocale } from '../public/js/core/i18n';
import type { ExerciseResult } from '../public/js/types';

let savedLocale: string;

beforeAll(() => {
  // Stub document so setLocale does not crash in node environment
  vi.stubGlobal('document', { documentElement: { lang: '' }, title: '' });
  savedLocale = getLocale();
  setLocale('ru');
});

afterAll(() => {
  setLocale(savedLocale as any);
  vi.unstubAllGlobals();
});

function makeResult(overrides?: Partial<ExerciseResult>): ExerciseResult {
  return {
    exerciseId: 'go-no-go',
    timestamp: Date.now(),
    durationMs: 180000,
    level: 1,
    score: 75,
    metrics: { accuracy: 0.75, totalTrials: 100, correctTrials: 75 },
    xpEarned: 0,
    ...overrides,
  };
}

describe('calculateXP', () => {
  it('gives base XP proportional to score', () => {
    const result = makeResult({ score: 50 });
    const xp = calculateXP(result, false, false);
    expect(xp).toBe(30); // 10 + (50/100) * 40 = 30
  });

  it('adds session complete bonus', () => {
    const result = makeResult({ score: 50 });
    const xp = calculateXP(result, true, false);
    expect(xp).toBe(60); // 30 + 30
  });

  it('adds streak bonus', () => {
    const result = makeResult({ score: 50 });
    const xp = calculateXP(result, false, true);
    expect(xp).toBe(50); // 30 + 20
  });

  it('adds perfect score bonus for >= 95', () => {
    const result = makeResult({ score: 96 });
    const xp = calculateXP(result, false, false);
    expect(xp).toBe(73); // 10 + 38.4 ≈ 48 + 25
  });
});

describe('getLevel', () => {
  it('returns level 1 for 0 XP', () => {
    expect(getLevel(0)).toBe(1);
  });

  it('returns correct level for accumulated XP', () => {
    expect(getLevel(1000)).toBeGreaterThan(1);
  });

  it('caps at level 30', () => {
    expect(getLevel(999999)).toBe(30);
  });
});

describe('getLevelTitle', () => {
  it('returns "Новичок" for level 1', () => {
    expect(getLevelTitle(1)).toBe('Новичок');
  });

  it('returns title for level 30', () => {
    expect(getLevelTitle(30)).toBe('Абсолют');
  });
});

describe('getXPProgress', () => {
  it('returns progress within current level', () => {
    const progress = getXPProgress(0);
    expect(progress.current).toBe(0);
    expect(progress.required).toBeGreaterThan(0);
    expect(progress.percent).toBe(0);
  });
});

describe('updateStreak', () => {
  it('returns zeros for empty array', () => {
    const result = updateStreak([]);
    expect(result.currentWeekDays).toBe(0);
    expect(result.weeklyGoalMet).toBe(false);
    expect(result.longestStreak).toBe(0);
  });

  it('counts consecutive days', () => {
    const result = updateStreak(['2024-01-01', '2024-01-02', '2024-01-03']);
    expect(result.longestStreak).toBe(3);
  });

  it('weekly goal met at 5 days', () => {
    // Create 5 days in the current week
    const monday = new Date();
    const day = monday.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    monday.setDate(monday.getDate() + diff);

    const days: string[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      days.push(d.toISOString().slice(0, 10));
    }

    const result = updateStreak(days);
    expect(result.weeklyGoalMet).toBe(true);
    expect(result.currentWeekDays).toBe(5);
  });
});

describe('getScoreTier', () => {
  it('returns "Разминка" for low scores', () => {
    const tier = getScoreTier(30);
    expect(tier.label).toBe('Разминка');
    expect(tier.showPercent).toBe(true);
  });

  it('returns "Идеально" for 95+', () => {
    const tier = getScoreTier(97);
    expect(tier.label).toBe('Идеально');
    expect(tier.showPercent).toBe(true);
  });
});
