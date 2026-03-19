import type { ExerciseId, DifficultyState, ExerciseResult, SessionPlan, SessionType } from '../types.js';
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

/**
 * Quick session: picks 1 cognitive exercise (weakest or least-recent).
 * Never includes breathing or pomodoro.
 * Fallback when no history: go-no-go (first in COGNITIVE_ORDER).
 */
export function createQuickSession(
  _difficulty: Record<ExerciseId, DifficultyState>,
  history: ExerciseResult[],
): SessionPlan {
  // Only cognitive exercises are candidates
  const candidates: ExerciseId[] = [...COGNITIVE_ORDER];

  let picked: ExerciseId = candidates[0]; // fallback: go-no-go

  if (history.length > 0) {
    // Compute average score per cognitive exercise from recent history
    const scoreMap: Record<string, { total: number; count: number }> = {};
    for (const r of history) {
      if (candidates.includes(r.exerciseId)) {
        if (!scoreMap[r.exerciseId]) scoreMap[r.exerciseId] = { total: 0, count: 0 };
        scoreMap[r.exerciseId].total += r.score;
        scoreMap[r.exerciseId].count++;
      }
    }

    // Find the weakest (lowest average score)
    let weakest: ExerciseId | null = null;
    let lowestAvg = Infinity;
    for (const id of candidates) {
      const entry = scoreMap[id];
      if (entry) {
        const avg = entry.total / entry.count;
        if (avg < lowestAvg) {
          lowestAvg = avg;
          weakest = id;
        }
      }
    }

    if (weakest !== null) {
      // Check if there are ties (all same avg)
      const allSameAvg = candidates.every((id) => {
        const entry = scoreMap[id];
        if (!entry) return false;
        return Math.abs(entry.total / entry.count - lowestAvg) < 0.01;
      });

      if (allSameAvg) {
        // Pick the least recently played
        picked = pickLeastRecent(candidates, history);
      } else {
        picked = weakest;
      }
    } else {
      // No scores for any cognitive exercise — pick least recent or fallback
      picked = pickLeastRecent(candidates, history);
    }
  }
  // If no history at all, picked stays as candidates[0] (go-no-go)

  const estimatedMinutes = Math.round(EXERCISE_CONFIGS[picked].durationSeconds / 60);

  return {
    exercises: [picked],
    estimatedMinutes,
    includesBreathing: false,
  };
}

function pickLeastRecent(candidates: ExerciseId[], history: ExerciseResult[]): ExerciseId {
  // Walk history backwards, find the last occurrence of each candidate
  const lastIndex: Record<string, number> = {};
  for (let i = history.length - 1; i >= 0; i--) {
    const id = history[i].exerciseId;
    if (candidates.includes(id) && !(id in lastIndex)) {
      lastIndex[id] = i;
    }
  }

  // Candidates not in history at all are "least recent" (index -1)
  let leastRecent: ExerciseId = candidates[0];
  let leastRecentIdx = Infinity;
  for (const id of candidates) {
    const idx = id in lastIndex ? lastIndex[id] : -1;
    if (idx < leastRecentIdx) {
      leastRecentIdx = idx;
      leastRecent = id;
    }
  }
  return leastRecent;
}

/**
 * Deep session: picks 5-6 exercises including breathing.
 * Always includes breathing first, then all 4 cognitive exercises,
 * plus the weakest cognitive exercise repeated for 6 total.
 */
export function createDeepSession(
  _difficulty: Record<ExerciseId, DifficultyState>,
  history: ExerciseResult[],
): SessionPlan {
  const exercises: ExerciseId[] = [];

  // Always include breathing first (warm-up)
  exercises.push('breathing');

  // Add all 4 cognitive exercises in difficulty order
  exercises.push(...COGNITIVE_ORDER);

  // Add a second round of the weakest cognitive exercise for 6 total
  const weakest = findWeakestCognitive(history);
  exercises.push(weakest);

  const estimatedMinutes = Math.round(
    exercises.reduce((sum, id) => sum + EXERCISE_CONFIGS[id].durationSeconds, 0) / 60,
  );

  return {
    exercises,
    estimatedMinutes,
    includesBreathing: true,
  };
}

function findWeakestCognitive(history: ExerciseResult[]): ExerciseId {
  if (history.length === 0) return COGNITIVE_ORDER[0];

  const scoreMap: Record<string, { total: number; count: number }> = {};
  for (const r of history) {
    if (COGNITIVE_ORDER.includes(r.exerciseId)) {
      if (!scoreMap[r.exerciseId]) scoreMap[r.exerciseId] = { total: 0, count: 0 };
      scoreMap[r.exerciseId].total += r.score;
      scoreMap[r.exerciseId].count++;
    }
  }

  let weakest: ExerciseId = COGNITIVE_ORDER[0];
  let lowestAvg = Infinity;
  for (const id of COGNITIVE_ORDER) {
    const entry = scoreMap[id];
    if (entry) {
      const avg = entry.total / entry.count;
      if (avg < lowestAvg) {
        lowestAvg = avg;
        weakest = id;
      }
    } else {
      // No history for this exercise — treat as weakest
      return id;
    }
  }
  return weakest;
}

/**
 * Dispatcher: creates a session plan based on session type.
 */
export function createSessionByType(
  type: SessionType,
  difficulty: Record<ExerciseId, DifficultyState>,
  history: ExerciseResult[],
): SessionPlan {
  switch (type) {
    case 'quick': return createQuickSession(difficulty, history);
    case 'deep': return createDeepSession(difficulty, history);
    default: return createSessionPlan(difficulty, history);
  }
}
