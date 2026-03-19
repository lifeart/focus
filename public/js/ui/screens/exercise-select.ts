import type { ScreenRender, ExerciseId, ExerciseCategory } from '../../types.js';
import { el, addClass } from '../renderer.js';
import { appState } from '../../main.js';
import { EXERCISE_CONFIGS } from '../../constants.js';
import { getScoreTier } from '../../core/progression.js';

interface CategoryGroup {
  label: string;
  category: ExerciseCategory;
  exercises: ExerciseId[];
}

const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    label: 'Когнитивные',
    category: 'cognitive',
    exercises: ['go-no-go', 'n-back', 'flanker', 'visual-search'],
  },
  {
    label: 'Расслабление',
    category: 'relaxation',
    exercises: ['breathing'],
  },
  {
    label: 'Продуктивность',
    category: 'productivity',
    exercises: ['pomodoro'],
  },
];

const CATEGORY_BADGE_CLASS: Record<ExerciseCategory, string> = {
  cognitive: 'badge--cognitive',
  relaxation: 'badge--relaxation',
  productivity: 'badge--productivity',
};

const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  cognitive: 'Когнитивное',
  relaxation: 'Расслабление',
  productivity: 'Продуктивность',
};

export const renderExerciseSelect: ScreenRender = (container, _params) => {
  addClass(container, 'screen');

  const data = appState.getData();
  const { personalRecords } = data.progression;
  const difficulty = data.difficulty;

  const header = el('div', { className: 'screen__header' }, [
    el('h1', { className: 'screen__title' }, ['Выбор упражнения']),
  ]);
  container.appendChild(header);

  const cleanupFns: (() => void)[] = [];

  for (const group of CATEGORY_GROUPS) {
    const category = el('div', { className: 'exercise-category' }, [
      el('h2', { className: 'exercise-category__title' }, [group.label]),
    ]);

    const list = el('div', { className: 'exercise-list' });

    for (const exerciseId of group.exercises) {
      const config = EXERCISE_CONFIGS[exerciseId];
      const currentLevel = difficulty[exerciseId].currentLevel;
      const bestScore = personalRecords[exerciseId] ?? 0;
      const tier = getScoreTier(bestScore);

      const scoreDisplay = bestScore > 0
        ? `${bestScore} — ${tier.label}`
        : 'Нет результатов';

      const card = el('div', { className: 'card card--interactive' }, [
        el('div', { className: 'flex flex--between' }, [
          el('div', { className: 'flex flex--gap-sm flex--align-center' }, [
            el('span', { className: 'exercise-card__icon' }, [config.icon]),
            el('div', null, [
              el('div', { className: 'exercise-card__header' }, [
                el('h3', { className: 'card__title' }, [config.name]),
                el('span', { className: `badge ${CATEGORY_BADGE_CLASS[config.category]}` }, [
                  CATEGORY_LABELS[config.category],
                ]),
              ]),
              el('p', { className: 'card__subtitle' }, [config.description]),
            ]),
          ]),
          el('div', { className: 'text--right flex--shrink-0' }, [
            el('span', { className: 'badge badge--primary' }, [`\u0423\u0440. ${currentLevel}`]),
            bestScore > 0
              ? el('p', { className: 'card__subtitle' }, [scoreDisplay])
              : el('p', { className: 'card__subtitle' }, [scoreDisplay]),
          ]),
        ]),
      ]);

      const handleClick = () => {
        window.location.hash = `#/play/${exerciseId}`;
      };

      card.addEventListener('click', handleClick);
      cleanupFns.push(() => card.removeEventListener('click', handleClick));

      list.appendChild(card);
    }

    category.appendChild(list);
    container.appendChild(category);
  }

  return () => {
    for (const fn of cleanupFns) {
      fn();
    }
  };
};
