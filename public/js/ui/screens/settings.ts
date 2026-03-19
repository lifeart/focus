import type { ScreenRender, ThemeId, BreathingPattern } from '../../types.js';
import { el, addClass } from '../renderer.js';
import { appState, getSoundManager } from '../../main.js';
import { THEME_UNLOCK_LEVELS, BREATHING_PATTERNS } from '../../constants.js';
import { exportData, importData } from '../../core/storage.js';
import { getLevel } from '../../core/progression.js';
import { createDisposables } from '../../core/disposables.js';

// ─── Theme display names ────────────────────────────────────────────

const THEME_NAMES: Record<ThemeId, string> = {
  dark: 'Тёмная',
  light: 'Светлая',
  ocean: 'Океан',
  sunset: 'Закат',
  forest: 'Лес',
  amoled: 'AMOLED',
};

// ─── Render Settings ────────────────────────────────────────────────

export const renderSettings: ScreenRender = (container, _params) => {
  const disposables = createDisposables();
  addClass(container, 'screen', 'settings-screen');

  const data = appState.getData();
  const settings = data.settings;
  const userLevel = getLevel(data.progression.totalXP);

  // ── Header ──

  const header = el('div', { className: 'screen__header' }, [
    el('h1', { className: 'screen__title' }, ['Настройки']),
  ]);
  container.appendChild(header);

  const sections = el('div', { className: 'settings__sections' });
  container.appendChild(sections);

  // ── 1. Profile ──

  {
    const section = createSection('Профиль');
    const nameInput = el('input', {
      type: 'text',
      className: 'settings__input',
      value: data.profile.name,
      placeholder: 'Ваше имя',
    }) as HTMLInputElement;

    const onBlur = () => {
      const newName = nameInput.value.trim();
      if (newName !== appState.getData().profile.name) {
        appState.updateData((d) => {
          d.profile.name = newName;
        });
        appState.emit({ type: 'profile-updated', profile: appState.getData().profile });
      }
    };

    disposables.addListener(nameInput, 'blur', onBlur);
    disposables.addListener(nameInput, 'change', onBlur);

    section.appendChild(el('label', { className: 'settings__label' }, ['Имя']));
    section.appendChild(nameInput);
    sections.appendChild(section);
  }

  // ── 2. Daily Goal ──

  {
    const section = createSection('Дневная цель');
    const options = [5, 10, 15];
    const chips = el('div', { className: 'settings__chips' });

    for (const mins of options) {
      const isActive = settings.dailyGoalMinutes === mins;
      const chip = el(
        'button',
        { className: `settings__chip${isActive ? ' settings__chip--active' : ''}` },
        [`${mins} мин`],
      );
      disposables.addListener(chip, 'click', () => {
        appState.updateData((d) => {
          d.settings.dailyGoalMinutes = mins;
        });
        appState.emit({ type: 'settings-changed', settings: appState.getData().settings });
        updateChips(chips, mins);
      });
      chips.appendChild(chip);
    }

    section.appendChild(chips);
    sections.appendChild(section);
  }

  // ── 3. Sound Toggle ──

  {
    const section = createSection('Звук');
    const toggle = el('div', { className: 'settings__toggle-row' });
    const label = el('span', null, [settings.soundEnabled ? 'Вкл' : 'Выкл']);
    const btn = el(
      'button',
      { className: `settings__toggle${settings.soundEnabled ? ' settings__toggle--on' : ''}` },
      [el('span', { className: 'settings__toggle-knob' })],
    );

    disposables.addListener(btn, 'click', () => {
      const current = appState.getData().settings.soundEnabled;
      const newVal = !current;
      appState.updateData((d) => {
        d.settings.soundEnabled = newVal;
      });
      getSoundManager().setEnabled(newVal);
      appState.emit({ type: 'settings-changed', settings: appState.getData().settings });
      label.textContent = newVal ? 'Вкл' : 'Выкл';
      if (newVal) {
        addClass(btn, 'settings__toggle--on');
      } else {
        btn.classList.remove('settings__toggle--on');
      }
    });

    toggle.appendChild(label);
    toggle.appendChild(btn);
    section.appendChild(toggle);
    sections.appendChild(section);
  }

  // ── 4. Theme ──

  {
    const section = createSection('Тема');
    const grid = el('div', { className: 'settings__theme-grid' });

    const themeIds: ThemeId[] = ['dark', 'light', 'ocean', 'sunset', 'forest', 'amoled'];

    for (const themeId of themeIds) {
      const requiredLevel = THEME_UNLOCK_LEVELS[themeId];
      const isUnlocked = userLevel >= requiredLevel;
      const isActive = settings.theme === themeId;

      const classes = ['settings__theme-card'];
      if (isActive) classes.push('settings__theme-card--active');
      if (!isUnlocked) classes.push('settings__theme-card--locked');

      const children: (Node | string)[] = [
        el('span', { className: 'settings__theme-name' }, [THEME_NAMES[themeId]]),
      ];

      if (!isUnlocked) {
        children.push(
          el('span', { className: 'settings__theme-lock' }, [`Ур. ${requiredLevel}`]),
        );
      }

      const card = el('div', { className: classes.join(' ') }, children);

      if (isUnlocked) {
        disposables.addListener(card, 'click', () => {
          appState.updateData((d) => {
            d.settings.theme = themeId;
          });
          appState.emit({ type: 'settings-changed', settings: appState.getData().settings });
          document.documentElement.setAttribute('data-theme', themeId);
          updateThemeCards(grid, themeId);
        });
      }

      grid.appendChild(card);
    }

    section.appendChild(grid);
    sections.appendChild(section);
  }

  // ── 5. Breathing Pattern ──

  {
    const section = createSection('Паттерн дыхания');
    const chips = el('div', { className: 'settings__chips' });
    const patterns: BreathingPattern[] = ['4-4-4', '4-7-8'];

    for (const pattern of patterns) {
      const patternInfo = BREATHING_PATTERNS[pattern];
      const isActive = settings.breathingPattern === pattern;
      const isLocked = pattern === '4-7-8' && userLevel < 5;

      const classes = ['settings__chip'];
      if (isActive) classes.push('settings__chip--active');
      if (isLocked) classes.push('settings__chip--locked');

      const label = isLocked ? `${patternInfo.label} (Ур. 5)` : patternInfo.label;
      const chip = el('button', { className: classes.join(' ') }, [label]);

      if (isLocked) {
        chip.setAttribute('disabled', '');
      }

      if (!isLocked) {
        disposables.addListener(chip, 'click', () => {
          appState.updateData((d) => {
            d.settings.breathingPattern = pattern;
          });
          appState.emit({ type: 'settings-changed', settings: appState.getData().settings });
          updateBreathingChips(chips, pattern);
        });
      }

      chips.appendChild(chip);
    }

    section.appendChild(chips);
    sections.appendChild(section);
  }

  // ── 6. Pomodoro Duration ──

  {
    const section = createSection('Длительность помодоро');
    const chips = el('div', { className: 'settings__chips' });
    const durations = [15, 20, 25];

    for (const mins of durations) {
      const isActive = settings.pomodoroMinutes === mins;
      const chip = el(
        'button',
        { className: `settings__chip${isActive ? ' settings__chip--active' : ''}` },
        [`${mins} мин`],
      );
      disposables.addListener(chip, 'click', () => {
        appState.updateData((d) => {
          d.settings.pomodoroMinutes = mins;
        });
        appState.emit({ type: 'settings-changed', settings: appState.getData().settings });
        updateChips(chips, mins);
      });
      chips.appendChild(chip);
    }

    section.appendChild(chips);
    sections.appendChild(section);
  }

  // ── 7. Export / Import ──

  {
    const section = createSection('Данные');
    const row = el('div', { className: 'settings__button-row' });

    const exportBtn = el('button', { className: 'settings__btn' }, ['Экспорт данных']);
    disposables.addListener(exportBtn, 'click', () => {
      const json = exportData(appState.getData());
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = el('a', { href: url, download: 'focus-data.json' });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });

    const importBtn = el('button', { className: 'settings__btn' }, ['Импорт данных']);
    disposables.addListener(importBtn, 'click', () => {
      const input = el('input', { type: 'file', accept: '.json', className: 'hidden' }) as HTMLInputElement;
      document.body.appendChild(input);

      const onChange = () => {
        const file = input.files?.[0];
        if (!file) {
          document.body.removeChild(input);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const text = reader.result as string;
          const imported = importData(text);
          if (imported) {
            appState.updateData((d) => {
              Object.assign(d, imported);
            });
            appState.emit({ type: 'data-imported' });
            document.documentElement.setAttribute('data-theme', imported.settings.theme);
            // Re-render by navigating to settings again
            window.location.hash = '#/settings';
          }
          document.body.removeChild(input);
        };
        reader.readAsText(file);
      };

      input.addEventListener('change', onChange);
      input.click();
    });

    row.appendChild(exportBtn);
    row.appendChild(importBtn);
    section.appendChild(row);
    sections.appendChild(section);
  }

  // ── 8. Reset Progress ──

  {
    const section = createSection('Сброс');

    const resetBtn = el('button', { className: 'settings__btn settings__btn--danger' }, ['Сбросить прогресс']);

    disposables.addListener(resetBtn, 'click', () => {
      showResetConfirmation(section, disposables);
    });

    section.appendChild(resetBtn);
    sections.appendChild(section);
  }

  return () => {
    disposables.dispose();
  };
};

// ─── Helpers ────────────────────────────────────────────────────────

function createSection(title: string): HTMLElement {
  const section = el('div', { className: 'settings__section' }, [
    el('h2', { className: 'settings__section-title' }, [title]),
  ]);
  return section;
}

function updateChips(container: HTMLElement, activeValue: number): void {
  const chips = container.querySelectorAll('.settings__chip');
  chips.forEach((chip) => {
    const text = chip.textContent || '';
    const value = parseInt(text, 10);
    chip.classList.toggle('settings__chip--active', value === activeValue);
  });
}

function updateThemeCards(container: HTMLElement, activeTheme: ThemeId): void {
  const cards = container.querySelectorAll('.settings__theme-card');
  cards.forEach((card) => {
    const nameEl = card.querySelector('.settings__theme-name');
    const name = nameEl?.textContent || '';
    const themeId = Object.entries(THEME_NAMES).find(([, v]) => v === name)?.[0];
    card.classList.toggle('settings__theme-card--active', themeId === activeTheme);
  });
}

function updateBreathingChips(container: HTMLElement, activePattern: BreathingPattern): void {
  const chips = container.querySelectorAll('.settings__chip');
  const patterns: BreathingPattern[] = ['4-4-4', '4-7-8'];
  chips.forEach((chip, index) => {
    if (index < patterns.length) {
      chip.classList.toggle('settings__chip--active', patterns[index] === activePattern);
    }
  });
}

function showResetConfirmation(
  section: HTMLElement,
  disposables: ReturnType<typeof createDisposables>,
): void {
  // Remove existing confirmation if any
  const existing = section.querySelector('.settings__confirm');
  if (existing) {
    existing.remove();
    return;
  }

  const confirm = el('div', { className: 'settings__confirm' }, [
    el('p', { className: 'settings__confirm-text' }, ['Вы уверены? Все данные будут удалены.']),
  ]);

  const btnRow = el('div', { className: 'settings__button-row' });

  const cancelBtn = el('button', { className: 'settings__btn' }, ['Отмена']);
  disposables.addListener(cancelBtn, 'click', () => {
    confirm.remove();
  });

  const confirmBtn = el('button', { className: 'settings__btn settings__btn--danger' }, ['Сбросить']);
  disposables.addListener(confirmBtn, 'click', () => {
    appState.resetData();
    window.location.hash = '#/onboarding';
  });

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(confirmBtn);
  confirm.appendChild(btnRow);
  section.appendChild(confirm);
}
