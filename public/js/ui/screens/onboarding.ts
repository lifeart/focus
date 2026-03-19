import type { ScreenRender, ExerciseResult } from '../../types.js';
import { el, addClass, clear } from '../renderer.js';
import { appState } from '../../main.js';
import { createDisposables } from '../../core/disposables.js';
import { calculateXP } from '../../core/progression.js';
import { t } from '../../core/i18n.js';
import type { Locale } from '../../types.js';

// ─── Constants ───────────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#6C5CE7', '#00CEC9', '#FF6B6B', '#FDCB6E',
  '#55EFC4', '#E17055', '#74B9FF', '#A29BFE',
];

const DAILY_GOAL_OPTIONS = [
  { minutes: 5, subtitleKey: 'onboarding.goal.easy' as const },
  { minutes: 10, subtitleKey: 'onboarding.goal.optimal' as const },
  { minutes: 15, subtitleKey: 'onboarding.goal.advanced' as const },
];

const TOTAL_TRIALS = 10;
const GO_COUNT = 8;
const NOGO_COUNT = 2;
const STIMULUS_DURATION = 800;
const ISI = 1500;

// ─── Inline styles ───────────────────────────────────────────────────

function injectStyles(): HTMLStyleElement {
  const style = document.createElement('style');
  style.textContent = `
    .onboarding__step {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-md);
      width: 100%;
      max-width: 400px;
      animation: ob-fade-in 0.4s ease-out;
    }
    @keyframes ob-fade-in {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes ob-fade-out {
      from { opacity: 1; transform: translateY(0); }
      to { opacity: 0; transform: translateY(-16px); }
    }
    .onboarding__step--leaving {
      animation: ob-fade-out 0.25s ease-in forwards;
    }
    .onboarding__title--large {
      font-size: var(--text-3xl);
    }
    .onboarding__instruction {
      font-size: var(--text-base);
      color: var(--text-secondary);
      margin: 0 0 var(--space-md);
      text-align: center;
      line-height: var(--line-normal);
    }
    .onboarding__detail {
      font-size: var(--text-sm);
      color: var(--text-muted);
      text-align: center;
      max-width: 320px;
      line-height: var(--line-normal);
      margin: 0;
    }

    /* Progress dots */
    .onboarding__progress {
      display: flex;
      gap: var(--space-sm);
      margin-bottom: var(--space-lg);
    }
    .onboarding__dot {
      width: 8px;
      height: 8px;
      border-radius: var(--radius-full);
      background: var(--surface-3);
      transition: background-color var(--transition-normal), transform var(--transition-fast);
    }
    .onboarding__dot--active {
      background: var(--primary);
      transform: scale(1.25);
    }
    .onboarding__dot--done {
      background: var(--success);
    }

    /* Feature list */
    .onboarding__features {
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
      margin: var(--space-md) 0;
      width: 100%;
      max-width: 300px;
    }
    .onboarding__feature {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      font-size: var(--text-sm);
      color: var(--text-secondary);
    }
    .onboarding__feature-icon {
      width: 24px;
      height: 24px;
      border-radius: var(--radius-full);
      background: var(--primary-subtle);
      color: var(--primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: var(--text-xs);
      flex-shrink: 0;
    }

    /* Visual legend */
    .onboarding__legend {
      display: flex;
      gap: var(--space-xl);
      margin: var(--space-md) 0;
      justify-content: center;
    }
    .onboarding__legend-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-xs);
    }
    .onboarding__legend-shape {
      width: 48px;
      height: 48px;
    }
    .onboarding__legend-shape--go {
      border-radius: var(--radius-full);
      background: var(--success);
      box-shadow: 0 0 16px rgba(78, 205, 196, 0.3);
    }
    .onboarding__legend-shape--nogo {
      border-radius: var(--radius-lg);
      background: var(--error);
      box-shadow: 0 0 16px rgba(255, 107, 107, 0.3);
    }
    .onboarding__legend-label {
      font-size: var(--text-xs);
      font-weight: var(--weight-semibold);
      color: var(--text-secondary);
    }

    /* Language selector */
    .onboarding__lang-row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-xs);
      justify-content: center;
      margin-bottom: var(--space-md);
    }
    .onboarding__lang-btn {
      padding: 0.25rem 0.75rem;
      border-radius: var(--radius-full);
      border: 1.5px solid var(--surface-3);
      background: transparent;
      color: var(--text-secondary);
      font-size: var(--text-xs);
      cursor: pointer;
      transition: border-color var(--transition-fast), color var(--transition-fast), background-color var(--transition-fast);
    }
    .onboarding__lang-btn:hover {
      border-color: var(--text-muted);
    }
    .onboarding__lang-btn--active {
      border-color: var(--primary);
      color: var(--primary);
      background: var(--primary-subtle);
    }

    /* Mini exercise */
    .onboarding__stimulus-area {
      width: 160px;
      height: 160px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: var(--space-md) auto;
    }
    .onboarding__stimulus {
      transition: opacity var(--transition-fast);
    }
    .onboarding__stimulus--go {
      width: 100px;
      height: 100px;
      border-radius: var(--radius-full);
      background: var(--success);
      box-shadow: 0 0 30px rgba(78, 205, 196, 0.3);
    }
    .onboarding__stimulus--nogo {
      width: 90px;
      height: 90px;
      border-radius: var(--radius-lg);
      background: var(--error);
      box-shadow: 0 0 30px rgba(255, 107, 107, 0.3);
    }
    .onboarding__trial-counter {
      font-size: var(--text-sm);
      color: var(--text-secondary);
    }
    .onboarding__feedback {
      font-size: var(--text-xl);
      font-weight: var(--weight-semibold);
      min-height: 36px;
    }
    .onboarding__feedback--correct {
      color: var(--success);
    }
    .onboarding__feedback--incorrect {
      color: var(--error);
    }

    /* Score */
    .onboarding__score {
      font-family: var(--font-heading);
      font-size: 4rem;
      font-weight: var(--weight-bold);
      color: var(--primary);
      margin: var(--space-sm) 0;
      line-height: 1;
    }

    /* Input */
    .onboarding__input {
      width: 100%;
      max-width: 280px;
      padding: 0.875rem 1rem;
      border-radius: var(--radius-lg);
      border: 2px solid transparent;
      background: var(--surface-2);
      color: var(--text);
      font-size: var(--text-md);
      text-align: center;
      outline: none;
      transition: border-color var(--transition-fast), background-color var(--transition-fast);
    }
    .onboarding__input:focus {
      border-color: var(--primary);
      background: var(--surface);
      box-shadow: 0 0 0 3px var(--primary-subtle);
    }

    /* Avatar colors */
    .onboarding__colors {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-md);
      justify-content: center;
      margin: var(--space-md) 0;
    }
    .onboarding__color-btn {
      width: 48px;
      height: 48px;
      border-radius: var(--radius-full);
      border: 3px solid transparent;
      cursor: pointer;
      transition: transform var(--transition-fast), border-color var(--transition-fast);
      padding: 0;
    }
    .onboarding__color-btn:active {
      transform: scale(0.9);
    }
    .onboarding__color-btn--selected {
      border-color: #fff;
      transform: scale(1.1);
    }

    /* Avatar preview */
    .onboarding__avatar-preview {
      width: 80px;
      height: 80px;
      border-radius: var(--radius-full);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: var(--text-2xl);
      font-weight: var(--weight-bold);
      color: #fff;
      margin: var(--space-sm) 0;
    }

    /* Goal cards */
    .onboarding__goals {
      display: flex;
      gap: var(--space-md);
      justify-content: center;
      margin: var(--space-md) 0;
      flex-wrap: wrap;
    }
    .onboarding__goal-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-xs);
      padding: var(--space-lg) var(--space-md);
      border-radius: var(--radius-xl);
      border: 2px solid var(--surface-3);
      background: var(--surface);
      cursor: pointer;
      transition: border-color var(--transition-fast), transform var(--transition-fast), background-color var(--transition-fast);
      min-width: 90px;
    }
    .onboarding__goal-card:active {
      transform: scale(0.96);
    }
    .onboarding__goal-card--selected {
      border-color: var(--primary);
      background: var(--primary-subtle);
    }
    .onboarding__goal-value {
      font-family: var(--font-heading);
      font-size: var(--text-xl);
      font-weight: var(--weight-bold);
      color: var(--text);
    }
    .onboarding__goal-subtitle {
      font-size: var(--text-xs);
      color: var(--text-secondary);
    }
  `;
  document.head.appendChild(style);
  return style;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function transitionStep(
  wrapper: HTMLElement,
  buildNextStep: () => HTMLElement,
  disposables: ReturnType<typeof createDisposables>,
): void {
  const current = wrapper.firstElementChild as HTMLElement | null;
  if (current) {
    addClass(current, 'onboarding__step--leaving');
    disposables.setTimeout(() => {
      clear(wrapper);
      wrapper.appendChild(buildNextStep());
    }, 250);
  } else {
    wrapper.appendChild(buildNextStep());
  }
}

function shuffleTrials(): boolean[] {
  // Build array: true = go, false = no-go
  const trials: boolean[] = [];
  for (let i = 0; i < GO_COUNT; i++) trials.push(true);
  for (let i = 0; i < NOGO_COUNT; i++) trials.push(false);
  // Fisher-Yates shuffle
  for (let i = trials.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [trials[i], trials[j]] = [trials[j], trials[i]];
  }
  return trials;
}

// ─── Screen render ───────────────────────────────────────────────────

export const renderOnboarding: ScreenRender = (container, _params) => {
  const disposables = createDisposables();
  const styleEl = injectStyles();
  disposables.addCleanup(() => styleEl.remove());

  addClass(container, 'screen', 'onboarding');

  const wrapper = el('div', { className: 'flex flex--col flex--center onboarding__wrapper' });
  container.appendChild(wrapper);

  const TOTAL_STEPS = 6;

  // Wizard state
  let userName = '';
  let avatarColor = AVATAR_COLORS[0];
  let dailyGoal = 10;
  let miniExerciseScore = 0;
  let miniExerciseCorrect = 0;
  let miniExerciseTotal = TOTAL_TRIALS;
  let exerciseStartTime = 0;
  let exerciseEndTime = 0;

  function buildProgressDots(currentStep: number): HTMLElement {
    const dotsContainer = el('div', { className: 'onboarding__progress' });
    for (let i = 1; i <= TOTAL_STEPS; i++) {
      const dot = el('div', { className: 'onboarding__dot' });
      if (i < currentStep) addClass(dot, 'onboarding__dot--done');
      else if (i === currentStep) addClass(dot, 'onboarding__dot--active');
      dotsContainer.appendChild(dot);
    }
    return dotsContainer;
  }

  // ─── Step 1: Welcome ────────────────────────────────────────────

  function buildLangSelector(): HTMLElement {
    const locales: { code: Locale; label: string }[] = [
      { code: 'en', label: 'English' },
      { code: 'ru', label: 'Русский' },
      { code: 'de', label: 'Deutsch' },
      { code: 'fr', label: 'Français' },
      { code: 'es', label: 'Español' },
    ];
    const currentLocale = appState.getData().settings.locale || 'en';
    const row = el('div', { className: 'onboarding__lang-row' });

    for (const loc of locales) {
      const btn = el('button', {
        className: `onboarding__lang-btn${loc.code === currentLocale ? ' onboarding__lang-btn--active' : ''}`,
      }, [loc.label]);
      btn.addEventListener('click', () => {
        if (loc.code !== currentLocale) {
          appState.updateData((d) => {
            d.settings.locale = loc.code;
          });
          appState.flush();
          window.location.reload();
        }
      });
      row.appendChild(btn);
    }

    return row;
  }

  function buildWelcome(): HTMLElement {
    const step = el('div', { className: 'onboarding__step' }, [
      buildLangSelector(),
      buildProgressDots(1),
      el('h1', { className: 'onboarding__title onboarding__title--large' }, ['Focus']),
      el('p', { className: 'onboarding__instruction' }, [t('onboarding.subtitle')]),
      el('p', { className: 'onboarding__detail' }, [t('onboarding.welcomeDetail')]),
      el('div', { className: 'onboarding__features' }, [
        el('div', { className: 'onboarding__feature' }, [
          el('div', { className: 'onboarding__feature-icon' }, ['\u2713']),
          el('span', null, [t('onboarding.welcomeFeature1')]),
        ]),
        el('div', { className: 'onboarding__feature' }, [
          el('div', { className: 'onboarding__feature-icon' }, ['\u2713']),
          el('span', null, [t('onboarding.welcomeFeature2')]),
        ]),
        el('div', { className: 'onboarding__feature' }, [
          el('div', { className: 'onboarding__feature-icon' }, ['\u2713']),
          el('span', null, [t('onboarding.welcomeFeature3')]),
        ]),
      ]),
      el('button', {
        className: 'btn btn--primary btn--lg',
        onClick: () => transitionStep(wrapper, buildExerciseIntro, disposables),
      }, [t('onboarding.letsGo')]),
    ]);
    return step;
  }

  // ─── Step 2: Mini Exercise ──────────────────────────────────────

  function buildExerciseIntro(): HTMLElement {
    const step = el('div', { className: 'onboarding__step' }, [
      buildProgressDots(2),
      el('h2', { className: 'onboarding__title' }, [t('onboarding.miniTest')]),
      el('p', { className: 'onboarding__instruction' }, [t('onboarding.miniTestWhy')]),
      el('div', { className: 'onboarding__legend' }, [
        el('div', { className: 'onboarding__legend-item' }, [
          el('div', { className: 'onboarding__legend-shape onboarding__legend-shape--go' }),
          el('div', { className: 'onboarding__legend-label' }, [t('onboarding.legendGo')]),
        ]),
        el('div', { className: 'onboarding__legend-item' }, [
          el('div', { className: 'onboarding__legend-shape onboarding__legend-shape--nogo' }),
          el('div', { className: 'onboarding__legend-label' }, [t('onboarding.legendNoGo')]),
        ]),
      ]),
      el('p', { className: 'onboarding__detail' }, [t('onboarding.pressSpace')]),
      el('button', {
        className: 'btn btn--primary btn--lg',
        onClick: () => transitionStep(wrapper, buildExercise, disposables),
      }, [t('onboarding.start')]),
    ]);
    return step;
  }

  function buildExercise(): HTMLElement {
    const trials = shuffleTrials();
    let trialIndex = 0;
    let correct = 0;
    let responded = false;
    let stimulusVisible = false;

    exerciseStartTime = Date.now();

    const feedbackEl = el('div', { className: 'onboarding__feedback' });
    const counterEl = el('div', { className: 'onboarding__trial-counter' });
    const stimArea = el('div', { className: 'onboarding__stimulus-area' });

    // Progress bar for exercise
    const progressBar = el('div');
    progressBar.style.cssText = 'width:100%;max-width:300px;height:4px;background:var(--surface-3);border-radius:4px;overflow:hidden;';
    const progressFill = el('div');
    progressFill.style.cssText = 'height:100%;background:var(--primary);border-radius:4px;transition:width 0.3s ease;width:0%;';
    progressBar.appendChild(progressFill);

    const step = el('div', { className: 'onboarding__step' }, [
      buildProgressDots(3),
      el('h2', { className: 'onboarding__title' }, [t('onboarding.miniTest')]),
      counterEl,
      progressBar,
      stimArea,
      feedbackEl,
    ]);

    function updateCounter(): void {
      counterEl.textContent = `${trialIndex + 1} / ${TOTAL_TRIALS}`;
      progressFill.style.width = `${((trialIndex + 1) / TOTAL_TRIALS) * 100}%`;
    }

    function handleResponse(): void {
      if (!stimulusVisible || responded) return;
      responded = true;
      const isGo = trials[trialIndex];
      if (isGo) {
        correct++;
        feedbackEl.textContent = t('onboarding.correct');
        feedbackEl.className = 'onboarding__feedback onboarding__feedback--correct';
      } else {
        feedbackEl.textContent = t('onboarding.shouldntPress');
        feedbackEl.className = 'onboarding__feedback onboarding__feedback--incorrect';
      }
    }

    function showStimulus(): void {
      responded = false;
      feedbackEl.textContent = '';
      feedbackEl.className = 'onboarding__feedback';
      updateCounter();

      const isGo = trials[trialIndex];
      clear(stimArea);

      const stim = el('div', {
        className: isGo
          ? 'onboarding__stimulus onboarding__stimulus--go'
          : 'onboarding__stimulus onboarding__stimulus--nogo',
      });
      stimArea.appendChild(stim);
      stimulusVisible = true;

      // Hide stimulus after duration
      disposables.setTimeout(() => {
        stimulusVisible = false;
        clear(stimArea);

        // Check omission for go trials
        if (!responded && isGo) {
          feedbackEl.textContent = t('onboarding.missed');
          feedbackEl.className = 'onboarding__feedback onboarding__feedback--incorrect';
        } else if (!responded && !isGo) {
          // Correctly withheld
          correct++;
          feedbackEl.textContent = t('onboarding.correct');
          feedbackEl.className = 'onboarding__feedback onboarding__feedback--correct';
        }

        trialIndex++;
        if (trialIndex < TOTAL_TRIALS) {
          // ISI before next trial
          disposables.setTimeout(() => {
            showStimulus();
          }, ISI - STIMULUS_DURATION);
        } else {
          // Done
          exerciseEndTime = Date.now();
          miniExerciseCorrect = correct;
          miniExerciseScore = Math.round((correct / TOTAL_TRIALS) * 100);
          transitionStep(wrapper, buildResult, disposables);
        }
      }, STIMULUS_DURATION);
    }

    // Input handlers
    const onKey = (e: Event): void => {
      if ((e as KeyboardEvent).code === 'Space' || (e as KeyboardEvent).key === ' ') {
        e.preventDefault();
        handleResponse();
      }
    };
    const onClick = (): void => {
      handleResponse();
    };

    disposables.addListener(document, 'keydown', onKey);
    disposables.addListener(stimArea, 'click', onClick);
    disposables.addListener(stimArea, 'touchstart', onClick);

    // Start first trial after a short delay
    disposables.setTimeout(() => {
      showStimulus();
    }, 500);

    return step;
  }

  // ─── Step 3: Result ─────────────────────────────────────────────

  function buildResult(): HTMLElement {
    const encouragement = miniExerciseScore >= 80
      ? t('onboarding.encourage.high')
      : miniExerciseScore >= 50
        ? t('onboarding.encourage.mid')
        : t('onboarding.encourage.low');

    const step = el('div', { className: 'onboarding__step' }, [
      buildProgressDots(4),
      el('h2', { className: 'onboarding__title' }, [t('onboarding.result')]),
      el('div', { className: 'onboarding__score' }, [`${miniExerciseScore}%`]),
      el('p', { className: 'onboarding__subtitle' }, [
        t('onboarding.correctCount', { correct: miniExerciseCorrect, total: miniExerciseTotal }),
      ]),
      el('p', { className: 'onboarding__subtitle' }, [encouragement]),
      el('p', { className: 'onboarding__detail' }, [t('onboarding.resultContext')]),
      el('button', {
        className: 'btn btn--primary btn--lg',
        onClick: () => transitionStep(wrapper, buildProfileName, disposables),
      }, [t('onboarding.next')]),
    ]);
    return step;
  }

  // ─── Step 4: Profile name ───────────────────────────────────────

  function buildProfileName(): HTMLElement {
    const input = el('input', {
      className: 'onboarding__input',
      type: 'text',
      placeholder: t('onboarding.namePlaceholder'),
    }) as HTMLInputElement;

    const step = el('div', { className: 'onboarding__step' }, [
      buildProgressDots(5),
      el('h2', { className: 'onboarding__title' }, [t('onboarding.whatsYourName')]),
      el('p', { className: 'onboarding__detail' }, [t('onboarding.nameExplain')]),
      input,
      el('button', {
        className: 'btn btn--primary btn--lg',
        onClick: () => {
          userName = input.value.trim() || t('dashboard.defaultName');
          transitionStep(wrapper, buildAvatarColor, disposables);
        },
      }, [t('onboarding.next')]),
    ]);

    disposables.setTimeout(() => input.focus(), 350);

    return step;
  }

  // ─── Step 5: Avatar color ───────────────────────────────────────

  function buildAvatarColor(): HTMLElement {
    let selectedColor = avatarColor;

    const preview = el('div', { className: 'onboarding__avatar-preview' });
    preview.style.backgroundColor = selectedColor;
    preview.textContent = (userName || t('dashboard.defaultName'))[0].toUpperCase();

    const colorBtns: HTMLButtonElement[] = [];

    function updateSelection(): void {
      preview.style.backgroundColor = selectedColor;
      colorBtns.forEach((btn, i) => {
        if (AVATAR_COLORS[i] === selectedColor) {
          addClass(btn, 'onboarding__color-btn--selected');
        } else {
          btn.classList.remove('onboarding__color-btn--selected');
        }
      });
    }

    const colorsContainer = el('div', { className: 'onboarding__colors' });
    AVATAR_COLORS.forEach((color) => {
      const btn = el('button', {
        className: 'onboarding__color-btn',
      }) as HTMLButtonElement;
      btn.style.backgroundColor = color;
      if (color === selectedColor) {
        addClass(btn, 'onboarding__color-btn--selected');
      }
      btn.addEventListener('click', () => {
        selectedColor = color;
        updateSelection();
      });
      colorBtns.push(btn);
      colorsContainer.appendChild(btn);
    });

    const step = el('div', { className: 'onboarding__step' }, [
      buildProgressDots(5),
      el('h2', { className: 'onboarding__title' }, [t('onboarding.chooseColor')]),
      el('p', { className: 'onboarding__detail' }, [t('onboarding.colorExplain')]),
      preview,
      colorsContainer,
      el('button', {
        className: 'btn btn--primary btn--lg',
        onClick: () => {
          avatarColor = selectedColor;
          transitionStep(wrapper, buildDailyGoal, disposables);
        },
      }, [t('onboarding.next')]),
    ]);
    return step;
  }

  // ─── Step 6: Daily goal ─────────────────────────────────────────

  function buildDailyGoal(): HTMLElement {
    let selectedGoal = dailyGoal;

    const cards: HTMLElement[] = [];

    function updateSelection(): void {
      cards.forEach((card, i) => {
        if (DAILY_GOAL_OPTIONS[i].minutes === selectedGoal) {
          addClass(card, 'onboarding__goal-card--selected');
        } else {
          card.classList.remove('onboarding__goal-card--selected');
        }
      });
    }

    const goalsContainer = el('div', { className: 'onboarding__goals' });
    DAILY_GOAL_OPTIONS.forEach((opt) => {
      const card = el('div', { className: 'onboarding__goal-card' }, [
        el('div', { className: 'onboarding__goal-value' }, [`${opt.minutes} ${t('stats.min')}`]),
        el('div', { className: 'onboarding__goal-subtitle' }, [t(opt.subtitleKey)]),
      ]);
      if (opt.minutes === selectedGoal) {
        addClass(card, 'onboarding__goal-card--selected');
      }
      card.addEventListener('click', () => {
        selectedGoal = opt.minutes;
        updateSelection();
      });
      cards.push(card);
      goalsContainer.appendChild(card);
    });

    const step = el('div', { className: 'onboarding__step' }, [
      buildProgressDots(6),
      el('h2', { className: 'onboarding__title' }, [t('onboarding.howManyMinutes')]),
      el('p', { className: 'onboarding__detail' }, [t('onboarding.goalExplain')]),
      goalsContainer,
      el('button', {
        className: 'btn btn--primary btn--lg',
        onClick: () => {
          dailyGoal = selectedGoal;
          finishOnboarding();
        },
      }, [t('onboarding.startBtn')]),
    ]);
    return step;
  }

  // ─── Finish ─────────────────────────────────────────────────────

  function finishOnboarding(): void {
    const durationMs = exerciseEndTime - exerciseStartTime;

    const exerciseResult: ExerciseResult = {
      exerciseId: 'go-no-go',
      timestamp: exerciseStartTime,
      durationMs,
      level: 1,
      score: miniExerciseScore,
      metrics: {
        accuracy: miniExerciseCorrect / miniExerciseTotal,
        totalTrials: miniExerciseTotal,
        correctTrials: miniExerciseCorrect,
        commissionErrors: 0,
        omissionErrors: miniExerciseTotal - miniExerciseCorrect,
      },
      xpEarned: 0,
    };

    // Calculate proper XP for the onboarding exercise
    exerciseResult.xpEarned = calculateXP(exerciseResult, false, false);

    appState.updateData((data) => {
      // Profile
      data.profile.name = userName;
      data.profile.avatarColor = avatarColor;
      data.profile.createdAt = Date.now();

      // Settings
      data.settings.dailyGoalMinutes = dailyGoal;

      // Exercise history
      data.exerciseHistory.push(exerciseResult);

      // Add XP from onboarding exercise
      data.progression.totalXP += exerciseResult.xpEarned;

      // Mark complete
      data.onboardingComplete = true;
    });

    appState.flush();

    window.location.hash = '#/dashboard';
  }

  // ─── Start wizard ──────────────────────────────────────────────

  transitionStep(wrapper, buildWelcome, disposables);

  return () => {
    disposables.dispose();
  };
};
