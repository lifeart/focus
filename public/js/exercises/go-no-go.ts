import type { Exercise, ExerciseResult, ExerciseMetrics, DifficultyParams, SoundManager, Disposables } from '../types.js';
import { el } from '../ui/renderer.js';
import { createDisposables } from '../core/disposables.js';
import { createExerciseTimer, jitteredInterval, showFeedback, formatTime, calculateCV, calculateLapseRate } from './helpers.js';
import { t } from '../core/i18n.js';

const DURATION_MS = 180_000; // 3 minutes
const GO_COLORS = ['#4ecdc4', '#45b7d1', '#96ceb4', '#ffd93d'];
const NOGO_COLOR = '#ff6b6b';
const GRACE_PERIOD_MS = 200;

interface TrialRecord {
  isGo: boolean;
  responded: boolean;
  correct: boolean;
  rt: number | null; // reaction time in ms, null if no response
}

export function createGoNoGo(level: number, params: DifficultyParams, sound: SoundManager): Exercise {
  const disposables = createDisposables();
  const timer = createExerciseTimer(DURATION_MS, disposables);

  const isiMin = params.isiMin ?? 1200;
  const isiMax = params.isiMax ?? 1800;
  const noGoRatio = params.noGoRatio ?? 0.20;
  const stimulusDuration = params.stimulusDuration ?? 500;

  const trials: TrialRecord[] = [];
  let container: HTMLElement | null = null;
  let stimulusArea: HTMLElement | null = null;
  let timerDisplay: HTMLElement | null = null;
  let trialCounter: HTMLElement | null = null;
  let currentShape: HTMLElement | null = null;

  let paused = false;
  let started = false;
  let currentTrialIsGo = true;
  let stimulusShownAt = 0;
  let awaitingResponse = false;
  let stimulusTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let isiTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let trialIndex = 0;

  // Estimated total trials for display
  const avgIsi = (isiMin + isiMax) / 2;
  const estimatedTrials = Math.round(DURATION_MS / (stimulusDuration + avgIsi));

  function randomGoColor(): string {
    return GO_COLORS[Math.floor(Math.random() * GO_COLORS.length)];
  }

  function isGoTrial(): boolean {
    return Math.random() >= noGoRatio;
  }

  function createShape(go: boolean): HTMLElement {
    const size = 100;
    const shape = el('div');
    shape.style.width = `${size}px`;
    shape.style.height = `${size}px`;
    shape.style.margin = '0 auto';
    shape.style.transition = 'transform 0.1s ease';

    if (go) {
      shape.style.borderRadius = '50%';
      shape.style.backgroundColor = randomGoColor();
    } else {
      shape.style.borderRadius = '0';
      shape.style.backgroundColor = NOGO_COLOR;
    }

    return shape;
  }

  function updateTrialCounter(): void {
    if (trialCounter) {
      trialCounter.textContent = t('trial.counter', { current: trialIndex, total: estimatedTrials });
    }
  }

  function handleResponse(): void {
    if (!started || paused || !awaitingResponse) return;

    const rt = Date.now() - stimulusShownAt;
    awaitingResponse = false;

    if (currentTrialIsGo) {
      // Correct: responded to Go stimulus
      trials[trials.length - 1].responded = true;
      trials[trials.length - 1].correct = true;
      trials[trials.length - 1].rt = rt;
      sound.playCorrect();
      if (container) showFeedback(container, true, disposables);
    } else {
      // Commission error: responded to No-Go stimulus
      trials[trials.length - 1].responded = true;
      trials[trials.length - 1].correct = false;
      trials[trials.length - 1].rt = rt;
      sound.playIncorrect();
      if (container) showFeedback(container, false, disposables);
    }

    // Remove stimulus immediately on response
    removeStimulus();
    // Cancel the stimulus timeout since we already handled it
    if (stimulusTimeoutId !== null) {
      clearTimeout(stimulusTimeoutId);
      stimulusTimeoutId = null;
    }
    // Schedule next trial after ISI
    scheduleNextTrial();
  }

  function removeStimulus(): void {
    if (currentShape && stimulusArea) {
      currentShape.remove();
      currentShape = null;
    }
  }

  function showStimulus(): void {
    if (!started || paused || !stimulusArea) return;

    trialIndex++;
    currentTrialIsGo = isGoTrial();

    const trial: TrialRecord = {
      isGo: currentTrialIsGo,
      responded: false,
      correct: false,
      rt: null,
    };
    trials.push(trial);

    currentShape = createShape(currentTrialIsGo);
    stimulusArea.appendChild(currentShape);
    stimulusShownAt = Date.now();
    awaitingResponse = true;

    updateTrialCounter();

    // Stimulus disappears after stimulusDuration + grace period for Go, stimulusDuration for No-Go
    const displayTime = currentTrialIsGo
      ? stimulusDuration + GRACE_PERIOD_MS
      : stimulusDuration;

    stimulusTimeoutId = disposables.setTimeout(() => {
      stimulusTimeoutId = null;
      onStimulusEnd();
    }, displayTime);
  }

  function onStimulusEnd(): void {
    if (!started || paused) return;

    const trial = trials[trials.length - 1];
    if (!trial.responded) {
      if (trial.isGo) {
        // Omission error: didn't respond to Go
        trial.correct = false;
        sound.playIncorrect();
        if (container) showFeedback(container, false, disposables);
      } else {
        // Correct rejection: didn't respond to No-Go
        trial.correct = true;
        sound.playCorrect();
        if (container) showFeedback(container, true, disposables);
      }
    }

    awaitingResponse = false;
    removeStimulus();
    scheduleNextTrial();
  }

  function scheduleNextTrial(): void {
    if (!started || paused) return;

    // Check if time is up
    if (timer.getElapsed() >= DURATION_MS) {
      return;
    }

    const isi = jitteredInterval(isiMin, isiMax);
    isiTimeoutId = disposables.setTimeout(() => {
      isiTimeoutId = null;
      if (started && !paused) {
        showStimulus();
      }
    }, isi);
  }

  function onKeyDown(e: Event): void {
    const ke = e as KeyboardEvent;
    if (ke.code === 'Space' || ke.key === ' ') {
      ke.preventDefault();
      handleResponse();
    }
  }

  function onClick(): void {
    handleResponse();
  }

  function computeMetrics(): ExerciseMetrics {
    const totalTrials = trials.length;
    const correctTrials = trials.filter(t => t.correct).length;
    const accuracy = totalTrials > 0 ? correctTrials / totalTrials : 0;

    const commissionErrors = trials.filter(t => !t.isGo && t.responded).length;
    const omissionErrors = trials.filter(t => t.isGo && !t.responded).length;

    const correctGoRTs = trials
      .filter(t => t.isGo && t.correct && t.rt !== null)
      .map(t => t.rt as number);

    const meanRT = correctGoRTs.length > 0
      ? correctGoRTs.reduce((a, b) => a + b, 0) / correctGoRTs.length
      : 0;

    const rtVariability = calculateCV(correctGoRTs);

    const totalNoGoTrials = trials.filter(t => !t.isGo).length;
    const commissionRate = totalNoGoTrials > 0 ? commissionErrors / totalNoGoTrials : 0;
    const lapseRate = calculateLapseRate(correctGoRTs);

    return {
      accuracy,
      totalTrials,
      correctTrials,
      commissionErrors,
      omissionErrors,
      meanRT: Math.round(meanRT),
      rtVariability: Math.round(rtVariability * 1000) / 1000,
      lapseRate: Math.round(lapseRate * 1000) / 1000,
    };
  }

  function computeScore(metrics: ExerciseMetrics): number {
    const cv = metrics.rtVariability ?? 0;
    const totalNoGoTrials = trials.filter(t => !t.isGo).length;
    const commissionRate = totalNoGoTrials > 0 ? (metrics.commissionErrors ?? 0) / totalNoGoTrials : 0;
    // 50% inhibition control, 30% overall accuracy, 20% response stability
    const inhibitionScore = (1 - commissionRate) * 50;
    const accuracyScore = metrics.accuracy * 30;
    const stabilityScore = (1 - cv) * 20;
    const score = inhibitionScore + accuracyScore + stabilityScore;
    return Math.round(Math.max(0, Math.min(100, score)));
  }

  const exercise: Exercise = {
    id: 'go-no-go',

    setup(cont: HTMLElement): void {
      container = cont;
      container.setAttribute('data-exercise', 'go-no-go');

      timerDisplay = el('div', { className: 'exercise-timer' });
      timerDisplay.textContent = formatTime(DURATION_MS);

      trialCounter = el('div', { className: 'exercise-trial-counter' });
      trialCounter.textContent = t('trial.counter', { current: 0, total: estimatedTrials });

      const header = el('div', { className: 'exercise-header' }, [timerDisplay, trialCounter]);

      stimulusArea = el('div', { className: 'exercise-stimulus-area' });
      stimulusArea.style.display = 'flex';
      stimulusArea.style.alignItems = 'center';
      stimulusArea.style.justifyContent = 'center';
      stimulusArea.style.minHeight = '200px';
      stimulusArea.style.cursor = 'pointer';
      stimulusArea.style.userSelect = 'none';

      container.appendChild(header);
      container.appendChild(stimulusArea);

      // Register input handlers
      disposables.addListener(document, 'keydown', onKeyDown);
      disposables.addListener(stimulusArea, 'click', onClick);
      disposables.addListener(stimulusArea, 'touchstart', onClick);

      // Timer tick updates
      timer.onTick((remaining) => {
        if (timerDisplay) {
          timerDisplay.textContent = formatTime(remaining);
        }
        if (remaining <= 0 && started) {
          started = false;
          awaitingResponse = false;
          removeStimulus();
        }
      });
    },

    start(): void {
      started = true;
      paused = false;
      timer.start();
      // Show first stimulus after a short ISI
      scheduleNextTrial();
    },

    pause(): void {
      if (!started || paused) return;
      paused = true;
      timer.pause();
      awaitingResponse = false;
      removeStimulus();
      // Cancel pending timeouts by clearing them
      if (stimulusTimeoutId !== null) {
        clearTimeout(stimulusTimeoutId);
        stimulusTimeoutId = null;
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
      // Resume by scheduling the next trial
      scheduleNextTrial();
    },

    stop(): ExerciseResult {
      const elapsed = timer.stop();
      started = false;
      awaitingResponse = false;
      removeStimulus();

      const metrics = computeMetrics();
      const score = computeScore(metrics);

      return {
        exerciseId: 'go-no-go',
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
      removeStimulus();
      disposables.dispose();
      if (container) {
        container.innerHTML = '';
        container = null;
      }
    },
  };

  return exercise;
}
