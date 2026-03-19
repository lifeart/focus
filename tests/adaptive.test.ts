import { describe, it, expect } from 'vitest';
import { updateDifficulty, getExerciseParams, isPlateauDetected, getMicroAdjustment } from '../public/js/core/adaptive';
import type { DifficultyState } from '../public/js/types';

// Helper to create initial state
function makeState(overrides?: Partial<DifficultyState>): DifficultyState {
  return {
    exerciseId: 'go-no-go',
    currentLevel: 5,
    recentScores: [],
    sessionsAtCurrentLevel: 0,
    ...overrides,
  };
}

describe('updateDifficulty', () => {
  it('levels up on single score > 88', () => {
    const state = makeState({ currentLevel: 5 });
    const result = updateDifficulty(state, 90);
    expect(result.currentLevel).toBe(6);
  });

  it('levels up on score of 89 (> 88 threshold)', () => {
    const state = makeState({ currentLevel: 5 });
    const result = updateDifficulty(state, 89);
    expect(result.currentLevel).toBe(6);
  });

  it('levels up when avg of last 3 >= 75', () => {
    const state = makeState({ currentLevel: 3, recentScores: [76, 78] });
    const result = updateDifficulty(state, 75);
    expect(result.currentLevel).toBe(4);
  });

  it('does not level up when avg of last 3 < 75', () => {
    const state = makeState({ currentLevel: 3, recentScores: [70, 72] });
    const result = updateDifficulty(state, 74);
    expect(result.currentLevel).toBe(3);
  });

  it('levels down on single score < 45', () => {
    const state = makeState({ currentLevel: 5 });
    const result = updateDifficulty(state, 44);
    expect(result.currentLevel).toBe(4);
  });

  it('levels down when 2 consecutive scores < 65', () => {
    const state = makeState({ currentLevel: 5, recentScores: [60] });
    const result = updateDifficulty(state, 62);
    expect(result.currentLevel).toBe(4);
  });

  it('does not level down when scores are between 65 and 74', () => {
    const state = makeState({ currentLevel: 5, recentScores: [66] });
    const result = updateDifficulty(state, 68);
    expect(result.currentLevel).toBe(5);
  });

  it('clamps level to minimum 1', () => {
    const state = makeState({ currentLevel: 1 });
    const result = updateDifficulty(state, 30);
    expect(result.currentLevel).toBe(1);
  });

  it('clamps level to maximum 10', () => {
    const state = makeState({ currentLevel: 10 });
    const result = updateDifficulty(state, 95);
    expect(result.currentLevel).toBe(10);
  });

  it('detects plateau after 5 sessions at same level', () => {
    let state = makeState({ currentLevel: 5, sessionsAtCurrentLevel: 4, recentScores: [70, 70, 70, 70] });
    const result = updateDifficulty(state, 70);
    expect(isPlateauDetected(result)).toBe(true);
  });

  it('resets sessionsAtCurrentLevel on level change', () => {
    const state = makeState({ currentLevel: 5, sessionsAtCurrentLevel: 3 });
    const result = updateDifficulty(state, 95);
    expect(result.sessionsAtCurrentLevel).toBe(0);
  });

  it('keeps recent scores trimmed to 5', () => {
    const state = makeState({ recentScores: [60, 65, 70, 72, 74] });
    const result = updateDifficulty(state, 72);
    expect(result.recentScores.length).toBe(5);
  });
});

describe('getExerciseParams', () => {
  it('returns correct params for go-no-go level 1', () => {
    const params = getExerciseParams('go-no-go', 1);
    expect(params.level).toBe(1);
    expect(params.isiMin).toBe(1200);
    expect(params.isiMax).toBe(1800);
    expect(params.noGoRatio).toBe(0.20);
  });

  it('returns correct params for n-back level 5', () => {
    const params = getExerciseParams('n-back', 5);
    expect(params.nLevel).toBe(2);
  });

  it('clamps level to valid range', () => {
    const params = getExerciseParams('go-no-go', 99);
    expect(params.level).toBe(10);
  });
});

describe('getMicroAdjustment (deterministic staircase)', () => {
  it('reduces isiMax for go-no-go', () => {
    const params = getExerciseParams('go-no-go', 5);
    const adjusted = getMicroAdjustment(params, 'go-no-go');
    expect(adjusted.isiMax).toBe(params.isiMax! - 50);
  });

  it('reduces stimulusInterval for n-back', () => {
    const params = getExerciseParams('n-back', 5);
    const adjusted = getMicroAdjustment(params, 'n-back');
    expect(adjusted.stimulusInterval).toBe(params.stimulusInterval! - 100);
  });

  it('reduces congruentRatio for flanker', () => {
    const params = getExerciseParams('flanker', 5);
    const adjusted = getMicroAdjustment(params, 'flanker');
    expect(adjusted.congruentRatio).toBeCloseTo(params.congruentRatio! - 0.02, 5);
  });

  it('does not change visual-search params', () => {
    const params = getExerciseParams('visual-search', 5);
    const adjusted = getMicroAdjustment(params, 'visual-search');
    expect(adjusted.gridSize).toBe(params.gridSize);
  });

  it('clamps isiMax to minimum 400', () => {
    const params = { level: 10, isiMin: 500, isiMax: 420 };
    const adjusted = getMicroAdjustment(params, 'go-no-go');
    expect(adjusted.isiMax).toBe(400);
  });
});
