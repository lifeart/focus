import { describe, it, expect } from 'vitest';
import { updateDifficulty, getExerciseParams, isPlateauDetected } from '../public/js/core/adaptive';
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
  it('levels up on single score > 90', () => {
    const state = makeState({ currentLevel: 5 });
    const result = updateDifficulty(state, 92);
    expect(result.currentLevel).toBe(6);
  });

  it('levels up when avg of last 3 >= 80', () => {
    const state = makeState({ currentLevel: 3, recentScores: [82, 85] });
    const result = updateDifficulty(state, 80);
    expect(result.currentLevel).toBe(4);
  });

  it('levels down on single score < 40', () => {
    const state = makeState({ currentLevel: 5 });
    const result = updateDifficulty(state, 35);
    expect(result.currentLevel).toBe(4);
  });

  it('levels down when 2 consecutive scores < 60', () => {
    const state = makeState({ currentLevel: 5, recentScores: [55] });
    const result = updateDifficulty(state, 58);
    expect(result.currentLevel).toBe(4);
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
    const state = makeState({ recentScores: [60, 65, 70, 75, 80] });
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
