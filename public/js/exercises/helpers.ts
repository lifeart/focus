import type { Disposables } from '../types.js';
import { el } from '../ui/renderer.js';
import { t } from '../core/i18n.js';

// Drift-corrected exercise timer
export interface ExerciseTimer {
  start(): void;
  pause(): void;
  resume(): void;
  stop(): number; // returns elapsed ms
  getElapsed(): number;
  onTick(callback: (remaining: number, elapsed: number) => void): void;
  isRunning(): boolean;
}

export function createExerciseTimer(durationMs: number, disposables: Disposables): ExerciseTimer {
  let startTime = 0;
  let pauseTime = 0;
  let totalPaused = 0;
  let running = false;
  let paused = false;
  let tickCallback: ((remaining: number, elapsed: number) => void) | null = null;
  let tickInterval: ReturnType<typeof setInterval> | null = null;

  function getElapsed(): number {
    if (!running) return 0;
    if (paused) return pauseTime - startTime - totalPaused;
    return Date.now() - startTime - totalPaused;
  }

  function startTicking(): void {
    if (tickInterval) clearInterval(tickInterval);
    tickInterval = disposables.setInterval(() => {
      if (tickCallback && running && !paused) {
        const elapsed = getElapsed();
        const remaining = Math.max(0, durationMs - elapsed);
        tickCallback(remaining, elapsed);
      }
    }, 100);
  }

  return {
    start() {
      startTime = Date.now();
      totalPaused = 0;
      running = true;
      paused = false;
      startTicking();
    },
    pause() {
      if (!running || paused) return;
      paused = true;
      pauseTime = Date.now();
    },
    resume() {
      if (!running || !paused) return;
      totalPaused += Date.now() - pauseTime;
      paused = false;
    },
    stop(): number {
      const elapsed = getElapsed();
      running = false;
      if (tickInterval) clearInterval(tickInterval);
      return elapsed;
    },
    getElapsed,
    onTick(callback) {
      tickCallback = callback;
    },
    isRunning() {
      return running && !paused;
    },
  };
}

// Show 3-2-1 countdown animation, returns a promise that resolves when done
export function showCountdown(container: HTMLElement, disposables: Disposables): Promise<void> {
  return new Promise((resolve) => {
    const overlay = el('div', { className: 'countdown-overlay' });
    const number = el('div', { className: 'countdown-number' });
    overlay.appendChild(number);
    container.appendChild(overlay);

    let count = 3;
    number.textContent = String(count);
    number.classList.add('countdown-animate');

    const interval = disposables.setInterval(() => {
      count--;
      if (count > 0) {
        number.textContent = String(count);
        number.classList.remove('countdown-animate');
        // Force reflow
        void number.offsetWidth;
        number.classList.add('countdown-animate');
      } else {
        number.textContent = t('countdown.go');
        number.classList.remove('countdown-animate');
        void number.offsetWidth;
        number.classList.add('countdown-animate');
        disposables.setTimeout(() => {
          overlay.remove();
          resolve();
        }, 600);
        clearInterval(interval);
      }
    }, 800);
  });
}

// Generate a random jittered interval between min and max
export function jitteredInterval(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// Format milliseconds to MM:SS
export function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Flash feedback (green for correct, red for incorrect)
export function showFeedback(container: HTMLElement, correct: boolean, disposables: Disposables): void {
  const flash = el('div', { className: `feedback-flash feedback-flash--${correct ? 'correct' : 'incorrect'}` });
  container.appendChild(flash);
  disposables.setTimeout(() => flash.remove(), 300);
}

// Calculate coefficient of variation (RT variability)
export function calculateCV(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance) / mean;
}

// Calculate d-prime (signal detection theory)
export function calculateDPrime(hitRate: number, falseAlarmRate: number): number {
  // Clamp rates to avoid infinite z-scores
  const clamp = (v: number) => Math.max(0.01, Math.min(0.99, v));
  const hr = clamp(hitRate);
  const far = clamp(falseAlarmRate);
  // z-score approximation (inverse normal)
  const zScore = (p: number) => {
    // Rational approximation of inverse normal CDF
    const a = [0, -3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [0, -5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [0, -7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [0, 7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];

    const pLow = 0.02425;
    const pHigh = 1 - pLow;

    let q: number, r: number;

    if (p < pLow) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[1]*q+c[2])*q+c[3])*q+c[4])*q+c[5])*q+c[6]) / ((((d[1]*q+d[2])*q+d[3])*q+d[4])*q+1);
    } else if (p <= pHigh) {
      q = p - 0.5;
      r = q * q;
      return (((((a[1]*r+a[2])*r+a[3])*r+a[4])*r+a[5])*r+a[6])*q / (((((b[1]*r+b[2])*r+b[3])*r+b[4])*r+b[5])*r+1);
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[1]*q+c[2])*q+c[3])*q+c[4])*q+c[5])*q+c[6]) / ((((d[1]*q+d[2])*q+d[3])*q+d[4])*q+1);
    }
  };

  return zScore(hr) - zScore(far);
}
