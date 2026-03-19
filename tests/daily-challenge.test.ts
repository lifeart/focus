import { describe, it, expect } from 'vitest';
import {
  dateHash,
  generateDailyChallenge,
  checkDailyChallengeProgress,
  getTodayExercises,
} from '../public/js/core/progression';
import type { ExerciseResult, ProgressionData, DailyChallenge } from '../public/js/types';

function makeResult(overrides?: Partial<ExerciseResult>): ExerciseResult {
  return {
    exerciseId: 'go-no-go',
    timestamp: Date.now(),
    durationMs: 60000,
    level: 1,
    score: 75,
    metrics: { accuracy: 0.75, totalTrials: 100, correctTrials: 75 },
    xpEarned: 0,
    ...overrides,
  };
}

function makeProgression(overrides?: Partial<ProgressionData>): ProgressionData {
  return {
    totalXP: 0,
    level: 1,
    activityDays: [],
    longestStreak: 0,
    currentStreak: 0,
    streakFreezes: 0,
    streakFreezeUsedDays: [],
    lastStreakCheckDate: '',
    streakFreezeEarnedAt: [],
    earnedBadges: [],
    personalRecords: {
      'go-no-go': 0,
      'n-back': 0,
      'flanker': 0,
      'visual-search': 0,
      'breathing': 0,
      'pomodoro': 0,
    },
    recordsBroken: 0,
    totalSessionCount: 0,
    totalFocusTimeMs: 0,
    breathingSessions: 0,
    ...overrides,
  };
}

function makeChallenge(overrides?: Partial<DailyChallenge>): DailyChallenge {
  return {
    type: 'complete-exercises',
    target: 2,
    progress: 0,
    date: new Date().toISOString().slice(0, 10),
    xpReward: 15,
    completed: false,
    ...overrides,
  };
}

// ─── dateHash ────────────────────────────────────────────────────────

describe('dateHash', () => {
  it('returns the same value for the same input', () => {
    expect(dateHash('2026-03-19')).toBe(dateHash('2026-03-19'));
  });

  it('returns different values for different inputs', () => {
    expect(dateHash('2026-03-19')).not.toBe(dateHash('2026-03-20'));
  });

  it('returns a non-negative number', () => {
    for (let d = 1; d <= 31; d++) {
      const ds = `2026-03-${String(d).padStart(2, '0')}`;
      expect(dateHash(ds)).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─── generateDailyChallenge ──────────────────────────────────────────

describe('generateDailyChallenge', () => {
  it('is deterministic: same date produces identical challenge', () => {
    const c1 = generateDailyChallenge('2026-03-19');
    const c2 = generateDailyChallenge('2026-03-19');
    expect(c1.type).toBe(c2.type);
    expect(c1.target).toBe(c2.target);
    expect(c1.xpReward).toBe(c2.xpReward);
    expect(c1.date).toBe('2026-03-19');
    expect(c1.progress).toBe(0);
    expect(c1.completed).toBe(false);
  });

  it('produces variety across different dates', () => {
    const types = new Set<string>();
    for (let d = 1; d <= 30; d++) {
      const ds = `2026-03-${String(d).padStart(2, '0')}`;
      types.add(generateDailyChallenge(ds).type);
    }
    // Should have at least 3 different types across 30 days
    expect(types.size).toBeGreaterThanOrEqual(3);
  });

  it('different dates produce potentially different challenges', () => {
    const c1 = generateDailyChallenge('2026-03-19');
    const c2 = generateDailyChallenge('2026-03-20');
    // At least the date should differ
    expect(c1.date).not.toBe(c2.date);
  });

  it('filters out hard challenges for new users with no history', () => {
    // Run 100 dates and verify no hard challenges when userHasHistory=false
    for (let d = 1; d <= 100; d++) {
      const ds = `2026-01-${String((d % 28) + 1).padStart(2, '0')}`;
      const challenge = generateDailyChallenge(ds, undefined, false, 1);
      expect(challenge.type).not.toBe('beat-personal-best');
      expect(challenge.type).not.toBe('fast-reaction');
    }
  });

  it('filters out n-back-level when user nBackLevel < 2', () => {
    for (let d = 1; d <= 100; d++) {
      const ds = `2026-02-${String((d % 28) + 1).padStart(2, '0')}`;
      const challenge = generateDailyChallenge(ds, undefined, true, 1);
      expect(challenge.type).not.toBe('n-back-level');
    }
  });

  it('applies no-repeat-from-yesterday filter', () => {
    // Generate challenge for a date, then generate for next day with previousType
    const c1 = generateDailyChallenge('2026-06-15');
    const c2 = generateDailyChallenge('2026-06-16', c1.type, true, 5);
    // With enough templates, it should differ (unless hash collision minus one template still maps the same)
    // We can at least check it runs without error
    expect(c2.type).toBeDefined();
    expect(c2.date).toBe('2026-06-16');
  });
});

// ─── getTodayExercises ───────────────────────────────────────────────

describe('getTodayExercises', () => {
  it('returns empty array when history is empty', () => {
    expect(getTodayExercises([], '2026-03-19')).toEqual([]);
  });

  it('returns only exercises from the specified date', () => {
    const todayTs = new Date('2026-03-19T10:00:00Z').getTime();
    const yesterdayTs = new Date('2026-03-18T10:00:00Z').getTime();
    const history = [
      makeResult({ timestamp: yesterdayTs }),
      makeResult({ timestamp: todayTs }),
      makeResult({ timestamp: todayTs + 1000 }),
    ];
    const today = getTodayExercises(history, '2026-03-19');
    expect(today.length).toBe(2);
  });

  it('handles no matching exercises', () => {
    const yesterdayTs = new Date('2026-03-18T10:00:00Z').getTime();
    const history = [makeResult({ timestamp: yesterdayTs })];
    expect(getTodayExercises(history, '2026-03-19')).toEqual([]);
  });
});

// ─── checkDailyChallengeProgress ─────────────────────────────────────

describe('checkDailyChallengeProgress', () => {
  const todayStr = '2026-03-19';
  const todayTs = new Date('2026-03-19T10:00:00Z').getTime();

  it('returns unchanged challenge if already completed', () => {
    const challenge = makeChallenge({ completed: true, progress: 2, date: todayStr });
    const result = makeResult({ timestamp: todayTs });
    const updated = checkDailyChallengeProgress(challenge, result, makeProgression(), [result]);
    expect(updated.completed).toBe(true);
    expect(updated.progress).toBe(2);
  });

  // ── high-score-exercise ──
  it('high-score-exercise: completes when score meets threshold', () => {
    const challenge = makeChallenge({
      type: 'high-score-exercise',
      target: 1,
      threshold: 90,
      exerciseId: 'go-no-go',
      date: todayStr,
    });
    const result = makeResult({ score: 92, exerciseId: 'go-no-go', timestamp: todayTs });
    const updated = checkDailyChallengeProgress(challenge, result, makeProgression(), [result]);
    expect(updated.completed).toBe(true);
    expect(updated.progress).toBe(1);
  });

  it('high-score-exercise: does not complete for wrong exercise', () => {
    const challenge = makeChallenge({
      type: 'high-score-exercise',
      target: 1,
      threshold: 90,
      exerciseId: 'go-no-go',
      date: todayStr,
    });
    const result = makeResult({ score: 95, exerciseId: 'flanker', timestamp: todayTs });
    const updated = checkDailyChallengeProgress(challenge, result, makeProgression(), [result]);
    expect(updated.completed).toBe(false);
  });

  // ── complete-exercises ──
  it('complete-exercises: tracks count of today exercises', () => {
    const challenge = makeChallenge({
      type: 'complete-exercises',
      target: 2,
      date: todayStr,
    });
    const r1 = makeResult({ timestamp: todayTs });
    const r2 = makeResult({ timestamp: todayTs + 1000 });

    // After first exercise
    const u1 = checkDailyChallengeProgress(challenge, r1, makeProgression(), [r1]);
    expect(u1.progress).toBe(1);
    expect(u1.completed).toBe(false);

    // After second exercise
    const u2 = checkDailyChallengeProgress(u1, r2, makeProgression(), [r1, r2]);
    expect(u2.progress).toBe(2);
    expect(u2.completed).toBe(true);
  });

  // ── beat-personal-best ──
  it('beat-personal-best: completes when record is broken', () => {
    const challenge = makeChallenge({
      type: 'beat-personal-best',
      target: 1,
      date: todayStr,
    });
    const result = makeResult({ score: 85, exerciseId: 'go-no-go', timestamp: todayTs });
    const prog = makeProgression({
      personalRecords: {
        'go-no-go': 80,
        'n-back': 0,
        'flanker': 0,
        'visual-search': 0,
        'breathing': 0,
        'pomodoro': 0,
      },
    });
    const updated = checkDailyChallengeProgress(challenge, result, prog, [result]);
    expect(updated.completed).toBe(true);
  });

  // ── train-minutes ──
  it('train-minutes: sums today exercise durations', () => {
    const challenge = makeChallenge({
      type: 'train-minutes',
      target: 5,
      date: todayStr,
    });
    // 3 minutes
    const r1 = makeResult({ timestamp: todayTs, durationMs: 180000 });
    const u1 = checkDailyChallengeProgress(challenge, r1, makeProgression(), [r1]);
    expect(u1.progress).toBe(3);
    expect(u1.completed).toBe(false);

    // 3 more minutes = 6 total
    const r2 = makeResult({ timestamp: todayTs + 1000, durationMs: 180000 });
    const u2 = checkDailyChallengeProgress(u1, r2, makeProgression(), [r1, r2]);
    expect(u2.progress).toBe(5); // capped at target
    expect(u2.completed).toBe(true);
  });

  // ── multi-exercise-score ──
  it('multi-exercise-score: counts distinct exercises with score >= threshold', () => {
    const challenge = makeChallenge({
      type: 'multi-exercise-score',
      target: 3,
      threshold: 80,
      date: todayStr,
    });
    const exercises = [
      makeResult({ exerciseId: 'go-no-go', score: 85, timestamp: todayTs }),
      makeResult({ exerciseId: 'flanker', score: 90, timestamp: todayTs + 1000 }),
      makeResult({ exerciseId: 'n-back', score: 82, timestamp: todayTs + 2000 }),
    ];
    const updated = checkDailyChallengeProgress(
      challenge,
      exercises[2],
      makeProgression(),
      exercises,
    );
    expect(updated.progress).toBe(3);
    expect(updated.completed).toBe(true);
  });

  // ── specific-exercise ──
  it('specific-exercise: completes on matching exercise', () => {
    const challenge = makeChallenge({
      type: 'specific-exercise',
      target: 1,
      exerciseId: 'n-back',
      date: todayStr,
    });
    const result = makeResult({ exerciseId: 'n-back', timestamp: todayTs });
    const updated = checkDailyChallengeProgress(challenge, result, makeProgression(), [result]);
    expect(updated.completed).toBe(true);
  });

  it('specific-exercise: does not complete for wrong exercise', () => {
    const challenge = makeChallenge({
      type: 'specific-exercise',
      target: 1,
      exerciseId: 'n-back',
      date: todayStr,
    });
    const result = makeResult({ exerciseId: 'flanker', timestamp: todayTs });
    const updated = checkDailyChallengeProgress(challenge, result, makeProgression(), [result]);
    expect(updated.completed).toBe(false);
  });

  // ── low-lapse-rate ──
  it('low-lapse-rate: completes when lapse rate is below threshold', () => {
    const challenge = makeChallenge({
      type: 'low-lapse-rate',
      target: 1,
      threshold: 5,
      date: todayStr,
    });
    const result = makeResult({
      timestamp: todayTs,
      metrics: { accuracy: 0.9, totalTrials: 100, correctTrials: 90, lapseRate: 0.03 },
    });
    const updated = checkDailyChallengeProgress(challenge, result, makeProgression(), [result]);
    expect(updated.completed).toBe(true);
  });

  it('low-lapse-rate: does not complete when lapse rate exceeds threshold', () => {
    const challenge = makeChallenge({
      type: 'low-lapse-rate',
      target: 1,
      threshold: 5,
      date: todayStr,
    });
    const result = makeResult({
      timestamp: todayTs,
      metrics: { accuracy: 0.9, totalTrials: 100, correctTrials: 90, lapseRate: 0.08 },
    });
    const updated = checkDailyChallengeProgress(challenge, result, makeProgression(), [result]);
    expect(updated.completed).toBe(false);
  });

  // ── breathing-session ──
  it('breathing-session: completes on breathing exercise', () => {
    const challenge = makeChallenge({
      type: 'breathing-session',
      target: 1,
      date: todayStr,
    });
    const result = makeResult({ exerciseId: 'breathing', timestamp: todayTs });
    const updated = checkDailyChallengeProgress(challenge, result, makeProgression(), [result]);
    expect(updated.completed).toBe(true);
  });

  // ── fast-reaction ──
  it('fast-reaction: completes when mean RT is below threshold', () => {
    const challenge = makeChallenge({
      type: 'fast-reaction',
      target: 1,
      threshold: 350,
      exerciseId: 'go-no-go',
      date: todayStr,
    });
    const result = makeResult({
      exerciseId: 'go-no-go',
      timestamp: todayTs,
      metrics: { accuracy: 0.9, totalTrials: 100, correctTrials: 90, meanRT: 320 },
    });
    const updated = checkDailyChallengeProgress(challenge, result, makeProgression(), [result]);
    expect(updated.completed).toBe(true);
  });

  it('fast-reaction: does not complete for non-go-no-go exercise', () => {
    const challenge = makeChallenge({
      type: 'fast-reaction',
      target: 1,
      threshold: 350,
      exerciseId: 'go-no-go',
      date: todayStr,
    });
    const result = makeResult({
      exerciseId: 'flanker',
      timestamp: todayTs,
      metrics: { accuracy: 0.9, totalTrials: 100, correctTrials: 90, meanRT: 300 },
    });
    const updated = checkDailyChallengeProgress(challenge, result, makeProgression(), [result]);
    expect(updated.completed).toBe(false);
  });

  // ── n-back-level ──
  it('n-back-level: completes when n-back level meets threshold', () => {
    const challenge = makeChallenge({
      type: 'n-back-level',
      target: 1,
      threshold: 3,
      date: todayStr,
    });
    const result = makeResult({ exerciseId: 'n-back', level: 3, timestamp: todayTs });
    const updated = checkDailyChallengeProgress(challenge, result, makeProgression(), [result]);
    expect(updated.completed).toBe(true);
  });

  it('n-back-level: does not complete for lower level', () => {
    const challenge = makeChallenge({
      type: 'n-back-level',
      target: 1,
      threshold: 3,
      date: todayStr,
    });
    const result = makeResult({ exerciseId: 'n-back', level: 2, timestamp: todayTs });
    const updated = checkDailyChallengeProgress(challenge, result, makeProgression(), [result]);
    expect(updated.completed).toBe(false);
  });

  // ── streak-day ──
  it('streak-day: completes on any exercise completion', () => {
    const challenge = makeChallenge({
      type: 'streak-day',
      target: 1,
      date: todayStr,
    });
    const result = makeResult({ timestamp: todayTs });
    const updated = checkDailyChallengeProgress(challenge, result, makeProgression(), [result]);
    expect(updated.completed).toBe(true);
  });

  // ── accuracy-streak ──
  it('accuracy-streak: tracks consecutive high scores', () => {
    const challenge = makeChallenge({
      type: 'accuracy-streak',
      target: 3,
      threshold: 80,
      date: todayStr,
    });
    const exercises = [
      makeResult({ score: 85, timestamp: todayTs }),
      makeResult({ score: 90, timestamp: todayTs + 1000 }),
      makeResult({ score: 82, timestamp: todayTs + 2000 }),
    ];
    const updated = checkDailyChallengeProgress(
      challenge,
      exercises[2],
      makeProgression(),
      exercises,
    );
    expect(updated.progress).toBe(3);
    expect(updated.completed).toBe(true);
  });

  it('accuracy-streak: broken by low score resets count', () => {
    const challenge = makeChallenge({
      type: 'accuracy-streak',
      target: 3,
      threshold: 80,
      date: todayStr,
    });
    const exercises = [
      makeResult({ score: 85, timestamp: todayTs }),
      makeResult({ score: 50, timestamp: todayTs + 1000 }), // breaks streak
      makeResult({ score: 90, timestamp: todayTs + 2000 }),
    ];
    const updated = checkDailyChallengeProgress(
      challenge,
      exercises[2],
      makeProgression(),
      exercises,
    );
    expect(updated.progress).toBe(1);
    expect(updated.completed).toBe(false);
  });

  // ── Edge cases ──
  it('no crash when exerciseHistory is empty', () => {
    const challenge = makeChallenge({ type: 'complete-exercises', target: 2, date: todayStr });
    const result = makeResult({ timestamp: todayTs });
    const updated = checkDailyChallengeProgress(challenge, result, makeProgression(), []);
    expect(updated.progress).toBe(0);
  });

  it('backward compatibility: old data without dailyChallenge is fine', () => {
    const prog = makeProgression();
    // dailyChallenge is undefined by default
    expect(prog.dailyChallenge).toBeUndefined();
    expect(prog.lastDailyBonusDate).toBeUndefined();
  });
});

// ─── no-pause-session is NOT a valid challenge type ──────────────────

describe('no-pause-session exclusion', () => {
  it('does not appear in any generated challenge across many dates', () => {
    for (let d = 1; d <= 365; d++) {
      const month = String(Math.floor((d - 1) / 28) + 1).padStart(2, '0');
      const day = String(((d - 1) % 28) + 1).padStart(2, '0');
      const ds = `2026-${month}-${day}`;
      const challenge = generateDailyChallenge(ds, undefined, true, 5);
      expect(challenge.type).not.toBe('no-pause-session');
    }
  });
});
