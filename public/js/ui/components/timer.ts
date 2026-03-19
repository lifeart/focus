import { el } from '../renderer.js';

export interface TimerOptions {
  totalSeconds: number;
  onComplete?: () => void;
  onTick?: (remainingSeconds: number) => void;
}

export interface TimerControls {
  pause(): void;
  resume(): void;
  stop(): void;
  element: HTMLElement;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function renderTimer(
  container: HTMLElement,
  options: TimerOptions,
): TimerControls {
  const { totalSeconds, onComplete, onTick } = options;

  const display = el('div', { className: 'timer' });
  const timeText = el('span', { className: 'timer__time' }, [formatTime(totalSeconds)]);
  display.appendChild(timeText);
  container.appendChild(display);

  let remaining = totalSeconds;
  let running = false;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let startTime = 0;
  let elapsedAtPause = 0;

  function tick(): void {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const newRemaining = Math.max(0, totalSeconds - elapsedAtPause - elapsed);

    if (newRemaining !== remaining) {
      remaining = newRemaining;
      timeText.textContent = formatTime(remaining);
      if (onTick) onTick(remaining);
    }

    if (remaining <= 0) {
      stopTimer();
      if (onComplete) onComplete();
    }
  }

  function startTimer(): void {
    if (running) return;
    running = true;
    startTime = Date.now();
    // Tick every 100ms for drift correction
    intervalId = setInterval(tick, 100);
  }

  function pause(): void {
    if (!running) return;
    running = false;
    elapsedAtPause = totalSeconds - remaining;
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function resume(): void {
    if (running) return;
    startTimer();
  }

  function stopTimer(): void {
    running = false;
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  // Auto-start
  startTimer();

  return {
    pause,
    resume,
    stop: stopTimer,
    element: display,
  };
}
