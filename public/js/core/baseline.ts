import type { ExerciseId, ExerciseResult, BaselineResult, DifficultyParams, SoundManager } from '../types.js';
import { DIFFICULTY_TABLE } from '../constants.js';

// Baseline exercises run at Level 1 with fixed parameters (no adaptive difficulty)
const BASELINE_EXERCISES: ExerciseId[] = ['go-no-go', 'flanker', 'n-back'];
const BASELINE_DURATION_MS = 60_000; // 1 minute per exercise

export function getBaselineExercises(): ExerciseId[] {
  return [...BASELINE_EXERCISES];
}

export function getBaselineParams(exerciseId: ExerciseId): DifficultyParams {
  // Always use Level 1 fixed parameters
  return { ...DIFFICULTY_TABLE[exerciseId][0] };
}

export function getBaselineDurationMs(): number {
  return BASELINE_DURATION_MS;
}

export function createBaselineResult(
  exercises: ExerciseResult[],
  sessionNumber: number,
): BaselineResult {
  return {
    timestamp: Date.now(),
    sessionNumber,
    exercises,
  };
}

export function shouldPromptBaseline(
  baseline: BaselineResult | undefined,
  totalSessionCount: number,
): boolean {
  // Prompt on first session (after onboarding) or every 20 sessions
  if (!baseline) return true;
  return (totalSessionCount - baseline.sessionNumber) >= 20;
}

export function getBaselineComparison(
  baseline: BaselineResult,
  currentResult: ExerciseResult,
): { exerciseId: ExerciseId; baselineScore: number; currentScore: number; improvement: number } | null {
  const baselineExercise = baseline.exercises.find(e => e.exerciseId === currentResult.exerciseId);
  if (!baselineExercise) return null;

  return {
    exerciseId: currentResult.exerciseId,
    baselineScore: baselineExercise.score,
    currentScore: currentResult.score,
    improvement: currentResult.score - baselineExercise.score,
  };
}
