import type { Exercise, ExerciseResult, ExerciseMetrics, DifficultyParams, SoundManager } from '../types.js';
import { el } from '../ui/renderer.js';
import { createDisposables } from '../core/disposables.js';
import { createExerciseTimer, jitteredInterval, showFeedback, formatTime, calculateCV, calculateLapseRate, MIN_RT_MS } from './helpers.js';
import { t } from '../core/i18n.js';

const DURATION_MS = 180_000; // 3 minutes

type Direction = 'left' | 'right';
type TrialType = 'congruent' | 'incongruent' | 'neutral';

interface TrialRecord {
  trialType: TrialType;
  congruent: boolean; // kept for backward compat
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

  const NEUTRAL_RATIO = 0.20;

  function pickTrialType(): TrialType {
    const r = Math.random();
    if (r < NEUTRAL_RATIO) return 'neutral';
    // Remaining 80% split by congruentRatio
    const adjustedThreshold = NEUTRAL_RATIO + (1 - NEUTRAL_RATIO) * congruentRatio;
    return r < adjustedThreshold ? 'congruent' : 'incongruent';
  }

  function randomDirection(): Direction {
    return Math.random() < 0.5 ? 'left' : 'right';
  }

  function createArrowSpan(direction: Direction, isCenter: boolean): HTMLElement {
    const span = el('span', {
      className: isCenter ? 'flanker-arrow flanker-arrow--target' : 'flanker-arrow',
    });
    span.textContent = direction === 'left' ? '\u25C0' : '\u25B6';
    return span;
  }

  function createNeutralSpan(): HTMLElement {
    const span = el('span', { className: 'flanker-arrow flanker-arrow--neutral' });
    span.textContent = '\u2014'; // em dash
    return span;
  }

  function showStimulus(): void {
    if (!started || paused || !stimulusArea) return;

    trialIndex++;
    const trialType = pickTrialType();
    const centerDir = randomDirection();
    const congruent = trialType === 'congruent';

    const trial: TrialRecord = {
      trialType,
      congruent,
      centerDirection: centerDir,
      responded: false,
      correct: false,
      rt: null,
    };
    trials.push(trial);

    // Clear stimulus area
    stimulusArea.innerHTML = '';

    // Build row of 5 items: flanker flanker CENTER flanker flanker
    const row = el('div', { className: 'flanker-row' });

    if (trialType === 'neutral') {
      // Neutral: flankers are dashes, center is still an arrow
      row.appendChild(createNeutralSpan());
      row.appendChild(createNeutralSpan());
      row.appendChild(createArrowSpan(centerDir, true));
      row.appendChild(createNeutralSpan());
      row.appendChild(createNeutralSpan());
      row.setAttribute('aria-label', `Neutral trial - center arrow points ${centerDir}`);
    } else {
      const flankerDir: Direction = congruent ? centerDir : (centerDir === 'left' ? 'right' : 'left');
      row.appendChild(createArrowSpan(flankerDir, false));
      row.appendChild(createArrowSpan(flankerDir, false));
      row.appendChild(createArrowSpan(centerDir, true));
      row.appendChild(createArrowSpan(flankerDir, false));
      row.appendChild(createArrowSpan(flankerDir, false));
      row.setAttribute('aria-label', `${trialType} trial - center arrow points ${centerDir}, flankers point ${flankerDir}`);
    }

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

    // Ignore anticipatory responses (too fast to be genuine)
    if (rt < MIN_RT_MS) return;

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
      trialCounter.textContent = t('trial.counter', { current: trialIndex, total: estimatedTrials });
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
      .filter(t => t.trialType === 'congruent' && t.correct && t.rt !== null)
      .map(t => t.rt as number);

    const correctIncongruentRTs = trials
      .filter(t => t.trialType === 'incongruent' && t.correct && t.rt !== null)
      .map(t => t.rt as number);

    const correctNeutralRTs = trials
      .filter(t => t.trialType === 'neutral' && t.correct && t.rt !== null)
      .map(t => t.rt as number);

    const rtCongruent = correctCongruentRTs.length > 0
      ? correctCongruentRTs.reduce((a, b) => a + b, 0) / correctCongruentRTs.length
      : 0;

    const rtIncongruent = correctIncongruentRTs.length > 0
      ? correctIncongruentRTs.reduce((a, b) => a + b, 0) / correctIncongruentRTs.length
      : 0;

    const rtNeutral = correctNeutralRTs.length > 0
      ? correctNeutralRTs.reduce((a, b) => a + b, 0) / correctNeutralRTs.length
      : 0;

    const interferenceScore = (rtCongruent > 0 && rtIncongruent > 0)
      ? rtIncongruent - rtCongruent
      : 0;

    const facilitationScore = (rtNeutral > 0 && rtCongruent > 0)
      ? rtNeutral - rtCongruent
      : 0;

    const inhibitionCost = (rtIncongruent > 0 && rtNeutral > 0)
      ? rtIncongruent - rtNeutral
      : 0;

    // IIV: CV across all correct RTs
    const allCorrectRTs = trials
      .filter(t => t.correct && t.rt !== null)
      .map(t => t.rt as number);
    const rtVariability = calculateCV(allCorrectRTs);
    const lapseRate = calculateLapseRate(allCorrectRTs);

    return {
      accuracy,
      totalTrials,
      correctTrials,
      rtCongruent: Math.round(rtCongruent),
      rtIncongruent: Math.round(rtIncongruent),
      rtNeutral: Math.round(rtNeutral),
      interferenceScore: Math.round(interferenceScore),
      facilitationScore: Math.round(facilitationScore),
      inhibitionCost: Math.round(inhibitionCost),
      rtVariability: Math.round(rtVariability * 1000) / 1000,
      lapseRate: Math.round(lapseRate * 1000) / 1000,
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
      trialCounter.textContent = t('trial.counter', { current: 0, total: estimatedTrials });

      const header = el('div', { className: 'exercise-header' }, [timerDisplay, trialCounter]);

      stimulusArea = el('div', { className: 'exercise-stimulus-area' });

      // On-screen response buttons for mobile
      const btnLeft = el('button', { className: 'flanker-btn flanker-btn--left' });
      btnLeft.textContent = '\u25C0';

      const btnRight = el('button', { className: 'flanker-btn flanker-btn--right' });
      btnRight.textContent = '\u25B6';

      const buttonRow = el('div', { className: 'flanker-buttons' }, [btnLeft, btnRight]);

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
