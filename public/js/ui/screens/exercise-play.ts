import type { ScreenRender, Exercise, ExerciseId, ExerciseResult, SessionResult } from '../../types.js';
import { el, addClass, clear } from '../renderer.js';
import { createDisposables } from '../../core/disposables.js';
import { showCountdown } from '../../exercises/helpers.js';
import { getExerciseParams, getMicroAdjustment, isPlateauDetected } from '../../core/adaptive.js';
import { createGoNoGo } from '../../exercises/go-no-go.js';
import { createNBack } from '../../exercises/n-back.js';
import { createFlanker } from '../../exercises/flanker.js';
import { createVisualSearch } from '../../exercises/visual-search.js';
import { createBreathing } from '../../exercises/breathing.js';
import { createPomodoro } from '../../exercises/pomodoro.js';
import { appState, getSoundManager } from '../../main.js';
import { EXERCISE_CONFIGS, SESSION_RESULT_KEY, SESSION_BONUS_KEY, SESSION_CELEBRATIONS_KEY, SESSION_TYPE_KEY } from '../../constants.js';
import { calculateXP, getCurrentStreak, getLevel, getLevelTitle, checkBadges, checkDailyChallengeProgress } from '../../core/progression.js';
import { STREAK_FREEZE_MAX, STREAK_FREEZE_EARN_INTERVAL, THEME_UNLOCK_LEVELS, AVATAR_UNLOCK_LEVELS } from '../../constants.js';
import type { CelebrationData } from '../components/celebration-overlay.js';
import type { EarnedBadge, ThemeId } from '../../types.js';
import { updateDifficulty } from '../../core/adaptive.js';
import { createSessionByType } from '../../core/session.js';
import { t } from '../../core/i18n.js';
import { getBaselineExercises, getBaselineParams, createBaselineResult } from '../../core/baseline.js';
import { showToast } from '../components/toast.js';

const DIFFICULTY_CHANGE_KEY = 'focus:difficulty_change';

function buildCelebrationData(
  levelBefore: number,
  levelAfter: number,
  newBadges: EarnedBadge[],
): CelebrationData | null {
  const data: CelebrationData = { badges: newBadges, currentLevel: levelAfter };

  if (levelAfter > levelBefore) {
    // Determine unlocked content at the new level
    const unlockedThemes: ThemeId[] = [];
    for (const [themeId, unlockLevel] of Object.entries(THEME_UNLOCK_LEVELS)) {
      if (unlockLevel === levelAfter) {
        unlockedThemes.push(themeId as ThemeId);
      }
    }
    const unlockedAvatarLevel = AVATAR_UNLOCK_LEVELS.includes(levelAfter);

    data.levelUp = {
      newLevel: levelAfter,
      title: getLevelTitle(levelAfter),
      unlockedThemes,
      unlockedAvatarLevel,
    };
  }

  if (!data.levelUp && data.badges.length === 0) return null;
  return data;
}

/**
 * Shared post-exercise state update logic used by both single and session modes.
 * Must be called inside an `appState.updateData()` callback.
 * Returns the level before XP addition (for level-up detection).
 */
function processExerciseResult(
  d: import('../../types.js').AppData,
  exId: ExerciseId,
  result: ExerciseResult,
  today: string,
  xp: number,
): void {
  // Add result to history
  d.exerciseHistory.push(result);

  // Update progression
  d.progression.totalXP += xp;
  d.progression.totalFocusTimeMs += result.durationMs;
  d.progression.totalSessionCount++;

  if (exId === 'breathing') {
    d.progression.breathingSessions++;
  }

  // Add activity day
  if (!d.progression.activityDays.includes(today)) {
    d.progression.activityDays.push(today);
  }

  // Update current streak
  d.progression.currentStreak = getCurrentStreak(
    d.progression.activityDays,
    d.progression.streakFreezeUsedDays,
  );
  if (d.progression.currentStreak > d.progression.longestStreak) {
    d.progression.longestStreak = d.progression.currentStreak;
  }
  d.progression.lastStreakCheckDate = today;

  // Check freeze earning at 7-day milestones
  const cs = d.progression.currentStreak;
  if (
    cs > 0 &&
    cs % STREAK_FREEZE_EARN_INTERVAL === 0 &&
    !d.progression.streakFreezeEarnedAt.includes(cs) &&
    d.progression.streakFreezes < STREAK_FREEZE_MAX
  ) {
    d.progression.streakFreezes++;
    d.progression.streakFreezeEarnedAt.push(cs);
  }

  // Check personal record
  const prevRecord = d.progression.personalRecords[exId] || 0;
  if (result.score > prevRecord) {
    d.progression.personalRecords[exId] = result.score;
    if (prevRecord > 0) {
      d.progression.recordsBroken++;
      appState.emit({ type: 'record-broken', exerciseId: exId, oldRecord: prevRecord, newRecord: result.score });
    }
  }

  // Update difficulty
  if (exId !== 'breathing' && exId !== 'pomodoro') {
    d.difficulty[exId] = updateDifficulty(d.difficulty[exId], result.score);
    const levelChange = d.difficulty[exId].lastLevelChange;
    if (levelChange) {
      try { sessionStorage.setItem(DIFFICULTY_CHANGE_KEY, levelChange); } catch {}
    }
  }

  // Update weekly challenge progress
  updateWeeklyChallengeProgress(d, result);

  // Update daily challenge progress
  const dc = d.progression.dailyChallenge;
  if (dc && dc.date === today && !dc.completed) {
    const updated = checkDailyChallengeProgress(dc, result, d.progression, d.exerciseHistory);
    d.progression.dailyChallenge = updated;
    if (updated.completed && !dc.completed) {
      d.progression.totalXP += updated.xpReward;
    }
  }
}

/**
 * Post-update logic: emit events, check badges/level-up.
 * Called after `appState.updateData()` with `processExerciseResult`.
 * Returns celebration data (or null).
 */
function postExerciseEmitAndBadges(
  result: ExerciseResult,
  levelBefore: number,
  today: string,
): { celebrationData: CelebrationData | null; levelAfter: number } {
  // Emit daily challenge complete event if applicable
  {
    const latestData = appState.getData();
    const dc = latestData.progression.dailyChallenge;
    if (dc && dc.completed && dc.date === today) {
      appState.emit({ type: 'daily-challenge-complete', challenge: dc });
    }
  }

  appState.emit({ type: 'exercise-complete', result });

  // Detect level-up and new badges
  const updatedData = appState.getData();
  const levelAfter = getLevel(updatedData.progression.totalXP);
  const newBadges = checkBadges(updatedData.progression, updatedData.difficulty);

  // Push newly earned badges into progression
  if (newBadges.length > 0) {
    appState.updateData((d2) => {
      for (const badge of newBadges) {
        d2.progression.earnedBadges.push(badge);
      }
    });
    for (const badge of newBadges) {
      appState.emit({ type: 'badge-earned', badge });
    }
  }

  if (levelAfter > levelBefore) {
    appState.emit({ type: 'level-up', newLevel: levelAfter, title: getLevelTitle(levelAfter) });
  }

  const celebrationData = buildCelebrationData(levelBefore, levelAfter, newBadges);
  return { celebrationData, levelAfter };
}

function updateWeeklyChallengeProgress(d: import('../../types.js').AppData, result: ExerciseResult): void {
  const challenge = d.progression.weeklyChallenge;
  if (!challenge || challenge.progress >= challenge.target) return;

  switch (challenge.type) {
    case 'perfect-exercises':
      if (result.score >= 90) challenge.progress++;
      break;
    case 'total-sessions':
      challenge.progress++;
      break;
    case 'focus-time': {
      const weekStart = challenge.weekStart || '';
      const weekMs = d.exerciseHistory
        .filter(r => new Date(r.timestamp).toISOString().slice(0, 10) >= weekStart)
        .reduce((sum, r) => sum + r.durationMs, 0);
      challenge.progress = Math.floor(weekMs / 60000);
      break;
    }
    case 'no-errors':
      if (result.score >= 90) challenge.progress++;
      break;
  }
}

function createExercise(exerciseId: ExerciseId): Exercise | null {
  const data = appState.getData();
  const diffState = data.difficulty[exerciseId];
  const level = diffState?.currentLevel || 1;
  let params = getExerciseParams(exerciseId, level);

  if (diffState && isPlateauDetected(diffState)) {
    params = getMicroAdjustment(params, exerciseId);
  }

  const sound = getSoundManager();

  switch (exerciseId) {
    case 'go-no-go':
      return createGoNoGo(level, params, sound);
    case 'n-back':
      return createNBack(level, params, sound);
    case 'flanker':
      return createFlanker(level, params, sound);
    case 'visual-search':
      return createVisualSearch(level, params, sound);
    case 'breathing':
      return createBreathing(level, params, sound, data.settings.breathingPattern);
    case 'pomodoro':
      return createPomodoro(level, params, sound, data.settings.pomodoroMinutes);
    default:
      return null;
  }
}

// ─── Single exercise mode ────────────────────────────────────────────

function renderSingleExercise(
  container: HTMLElement,
  disposables: ReturnType<typeof createDisposables>,
  exerciseId: ExerciseId,
): () => void {
  const exId: ExerciseId = exerciseId;
  const config = EXERCISE_CONFIGS[exId];
  let exercise: Exercise | null = null;
  let isPaused = false;
  let isFinished = false;

  const exerciseName = t(`exercise.${exId}.name` as any);

  // Build UI
  const header = el('div', { className: 'exercise-header' }, [
    el('button', {
      className: 'btn btn--ghost exercise-back-btn',
      onClick: () => finishExercise(true),
    }, [t('play.exit')]),
    el('h2', { className: 'exercise-title' }, [exerciseName]),
    el('button', {
      className: 'btn btn--ghost exercise-pause-btn',
      id: 'pause-btn',
      onClick: togglePause,
    }, [t('play.pause')]),
  ]);

  const exerciseArea = el('div', { className: 'exercise-area' });
  const pauseOverlay = el('div', { className: 'pause-overlay hidden' }, [
    el('div', { className: 'pause-content' }, [
      el('h2', null, [t('play.pauseTitle')]),
      el('button', {
        className: 'btn btn--primary',
        onClick: togglePause,
      }, [t('play.continue')]),
      el('button', {
        className: 'btn btn--ghost',
        onClick: () => finishExercise(true),
      }, [t('play.finish')]),
    ]),
  ]);

  container.appendChild(header);
  container.appendChild(exerciseArea);
  container.appendChild(pauseOverlay);

  function togglePause(): void {
    if (isFinished || !exercise) return;
    isPaused = !isPaused;
    if (isPaused) {
      exercise.pause();
      pauseOverlay.classList.remove('hidden');
    } else {
      exercise.resume();
      pauseOverlay.classList.add('hidden');
    }
  }

  function finishExercise(earlyExit: boolean): void {
    if (isFinished || !exercise) return;
    isFinished = true;

    const result = exercise.stop();
    exercise.destroy();

    if (!earlyExit) {
      // Calculate XP and update state
      const data = appState.getData();
      const today = new Date().toISOString().slice(0, 10);
      const isNewDay = !data.progression.activityDays.includes(today);
      let xp = calculateXP(result, false, isNewDay);

      // Random bonus event (~20% chance)
      const bonusEvent = Math.random() < 0.2;
      if (bonusEvent) {
        xp *= 2;
      }
      result.xpEarned = xp;

      // Capture level before XP addition for level-up detection
      const levelBefore = getLevel(data.progression.totalXP);

      appState.updateData((d) => {
        processExerciseResult(d, exId, result, today, xp);
      });

      const { celebrationData } = postExerciseEmitAndBadges(result, levelBefore, today);

      // Store celebration data for results screen
      if (celebrationData) {
        try {
          sessionStorage.setItem(SESSION_CELEBRATIONS_KEY, JSON.stringify(celebrationData));
        } catch {
          // ignore
        }
      }

      // Navigate to results (store result in sessionStorage for results screen)
      try {
        sessionStorage.setItem(SESSION_RESULT_KEY, JSON.stringify(result));
        sessionStorage.setItem(SESSION_BONUS_KEY, bonusEvent ? '1' : '0');
      } catch {
        // ignore
      }
      window.location.hash = '#/results';
    } else {
      window.location.hash = '#/exercises';
    }
  }

  // Start exercise
  async function startExercise(): Promise<void> {
    // Show difficulty change notification from previous session
    const diffChange = sessionStorage.getItem(DIFFICULTY_CHANGE_KEY);
    if (diffChange) {
      sessionStorage.removeItem(DIFFICULTY_CHANGE_KEY);
      const msg = diffChange === 'up' ? t('difficulty.levelUp') : t('difficulty.levelDown');
      showToast(msg);
    }

    exercise = createExercise(exId);
    if (!exercise) return;

    exercise.setup(exerciseArea);

    // Show countdown (skip for breathing and pomodoro)
    if (exId !== 'breathing' && exId !== 'pomodoro') {
      await showCountdown(exerciseArea, disposables);
    }

    if (isFinished) return; // in case user left during countdown

    exercise.start();

    // Auto-finish when the exercise's internal timer runs out.
    // We poll every 500ms instead of using a single setTimeout because
    // the exercise timer pauses/resumes but setTimeout uses wall-clock time.
    // A single setTimeout would misfire if the user pauses the exercise.
    if (exId !== 'pomodoro') {
      const exConfig = EXERCISE_CONFIGS[exId];
      const durationMs = exConfig.durationSeconds * 1000;
      let exerciseElapsed = 0;
      const autoFinishInterval = disposables.setInterval(() => {
        if (isFinished) {
          clearInterval(autoFinishInterval);
          return;
        }
        if (!isPaused) {
          exerciseElapsed += 500;
        }
        if (exerciseElapsed >= durationMs + 500 && !isFinished && !isPaused) {
          clearInterval(autoFinishInterval);
          finishExercise(false);
        }
      }, 500);
    }
  }

  startExercise().catch(console.error);

  return () => {
    if (exercise && !isFinished) {
      exercise.destroy();
    }
  };
}

// ─── Session mode ────────────────────────────────────────────────────

function renderSessionMode(
  container: HTMLElement,
  disposables: ReturnType<typeof createDisposables>,
): () => void {
  const data = appState.getData();
  const sessionType = (sessionStorage.getItem(SESSION_TYPE_KEY) || 'standard') as import('../../types.js').SessionType;
  const plan = createSessionByType(sessionType, data.difficulty, data.exerciseHistory);
  const sessionStartedAt = Date.now();
  const exerciseResults: ExerciseResult[] = [];
  let currentExerciseIndex = -1; // -1 = showing plan
  let exercise: Exercise | null = null;
  let isPaused = false;
  let isFinished = false;
  let cleanupCurrent: (() => void) | null = null;

  // Accumulated celebration data across session exercises
  let sessionCelebration: CelebrationData = { badges: [] };

  // ── Show session plan ──────────────────────────────────────────────

  function showPlan(): void {
    clear(container);

    const planList = el('div', { className: 'session-plan-list' });
    for (let i = 0; i < plan.exercises.length; i++) {
      const exId = plan.exercises[i];
      const config = EXERCISE_CONFIGS[exId];
      const exerciseName = t(`exercise.${exId}.name` as any);
      planList.appendChild(el('div', { className: 'session-plan-item' }, [
        el('span', { className: 'session-plan-item__num' }, [`${i + 1}.`]),
        el('span', { className: 'session-plan-item__icon' }, [config.icon]),
        el('span', { className: 'session-plan-item__name' }, [exerciseName]),
      ]));
    }

    const planScreen = el('div', { className: 'screen__stub' }, [
      el('h1', { className: 'screen__title' }, [t('play.sessionPlan')]),
      el('p', null, [
        t('play.planInfo', { count: plan.exercises.length, minutes: plan.estimatedMinutes }),
      ]),
      planList,
      el('button', {
        className: 'btn btn--primary btn--lg',
        onClick: () => startNextExercise(),
      }, [t('play.startBtn')]),
      el('button', {
        className: 'btn btn--ghost',
        onClick: () => { window.location.hash = '#/dashboard'; },
      }, [t('play.cancelBtn')]),
    ]);

    container.appendChild(planScreen);
  }

  // ── Transition screen between exercises ────────────────────────────

  function showTransition(nextExId: ExerciseId): void {
    clear(container);
    const exerciseName = t(`exercise.${nextExId}.name` as any);
    const exerciseDesc = t(`exercise.${nextExId}.description` as any);

    const transitionScreen = el('div', { className: 'screen__stub' }, [
      el('p', { className: 'session-transition__label' }, [
        t('play.exerciseOf', { current: currentExerciseIndex + 1, total: plan.exercises.length }),
      ]),
      el('h1', { className: 'screen__title' }, [
        t('play.nextExercise', { name: exerciseName }),
      ]),
      el('p', null, [exerciseDesc]),
    ]);

    container.appendChild(transitionScreen);

    disposables.setTimeout(() => {
      if (!isFinished) {
        runExercise(nextExId);
      }
    }, 2500);
  }

  // ── Run a single exercise within session ───────────────────────────

  function runExercise(exId: ExerciseId): void {
    clear(container);
    addClass(container, 'screen');

    const exerciseName = t(`exercise.${exId}.name` as any);
    let exerciseFinished = false;

    const header = el('div', { className: 'exercise-header' }, [
      el('button', {
        className: 'btn btn--ghost exercise-back-btn',
        onClick: () => onExerciseFinish(true),
      }, [t('play.exit')]),
      el('h2', { className: 'exercise-title' }, [
        `${exerciseName} (${currentExerciseIndex + 1}/${plan.exercises.length})`,
      ]),
      el('button', {
        className: 'btn btn--ghost exercise-pause-btn',
        onClick: toggleExercisePause,
      }, [t('play.pause')]),
    ]);

    const exerciseArea = el('div', { className: 'exercise-area' });
    const pauseOverlay = el('div', { className: 'pause-overlay hidden' }, [
      el('div', { className: 'pause-content' }, [
        el('h2', null, [t('play.pauseTitle')]),
        el('button', {
          className: 'btn btn--primary',
          onClick: toggleExercisePause,
        }, [t('play.continue')]),
        el('button', {
          className: 'btn btn--ghost',
          onClick: () => onExerciseFinish(true),
        }, [t('play.finishSession')]),
      ]),
    ]);

    container.appendChild(header);
    container.appendChild(exerciseArea);
    container.appendChild(pauseOverlay);

    function toggleExercisePause(): void {
      if (exerciseFinished || !exercise) return;
      isPaused = !isPaused;
      if (isPaused) {
        exercise.pause();
        pauseOverlay.classList.remove('hidden');
      } else {
        exercise.resume();
        pauseOverlay.classList.add('hidden');
      }
    }

    function onExerciseFinish(earlyExit: boolean): void {
      if (exerciseFinished || !exercise) return;
      exerciseFinished = true;

      const result = exercise.stop();
      exercise.destroy();
      exercise = null;

      if (earlyExit) {
        // Abort entire session
        isFinished = true;
        window.location.hash = '#/exercises';
        return;
      }

      // Calculate XP for this exercise
      const appData = appState.getData();
      const today = new Date().toISOString().slice(0, 10);
      const isNewDay = !appData.progression.activityDays.includes(today);
      const isLastExercise = currentExerciseIndex >= plan.exercises.length - 1;
      const xp = calculateXP(result, isLastExercise, isNewDay);
      result.xpEarned = xp;

      // Capture level before XP addition for level-up detection
      const sessionLevelBefore = getLevel(appData.progression.totalXP);

      // Update state for this exercise
      appState.updateData((d) => {
        processExerciseResult(d, exId, result, today, xp);
      });

      const { celebrationData: exerciseCelebration } = postExerciseEmitAndBadges(result, sessionLevelBefore, today);

      // Accumulate celebration data (keep highest level-up, accumulate badges)
      if (exerciseCelebration) {
        // Level-up: keep the latest (highest) one
        if (exerciseCelebration.levelUp) {
          sessionCelebration.levelUp = exerciseCelebration.levelUp;
        }
        // Badges: accumulate
        sessionCelebration.badges.push(...exerciseCelebration.badges);
      }

      exerciseResults.push(result);

      // Start next exercise or finish session
      startNextExercise();
    }

    // Start the exercise
    async function startThisExercise(): Promise<void> {
      exercise = createExercise(exId);
      if (!exercise) return;

      exercise.setup(exerciseArea);

      if (exId !== 'breathing' && exId !== 'pomodoro') {
        await showCountdown(exerciseArea, disposables);
      }

      if (exerciseFinished || isFinished) return;

      exercise.start();

      const exConfig = EXERCISE_CONFIGS[exId];
      if (exId !== 'pomodoro') {
        const durationMs = exConfig.durationSeconds * 1000;
        let exerciseElapsed = 0;
        const autoFinishInterval = disposables.setInterval(() => {
          if (exerciseFinished || isFinished) {
            clearInterval(autoFinishInterval);
            return;
          }
          if (!isPaused) {
            exerciseElapsed += 500;
          }
          if (exerciseElapsed >= durationMs + 500 && !exerciseFinished && !isPaused) {
            clearInterval(autoFinishInterval);
            onExerciseFinish(false);
          }
        }, 500);
      }
    }

    cleanupCurrent = () => {
      if (exercise && !exerciseFinished) {
        exercise.destroy();
        exercise = null;
      }
    };

    startThisExercise().catch(console.error);
  }

  // ── Start next exercise or finish session ──────────────────────────

  function startNextExercise(): void {
    currentExerciseIndex++;

    if (currentExerciseIndex >= plan.exercises.length) {
      // Session complete - aggregate results
      finishSession();
      return;
    }

    const nextExId = plan.exercises[currentExerciseIndex];

    if (currentExerciseIndex === 0 || sessionType === 'quick') {
      // First exercise or quick session - start directly
      runExercise(nextExId);
    } else {
      // Show transition
      showTransition(nextExId);
    }
  }

  // ── Finish session ─────────────────────────────────────────────────

  function finishSession(): void {
    isFinished = true;
    try { sessionStorage.removeItem(SESSION_TYPE_KEY); } catch {}

    const totalXP = exerciseResults.reduce((sum, r) => sum + r.xpEarned, 0);
    const sessionResult: SessionResult = {
      startedAt: sessionStartedAt,
      completedAt: Date.now(),
      exercises: exerciseResults,
      totalXP,
    };

    // Store session result in appState.history
    appState.updateData((d) => {
      d.history.push(sessionResult);
    });

    appState.emit({ type: 'session-complete', result: sessionResult });

    // Store aggregated result for results screen
    const aggregated: ExerciseResult = {
      exerciseId: exerciseResults[0]?.exerciseId || 'go-no-go',
      timestamp: sessionStartedAt,
      durationMs: (sessionResult.completedAt - sessionResult.startedAt),
      level: 1,
      score: exerciseResults.length > 0
        ? Math.round(exerciseResults.reduce((sum, r) => sum + r.score, 0) / exerciseResults.length)
        : 0,
      metrics: {
        accuracy: exerciseResults.length > 0
          ? exerciseResults.reduce((sum, r) => sum + r.metrics.accuracy, 0) / exerciseResults.length
          : 0,
        totalTrials: exerciseResults.reduce((sum, r) => sum + r.metrics.totalTrials, 0),
        correctTrials: exerciseResults.reduce((sum, r) => sum + r.metrics.correctTrials, 0),
      },
      xpEarned: totalXP,
    };

    try {
      sessionStorage.setItem(SESSION_RESULT_KEY, JSON.stringify(aggregated));
      sessionStorage.setItem(SESSION_BONUS_KEY, '0');
    } catch {
      // ignore
    }

    // Write accumulated celebration data
    if (sessionCelebration.levelUp || sessionCelebration.badges.length > 0) {
      try {
        sessionStorage.setItem(SESSION_CELEBRATIONS_KEY, JSON.stringify(sessionCelebration));
      } catch {
        // ignore
      }
    }

    window.location.hash = '#/results';
  }

  // ── Start ──────────────────────────────────────────────────────────

  if (sessionType === 'quick') {
    startNextExercise(); // Skip plan screen, go straight to exercise
  } else {
    showPlan();
  }

  return () => {
    isFinished = true;
    try { sessionStorage.removeItem(SESSION_TYPE_KEY); } catch {}
    if (cleanupCurrent) cleanupCurrent();
  };
}

// ─── Baseline mode ──────────────────────────────────────────────────

function createBaselineExercise(exerciseId: ExerciseId): Exercise | null {
  const params = getBaselineParams(exerciseId);
  const sound = getSoundManager();
  const level = 1; // Always Level 1 for baseline

  switch (exerciseId) {
    case 'go-no-go':
      return createGoNoGo(level, params, sound);
    case 'n-back':
      return createNBack(level, params, sound);
    case 'flanker':
      return createFlanker(level, params, sound);
    default:
      return null;
  }
}

function renderBaselineMode(
  container: HTMLElement,
  disposables: ReturnType<typeof createDisposables>,
): () => void {
  const baselineExercises = getBaselineExercises();
  const exerciseResults: ExerciseResult[] = [];
  let currentIndex = -1;
  let exercise: Exercise | null = null;
  let isPaused = false;
  let isFinished = false;

  function runNextExercise(): void {
    currentIndex++;
    if (currentIndex >= baselineExercises.length) {
      finishBaseline();
      return;
    }
    runExercise(baselineExercises[currentIndex]);
  }

  function runExercise(exId: ExerciseId): void {
    container.innerHTML = '';
    const exerciseName = t(`exercise.${exId}.name` as any);
    let exerciseFinished = false;

    const header = el('div', { className: 'exercise-header' }, [
      el('button', {
        className: 'btn btn--ghost exercise-back-btn',
        onClick: () => { isFinished = true; window.location.hash = '#/dashboard'; },
      }, [t('play.exit')]),
      el('h2', { className: 'exercise-title' }, [
        `${exerciseName} (${currentIndex + 1}/${baselineExercises.length})`,
      ]),
      el('button', {
        className: 'btn btn--ghost exercise-pause-btn',
        onClick: togglePause,
      }, [t('play.pause')]),
    ]);

    const exerciseArea = el('div', { className: 'exercise-area' });
    const pauseOverlay = el('div', { className: 'pause-overlay hidden' }, [
      el('div', { className: 'pause-content' }, [
        el('h2', null, [t('play.pauseTitle')]),
        el('button', { className: 'btn btn--primary', onClick: togglePause }, [t('play.continue')]),
        el('button', { className: 'btn btn--ghost', onClick: () => { isFinished = true; window.location.hash = '#/dashboard'; } }, [t('play.finish')]),
      ]),
    ]);

    container.appendChild(header);
    container.appendChild(exerciseArea);
    container.appendChild(pauseOverlay);

    function togglePause(): void {
      if (exerciseFinished || !exercise) return;
      isPaused = !isPaused;
      if (isPaused) {
        exercise.pause();
        pauseOverlay.classList.remove('hidden');
      } else {
        exercise.resume();
        pauseOverlay.classList.add('hidden');
      }
    }

    function onFinish(): void {
      if (exerciseFinished || !exercise) return;
      exerciseFinished = true;
      const result = exercise.stop();
      exercise.destroy();
      exercise = null;
      exerciseResults.push(result);

      // Brief transition then next exercise
      disposables.setTimeout(() => {
        if (!isFinished) runNextExercise();
      }, 1000);
    }

    async function start(): Promise<void> {
      exercise = createBaselineExercise(exId);
      if (!exercise) return;
      exercise.setup(exerciseArea);
      if (exId !== 'breathing' && exId !== 'pomodoro') {
        await showCountdown(exerciseArea, disposables);
      }
      if (exerciseFinished || isFinished) return;
      exercise.start();

      // Baseline uses 90s fixed duration for reliable signal trials
      const durationMs = 90_000;
      let elapsed = 0;
      const autoFinish = disposables.setInterval(() => {
        if (exerciseFinished || isFinished) { clearInterval(autoFinish); return; }
        if (!isPaused) elapsed += 500;
        if (elapsed >= durationMs + 500 && !exerciseFinished && !isPaused) {
          clearInterval(autoFinish);
          onFinish();
        }
      }, 500);
    }

    start().catch(console.error);
  }

  function finishBaseline(): void {
    isFinished = true;
    const data = appState.getData();
    const baseline = createBaselineResult(exerciseResults, data.progression.totalSessionCount);

    appState.updateData((d) => {
      d.baseline = baseline;
    });

    window.location.hash = '#/dashboard';
  }

  // Show intro screen
  const intro = el('div', { className: 'screen__stub' }, [
    el('h1', { className: 'screen__title' }, [t('baseline.title')]),
    el('p', null, [t('dashboard.baselinePrompt')]),
    el('p', null, [
      t('play.planInfo', { count: baselineExercises.length, minutes: baselineExercises.length }),
    ]),
    el('button', {
      className: 'btn btn--primary btn--lg',
      onClick: () => runNextExercise(),
    }, [t('play.startBtn')]),
    el('button', {
      className: 'btn btn--ghost',
      onClick: () => { window.location.hash = '#/dashboard'; },
    }, [t('play.cancelBtn')]),
  ]);
  container.appendChild(intro);

  return () => {
    isFinished = true;
    if (exercise) { exercise.destroy(); exercise = null; }
  };
}

// ─── Main render ─────────────────────────────────────────────────────

export const renderExercisePlay: ScreenRender = (container, params) => {
  addClass(container, 'screen');
  const disposables = createDisposables();

  const exerciseId = params?.exerciseId as string | undefined;

  // Baseline mode
  if (exerciseId === 'baseline') {
    const cleanupBaseline = renderBaselineMode(container, disposables);
    return () => {
      cleanupBaseline();
      disposables.dispose();
    };
  }

  // Session mode: no exerciseId provided
  if (!exerciseId) {
    const cleanupSession = renderSessionMode(container, disposables);
    return () => {
      cleanupSession();
      disposables.dispose();
    };
  }

  // Single exercise mode
  const exId = exerciseId as ExerciseId;
  if (!EXERCISE_CONFIGS[exId]) {
    container.appendChild(el('div', { className: 'screen__stub' }, [
      el('h1', { className: 'screen__title' }, [t('play.notFound')]),
      el('p', null, [t('play.returnToList')]),
      el('button', { className: 'btn btn--primary', onClick: () => { window.location.hash = '#/exercises'; } }, [t('play.toExercises')]),
    ]));
    return () => disposables.dispose();
  }

  const cleanupExercise = renderSingleExercise(container, disposables, exId);

  return () => {
    cleanupExercise();
    disposables.dispose();
  };
};
