import type { Exercise, ExerciseResult, ExerciseMetrics, DifficultyParams, SoundManager } from '../types.js';
import { el } from '../ui/renderer.js';
import { createDisposables } from '../core/disposables.js';
import { formatTime } from './helpers.js';
import { t } from '../core/i18n.js';

type PomodoroState = 'focus' | 'break' | 'done';

const BREAK_DURATION_MS = 5 * 60 * 1000;
const SVG_NS = 'http://www.w3.org/2000/svg';
const RADIUS = 90;
const STROKE_WIDTH = 8;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const VIEW_SIZE = (RADIUS + STROKE_WIDTH) * 2;
const CENTER = VIEW_SIZE / 2;

function requestNotificationPermission(): void {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function sendNotification(body: string): void {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Focus', { body });
  }
}

function randomQuote(): string {
  const quoteIndex = Math.floor(Math.random() * 13);
  return t(`quote.${quoteIndex}` as any);
}

function createProgressRing(): { svg: SVGSVGElement; circle: SVGCircleElement } {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', String(VIEW_SIZE));
  svg.setAttribute('height', String(VIEW_SIZE));
  svg.setAttribute('viewBox', `0 0 ${VIEW_SIZE} ${VIEW_SIZE}`);
  svg.style.display = 'block';
  svg.style.margin = '0 auto';

  // Background track
  const bgCircle = document.createElementNS(SVG_NS, 'circle');
  bgCircle.setAttribute('cx', String(CENTER));
  bgCircle.setAttribute('cy', String(CENTER));
  bgCircle.setAttribute('r', String(RADIUS));
  bgCircle.setAttribute('fill', 'none');
  bgCircle.setAttribute('stroke', 'var(--surface-elevated, #2a2a2a)');
  bgCircle.setAttribute('stroke-width', String(STROKE_WIDTH));
  svg.appendChild(bgCircle);

  // Progress circle
  const circle = document.createElementNS(SVG_NS, 'circle');
  circle.setAttribute('cx', String(CENTER));
  circle.setAttribute('cy', String(CENTER));
  circle.setAttribute('r', String(RADIUS));
  circle.setAttribute('fill', 'none');
  circle.setAttribute('stroke', 'var(--primary, #6C5CE7)');
  circle.setAttribute('stroke-width', String(STROKE_WIDTH));
  circle.setAttribute('stroke-linecap', 'round');
  circle.setAttribute('stroke-dasharray', String(CIRCUMFERENCE));
  circle.setAttribute('stroke-dashoffset', '0');
  circle.style.transform = 'rotate(-90deg)';
  circle.style.transformOrigin = '50% 50%';
  circle.style.transition = 'stroke 0.3s ease';
  svg.appendChild(circle);

  return { svg, circle };
}

export function createPomodoro(
  level: number,
  params: DifficultyParams,
  sound: SoundManager,
  durationMinutes?: number,
): Exercise {
  const disposables = createDisposables();

  const validDurations = [15, 20, 25];
  const focusMinutes = durationMinutes && validDurations.includes(durationMinutes) ? durationMinutes : 15;
  const focusDurationMs = focusMinutes * 60 * 1000;

  let container: HTMLElement | null = null;
  let timerText: HTMLElement | null = null;
  let stateLabel: HTMLElement | null = null;
  let quoteEl: HTMLElement | null = null;
  let progressCircle: SVGCircleElement | null = null;
  let startPauseBtn: HTMLElement | null = null;
  let resetBtn: HTMLElement | null = null;

  let state: PomodoroState = 'focus';
  let started = false;
  let paused = false;

  // Drift-corrected timing
  let phaseStartTime = 0;
  let totalPausedMs = 0;
  let pauseStartTime = 0;
  let tickInterval: ReturnType<typeof setInterval> | null = null;

  // Track total elapsed for scoring
  let focusElapsedMs = 0;
  let exerciseStartTime = 0;

  function getCurrentPhaseDuration(): number {
    return state === 'focus' ? focusDurationMs : BREAK_DURATION_MS;
  }

  function getElapsedInPhase(): number {
    if (!started) return 0;
    if (paused) return pauseStartTime - phaseStartTime - totalPausedMs;
    return Date.now() - phaseStartTime - totalPausedMs;
  }

  function getRemainingInPhase(): number {
    return Math.max(0, getCurrentPhaseDuration() - getElapsedInPhase());
  }

  function updateDisplay(): void {
    if (!started || state === 'done') return;

    const remaining = getRemainingInPhase();
    const duration = getCurrentPhaseDuration();
    const elapsed = getElapsedInPhase();
    const progress = Math.min(1, elapsed / duration);

    // Update timer text
    if (timerText) {
      timerText.textContent = formatTime(remaining);
    }

    // Update progress ring
    if (progressCircle) {
      const offset = CIRCUMFERENCE * (1 - progress);
      progressCircle.setAttribute('stroke-dashoffset', String(offset));
    }

    // Check if phase completed
    if (remaining <= 0) {
      onPhaseComplete();
    }
  }

  function onPhaseComplete(): void {
    if (state === 'focus') {
      focusElapsedMs = focusDurationMs;
      sound.playEnd();
      sendNotification(t('pomodoro.notification.break'));
      transitionToBreak();
    } else if (state === 'break') {
      sendNotification(t('pomodoro.notification.breakOver'));
      transitionToDone();
    }
  }

  function transitionToBreak(): void {
    state = 'break';
    phaseStartTime = Date.now();
    totalPausedMs = 0;

    if (stateLabel) {
      stateLabel.textContent = t('pomodoro.break');
    }

    if (progressCircle) {
      progressCircle.setAttribute('stroke', 'var(--success, #00b894)');
      progressCircle.setAttribute('stroke-dashoffset', '0');
    }

    if (quoteEl) {
      quoteEl.textContent = randomQuote();
      quoteEl.style.display = 'block';
    }

    if (timerText) {
      timerText.textContent = formatTime(BREAK_DURATION_MS);
    }
  }

  function transitionToDone(): void {
    state = 'done';
    stopTicking();

    if (stateLabel) {
      stateLabel.textContent = t('pomodoro.done');
    }

    if (timerText) {
      timerText.textContent = '0:00';
    }

    if (progressCircle) {
      progressCircle.setAttribute('stroke-dashoffset', '0');
    }

    if (startPauseBtn) {
      startPauseBtn.style.display = 'none';
    }
  }

  function startTicking(): void {
    if (tickInterval) clearInterval(tickInterval);
    tickInterval = disposables.setInterval(() => {
      if (started && !paused) {
        updateDisplay();
      }
    }, 100);
  }

  function stopTicking(): void {
    if (tickInterval) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
  }

  function resetExercise(): void {
    stopTicking();
    state = 'focus';
    started = false;
    paused = false;
    phaseStartTime = 0;
    totalPausedMs = 0;
    pauseStartTime = 0;
    focusElapsedMs = 0;

    if (timerText) {
      timerText.textContent = formatTime(focusDurationMs);
    }

    if (stateLabel) {
      stateLabel.textContent = t('pomodoro.focus');
    }

    if (progressCircle) {
      progressCircle.setAttribute('stroke', 'var(--primary, #6C5CE7)');
      progressCircle.setAttribute('stroke-dashoffset', '0');
    }

    if (quoteEl) {
      quoteEl.style.display = 'none';
      quoteEl.textContent = '';
    }

    if (startPauseBtn) {
      startPauseBtn.textContent = t('pomodoro.focus');
      startPauseBtn.style.display = '';
    }
  }

  function toggleStartPause(): void {
    if (!started) {
      // First start
      exercise.start();
    } else if (paused) {
      exercise.resume();
    } else {
      exercise.pause();
    }
    updateButtonLabel();
  }

  function updateButtonLabel(): void {
    if (!startPauseBtn) return;
    if (!started) {
      startPauseBtn.textContent = t('pomodoro.focus');
    } else if (paused) {
      startPauseBtn.textContent = t('pomodoro.continueBtn');
    } else {
      startPauseBtn.textContent = t('pomodoro.pauseBtn');
    }
  }

  const exercise: Exercise = {
    id: 'pomodoro',

    setup(cont: HTMLElement): void {
      container = cont;
      container.setAttribute('data-exercise', 'pomodoro');

      // State label
      stateLabel = el('div', { className: 'exercise-timer' });
      stateLabel.textContent = t('pomodoro.focus');
      stateLabel.style.textAlign = 'center';
      stateLabel.style.fontSize = '1.2rem';
      stateLabel.style.fontWeight = '600';
      stateLabel.style.textTransform = 'uppercase';
      stateLabel.style.letterSpacing = '0.05em';
      stateLabel.style.marginBottom = '1.5rem';
      stateLabel.style.color = 'var(--text-primary, #fff)';

      // SVG progress ring container
      const ringContainer = el('div', { className: 'pomodoro-ring-container' });
      ringContainer.style.position = 'relative';
      ringContainer.style.display = 'flex';
      ringContainer.style.alignItems = 'center';
      ringContainer.style.justifyContent = 'center';
      ringContainer.style.minHeight = `${VIEW_SIZE}px`;

      const { svg, circle } = createProgressRing();
      progressCircle = circle;
      ringContainer.appendChild(svg);

      // Timer text overlaid in center of ring
      timerText = el('div', { className: 'pomodoro-timer-text' });
      timerText.textContent = formatTime(focusDurationMs);
      timerText.style.position = 'absolute';
      timerText.style.top = '50%';
      timerText.style.left = '50%';
      timerText.style.transform = 'translate(-50%, -50%)';
      timerText.style.fontSize = '2.5rem';
      timerText.style.fontWeight = '700';
      timerText.style.fontVariantNumeric = 'tabular-nums';
      timerText.style.color = 'var(--text-primary, #fff)';
      ringContainer.appendChild(timerText);

      // Quote element (shown during break)
      quoteEl = el('div', { className: 'pomodoro-quote' });
      quoteEl.style.display = 'none';
      quoteEl.style.textAlign = 'center';
      quoteEl.style.marginTop = '1.5rem';
      quoteEl.style.padding = '0 1rem';
      quoteEl.style.fontSize = '1rem';
      quoteEl.style.fontStyle = 'italic';
      quoteEl.style.color = 'var(--text-secondary, #aaa)';
      quoteEl.style.lineHeight = '1.5';

      // Controls
      startPauseBtn = el('button', { className: 'btn btn--primary' });
      startPauseBtn.textContent = t('pomodoro.focus');
      disposables.addListener(startPauseBtn, 'click', toggleStartPause);

      resetBtn = el('button', { className: 'btn btn--secondary' });
      resetBtn.textContent = t('pomodoro.resetBtn');
      disposables.addListener(resetBtn, 'click', resetExercise);

      const controls = el('div', { className: 'pomodoro-controls' });
      controls.style.display = 'flex';
      controls.style.gap = '1rem';
      controls.style.justifyContent = 'center';
      controls.style.marginTop = '1.5rem';
      controls.appendChild(startPauseBtn);
      controls.appendChild(resetBtn);

      container.appendChild(stateLabel);
      container.appendChild(ringContainer);
      container.appendChild(quoteEl);
      container.appendChild(controls);
    },

    start(): void {
      if (started) return;
      started = true;
      paused = false;
      state = 'focus';
      exerciseStartTime = Date.now();
      phaseStartTime = Date.now();
      totalPausedMs = 0;
      focusElapsedMs = 0;

      requestNotificationPermission();
      startTicking();
      updateDisplay();
      updateButtonLabel();
    },

    pause(): void {
      if (!started || paused || state === 'done') return;
      paused = true;
      pauseStartTime = Date.now();
      updateButtonLabel();
    },

    resume(): void {
      if (!started || !paused || state === 'done') return;
      totalPausedMs += Date.now() - pauseStartTime;
      paused = false;
      updateButtonLabel();
    },

    stop(): ExerciseResult {
      // Capture focus time before stopping
      if (state === 'focus' && started) {
        focusElapsedMs = getElapsedInPhase();
      }

      const totalElapsed = started ? Date.now() - exerciseStartTime : 0;
      stopTicking();
      started = false;

      const completionRatio = Math.min(1, focusElapsedMs / focusDurationMs);
      const score = Math.round(completionRatio * 100);
      const completed = state === 'done' || completionRatio >= 1;

      const metrics: ExerciseMetrics = {
        accuracy: 1.0,
        totalTrials: 1,
        correctTrials: completed ? 1 : 0,
      };

      return {
        exerciseId: 'pomodoro',
        timestamp: Date.now(),
        durationMs: totalElapsed,
        level,
        score,
        metrics,
        xpEarned: Math.round(score * 0.3 + 10),
      };
    },

    destroy(): void {
      started = false;
      paused = false;
      stopTicking();
      disposables.dispose();
      if (container) {
        container.innerHTML = '';
        container = null;
      }
    },
  };

  return exercise;
}
