import type { ExerciseId, DifficultyParams, DifficultyState } from '../types.js';
import { DIFFICULTY_TABLE } from '../constants.js';

export function getExerciseParams(exerciseId: ExerciseId, level: number): DifficultyParams {
  const table = DIFFICULTY_TABLE[exerciseId];
  const clamped = Math.max(1, Math.min(level, table.length));
  return table[clamped - 1];
}

export function updateDifficulty(state: DifficultyState, score: number): DifficultyState {
  const recentScores = [...state.recentScores, score].slice(-5);
  let newLevel = state.currentLevel;
  let sessionsAtCurrentLevel = state.sessionsAtCurrentLevel + 1;
  let lastMicroAdjustment = state.lastMicroAdjustment;

  // Level up conditions
  if (score > 88) {
    // Instant level up
    newLevel++;
  } else if (recentScores.length >= 3) {
    const last3 = recentScores.slice(-3);
    const avg = last3.reduce((a, b) => a + b, 0) / last3.length;
    if (avg >= 75) {
      newLevel++;
    }
  }

  // Level down conditions (only if no level up happened)
  if (newLevel === state.currentLevel) {
    if (score < 45) {
      // Instant level down
      newLevel--;
    } else if (recentScores.length >= 2) {
      const last2 = recentScores.slice(-2);
      if (last2[0] < 65 && last2[1] < 65) {
        newLevel--;
      }
    }
  }

  // Clamp level
  newLevel = Math.max(1, Math.min(10, newLevel));

  // Reset sessions counter on level change
  if (newLevel !== state.currentLevel) {
    sessionsAtCurrentLevel = 0;
    lastMicroAdjustment = undefined;
  }

  // Plateau detection
  if (sessionsAtCurrentLevel >= 5 && newLevel === state.currentLevel) {
    lastMicroAdjustment = Date.now();
  }

  const levelChange: 'up' | 'down' | undefined =
    newLevel > state.currentLevel ? 'up' :
    newLevel < state.currentLevel ? 'down' :
    undefined;

  return {
    exerciseId: state.exerciseId,
    currentLevel: newLevel,
    recentScores,
    sessionsAtCurrentLevel,
    lastMicroAdjustment,
    lastLevelChange: levelChange,
  };
}

export function getMicroAdjustment(params: DifficultyParams, exerciseId: ExerciseId): DifficultyParams {
  const adjusted: DifficultyParams = { ...params };

  // Deterministic staircase: on plateau, increment ONE parameter slightly
  switch (exerciseId) {
    case 'go-no-go':
      if (adjusted.isiMax != null) adjusted.isiMax = Math.max(400, adjusted.isiMax - 50);
      break;
    case 'n-back':
      if (adjusted.stimulusInterval != null) adjusted.stimulusInterval = Math.max(1500, adjusted.stimulusInterval - 100);
      break;
    case 'flanker':
      if (adjusted.congruentRatio != null) adjusted.congruentRatio = Math.max(0.30, adjusted.congruentRatio - 0.02);
      break;
    // visual-search: grid size is discrete, no micro-adjustment
    default:
      break;
  }

  return adjusted;
}

export function isPlateauDetected(state: DifficultyState): boolean {
  return state.sessionsAtCurrentLevel >= 5 && state.lastMicroAdjustment !== undefined;
}
