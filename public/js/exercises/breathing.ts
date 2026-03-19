import type { Exercise, ExerciseResult, ExerciseMetrics, DifficultyParams, SoundManager } from '../types.js';
import { el } from '../ui/renderer.js';
import { createDisposables } from '../core/disposables.js';
import { createExerciseTimer, formatTime } from './helpers.js';
import { BREATHING_PATTERNS } from '../constants.js';
import { t } from '../core/i18n.js';

type BreathingPhase = 'inhale' | 'hold' | 'exhale';

const PHASE_KEYS: Record<BreathingPhase, 'breathing.inhale' | 'breathing.hold' | 'breathing.exhale'> = {
  inhale: 'breathing.inhale',
  hold: 'breathing.hold',
  exhale: 'breathing.exhale',
};

const SCALE_MIN = 0.6;
const SCALE_MAX = 1.4;

/** Smoothstep easing: t * t * (3 - 2 * t) */
function smoothstep(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * clamped * (3 - 2 * clamped);
}

export function createBreathing(
  level: number,
  params: DifficultyParams,
  sound: SoundManager,
  pattern?: '4-4-4' | '4-7-8',
  durationMinutes?: number,
): Exercise {
  const disposables = createDisposables();

  const selectedPattern = pattern ?? '4-4-4';
  const patternConfig = BREATHING_PATTERNS[selectedPattern];
  const inhaleDuration = patternConfig.inhale * 1000;
  const holdDuration = patternConfig.hold * 1000;
  const exhaleDuration = patternConfig.exhale * 1000;
  const cycleDuration = inhaleDuration + holdDuration + exhaleDuration;

  const totalDurationMs = (durationMinutes ?? 2) * 60 * 1000;
  const timer = createExerciseTimer(totalDurationMs, disposables);

  let container: HTMLElement | null = null;
  let circle: HTMLElement | null = null;
  let phaseLabel: HTMLElement | null = null;
  let timerDisplay: HTMLElement | null = null;
  let cycleCounter: HTMLElement | null = null;

  let started = false;
  let paused = false;
  let rafId: number | null = null;

  // Animation state
  let cycleStartTime = 0;
  let completedCycles = 0;
  let currentPhase: BreathingPhase = 'inhale';
  let lastPhase: BreathingPhase | null = null;

  function getPhaseAndProgress(elapsedInCycle: number): { phase: BreathingPhase; progress: number } {
    if (elapsedInCycle < inhaleDuration) {
      return { phase: 'inhale', progress: elapsedInCycle / inhaleDuration };
    } else if (elapsedInCycle < inhaleDuration + holdDuration) {
      return { phase: 'hold', progress: (elapsedInCycle - inhaleDuration) / holdDuration };
    } else {
      return { phase: 'exhale', progress: (elapsedInCycle - inhaleDuration - holdDuration) / exhaleDuration };
    }
  }

  function getScale(phase: BreathingPhase, progress: number): number {
    const eased = smoothstep(progress);
    switch (phase) {
      case 'inhale':
        return SCALE_MIN + (SCALE_MAX - SCALE_MIN) * eased;
      case 'hold':
        return SCALE_MAX;
      case 'exhale':
        return SCALE_MAX - (SCALE_MAX - SCALE_MIN) * eased;
    }
  }

  function getGlowIntensity(phase: BreathingPhase, progress: number): number {
    switch (phase) {
      case 'inhale':
        return smoothstep(progress);
      case 'hold':
        return 1;
      case 'exhale':
        return 1 - smoothstep(progress);
    }
  }

  function animationLoop(): void {
    if (!started || paused) return;

    const elapsed = timer.getElapsed();
    const elapsedSinceCycleStart = elapsed - cycleStartTime;
    const elapsedInCycle = elapsedSinceCycleStart % cycleDuration;

    // Check if a new cycle started
    const cycleIndex = Math.floor(elapsedSinceCycleStart / cycleDuration);
    if (cycleIndex > completedCycles) {
      completedCycles = cycleIndex;
      if (cycleCounter) {
        cycleCounter.textContent = t('breathing.cycle', { n: completedCycles + 1 });
      }
    }

    const { phase, progress } = getPhaseAndProgress(elapsedInCycle);
    currentPhase = phase;

    // Play tick on phase change
    if (lastPhase !== null && lastPhase !== phase) {
      sound.playTick();
    }
    lastPhase = phase;

    // Update phase label
    if (phaseLabel) {
      phaseLabel.textContent = t(PHASE_KEYS[phase]);
    }

    // Update circle
    if (circle) {
      const scale = getScale(phase, progress);
      const glow = getGlowIntensity(phase, progress);
      const glowSize = 20 + glow * 30;
      const glowOpacity = 0.3 + glow * 0.4;

      circle.style.transform = `scale(${scale})`;
      circle.style.boxShadow = `0 0 ${glowSize}px ${glowSize / 2}px rgba(108, 92, 231, ${glowOpacity})`;
    }

    rafId = disposables.requestAnimationFrame(animationLoop);
  }

  function startAnimation(): void {
    cycleStartTime = 0;
    completedCycles = 0;
    lastPhase = null;
    rafId = disposables.requestAnimationFrame(animationLoop);
  }

  function stopAnimation(): void {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  const exercise: Exercise = {
    id: 'breathing',

    setup(cont: HTMLElement): void {
      container = cont;
      container.setAttribute('data-exercise', 'breathing');

      // Timer display
      timerDisplay = el('div', { className: 'exercise-timer' });
      timerDisplay.textContent = formatTime(totalDurationMs);

      // Pattern info
      const patternKey = selectedPattern === '4-4-4' ? 'breathing.pattern.444' : 'breathing.pattern.478';
      const patternInfo = el('div', { className: 'exercise-trial-counter' });
      patternInfo.textContent = t(patternKey as any);

      const header = el('div', { className: 'exercise-header' }, [timerDisplay, patternInfo]);

      // Phase label
      phaseLabel = el('div', { className: 'breathing-phase-label' });
      phaseLabel.textContent = t('breathing.inhale');
      phaseLabel.style.textAlign = 'center';
      phaseLabel.style.fontSize = '1.5rem';
      phaseLabel.style.fontWeight = '600';
      phaseLabel.style.marginBottom = '2rem';
      phaseLabel.style.color = 'var(--text-primary, #fff)';
      phaseLabel.style.letterSpacing = '0.05em';
      phaseLabel.style.textTransform = 'uppercase';

      // Breathing circle container
      const circleContainer = el('div', { className: 'breathing-circle-container' });
      circleContainer.style.display = 'flex';
      circleContainer.style.alignItems = 'center';
      circleContainer.style.justifyContent = 'center';
      circleContainer.style.minHeight = '250px';

      // Breathing circle
      circle = el('div', { className: 'breathing-circle' });
      circle.style.width = '150px';
      circle.style.height = '150px';
      circle.style.borderRadius = '50%';
      circle.style.background = 'linear-gradient(135deg, #6C5CE7 0%, #a29bfe 50%, #6C5CE7 100%)';
      circle.style.transform = `scale(${SCALE_MIN})`;
      circle.style.boxShadow = '0 0 20px 10px rgba(108, 92, 231, 0.3)';
      circle.style.transition = 'none'; // RAF handles animation, not CSS transitions

      circleContainer.appendChild(circle);

      // Cycle counter
      cycleCounter = el('div', { className: 'breathing-cycle-counter' });
      cycleCounter.textContent = t('breathing.cycle', { n: 1 });
      cycleCounter.style.textAlign = 'center';
      cycleCounter.style.marginTop = '2rem';
      cycleCounter.style.fontSize = '0.9rem';
      cycleCounter.style.color = 'var(--text-secondary, #aaa)';

      container.appendChild(header);
      container.appendChild(phaseLabel);
      container.appendChild(circleContainer);
      container.appendChild(cycleCounter);

      // Timer tick updates
      timer.onTick((remaining) => {
        if (timerDisplay) {
          timerDisplay.textContent = formatTime(remaining);
        }
        if (remaining <= 0 && started) {
          started = false;
          stopAnimation();
        }
      });
    },

    start(): void {
      started = true;
      paused = false;
      timer.start();
      startAnimation();
    },

    pause(): void {
      if (!started || paused) return;
      paused = true;
      timer.pause();
      stopAnimation();
    },

    resume(): void {
      if (!started || !paused) return;
      paused = false;
      timer.resume();
      rafId = disposables.requestAnimationFrame(animationLoop);
    },

    stop(): ExerciseResult {
      const elapsed = timer.stop();
      started = false;
      stopAnimation();

      // Count completed cycles based on elapsed time
      const totalCyclesCompleted = Math.floor(elapsed / cycleDuration);
      const completionRatio = Math.min(1, elapsed / totalDurationMs);
      const score = Math.round(completionRatio * 100);

      const metrics: ExerciseMetrics = {
        accuracy: 1.0,
        totalTrials: totalCyclesCompleted,
        correctTrials: totalCyclesCompleted,
      };

      return {
        exerciseId: 'breathing',
        timestamp: Date.now(),
        durationMs: elapsed,
        level,
        score,
        metrics,
        xpEarned: Math.round(score * 0.3 + 10),
      };
    },

    destroy(): void {
      started = false;
      paused = false;
      stopAnimation();
      disposables.dispose();
      if (container) {
        container.innerHTML = '';
        container = null;
      }
    },
  };

  return exercise;
}
