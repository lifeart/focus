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
import { EXERCISE_CONFIGS, SESSION_RESULT_KEY, SESSION_BONUS_KEY } from '../../constants.js';
import { calculateXP } from '../../core/progression.js';
import { updateDifficulty } from '../../core/adaptive.js';
import { createSessionPlan } from '../../core/session.js';

function createExercise(exerciseId: ExerciseId): Exercise | null {
  const data = appState.getData();
  const diffState = data.difficulty[exerciseId];
  const level = diffState?.currentLevel || 1;
  let params = getExerciseParams(exerciseId, level);

  if (diffState && isPlateauDetected(diffState)) {
    params = getMicroAdjustment(params);
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

  // Build UI
  const header = el('div', { className: 'exercise-header' }, [
    el('button', {
      className: 'btn btn--ghost exercise-back-btn',
      onClick: () => finishExercise(true),
    }, ['\u2190 \u0412\u044B\u0445\u043E\u0434']),
    el('h2', { className: 'exercise-title' }, [config.name]),
    el('button', {
      className: 'btn btn--ghost exercise-pause-btn',
      id: 'pause-btn',
      onClick: togglePause,
    }, ['\u23F8 \u041F\u0430\u0443\u0437\u0430']),
  ]);

  const exerciseArea = el('div', { className: 'exercise-area' });
  const pauseOverlay = el('div', { className: 'pause-overlay hidden' }, [
    el('div', { className: 'pause-content' }, [
      el('h2', null, ['\u041F\u0430\u0443\u0437\u0430']),
      el('button', {
        className: 'btn btn--primary',
        onClick: togglePause,
      }, ['\u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C']),
      el('button', {
        className: 'btn btn--ghost',
        onClick: () => finishExercise(true),
      }, ['\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044C']),
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

      appState.updateData((d) => {
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
        }
      });

      appState.emit({ type: 'exercise-complete', result });

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

  startExercise();

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
  const plan = createSessionPlan(data.difficulty, data.exerciseHistory);
  const sessionStartedAt = Date.now();
  const exerciseResults: ExerciseResult[] = [];
  let currentExerciseIndex = -1; // -1 = showing plan
  let exercise: Exercise | null = null;
  let isPaused = false;
  let isFinished = false;
  let cleanupCurrent: (() => void) | null = null;

  // ── Show session plan ──────────────────────────────────────────────

  function showPlan(): void {
    clear(container);

    const planList = el('div', { className: 'session-plan-list' });
    for (let i = 0; i < plan.exercises.length; i++) {
      const exId = plan.exercises[i];
      const config = EXERCISE_CONFIGS[exId];
      planList.appendChild(el('div', { className: 'session-plan-item' }, [
        el('span', { className: 'session-plan-item__num' }, [`${i + 1}.`]),
        el('span', { className: 'session-plan-item__icon' }, [config.icon]),
        el('span', { className: 'session-plan-item__name' }, [config.name]),
      ]));
    }

    const planScreen = el('div', { className: 'screen__stub' }, [
      el('h1', { className: 'screen__title' }, ['\u041F\u043B\u0430\u043D \u0442\u0440\u0435\u043D\u0438\u0440\u043E\u0432\u043A\u0438']),
      el('p', null, [
        `${plan.exercises.length} \u0443\u043F\u0440\u0430\u0436\u043D\u0435\u043D\u0438\u0439 \u2022 ~${plan.estimatedMinutes} \u043C\u0438\u043D`,
      ]),
      planList,
      el('button', {
        className: 'btn btn--primary btn--lg',
        onClick: () => startNextExercise(),
      }, ['\u041D\u0430\u0447\u0430\u0442\u044C']),
      el('button', {
        className: 'btn btn--ghost',
        onClick: () => { window.location.hash = '#/dashboard'; },
      }, ['\u041E\u0442\u043C\u0435\u043D\u0430']),
    ]);

    container.appendChild(planScreen);
  }

  // ── Transition screen between exercises ────────────────────────────

  function showTransition(nextExId: ExerciseId): void {
    clear(container);
    const config = EXERCISE_CONFIGS[nextExId];

    const transitionScreen = el('div', { className: 'screen__stub' }, [
      el('p', { className: 'session-transition__label' }, [
        `\u0423\u043F\u0440\u0430\u0436\u043D\u0435\u043D\u0438\u0435 ${currentExerciseIndex + 1} \u0438\u0437 ${plan.exercises.length}`,
      ]),
      el('h1', { className: 'screen__title' }, [
        `\u0421\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0435: ${config.name}`,
      ]),
      el('p', null, [config.description]),
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

    const config = EXERCISE_CONFIGS[exId];
    let exerciseFinished = false;

    const header = el('div', { className: 'exercise-header' }, [
      el('button', {
        className: 'btn btn--ghost exercise-back-btn',
        onClick: () => onExerciseFinish(true),
      }, ['\u2190 \u0412\u044B\u0445\u043E\u0434']),
      el('h2', { className: 'exercise-title' }, [
        `${config.name} (${currentExerciseIndex + 1}/${plan.exercises.length})`,
      ]),
      el('button', {
        className: 'btn btn--ghost exercise-pause-btn',
        onClick: toggleExercisePause,
      }, ['\u23F8 \u041F\u0430\u0443\u0437\u0430']),
    ]);

    const exerciseArea = el('div', { className: 'exercise-area' });
    const pauseOverlay = el('div', { className: 'pause-overlay hidden' }, [
      el('div', { className: 'pause-content' }, [
        el('h2', null, ['\u041F\u0430\u0443\u0437\u0430']),
        el('button', {
          className: 'btn btn--primary',
          onClick: toggleExercisePause,
        }, ['\u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C']),
        el('button', {
          className: 'btn btn--ghost',
          onClick: () => onExerciseFinish(true),
        }, ['\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044C \u0441\u0435\u0441\u0441\u0438\u044E']),
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

      // Update state for this exercise
      appState.updateData((d) => {
        d.exerciseHistory.push(result);
        d.progression.totalXP += xp;
        d.progression.totalFocusTimeMs += result.durationMs;
        d.progression.totalSessionCount++;

        if (exId === 'breathing') {
          d.progression.breathingSessions++;
        }

        if (!d.progression.activityDays.includes(today)) {
          d.progression.activityDays.push(today);
        }

        const prevRecord = d.progression.personalRecords[exId] || 0;
        if (result.score > prevRecord) {
          d.progression.personalRecords[exId] = result.score;
          if (prevRecord > 0) {
            d.progression.recordsBroken++;
            appState.emit({ type: 'record-broken', exerciseId: exId, oldRecord: prevRecord, newRecord: result.score });
          }
        }

        if (exId !== 'breathing' && exId !== 'pomodoro') {
          d.difficulty[exId] = updateDifficulty(d.difficulty[exId], result.score);
        }
      });

      appState.emit({ type: 'exercise-complete', result });
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

    startThisExercise();
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

    if (currentExerciseIndex === 0) {
      // First exercise - start directly
      runExercise(nextExId);
    } else {
      // Show transition
      showTransition(nextExId);
    }
  }

  // ── Finish session ─────────────────────────────────────────────────

  function finishSession(): void {
    isFinished = true;

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

    window.location.hash = '#/results';
  }

  // ── Start ──────────────────────────────────────────────────────────

  showPlan();

  return () => {
    isFinished = true;
    if (cleanupCurrent) cleanupCurrent();
  };
}

// ─── Main render ─────────────────────────────────────────────────────

export const renderExercisePlay: ScreenRender = (container, params) => {
  addClass(container, 'screen');
  const disposables = createDisposables();

  const exerciseId = params?.exerciseId as ExerciseId | undefined;

  // Session mode: no exerciseId provided
  if (!exerciseId) {
    const cleanupSession = renderSessionMode(container, disposables);
    return () => {
      cleanupSession();
      disposables.dispose();
    };
  }

  // Single exercise mode
  if (!EXERCISE_CONFIGS[exerciseId]) {
    container.appendChild(el('div', { className: 'screen__stub' }, [
      el('h1', { className: 'screen__title' }, ['\u0423\u043F\u0440\u0430\u0436\u043D\u0435\u043D\u0438\u0435 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E']),
      el('p', null, ['\u0412\u0435\u0440\u043D\u0438\u0442\u0435\u0441\u044C \u043A \u0441\u043F\u0438\u0441\u043A\u0443 \u0443\u043F\u0440\u0430\u0436\u043D\u0435\u043D\u0438\u0439']),
      el('button', { className: 'btn btn--primary', onClick: () => { window.location.hash = '#/exercises'; } }, ['\u041A \u0443\u043F\u0440\u0430\u0436\u043D\u0435\u043D\u0438\u044F\u043C']),
    ]));
    return () => disposables.dispose();
  }

  const cleanupExercise = renderSingleExercise(container, disposables, exerciseId);

  return () => {
    cleanupExercise();
    disposables.dispose();
  };
};
