import type { ScreenRender, ExerciseId, ExerciseCategory } from '../../types.js';
import { el, addClass } from '../renderer.js';
import { appState } from '../../main.js';
import { EXERCISE_CONFIGS } from '../../constants.js';
import { getScoreTier } from '../../core/progression.js';
import { t } from '../../core/i18n.js';

interface CategoryGroup {
  labelKey: 'category.cognitive' | 'category.relaxation' | 'category.productivity';
  category: ExerciseCategory;
  exercises: ExerciseId[];
}

const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    labelKey: 'category.cognitive',
    category: 'cognitive',
    exercises: ['go-no-go', 'n-back', 'flanker', 'visual-search'],
  },
  {
    labelKey: 'category.relaxation',
    category: 'relaxation',
    exercises: ['breathing'],
  },
  {
    labelKey: 'category.productivity',
    category: 'productivity',
    exercises: ['pomodoro'],
  },
];

const CATEGORY_BADGE_CLASS: Record<ExerciseCategory, string> = {
  cognitive: 'badge--cognitive',
  relaxation: 'badge--relaxation',
  productivity: 'badge--productivity',
};

export const renderExerciseSelect: ScreenRender = (container, _params) => {
  addClass(container, 'screen');

  const data = appState.getData();
  const { personalRecords } = data.progression;
  const difficulty = data.difficulty;

  const header = el('div', { className: 'screen__header' }, [
    el('h1', { className: 'screen__title' }, [t('exerciseSelect.title')]),
  ]);
  container.appendChild(header);

  const cleanupFns: (() => void)[] = [];

  for (const group of CATEGORY_GROUPS) {
    const category = el('div', { className: 'exercise-category' }, [
      el('h2', { className: 'exercise-category__title' }, [t(group.labelKey)]),
    ]);

    const list = el('div', { className: 'exercise-list' });

    for (const exerciseId of group.exercises) {
      const config = EXERCISE_CONFIGS[exerciseId];
      const currentLevel = difficulty[exerciseId].currentLevel;
      const bestScore = personalRecords[exerciseId] ?? 0;
      const tier = getScoreTier(bestScore);

      const exerciseName = t(`exercise.${exerciseId}.name` as any);
      const exerciseDesc = t(`exercise.${exerciseId}.description` as any);
      const categoryLabel = t(`category.${config.category}` as any);

      const scoreDisplay = bestScore > 0
        ? `${bestScore} — ${tier.label}`
        : t('exerciseSelect.noResults');

      const card = el('div', { className: 'card card--interactive' }, [
        el('div', { className: 'flex flex--between' }, [
          el('div', { className: 'flex flex--gap-sm flex--align-center' }, [
            el('span', { className: 'exercise-card__icon' }, [config.icon]),
            el('div', null, [
              el('div', { className: 'exercise-card__header' }, [
                el('h3', { className: 'card__title' }, [exerciseName]),
                el('span', { className: `badge ${CATEGORY_BADGE_CLASS[config.category]}` }, [
                  categoryLabel,
                ]),
              ]),
              el('p', { className: 'card__subtitle' }, [exerciseDesc]),
            ]),
          ]),
          el('div', { className: 'text--right flex--shrink-0' }, [
            el('span', { className: 'badge badge--primary' }, [t('exerciseSelect.level', { level: currentLevel })]),
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
