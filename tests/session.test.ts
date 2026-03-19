import { describe, it, expect } from 'vitest';
import { createSessionPlan, createQuickSession, createDeepSession, createSessionByType } from '../public/js/core/session';
import type { DifficultyState, ExerciseResult, ExerciseId } from '../public/js/types';

function makeDefaultDifficulty(): Record<ExerciseId, DifficultyState> {
  const ids: ExerciseId[] = ['go-no-go', 'n-back', 'flanker', 'visual-search', 'breathing', 'pomodoro'];
  const result = {} as Record<ExerciseId, DifficultyState>;
  for (const id of ids) {
    result[id] = {
      exerciseId: id,
      currentLevel: 1,
      recentScores: [],
      sessionsAtCurrentLevel: 0,
    };
  }
  return result;
}

function makeResult(exerciseId: ExerciseId, overrides?: Partial<ExerciseResult>): ExerciseResult {
  return {
    exerciseId,
    timestamp: Date.now(),
    durationMs: 60000,
    level: 1,
    score: 75,
    metrics: { accuracy: 0.75, totalTrials: 50, correctTrials: 38 },
    xpEarned: 30,
    ...overrides,
  };
}

describe('createSessionPlan', () => {
  it('generates 3-4 exercises', () => {
    const plan = createSessionPlan(makeDefaultDifficulty(), []);
    expect(plan.exercises.length).toBeGreaterThanOrEqual(3);
    expect(plan.exercises.length).toBeLessThanOrEqual(5);
  });

  it('generates exactly 4 cognitive exercises when no breathing needed', () => {
    // If last exercise was breathing (within last 3), no breathing is added
    const history: ExerciseResult[] = [
      makeResult('breathing'),
    ];
    const plan = createSessionPlan(makeDefaultDifficulty(), history);
    expect(plan.includesBreathing).toBe(false);
    expect(plan.exercises.length).toBe(4);
  });

  it('includes breathing when > 3 sessions without it', () => {
    const history: ExerciseResult[] = [
      makeResult('go-no-go'),
      makeResult('flanker'),
      makeResult('n-back'),
      makeResult('visual-search'),
    ];
    const plan = createSessionPlan(makeDefaultDifficulty(), history);
    expect(plan.includesBreathing).toBe(true);
    expect(plan.exercises).toContain('breathing');
  });

  it('includes breathing when history is empty (infinite sessions since breathing)', () => {
    const plan = createSessionPlan(makeDefaultDifficulty(), []);
    expect(plan.includesBreathing).toBe(true);
    expect(plan.exercises[0]).toBe('breathing');
  });

  it('orders relaxation (breathing) before cognitive exercises', () => {
    const history: ExerciseResult[] = [
      makeResult('go-no-go'),
      makeResult('flanker'),
      makeResult('n-back'),
      makeResult('visual-search'),
    ];
    const plan = createSessionPlan(makeDefaultDifficulty(), history);
    if (plan.includesBreathing) {
      const breathingIndex = plan.exercises.indexOf('breathing');
      // Breathing should be first (relaxation before cognitive)
      expect(breathingIndex).toBe(0);
    }
  });

  it('does not include duplicate exercises', () => {
    const plan = createSessionPlan(makeDefaultDifficulty(), []);
    const uniqueExercises = new Set(plan.exercises);
    expect(uniqueExercises.size).toBe(plan.exercises.length);
  });

  it('avoids repeating the last completed exercise when enough alternatives exist', () => {
    // When breathing is included, only 3 cognitive needed, so go-no-go can be skipped
    const history: ExerciseResult[] = [
      makeResult('go-no-go'),
      makeResult('flanker'),
      makeResult('n-back'),
      makeResult('visual-search'),
      makeResult('go-no-go'),
    ];
    const plan = createSessionPlan(makeDefaultDifficulty(), history);
    // Breathing is included (> 3 sessions since breathing)
    expect(plan.includesBreathing).toBe(true);
    // Only 3 cognitive exercises needed, so go-no-go (last exercise) can be excluded
    const cognitiveExercises = plan.exercises.filter((e) => e !== 'breathing');
    expect(cognitiveExercises).not.toContain('go-no-go');
  });

  it('has a positive estimated duration', () => {
    const plan = createSessionPlan(makeDefaultDifficulty(), []);
    expect(plan.estimatedMinutes).toBeGreaterThan(0);
  });
});

describe('createQuickSession', () => {
  it('returns exactly 1 exercise', () => {
    const plan = createQuickSession(makeDefaultDifficulty(), []);
    expect(plan.exercises.length).toBe(1);
  });

  it('never returns breathing or pomodoro', () => {
    const history: ExerciseResult[] = [
      makeResult('go-no-go', { score: 90 }),
      makeResult('flanker', { score: 90 }),
      makeResult('n-back', { score: 90 }),
      makeResult('visual-search', { score: 90 }),
    ];
    for (let i = 0; i < 20; i++) {
      const plan = createQuickSession(makeDefaultDifficulty(), history);
      expect(plan.exercises[0]).not.toBe('breathing');
      expect(plan.exercises[0]).not.toBe('pomodoro');
    }
  });

  it('picks weakest exercise when scores differ', () => {
    const history: ExerciseResult[] = [
      makeResult('go-no-go', { score: 90 }),
      makeResult('flanker', { score: 40 }),
      makeResult('n-back', { score: 80 }),
      makeResult('visual-search', { score: 70 }),
    ];
    const plan = createQuickSession(makeDefaultDifficulty(), history);
    expect(plan.exercises[0]).toBe('flanker');
  });

  it('picks least-recent exercise when scores are equal', () => {
    const history: ExerciseResult[] = [
      makeResult('go-no-go', { score: 75 }),
      makeResult('flanker', { score: 75 }),
      makeResult('n-back', { score: 75 }),
      makeResult('visual-search', { score: 75 }),
    ];
    // go-no-go was played first (least recent), so it should be picked
    const plan = createQuickSession(makeDefaultDifficulty(), history);
    expect(plan.exercises[0]).toBe('go-no-go');
  });

  it('works with empty history (defaults to go-no-go)', () => {
    const plan = createQuickSession(makeDefaultDifficulty(), []);
    expect(plan.exercises[0]).toBe('go-no-go');
  });

  it('does not include breathing', () => {
    const plan = createQuickSession(makeDefaultDifficulty(), []);
    expect(plan.includesBreathing).toBe(false);
  });

  it('has a positive estimated duration', () => {
    const plan = createQuickSession(makeDefaultDifficulty(), []);
    expect(plan.estimatedMinutes).toBeGreaterThan(0);
  });
});

describe('createDeepSession', () => {
  it('returns 6 exercises', () => {
    const plan = createDeepSession(makeDefaultDifficulty(), []);
    expect(plan.exercises.length).toBe(6);
  });

  it('always includes breathing', () => {
    const plan = createDeepSession(makeDefaultDifficulty(), []);
    expect(plan.includesBreathing).toBe(true);
    expect(plan.exercises).toContain('breathing');
  });

  it('includes all 4 cognitive exercises', () => {
    const plan = createDeepSession(makeDefaultDifficulty(), []);
    expect(plan.exercises).toContain('go-no-go');
    expect(plan.exercises).toContain('flanker');
    expect(plan.exercises).toContain('visual-search');
    expect(plan.exercises).toContain('n-back');
  });

  it('starts with breathing (warm-up)', () => {
    const plan = createDeepSession(makeDefaultDifficulty(), []);
    expect(plan.exercises[0]).toBe('breathing');
  });

  it('has estimated minutes around 10', () => {
    const plan = createDeepSession(makeDefaultDifficulty(), []);
    expect(plan.estimatedMinutes).toBeGreaterThanOrEqual(6);
    expect(plan.estimatedMinutes).toBeLessThanOrEqual(12);
  });

  it('repeats the weakest cognitive exercise as the 6th', () => {
    const history: ExerciseResult[] = [
      makeResult('go-no-go', { score: 90 }),
      makeResult('flanker', { score: 40 }),
      makeResult('n-back', { score: 80 }),
      makeResult('visual-search', { score: 70 }),
    ];
    const plan = createDeepSession(makeDefaultDifficulty(), history);
    // flanker is weakest, should appear twice
    const flankerCount = plan.exercises.filter((e) => e === 'flanker').length;
    expect(flankerCount).toBe(2);
  });
});

describe('createSessionByType', () => {
  it('dispatches quick to createQuickSession', () => {
    const plan = createSessionByType('quick', makeDefaultDifficulty(), []);
    expect(plan.exercises.length).toBe(1);
    expect(plan.includesBreathing).toBe(false);
  });

  it('dispatches standard to createSessionPlan', () => {
    const plan = createSessionByType('standard', makeDefaultDifficulty(), []);
    expect(plan.exercises.length).toBeGreaterThanOrEqual(3);
    expect(plan.exercises.length).toBeLessThanOrEqual(5);
  });

  it('dispatches deep to createDeepSession', () => {
    const plan = createSessionByType('deep', makeDefaultDifficulty(), []);
    expect(plan.exercises.length).toBe(6);
    expect(plan.includesBreathing).toBe(true);
  });
});
