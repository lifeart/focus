import type { ExerciseId, DifficultyState, ExerciseResult, SessionPlan } from '../types.js';
import { EXERCISE_CONFIGS } from '../constants.js';

// Cognitive exercises ordered by estimated difficulty (easiest to hardest)
const COGNITIVE_ORDER: ExerciseId[] = ['go-no-go', 'flanker', 'visual-search', 'n-back'];

export function createSessionPlan(
  difficulty: Record<ExerciseId, DifficultyState>,
  history: ExerciseResult[],
): SessionPlan {
  const exercises: ExerciseId[] = [];
  let includesBreathing = false;

  // Check if breathing should be included (> 3 sessions since last breathing)
  const breathingResults = history.filter((r) => r.exerciseId === 'breathing');
  const lastBreathingIndex = breathingResults.length > 0
    ? history.lastIndexOf(breathingResults[breathingResults.length - 1])
    : -1;
  const sessionsSinceBreathing = lastBreathingIndex === -1
    ? Infinity
    : history.length - 1 - lastBreathingIndex;

  if (sessionsSinceBreathing > 3) {
    exercises.push('breathing');
    includesBreathing = true;
  }

  // Pick cognitive exercises: 3 if breathing included, 4 otherwise
  const targetCognitive = includesBreathing ? 3 : 4;

  // Sort cognitive exercises: relaxation first, then by difficulty order
  // Avoid repeating the last exercise done
  const lastExercise = history.length > 0 ? history[history.length - 1].exerciseId : null;

  const available = COGNITIVE_ORDER.filter((id) => id !== lastExercise);

  // If we filtered out too many, add back all
  const pool = available.length >= targetCognitive ? available : [...COGNITIVE_ORDER];

  // Pick exercises from the pool, up to targetCognitive
  const selected = pool.slice(0, targetCognitive);

  // If we still need more, allow the last exercise
  if (selected.length < targetCognitive) {
    for (const id of COGNITIVE_ORDER) {
      if (!selected.includes(id) && selected.length < targetCognitive) {
        selected.push(id);
      }
    }
  }

  exercises.push(...selected);

  // Estimate total duration
  const estimatedMinutes = Math.round(
    exercises.reduce((sum, id) => sum + EXERCISE_CONFIGS[id].durationSeconds, 0) / 60,
  );

  return {
    exercises,
    estimatedMinutes,
    includesBreathing,
  };
}
