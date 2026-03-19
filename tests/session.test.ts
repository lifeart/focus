import { describe, it, expect } from 'vitest';
import { createSessionPlan } from '../public/js/core/session';
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
