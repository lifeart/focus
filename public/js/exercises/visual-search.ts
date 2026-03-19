import type { Exercise, ExerciseResult, ExerciseMetrics, DifficultyParams, SoundManager } from '../types.js';
import { el } from '../ui/renderer.js';
import { createDisposables } from '../core/disposables.js';
import { createExerciseTimer, showFeedback, formatTime, calculateCV, calculateLapseRate, calculateSearchSlope } from './helpers.js';
import { t } from '../core/i18n.js';

const DURATION_MS = 180_000; // 3 minutes
const TRIAL_TIMEOUT_MS = 10_000; // 10 seconds per trial
const INTER_TRIAL_MS = 500; // 500ms between trials

type ShapeType = 'red-circle' | 'blue-circle' | 'red-square';

interface TrialRecord {
  targetPresent: boolean;
  correct: boolean;
  rt: number | null; // reaction time in ms
  trialGridSize: number; // grid size for this trial (varies for slope calculation)
}

export function createVisualSearch(level: number, params: DifficultyParams, sound: SoundManager): Exercise {
  const disposables = createDisposables();
  const timer = createExerciseTimer(DURATION_MS, disposables);

  const baseGridSize = params.gridSize ?? 3;
  // Vary grid size: base-1, base, base+1 (clamped to [3, 7])
  const gridSizeVariants = [
    Math.max(3, baseGridSize - 1),
    baseGridSize,
    Math.min(7, baseGridSize + 1),
  ];
  let currentGridSize = baseGridSize;
  let totalCells = currentGridSize * currentGridSize;

  const trials: TrialRecord[] = [];
  let container: HTMLElement | null = null;
  let gridContainer: HTMLElement | null = null;
  let timerDisplay: HTMLElement | null = null;
  let trialCounter: HTMLElement | null = null;
  let noTargetBtn: HTMLElement | null = null;

  let paused = false;
  let started = false;
  let awaitingResponse = false;
  let trialStartedAt = 0;
  let currentTrialTargetPresent = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let interTrialId: ReturnType<typeof setTimeout> | null = null;
  let trialIndex = 0;

  // Estimate ~50 trials over 3 minutes
  const avgTrialTime = (TRIAL_TIMEOUT_MS * 0.4) + INTER_TRIAL_MS;
  const estimatedTrials = Math.round(DURATION_MS / avgTrialTime);

  function generateGrid(): ShapeType[] {
    // Pick a random grid size variant for this trial
    currentGridSize = gridSizeVariants[Math.floor(Math.random() * gridSizeVariants.length)];
    totalCells = currentGridSize * currentGridSize;

    const cells: ShapeType[] = [];

    // Decide target presence (50/50)
    currentTrialTargetPresent = Math.random() < 0.5;

    if (currentTrialTargetPresent) {
      // Place exactly 1 red circle (the target)
      cells.push('red-circle');
      // Fill remaining with distractors
      for (let i = 1; i < totalCells; i++) {
        cells.push(Math.random() < 0.5 ? 'blue-circle' : 'red-square');
      }
    } else {
      // No target - only distractors
      for (let i = 0; i < totalCells; i++) {
        cells.push(Math.random() < 0.5 ? 'blue-circle' : 'red-square');
      }
    }

    // Shuffle (Fisher-Yates)
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }

    return cells;
  }

  function createShapeElement(shape: ShapeType): HTMLElement {
    const div = el('div');
    const size = Math.max(44, Math.floor(200 / currentGridSize));
    div.style.width = `${size}px`;
    div.style.height = `${size}px`;
    div.style.cursor = 'pointer';
    div.style.touchAction = 'manipulation';
    div.style.userSelect = 'none';
    div.style.webkitUserSelect = 'none';
    div.style.transition = 'transform 0.1s';

    if (shape === 'red-circle') {
      div.style.background = '#ff6b6b';
      div.style.borderRadius = '50%';
    } else if (shape === 'blue-circle') {
      div.style.background = '#45b7d1';
      div.style.borderRadius = '50%';
    } else {
      // red-square
      div.style.background = '#ff6b6b';
      div.style.borderRadius = '0';
    }

    div.setAttribute('data-shape', shape);
    return div;
  }

  function showTrial(): void {
    if (!started || paused || !gridContainer) return;

    trialIndex++;
    const cells = generateGrid();

    // Clear grid and update layout for current grid size
    gridContainer.innerHTML = '';
    gridContainer.style.gridTemplateColumns = `repeat(${currentGridSize}, 1fr)`;
    gridContainer.style.maxWidth = `${currentGridSize * (Math.max(44, Math.floor(200 / currentGridSize)) + 8)}px`;

    // Render grid cells
    for (const shape of cells) {
      const shapeEl = createShapeElement(shape);
      gridContainer.appendChild(shapeEl);

      disposables.addListener(shapeEl, 'click', () => {
        handleGridClick(shape);
      });
    }

    trialStartedAt = Date.now();
    awaitingResponse = true;
    updateTrialCounter();

    // Enable no-target button
    if (noTargetBtn) {
      noTargetBtn.removeAttribute('disabled');
    }

    // Start trial timeout
    timeoutId = disposables.setTimeout(() => {
      timeoutId = null;
      onTrialTimeout();
    }, TRIAL_TIMEOUT_MS);
  }

  function handleGridClick(clickedShape: ShapeType): void {
    if (!started || paused || !awaitingResponse) return;

    const rt = Date.now() - trialStartedAt;
    awaitingResponse = false;
    cancelTrialTimeout();

    if (currentTrialTargetPresent && clickedShape === 'red-circle') {
      // Correct: clicked the target
      trials.push({ targetPresent: true, correct: true, rt, trialGridSize: currentGridSize });
      sound.playCorrect();
      if (container) showFeedback(container, true, disposables);
    } else {
      // Incorrect: clicked wrong item (either wrong item in target-present, or any item in target-absent)
      trials.push({ targetPresent: currentTrialTargetPresent, correct: false, rt, trialGridSize: currentGridSize });
      sound.playIncorrect();
      if (container) showFeedback(container, false, disposables);
    }

    clearGrid();
    scheduleNextTrial();
  }

  function handleNoTarget(): void {
    if (!started || paused || !awaitingResponse) return;

    const rt = Date.now() - trialStartedAt;
    awaitingResponse = false;
    cancelTrialTimeout();

    if (!currentTrialTargetPresent) {
      // Correct: no target and user said so
      trials.push({ targetPresent: false, correct: true, rt, trialGridSize: currentGridSize });
      sound.playCorrect();
      if (container) showFeedback(container, true, disposables);
    } else {
      // Incorrect: target was present but user said no target
      trials.push({ targetPresent: true, correct: false, rt, trialGridSize: currentGridSize });
      sound.playIncorrect();
      if (container) showFeedback(container, false, disposables);
    }

    clearGrid();
    scheduleNextTrial();
  }

  function onTrialTimeout(): void {
    if (!started || paused || !awaitingResponse) return;

    awaitingResponse = false;

    if (currentTrialTargetPresent) {
      // Miss: target was present but user didn't respond
      trials.push({ targetPresent: true, correct: false, rt: null, trialGridSize: currentGridSize });
      sound.playIncorrect();
      if (container) showFeedback(container, false, disposables);
    } else {
      // Target-absent timeout: auto-proceed as correct-ish
      trials.push({ targetPresent: false, correct: true, rt: null, trialGridSize: currentGridSize });
    }

    clearGrid();
    scheduleNextTrial();
  }

  function cancelTrialTimeout(): void {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  function clearGrid(): void {
    if (gridContainer) {
      gridContainer.innerHTML = '';
    }
    if (noTargetBtn) {
      noTargetBtn.setAttribute('disabled', '');
    }
  }

  function scheduleNextTrial(): void {
    if (!started || paused) return;
    if (timer.getElapsed() >= DURATION_MS) return;

    interTrialId = disposables.setTimeout(() => {
      interTrialId = null;
      if (started && !paused) {
        showTrial();
      }
    }, INTER_TRIAL_MS);
  }

  function updateTrialCounter(): void {
    if (trialCounter) {
      trialCounter.textContent = t('trial.counter', { current: trialIndex, total: estimatedTrials });
    }
  }

  function computeMetrics(): ExerciseMetrics {
    const totalTrials = trials.length;
    const correctTrials = trials.filter(t => t.correct).length;
    const accuracy = totalTrials > 0 ? correctTrials / totalTrials : 0;

    // Average search time for correct target-present trials only
    const correctTargetPresentTrials = trials
      .filter(t => t.targetPresent && t.correct && t.rt !== null);

    const correctTargetPresentRTs = correctTargetPresentTrials.map(t => t.rt as number);

    const searchTime = correctTargetPresentRTs.length > 0
      ? correctTargetPresentRTs.reduce((a, b) => a + b, 0) / correctTargetPresentRTs.length
      : 0;

    const avgTotalCells = baseGridSize * baseGridSize;
    const itemsPerSecond = searchTime > 0
      ? (avgTotalCells / (searchTime / 1000))
      : 0;

    // Search slope: RT vs set size (items = gridSize^2)
    // Group correct target-present RTs by grid size, compute mean per size
    const rtBySize = new Map<number, number[]>();
    for (const t of correctTargetPresentTrials) {
      const setSize = t.trialGridSize * t.trialGridSize;
      if (!rtBySize.has(setSize)) rtBySize.set(setSize, []);
      rtBySize.get(setSize)!.push(t.rt as number);
    }
    const sizeRtPairs: { size: number; rt: number }[] = [];
    for (const [size, rts] of rtBySize) {
      const meanRt = rts.reduce((a, b) => a + b, 0) / rts.length;
      sizeRtPairs.push({ size, rt: meanRt });
    }
    const searchSlope = calculateSearchSlope(sizeRtPairs);

    // IIV and lapse rate
    const rtVariability = calculateCV(correctTargetPresentRTs);
    const lapseRate = calculateLapseRate(correctTargetPresentRTs);

    return {
      accuracy,
      totalTrials,
      correctTrials,
      searchTime: Math.round(searchTime),
      itemsPerSecond: Math.round(itemsPerSecond * 100) / 100,
      searchSlope: Math.round(searchSlope * 100) / 100,
      rtVariability: Math.round(rtVariability * 1000) / 1000,
      lapseRate: Math.round(lapseRate * 1000) / 1000,
    };
  }

  function computeScore(metrics: ExerciseMetrics): number {
    const score = metrics.accuracy * 100;
    return Math.round(Math.max(0, Math.min(100, score)));
  }

  const exercise: Exercise = {
    id: 'visual-search',

    setup(cont: HTMLElement): void {
      container = cont;
      container.setAttribute('data-exercise', 'visual-search');

      timerDisplay = el('div', { className: 'exercise-timer' });
      timerDisplay.textContent = formatTime(DURATION_MS);

      trialCounter = el('div', { className: 'exercise-trial-counter' });
      trialCounter.textContent = t('trial.counter', { current: 0, total: estimatedTrials });

      const header = el('div', { className: 'exercise-header' }, [timerDisplay, trialCounter]);

      gridContainer = el('div', { className: 'visual-search-grid' });
      gridContainer.style.display = 'grid';
      gridContainer.style.gridTemplateColumns = `repeat(${baseGridSize}, 1fr)`;
      gridContainer.style.gap = '8px';
      gridContainer.style.justifyItems = 'center';
      gridContainer.style.alignItems = 'center';
      gridContainer.style.maxWidth = `${baseGridSize * (Math.max(44, Math.floor(200 / baseGridSize)) + 8)}px`;
      gridContainer.style.margin = '1.5rem auto';
      gridContainer.style.padding = '1rem';

      noTargetBtn = el('button', { className: 'visual-search-no-target-btn' });
      noTargetBtn.textContent = t('visualSearch.noTarget');
      noTargetBtn.style.display = 'block';
      noTargetBtn.style.margin = '1rem auto';
      noTargetBtn.style.padding = '0.75rem 2rem';
      noTargetBtn.style.fontSize = '1.1rem';
      noTargetBtn.style.border = '2px solid #555';
      noTargetBtn.style.borderRadius = '12px';
      noTargetBtn.style.background = 'rgba(255,255,255,0.08)';
      noTargetBtn.style.color = '#e0e0e0';
      noTargetBtn.style.cursor = 'pointer';
      noTargetBtn.style.touchAction = 'manipulation';
      noTargetBtn.style.userSelect = 'none';
      noTargetBtn.style.webkitUserSelect = 'none';
      noTargetBtn.setAttribute('disabled', '');

      container.appendChild(header);
      container.appendChild(gridContainer);
      container.appendChild(noTargetBtn);

      disposables.addListener(noTargetBtn, 'click', () => {
        handleNoTarget();
      });

      // Timer tick updates
      timer.onTick((remaining) => {
        if (timerDisplay) {
          timerDisplay.textContent = formatTime(remaining);
        }
        if (remaining <= 0 && started) {
          started = false;
          awaitingResponse = false;
          clearGrid();
        }
      });
    },

    start(): void {
      started = true;
      paused = false;
      timer.start();
      showTrial();
    },

    pause(): void {
      if (!started || paused) return;
      paused = true;
      timer.pause();
      awaitingResponse = false;
      clearGrid();
      cancelTrialTimeout();
      if (interTrialId !== null) {
        clearTimeout(interTrialId);
        interTrialId = null;
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
      clearGrid();
      cancelTrialTimeout();

      const metrics = computeMetrics();
      const score = computeScore(metrics);

      return {
        exerciseId: 'visual-search',
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
      clearGrid();
      disposables.dispose();
      if (container) {
        container.innerHTML = '';
        container = null;
      }
    },
  };

  return exercise;
}
