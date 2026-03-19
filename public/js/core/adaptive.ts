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
  if (score > 90) {
    // Instant level up
    newLevel++;
  } else if (recentScores.length >= 3) {
    const last3 = recentScores.slice(-3);
    const avg = last3.reduce((a, b) => a + b, 0) / last3.length;
    if (avg >= 80) {
      newLevel++;
    }
  }

  // Level down conditions (only if no level up happened)
  if (newLevel === state.currentLevel) {
    if (score < 40) {
      // Instant level down
      newLevel--;
    } else if (recentScores.length >= 2) {
      const last2 = recentScores.slice(-2);
      if (last2[0] < 60 && last2[1] < 60) {
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

  return {
    exerciseId: state.exerciseId,
    currentLevel: newLevel,
    recentScores,
    sessionsAtCurrentLevel,
    lastMicroAdjustment,
  };
}

export function getMicroAdjustment(params: DifficultyParams): DifficultyParams {
  const adjusted: DifficultyParams = { ...params };

  for (const key of Object.keys(adjusted)) {
    if (key === 'level') continue;
    const value = adjusted[key];
    if (typeof value === 'number') {
      // Random variation within +/-10%
      const factor = 1 + (Math.random() * 0.2 - 0.1);
      adjusted[key] = Math.round(value * factor);
    }
  }

  return adjusted;
}

export function isPlateauDetected(state: DifficultyState): boolean {
  return state.sessionsAtCurrentLevel >= 5 && state.lastMicroAdjustment !== undefined;
}
