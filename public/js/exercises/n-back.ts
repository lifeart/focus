import type { Exercise, ExerciseResult, ExerciseMetrics, DifficultyParams, SoundManager } from '../types.js';
import { el } from '../ui/renderer.js';
import { createDisposables } from '../core/disposables.js';
import { createExerciseTimer, formatTime, calculateDPrime, calculateCV, calculateLapseRate } from './helpers.js';
import { t } from '../core/i18n.js';

const DURATION_MS = 180_000; // 3 minutes
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const MATCH_RATE = 0.3;
const LURE_RATE = 0.15; // 15% of non-target trials are lures (only at level 3+)

interface TrialRecord {
  letter: string;
  isMatch: boolean;
  isLure: boolean; // matches at N±1 but not N
  responded: boolean; // user pressed Match
  stimulusShownAt: number;
  rt: number | null; // response time for IIV tracking
}

export function createNBack(level: number, params: DifficultyParams, sound: SoundManager): Exercise {
  const disposables = createDisposables();
  const timer = createExerciseTimer(DURATION_MS, disposables);

  const nLevel = params.nLevel ?? 1;
  const stimulusInterval = params.stimulusInterval ?? 3000;

  let container: HTMLElement | null = null;
  let timerDisplay: HTMLElement | null = null;
  let trialCounter: HTMLElement | null = null;
  let letterDisplay: HTMLElement | null = null;
  let queueDisplay: HTMLElement | null = null;
  let matchButton: HTMLElement | null = null;

  let paused = false;
  let started = false;
  let sequence: string[] = [];
  let currentIndex = -1;
  let stimulusTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let trials: TrialRecord[] = [];
  let respondedThisTrial = false;

  const estimatedTrials = Math.floor(DURATION_MS / stimulusInterval);

  // Track which positions are lure trials
  const lurePositions = new Set<number>();

  // Pre-generate the full sequence
  function generateSequence(): string[] {
    const totalStimuli = estimatedTrials + 5; // a few extra
    const seq: string[] = [];
    const useLures = level >= 3; // Lure trials only at difficulty level 3+

    for (let i = 0; i < totalStimuli; i++) {
      if (i >= nLevel && Math.random() < MATCH_RATE) {
        // Make it a match: use the letter from N positions back
        seq.push(seq[i - nLevel]);
      } else if (i >= nLevel) {
        // Non-target trial: possibly make it a lure
        if (useLures && Math.random() < LURE_RATE) {
          // Lure: match at N+1 or N-1 but NOT at N
          const avoid = seq[i - nLevel];
          let lureLetter: string | null = null;

          // Try N-1 lure first
          if (i >= nLevel + 1 && seq[i - nLevel + 1] !== avoid) {
            lureLetter = seq[i - nLevel + 1];
          }
          // Try N+1 lure
          if (!lureLetter && i >= nLevel - 1 && nLevel >= 2 && seq[i - nLevel - 1] !== avoid) {
            lureLetter = seq[i - nLevel - 1];
          }

          if (lureLetter) {
            seq.push(lureLetter);
            lurePositions.add(i);
            continue;
          }
        }

        // Regular non-target: pick a letter that doesn't match N-back
        const avoid = seq[i - nLevel];
        let letter: string;
        do {
          letter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
        } while (letter === avoid);
        seq.push(letter);
      } else {
        // First N letters: just pick randomly
        seq.push(LETTERS[Math.floor(Math.random() * LETTERS.length)]);
      }
    }
    return seq;
  }

  function isLureTrial(index: number): boolean {
    return lurePositions.has(index);
  }

  function isMatchTrial(index: number): boolean {
    if (index < nLevel) return false;
    return sequence[index] === sequence[index - nLevel];
  }

  function updateTrialCounter(): void {
    if (trialCounter) {
      trialCounter.textContent = t('trial.counter', { current: currentIndex + 1, total: estimatedTrials });
    }
  }

  function showLetter(): void {
    if (!started || paused || !letterDisplay || !queueDisplay) return;

    currentIndex++;
    if (currentIndex >= sequence.length) return;

    const letter = sequence[currentIndex];
    const match = isMatchTrial(currentIndex);
    respondedThisTrial = false;

    trials.push({
      letter,
      isMatch: match,
      isLure: isLureTrial(currentIndex),
      responded: false,
      stimulusShownAt: Date.now(),
      rt: null,
    });

    // Display the current letter with fade-in
    letterDisplay.textContent = letter;
    letterDisplay.classList.remove('nback-letter-fade');
    void letterDisplay.offsetWidth; // force reflow
    letterDisplay.classList.add('nback-letter-fade');

    // Update queue display: show last N letters (before current)
    updateQueue();
    updateTrialCounter();

    // Schedule next stimulus
    stimulusTimeoutId = disposables.setTimeout(() => {
      stimulusTimeoutId = null;
      onStimulusEnd();
    }, stimulusInterval);
  }

  function updateQueue(): void {
    if (!queueDisplay) return;
    queueDisplay.innerHTML = '';

    const start = Math.max(0, currentIndex - nLevel);
    const end = currentIndex; // exclusive: don't include current
    for (let i = start; i < end; i++) {
      const span = el('span', { className: 'nback-queue-letter' });
      span.textContent = sequence[i];
      queueDisplay.appendChild(span);
    }
  }

  function onStimulusEnd(): void {
    if (!started || paused) return;

    const trial = trials[trials.length - 1];
    if (!trial) return;

    // Evaluate: if user didn't respond
    if (!trial.responded) {
      if (trial.isMatch) {
        // Miss: was a match but user didn't press
        sound.playIncorrect();
        if (container) showBriefFeedback(false);
      } else {
        // Correct rejection: not a match and user didn't press
        // No explicit feedback for correct rejections (silent success)
      }
    }

    // Check if time is up
    if (timer.getElapsed() >= DURATION_MS) {
      return;
    }

    // Show next letter
    showLetter();
  }

  function handleMatch(): void {
    if (!started || paused || respondedThisTrial) return;
    if (currentIndex < 0 || currentIndex >= trials.length) return;

    respondedThisTrial = true;
    const trial = trials[currentIndex];
    trial.responded = true;
    trial.rt = Date.now() - trial.stimulusShownAt;

    if (trial.isMatch) {
      // Hit
      sound.playCorrect();
      if (container) showBriefFeedback(true);
    } else {
      // False alarm
      sound.playIncorrect();
      if (container) showBriefFeedback(false);
    }
  }

  function showBriefFeedback(correct: boolean): void {
    if (!container) return;
    const flash = el('div', { className: `feedback-flash feedback-flash--${correct ? 'correct' : 'incorrect'}` });
    container.appendChild(flash);
    disposables.setTimeout(() => flash.remove(), 300);
  }

  function onKeyDown(e: Event): void {
    const ke = e as KeyboardEvent;
    if (ke.code === 'KeyM' || ke.key === 'm' || ke.key === 'M') {
      ke.preventDefault();
      handleMatch();
    }
  }

  function onMatchClick(): void {
    handleMatch();
  }

  function computeMetrics(): ExerciseMetrics {
    // Only count trials where a match decision was possible (index >= nLevel)
    const scoredTrials = trials.filter((_, i) => i >= nLevel);
    const totalTrials = scoredTrials.length;

    const matchTrials = scoredTrials.filter(t => t.isMatch);
    const nonMatchTrials = scoredTrials.filter(t => !t.isMatch);

    const hits = matchTrials.filter(t => t.responded).length;
    const misses = matchTrials.filter(t => !t.responded).length;
    const falseAlarms = nonMatchTrials.filter(t => t.responded).length;
    const correctRejections = nonMatchTrials.filter(t => !t.responded).length;

    const correctTrials = hits + correctRejections;
    const accuracy = totalTrials > 0 ? correctTrials / totalTrials : 0;

    const hitRate = (hits + misses) > 0 ? hits / (hits + misses) : 0;
    const falseAlarmRate = (falseAlarms + correctRejections) > 0
      ? falseAlarms / (falseAlarms + correctRejections)
      : 0;

    const dPrime = (hits + misses) > 0 && (falseAlarms + correctRejections) > 0
      ? calculateDPrime(hitRate, falseAlarmRate)
      : 0;

    // Lure trial metrics
    const lureTrialsList = scoredTrials.filter(t => t.isLure);
    const lureTrialsCount = lureTrialsList.length;
    const lureFalseAlarms = lureTrialsList.filter(t => t.responded).length;

    // IIV: CV across correct match RTs
    const correctMatchRTs = matchTrials
      .filter(t => t.responded && t.rt !== null)
      .map(t => t.rt as number);
    const rtVariability = calculateCV(correctMatchRTs);
    const lapseRate = calculateLapseRate(correctMatchRTs);

    return {
      accuracy,
      totalTrials,
      correctTrials,
      hits,
      misses,
      falseAlarms,
      dPrime: Math.round(dPrime * 1000) / 1000,
      lureTrials: lureTrialsCount,
      lureFalseAlarms,
      rtVariability: Math.round(rtVariability * 1000) / 1000,
      lapseRate: Math.round(lapseRate * 1000) / 1000,
    };
  }

  function computeScore(metrics: ExerciseMetrics): number {
    const dPrime = metrics.dPrime ?? 0;
    let score: number;

    if (dPrime > 0) {
      // Map d' from [0, 4] to [0, 100]
      score = (dPrime / 4) * 100;
    } else {
      score = metrics.accuracy * 100;
    }

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  const exercise: Exercise = {
    id: 'n-back',

    setup(cont: HTMLElement): void {
      container = cont;
      container.setAttribute('data-exercise', 'n-back');

      // Generate sequence
      sequence = generateSequence();

      // Header
      timerDisplay = el('div', { className: 'exercise-timer' });
      timerDisplay.textContent = formatTime(DURATION_MS);

      const levelLabel = el('div', { className: 'exercise-level-label' });
      levelLabel.textContent = `${nLevel}-Back`;

      trialCounter = el('div', { className: 'exercise-trial-counter' });
      trialCounter.textContent = t('trial.counter', { current: 0, total: estimatedTrials });

      const header = el('div', { className: 'exercise-header' }, [timerDisplay, levelLabel, trialCounter]);

      // Letter display area
      letterDisplay = el('div', { className: 'nback-letter' });
      letterDisplay.textContent = '';

      // Queue display
      queueDisplay = el('div', { className: 'nback-queue' });

      // Stimulus area
      const stimulusArea = el('div', { className: 'exercise-stimulus-area nback-stimulus-area' }, [
        letterDisplay,
        queueDisplay,
      ]);
      stimulusArea.style.display = 'flex';
      stimulusArea.style.flexDirection = 'column';
      stimulusArea.style.alignItems = 'center';
      stimulusArea.style.justifyContent = 'center';
      stimulusArea.style.minHeight = '200px';
      stimulusArea.style.userSelect = 'none';

      // Match button
      matchButton = el('button', { className: 'nback-match-btn' });
      matchButton.textContent = t('nback.matchBtn');

      const controls = el('div', { className: 'nback-controls' }, [matchButton]);

      container.appendChild(header);
      container.appendChild(stimulusArea);
      container.appendChild(controls);

      // Input handlers
      disposables.addListener(document, 'keydown', onKeyDown);
      disposables.addListener(matchButton, 'click', onMatchClick);
      disposables.addListener(matchButton, 'touchstart', onMatchClick);

      // Timer tick
      timer.onTick((remaining) => {
        if (timerDisplay) {
          timerDisplay.textContent = formatTime(remaining);
        }
        if (remaining <= 0 && started) {
          started = false;
          if (stimulusTimeoutId !== null) {
            clearTimeout(stimulusTimeoutId);
            stimulusTimeoutId = null;
          }
        }
      });
    },

    start(): void {
      started = true;
      paused = false;
      timer.start();
      // Show first letter after a short delay
      disposables.setTimeout(() => {
        if (started && !paused) {
          showLetter();
        }
      }, 500);
    },

    pause(): void {
      if (!started || paused) return;
      paused = true;
      timer.pause();
      if (stimulusTimeoutId !== null) {
        clearTimeout(stimulusTimeoutId);
        stimulusTimeoutId = null;
      }
    },

    resume(): void {
      if (!started || !paused) return;
      paused = false;
      timer.resume();
      // Resume by showing the next letter
      disposables.setTimeout(() => {
        if (started && !paused) {
          showLetter();
        }
      }, 500);
    },

    stop(): ExerciseResult {
      const elapsed = timer.stop();
      started = false;

      if (stimulusTimeoutId !== null) {
        clearTimeout(stimulusTimeoutId);
        stimulusTimeoutId = null;
      }

      const metrics = computeMetrics();
      const score = computeScore(metrics);

      return {
        exerciseId: 'n-back',
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
      if (stimulusTimeoutId !== null) {
        clearTimeout(stimulusTimeoutId);
        stimulusTimeoutId = null;
      }
      disposables.dispose();
      if (container) {
        container.innerHTML = '';
        container = null;
      }
    },
  };

  return exercise;
}
