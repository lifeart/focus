import type { Exercise, ExerciseResult, ExerciseMetrics, DifficultyParams, SoundManager } from '../types.js';
import { el } from '../ui/renderer.js';
import { createDisposables } from '../core/disposables.js';
import { createExerciseTimer, jitteredInterval, showFeedback, formatTime } from './helpers.js';

const DURATION_MS = 180_000; // 3 minutes

type Direction = 'left' | 'right';

interface TrialRecord {
  congruent: boolean;
  centerDirection: Direction;
  responded: boolean;
  correct: boolean;
  rt: number | null;
}

export function createFlanker(level: number, params: DifficultyParams, sound: SoundManager): Exercise {
  const disposables = createDisposables();
  const timer = createExerciseTimer(DURATION_MS, disposables);

  const congruentRatio = params.congruentRatio ?? 0.70;
  const responseDeadline = params.responseDeadline ?? 2000;
  const isiMin = params.flankerIsiMin ?? 1200;
  const isiMax = params.flankerIsiMax ?? 1800;

  const trials: TrialRecord[] = [];
  let container: HTMLElement | null = null;
  let stimulusArea: HTMLElement | null = null;
  let timerDisplay: HTMLElement | null = null;
  let trialCounter: HTMLElement | null = null;

  let paused = false;
  let started = false;
  let awaitingResponse = false;
  let stimulusShownAt = 0;
  let deadlineTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let isiTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let trialIndex = 0;

  // Touch tracking for swipe detection
  let touchStartX = 0;
  let touchStartY = 0;

  const avgIsi = (isiMin + isiMax) / 2;
  const avgTrialTime = responseDeadline * 0.5 + avgIsi; // assume ~half deadline on avg
  const estimatedTrials = Math.round(DURATION_MS / avgTrialTime);

  function isCongruent(): boolean {
    return Math.random() < congruentRatio;
  }

  function randomDirection(): Direction {
    return Math.random() < 0.5 ? 'left' : 'right';
  }

  function createArrowSpan(direction: Direction, isCenter: boolean): HTMLElement {
    const span = el('span');
    span.textContent = direction === 'left' ? '\u25C0' : '\u25B6';
    span.style.fontSize = '3rem';
    span.style.margin = '0 0.25rem';
    span.style.display = 'inline-block';
    span.style.userSelect = 'none';
    span.style.lineHeight = '1';
    if (isCenter) {
      span.style.color = '#ffd93d';
      span.style.transform = 'scale(1.3)';
      span.style.textShadow = '0 0 12px rgba(255,217,61,0.6)';
    } else {
      span.style.color = '#e0e0e0';
    }
    return span;
  }

  function showStimulus(): void {
    if (!started || paused || !stimulusArea) return;

    trialIndex++;
    const congruent = isCongruent();
    const centerDir = randomDirection();
    const flankerDir: Direction = congruent ? centerDir : (centerDir === 'left' ? 'right' : 'left');

    const trial: TrialRecord = {
      congruent,
      centerDirection: centerDir,
      responded: false,
      correct: false,
      rt: null,
    };
    trials.push(trial);

    // Clear stimulus area
    stimulusArea.innerHTML = '';

    // Build row of 5 arrows: flanker flanker CENTER flanker flanker
    const row = el('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'center';
    row.style.gap = '0.3rem';

    row.appendChild(createArrowSpan(flankerDir, false));
    row.appendChild(createArrowSpan(flankerDir, false));
    row.appendChild(createArrowSpan(centerDir, true));
    row.appendChild(createArrowSpan(flankerDir, false));
    row.appendChild(createArrowSpan(flankerDir, false));

    stimulusArea.appendChild(row);
    stimulusShownAt = Date.now();
    awaitingResponse = true;

    updateTrialCounter();

    // Start deadline timer
    deadlineTimeoutId = disposables.setTimeout(() => {
      deadlineTimeoutId = null;
      onDeadlineExpired();
    }, responseDeadline);
  }

  function onDeadlineExpired(): void {
    if (!started || paused || !awaitingResponse) return;

    const trial = trials[trials.length - 1];
    if (!trial.responded) {
      // Miss / timeout
      trial.responded = false;
      trial.correct = false;
      trial.rt = null;
      sound.playIncorrect();
      if (container) showFeedback(container, false, disposables);
    }

    awaitingResponse = false;
    clearStimulus();
    scheduleNextTrial();
  }

  function handleResponse(direction: Direction): void {
    if (!started || paused || !awaitingResponse) return;

    const rt = Date.now() - stimulusShownAt;
    awaitingResponse = false;

    const trial = trials[trials.length - 1];
    trial.responded = true;
    trial.rt = rt;

    if (direction === trial.centerDirection) {
      trial.correct = true;
      sound.playCorrect();
      if (container) showFeedback(container, true, disposables);
    } else {
      trial.correct = false;
      sound.playIncorrect();
      if (container) showFeedback(container, false, disposables);
    }

    // Cancel deadline timer
    if (deadlineTimeoutId !== null) {
      clearTimeout(deadlineTimeoutId);
      deadlineTimeoutId = null;
    }

    clearStimulus();
    scheduleNextTrial();
  }

  function clearStimulus(): void {
    if (stimulusArea) {
      stimulusArea.innerHTML = '';
    }
  }

  function scheduleNextTrial(): void {
    if (!started || paused) return;
    if (timer.getElapsed() >= DURATION_MS) return;

    const isi = jitteredInterval(isiMin, isiMax);
    isiTimeoutId = disposables.setTimeout(() => {
      isiTimeoutId = null;
      if (started && !paused) {
        showStimulus();
      }
    }, isi);
  }

  function updateTrialCounter(): void {
    if (trialCounter) {
      trialCounter.textContent = `\u041f\u0440\u043e\u0431\u0430 ${trialIndex} \u0438\u0437 ~${estimatedTrials}`;
    }
  }

  function onKeyDown(e: Event): void {
    const ke = e as KeyboardEvent;
    if (ke.code === 'ArrowLeft' || ke.key === 'ArrowLeft') {
      ke.preventDefault();
      handleResponse('left');
    } else if (ke.code === 'ArrowRight' || ke.key === 'ArrowRight') {
      ke.preventDefault();
      handleResponse('right');
    }
  }

  function onTouchStart(e: Event): void {
    const te = e as TouchEvent;
    if (te.touches.length > 0) {
      touchStartX = te.touches[0].clientX;
      touchStartY = te.touches[0].clientY;
    }
  }

  function onTouchEnd(e: Event): void {
    const te = e as TouchEvent;
    if (te.changedTouches.length > 0) {
      const dx = te.changedTouches[0].clientX - touchStartX;
      const dy = te.changedTouches[0].clientY - touchStartY;
      const minSwipe = 40;
      // Only detect horizontal swipe if horizontal distance > vertical distance
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > minSwipe) {
        handleResponse(dx < 0 ? 'left' : 'right');
      }
    }
  }

  function computeMetrics(): ExerciseMetrics {
    const totalTrials = trials.length;
    const correctTrials = trials.filter(t => t.correct).length;
    const accuracy = totalTrials > 0 ? correctTrials / totalTrials : 0;

    const correctCongruentRTs = trials
      .filter(t => t.congruent && t.correct && t.rt !== null)
      .map(t => t.rt as number);

    const correctIncongruentRTs = trials
      .filter(t => !t.congruent && t.correct && t.rt !== null)
      .map(t => t.rt as number);

    const rtCongruent = correctCongruentRTs.length > 0
      ? correctCongruentRTs.reduce((a, b) => a + b, 0) / correctCongruentRTs.length
      : 0;

    const rtIncongruent = correctIncongruentRTs.length > 0
      ? correctIncongruentRTs.reduce((a, b) => a + b, 0) / correctIncongruentRTs.length
      : 0;

    const interferenceScore = (rtCongruent > 0 && rtIncongruent > 0)
      ? rtIncongruent - rtCongruent
      : 0;

    return {
      accuracy,
      totalTrials,
      correctTrials,
      rtCongruent: Math.round(rtCongruent),
      rtIncongruent: Math.round(rtIncongruent),
      interferenceScore: Math.round(interferenceScore),
    };
  }

  function computeScore(metrics: ExerciseMetrics): number {
    const score = metrics.accuracy * 100;
    return Math.round(Math.max(0, Math.min(100, score)));
  }

  const exercise: Exercise = {
    id: 'flanker',

    setup(cont: HTMLElement): void {
      container = cont;
      container.setAttribute('data-exercise', 'flanker');

      timerDisplay = el('div', { className: 'exercise-timer' });
      timerDisplay.textContent = formatTime(DURATION_MS);

      trialCounter = el('div', { className: 'exercise-trial-counter' });
      trialCounter.textContent = `\u041f\u0440\u043e\u0431\u0430 0 \u0438\u0437 ~${estimatedTrials}`;

      const header = el('div', { className: 'exercise-header' }, [timerDisplay, trialCounter]);

      stimulusArea = el('div', { className: 'exercise-stimulus-area' });
      stimulusArea.style.display = 'flex';
      stimulusArea.style.alignItems = 'center';
      stimulusArea.style.justifyContent = 'center';
      stimulusArea.style.minHeight = '200px';
      stimulusArea.style.userSelect = 'none';

      // On-screen response buttons for mobile
      const btnLeft = el('button', { className: 'flanker-btn flanker-btn--left' });
      btnLeft.textContent = '\u25C0';
      btnLeft.style.fontSize = '2.5rem';
      btnLeft.style.padding = '0.75rem 2rem';
      btnLeft.style.border = '2px solid #555';
      btnLeft.style.borderRadius = '12px';
      btnLeft.style.background = 'rgba(255,255,255,0.08)';
      btnLeft.style.color = '#e0e0e0';
      btnLeft.style.cursor = 'pointer';
      btnLeft.style.touchAction = 'manipulation';
      btnLeft.style.userSelect = 'none';
      btnLeft.style.webkitUserSelect = 'none';

      const btnRight = el('button', { className: 'flanker-btn flanker-btn--right' });
      btnRight.textContent = '\u25B6';
      btnRight.style.fontSize = '2.5rem';
      btnRight.style.padding = '0.75rem 2rem';
      btnRight.style.border = '2px solid #555';
      btnRight.style.borderRadius = '12px';
      btnRight.style.background = 'rgba(255,255,255,0.08)';
      btnRight.style.color = '#e0e0e0';
      btnRight.style.cursor = 'pointer';
      btnRight.style.touchAction = 'manipulation';
      btnRight.style.userSelect = 'none';
      btnRight.style.webkitUserSelect = 'none';

      const buttonRow = el('div', { className: 'flanker-buttons' }, [btnLeft, btnRight]);
      buttonRow.style.display = 'flex';
      buttonRow.style.justifyContent = 'center';
      buttonRow.style.gap = '2rem';
      buttonRow.style.marginTop = '2rem';

      container.appendChild(header);
      container.appendChild(stimulusArea);
      container.appendChild(buttonRow);

      // Register input handlers
      disposables.addListener(document, 'keydown', onKeyDown);
      disposables.addListener(btnLeft, 'click', () => handleResponse('left'));
      disposables.addListener(btnRight, 'click', () => handleResponse('right'));

      // Swipe detection
      disposables.addListener(stimulusArea, 'touchstart', onTouchStart);
      disposables.addListener(stimulusArea, 'touchend', onTouchEnd);

      // Timer tick updates
      timer.onTick((remaining) => {
        if (timerDisplay) {
          timerDisplay.textContent = formatTime(remaining);
        }
        if (remaining <= 0 && started) {
          started = false;
          awaitingResponse = false;
          clearStimulus();
        }
      });
    },

    start(): void {
      started = true;
      paused = false;
      timer.start();
      scheduleNextTrial();
    },

    pause(): void {
      if (!started || paused) return;
      paused = true;
      timer.pause();
      awaitingResponse = false;
      clearStimulus();
      if (deadlineTimeoutId !== null) {
        clearTimeout(deadlineTimeoutId);
        deadlineTimeoutId = null;
      }
      if (isiTimeoutId !== null) {
        clearTimeout(isiTimeoutId);
        isiTimeoutId = null;
      }
    },

    resume(): void {
      if (!started || !paused) return;
      paused = false;
      timer.resume();
      scheduleNextTrial();
    },

    stop(): ExerciseResult {
      const elapsed = timer.stop();
      started = false;
      awaitingResponse = false;
      clearStimulus();

      const metrics = computeMetrics();
      const score = computeScore(metrics);

      return {
        exerciseId: 'flanker',
        timestamp: Date.now(),
        durationMs: elapsed,
        level,
        score,
        metrics,
        xpEarned: Math.round(score * 0.5 + 10),
      };
    },

    destroy(): void {
      started = false;
      paused = false;
      awaitingResponse = false;
      clearStimulus();
      disposables.dispose();
      if (container) {
        container.innerHTML = '';
        container = null;
      }
    },
  };

  return exercise;
}
