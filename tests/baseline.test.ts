import { describe, it, expect } from 'vitest';
import {
  getBaselineExercises,
  getBaselineParams,
  getBaselineDurationMs,
  createBaselineResult,
  shouldPromptBaseline,
  getBaselineComparison,
} from '../public/js/core/baseline';
import { DIFFICULTY_TABLE } from '../public/js/constants';
import type { ExerciseResult, BaselineResult, ExerciseId } from '../public/js/types';

function makeExerciseResult(overrides?: Partial<ExerciseResult>): ExerciseResult {
  return {
    exerciseId: 'go-no-go',
    timestamp: Date.now(),
    durationMs: 60000,
    level: 1,
    score: 75,
    metrics: { accuracy: 0.85, totalTrials: 20, correctTrials: 17 },
    xpEarned: 10,
    ...overrides,
  };
}

function makeBaseline(overrides?: Partial<BaselineResult>): BaselineResult {
  return {
    timestamp: Date.now(),
    sessionNumber: 1,
    exercises: [
      makeExerciseResult({ exerciseId: 'go-no-go', score: 70 }),
      makeExerciseResult({ exerciseId: 'flanker', score: 65 }),
      makeExerciseResult({ exerciseId: 'n-back', score: 60 }),
    ],
    ...overrides,
  };
}

describe('getBaselineExercises', () => {
  it('returns the three baseline exercise IDs', () => {
    expect(getBaselineExercises()).toEqual(['go-no-go', 'flanker', 'n-back']);
  });

  it('returns a new array each call (no mutation leaks)', () => {
    const a = getBaselineExercises();
    const b = getBaselineExercises();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe('getBaselineParams', () => {
  it.each(['go-no-go', 'flanker', 'n-back'] as ExerciseId[])(
    'returns Level 1 params for %s matching DIFFICULTY_TABLE[%s][0]',
    (exerciseId) => {
      const params = getBaselineParams(exerciseId);
      expect(params).toEqual(DIFFICULTY_TABLE[exerciseId][0]);
    },
  );

  it('returns a copy, not the original object', () => {
    const params = getBaselineParams('go-no-go');
    expect(params).not.toBe(DIFFICULTY_TABLE['go-no-go'][0]);
  });

  it('go-no-go Level 1 has expected fields', () => {
    const params = getBaselineParams('go-no-go');
    expect(params.level).toBe(1);
    expect(params.isiMin).toBe(1200);
    expect(params.isiMax).toBe(1800);
    expect(params.noGoRatio).toBe(0.20);
    expect(params.stimulusDuration).toBe(500);
  });

  it('n-back Level 1 has expected fields', () => {
    const params = getBaselineParams('n-back');
    expect(params.level).toBe(1);
    expect(params.nLevel).toBe(1);
    expect(params.stimulusInterval).toBe(3000);
  });

  it('flanker Level 1 has expected fields', () => {
    const params = getBaselineParams('flanker');
    expect(params.level).toBe(1);
    expect(params.congruentRatio).toBe(0.70);
    expect(params.responseDeadline).toBe(2000);
  });
});

describe('getBaselineDurationMs', () => {
  it('returns 90000 (90 seconds)', () => {
    expect(getBaselineDurationMs()).toBe(90000);
  });
});

describe('createBaselineResult', () => {
  it('creates a BaselineResult with the given exercises and sessionNumber', () => {
    const exercises = [
      makeExerciseResult({ exerciseId: 'go-no-go' }),
      makeExerciseResult({ exerciseId: 'flanker' }),
    ];
    const before = Date.now();
    const result = createBaselineResult(exercises, 5);
    const after = Date.now();

    expect(result.sessionNumber).toBe(5);
    expect(result.exercises).toBe(exercises);
    expect(result.timestamp).toBeGreaterThanOrEqual(before);
    expect(result.timestamp).toBeLessThanOrEqual(after);
  });

  it('preserves all exercise results in order', () => {
    const exercises = [
      makeExerciseResult({ exerciseId: 'go-no-go', score: 80 }),
      makeExerciseResult({ exerciseId: 'n-back', score: 55 }),
      makeExerciseResult({ exerciseId: 'flanker', score: 72 }),
    ];
    const result = createBaselineResult(exercises, 1);
    expect(result.exercises).toHaveLength(3);
    expect(result.exercises[0].exerciseId).toBe('go-no-go');
    expect(result.exercises[1].exerciseId).toBe('n-back');
    expect(result.exercises[2].exerciseId).toBe('flanker');
  });
});

describe('shouldPromptBaseline', () => {
  it('returns true when baseline is undefined', () => {
    expect(shouldPromptBaseline(undefined, 0)).toBe(true);
    expect(shouldPromptBaseline(undefined, 100)).toBe(true);
  });

  it('returns true when totalSessionCount - baseline.sessionNumber >= 20', () => {
    const baseline = makeBaseline({ sessionNumber: 5 });
    expect(shouldPromptBaseline(baseline, 25)).toBe(true);
    expect(shouldPromptBaseline(baseline, 30)).toBe(true);
  });

  it('returns true when exactly 20 sessions since baseline', () => {
    const baseline = makeBaseline({ sessionNumber: 10 });
    expect(shouldPromptBaseline(baseline, 30)).toBe(true);
  });

  it('returns false when fewer than 20 sessions since baseline', () => {
    const baseline = makeBaseline({ sessionNumber: 5 });
    expect(shouldPromptBaseline(baseline, 10)).toBe(false);
    expect(shouldPromptBaseline(baseline, 24)).toBe(false);
  });

  it('returns false when exactly 19 sessions since baseline', () => {
    const baseline = makeBaseline({ sessionNumber: 1 });
    expect(shouldPromptBaseline(baseline, 20)).toBe(false);
  });
});

describe('getBaselineComparison', () => {
  it('returns correct comparison when baseline has matching exercise', () => {
    const baseline = makeBaseline();
    const current = makeExerciseResult({ exerciseId: 'go-no-go', score: 85 });
    const result = getBaselineComparison(baseline, current);

    expect(result).not.toBeNull();
    expect(result!.exerciseId).toBe('go-no-go');
    expect(result!.baselineScore).toBe(70);
    expect(result!.currentScore).toBe(85);
    expect(result!.improvement).toBe(15);
  });

  it('returns null when baseline has no matching exercise', () => {
    const baseline = makeBaseline({ exercises: [makeExerciseResult({ exerciseId: 'flanker' })] });
    const current = makeExerciseResult({ exerciseId: 'go-no-go', score: 80 });
    expect(getBaselineComparison(baseline, current)).toBeNull();
  });

  it('calculates positive improvement correctly', () => {
    const baseline = makeBaseline();
    const current = makeExerciseResult({ exerciseId: 'flanker', score: 90 });
    const result = getBaselineComparison(baseline, current)!;
    expect(result.improvement).toBe(25); // 90 - 65
  });

  it('calculates negative improvement (regression) correctly', () => {
    const baseline = makeBaseline();
    const current = makeExerciseResult({ exerciseId: 'n-back', score: 50 });
    const result = getBaselineComparison(baseline, current)!;
    expect(result.improvement).toBe(-10); // 50 - 60
  });

  it('returns zero improvement when scores are equal', () => {
    const baseline = makeBaseline();
    const current = makeExerciseResult({ exerciseId: 'go-no-go', score: 70 });
    const result = getBaselineComparison(baseline, current)!;
    expect(result.improvement).toBe(0);
  });
});
