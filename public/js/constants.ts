import type {
  ExerciseId,
  ExerciseConfig,
  DifficultyParams,
  BadgeDefinition,
  AppSettings,
  AppData,
  ThemeId,
  ScoreTier,
  BreathingPattern,
  WeeklyChallenge,
  BadgeTier,
} from './types.js';

// ─── Storage key & version ───────────────────────────────────────────

export const APP_DATA_KEY = 'focus:app_data';
export const SESSION_RESULT_KEY = 'focus:last_exercise_result';
export const SESSION_BONUS_KEY = 'focus:last_bonus_event';
export const SESSION_MOOD_KEY = 'focus:session_mood';
export const SESSION_POST_MOOD_KEY = 'focus:post_session_mood';
export const CURRENT_DATA_VERSION = 1;

// ─── Exercise configs ────────────────────────────────────────────────

export const EXERCISE_CONFIGS: Record<ExerciseId, ExerciseConfig> = {
  'go-no-go': {
    id: 'go-no-go',
    name: 'Реакция Go/No-Go',
    description: 'Нажимайте на зелёные стимулы и сдерживайте реакцию на красные',
    category: 'cognitive',
    icon: '🎯',
    durationSeconds: 60,
    minLevel: 1,
    maxLevel: 10,
  },
  'n-back': {
    id: 'n-back',
    name: 'N-Back память',
    description: 'Запоминайте последовательность и отмечайте совпадения с N шагов назад',
    category: 'cognitive',
    icon: '🧠',
    durationSeconds: 90,
    minLevel: 1,
    maxLevel: 10,
  },
  'flanker': {
    id: 'flanker',
    name: 'Фланкер',
    description: 'Определите направление центральной стрелки, игнорируя отвлекающие',
    category: 'cognitive',
    icon: '➡️',
    durationSeconds: 60,
    minLevel: 1,
    maxLevel: 10,
  },
  'visual-search': {
    id: 'visual-search',
    name: 'Визуальный поиск',
    description: 'Найдите целевой объект среди отвлекающих элементов',
    category: 'cognitive',
    icon: '🔍',
    durationSeconds: 60,
    minLevel: 1,
    maxLevel: 10,
  },
  'breathing': {
    id: 'breathing',
    name: 'Дыхание',
    description: 'Дыхательная практика для расслабления и концентрации',
    category: 'relaxation',
    icon: '🌬️',
    durationSeconds: 120,
    minLevel: 1,
    maxLevel: 1,
  },
  'pomodoro': {
    id: 'pomodoro',
    name: 'Помодоро',
    description: 'Таймер фокусировки для продуктивной работы',
    category: 'productivity',
    icon: '🍅',
    durationSeconds: 1500,
    minLevel: 1,
    maxLevel: 1,
  },
};

// ─── Difficulty tables (10 levels per exercise) ──────────────────────

export const DIFFICULTY_TABLE: Record<ExerciseId, DifficultyParams[]> = {
  'go-no-go': [
    { level: 1,  isiMin: 1200, isiMax: 1800, noGoRatio: 0.20, stimulusDuration: 500 },
    { level: 2,  isiMin: 1100, isiMax: 1700, noGoRatio: 0.20, stimulusDuration: 475 },
    { level: 3,  isiMin: 1000, isiMax: 1600, noGoRatio: 0.22, stimulusDuration: 450 },
    { level: 4,  isiMin: 950,  isiMax: 1500, noGoRatio: 0.23, stimulusDuration: 425 },
    { level: 5,  isiMin: 850,  isiMax: 1400, noGoRatio: 0.25, stimulusDuration: 400 },
    { level: 6,  isiMin: 800,  isiMax: 1300, noGoRatio: 0.25, stimulusDuration: 380 },
    { level: 7,  isiMin: 700,  isiMax: 1200, noGoRatio: 0.27, stimulusDuration: 360 },
    { level: 8,  isiMin: 650,  isiMax: 1100, noGoRatio: 0.28, stimulusDuration: 340 },
    { level: 9,  isiMin: 550,  isiMax: 900,  noGoRatio: 0.29, stimulusDuration: 320 },
    { level: 10, isiMin: 500,  isiMax: 800,  noGoRatio: 0.30, stimulusDuration: 300 },
  ],
  'n-back': [
    { level: 1,  nLevel: 1, stimulusInterval: 3000 },
    { level: 2,  nLevel: 1, stimulusInterval: 2700 },
    { level: 3,  nLevel: 1, stimulusInterval: 2400 },
    { level: 4,  nLevel: 1, stimulusInterval: 2100 },
    { level: 5,  nLevel: 2, stimulusInterval: 3000 },
    { level: 6,  nLevel: 2, stimulusInterval: 2700 },
    { level: 7,  nLevel: 2, stimulusInterval: 2400 },
    { level: 8,  nLevel: 3, stimulusInterval: 3000 },
    { level: 9,  nLevel: 3, stimulusInterval: 2700 },
    { level: 10, nLevel: 3, stimulusInterval: 2400 },
  ],
  'flanker': [
    { level: 1,  congruentRatio: 0.70, responseDeadline: 2000, flankerIsiMin: 500, flankerIsiMax: 700 },
    { level: 2,  congruentRatio: 0.67, responseDeadline: 1900, flankerIsiMin: 480, flankerIsiMax: 680 },
    { level: 3,  congruentRatio: 0.63, responseDeadline: 1800, flankerIsiMin: 470, flankerIsiMax: 660 },
    { level: 4,  congruentRatio: 0.60, responseDeadline: 1700, flankerIsiMin: 460, flankerIsiMax: 640 },
    { level: 5,  congruentRatio: 0.55, responseDeadline: 1600, flankerIsiMin: 450, flankerIsiMax: 620 },
    { level: 6,  congruentRatio: 0.52, responseDeadline: 1500, flankerIsiMin: 440, flankerIsiMax: 600 },
    { level: 7,  congruentRatio: 0.48, responseDeadline: 1400, flankerIsiMin: 430, flankerIsiMax: 580 },
    { level: 8,  congruentRatio: 0.45, responseDeadline: 1300, flankerIsiMin: 420, flankerIsiMax: 560 },
    { level: 9,  congruentRatio: 0.42, responseDeadline: 1100, flankerIsiMin: 410, flankerIsiMax: 540 },
    { level: 10, congruentRatio: 0.40, responseDeadline: 1000, flankerIsiMin: 400, flankerIsiMax: 520 },
  ],
  'visual-search': [
    { level: 1,  gridSize: 3 },
    { level: 2,  gridSize: 3 },
    { level: 3,  gridSize: 4 },
    { level: 4,  gridSize: 4 },
    { level: 5,  gridSize: 5 },
    { level: 6,  gridSize: 5 },
    { level: 7,  gridSize: 6 },
    { level: 8,  gridSize: 6 },
    { level: 9,  gridSize: 7 },
    { level: 10, gridSize: 7 },
  ],
  'breathing': [
    { level: 1 },
  ],
  'pomodoro': [
    { level: 1 },
  ],
};

// ─── Badge definitions ───────────────────────────────────────────────

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'sessions',
    name: 'Марафонец',
    description: {
      bronze: 'Завершите 10 сессий',
      silver: 'Завершите 50 сессий',
      gold: 'Завершите 100 сессий',
    },
    icon: '🏃',
    condition: { bronze: 10, silver: 50, gold: 100 },
  },
  {
    id: 'weekly-goal',
    name: 'Целеустремлённый',
    description: {
      bronze: 'Выполните недельную цель 2 раза',
      silver: 'Выполните недельную цель 5 раз',
      gold: 'Выполните недельную цель 10 раз',
    },
    icon: '🎯',
    condition: { bronze: 2, silver: 5, gold: 10 },
  },
  {
    id: 'go-no-go-accuracy',
    name: 'Снайпер',
    description: {
      bronze: 'Точность Go/No-Go ≥ 85%',
      silver: 'Точность Go/No-Go ≥ 92%',
      gold: 'Точность Go/No-Go ≥ 98%',
    },
    icon: '🎯',
    condition: { bronze: 85, silver: 92, gold: 98 },
  },
  {
    id: 'n-back-level',
    name: 'Вундеркинд',
    description: {
      bronze: 'Достигните уровня 3 в N-Back',
      silver: 'Достигните уровня 6 в N-Back',
      gold: 'Достигните уровня 10 в N-Back',
    },
    icon: '🧠',
    condition: { bronze: 3, silver: 6, gold: 10 },
  },
  {
    id: 'focus-time',
    name: 'Фокус-мастер',
    description: {
      bronze: 'Накопите 60 минут фокусировки',
      silver: 'Накопите 300 минут фокусировки',
      gold: 'Накопите 600 минут фокусировки',
    },
    icon: '⏱️',
    condition: { bronze: 60, silver: 300, gold: 600 },
  },
  {
    id: 'breathing-sessions',
    name: 'Мастер дыхания',
    description: {
      bronze: 'Завершите 10 дыхательных сессий',
      silver: 'Завершите 30 дыхательных сессий',
      gold: 'Завершите 100 дыхательных сессий',
    },
    icon: '🌬️',
    condition: { bronze: 10, silver: 30, gold: 100 },
  },
  {
    id: 'personal-record',
    name: 'Рекордсмен',
    description: {
      bronze: 'Побейте личный рекорд 5 раз',
      silver: 'Побейте личный рекорд 15 раз',
      gold: 'Побейте личный рекорд 30 раз',
    },
    icon: '🏆',
    condition: { bronze: 5, silver: 15, gold: 30 },
  },
];

// ─── XP sources ──────────────────────────────────────────────────────

export const XP_SOURCES = {
  exerciseComplete: 20,
  perfectScore: 15,
  sessionComplete: 10,
  dailyGoalMet: 25,
  streakDay: 5,
  recordBroken: 30,
  weeklyChallengeComplete: 50,
  bonusEvent: 10,
} as const;

// ─── XP required per level ───────────────────────────────────────────

export function xpForLevel(level: number): number {
  return Math.floor(80 * Math.pow(level, 1.3));
}

export const XP_TABLE: number[] = Array.from({ length: 31 }, (_, i) => xpForLevel(i));

// ─── Level titles (Russian) ─────────────────────────────────────────

export const LEVEL_TITLES: Record<number, string> = {
  1:  'Новичок',
  2:  'Ученик',
  3:  'Стажёр',
  4:  'Практикант',
  5:  'Внимательный',
  6:  'Сосредоточенный',
  7:  'Наблюдатель',
  8:  'Аналитик',
  9:  'Стратег',
  10: 'Тактик',
  11: 'Исследователь',
  12: 'Знаток',
  13: 'Эксперт',
  14: 'Специалист',
  15: 'Профессионал',
  16: 'Мастер',
  17: 'Виртуоз',
  18: 'Гуру',
  19: 'Наставник',
  20: 'Мудрец',
  21: 'Провидец',
  22: 'Оракул',
  23: 'Архитектор разума',
  24: 'Хранитель фокуса',
  25: 'Повелитель внимания',
  26: 'Магистр концентрации',
  27: 'Гроссмейстер',
  28: 'Легенда',
  29: 'Титан',
  30: 'Абсолют',
};

// ─── Score tiers ─────────────────────────────────────────────────────

export const SCORE_TIERS: { min: number; max: number; label: string; tier: ScoreTier; showPercent: boolean }[] = [
  { min: 0,  max: 59,  label: 'Разминка',      tier: 'warmup',     showPercent: true },
  { min: 60, max: 74,  label: 'Хороший старт',  tier: 'good-start', showPercent: true },
  { min: 75, max: 84,  label: 'Отлично',        tier: 'great',      showPercent: true },
  { min: 85, max: 94,  label: 'Потрясающе',     tier: 'amazing',    showPercent: true },
  { min: 95, max: 100, label: 'Идеально',       tier: 'perfect',    showPercent: true },
];

// ─── Default settings ────────────────────────────────────────────────

export const DEFAULT_SETTINGS: AppSettings = {
  dailyGoalMinutes: 10,
  soundEnabled: true,
  theme: 'dark',
  breathingPattern: '4-4-4',
  pomodoroMinutes: 25,
  showStreak: true,
};

// ─── Default app data factory ────────────────────────────────────────

export function createDefaultAppData(): AppData {
  const now = Date.now();
  return {
    version: CURRENT_DATA_VERSION,
    profile: {
      name: '',
      avatarColor: '#6C5CE7',
      avatarLevel: 1,
      createdAt: now,
    },
    settings: { ...DEFAULT_SETTINGS },
    progression: {
      totalXP: 0,
      level: 1,
      activityDays: [],
      longestStreak: 0,
      earnedBadges: [],
      personalRecords: {
        'go-no-go': 0,
        'n-back': 0,
        'flanker': 0,
        'visual-search': 0,
        'breathing': 0,
        'pomodoro': 0,
      },
      recordsBroken: 0,
      totalSessionCount: 0,
      totalFocusTimeMs: 0,
      breathingSessions: 0,
    },
    difficulty: {
      'go-no-go':       { exerciseId: 'go-no-go',       currentLevel: 1, recentScores: [], sessionsAtCurrentLevel: 0 },
      'n-back':         { exerciseId: 'n-back',         currentLevel: 1, recentScores: [], sessionsAtCurrentLevel: 0 },
      'flanker':        { exerciseId: 'flanker',        currentLevel: 1, recentScores: [], sessionsAtCurrentLevel: 0 },
      'visual-search':  { exerciseId: 'visual-search',  currentLevel: 1, recentScores: [], sessionsAtCurrentLevel: 0 },
      'breathing':      { exerciseId: 'breathing',      currentLevel: 1, recentScores: [], sessionsAtCurrentLevel: 0 },
      'pomodoro':       { exerciseId: 'pomodoro',       currentLevel: 1, recentScores: [], sessionsAtCurrentLevel: 0 },
    },
    history: [],
    exerciseHistory: [],
    onboardingComplete: false,
  };
}

// ─── Breathing patterns ──────────────────────────────────────────────

export const BREATHING_PATTERNS: Record<BreathingPattern, { inhale: number; hold: number; exhale: number; label: string }> = {
  '4-4-4': { inhale: 4, hold: 4, exhale: 4, label: 'Коробочное дыхание (4-4-4)' },
  '4-7-8': { inhale: 4, hold: 7, exhale: 8, label: 'Расслабляющее дыхание (4-7-8)' },
};

// ─── Pomodoro motivational quotes (Russian) ──────────────────────────

export const POMODORO_QUOTES: string[] = [
  'Сосредоточься на одной задаче — и ты удивишься результату.',
  'Каждая минута фокуса приближает тебя к цели.',
  'Маленькие шаги ведут к большим достижениям.',
  'Дисциплина — это мост между целями и результатами.',
  'Не бойся медленного продвижения — бойся остановки.',
  'Фокус — это суперсила, доступная каждому.',
  'Твой мозг — мощный инструмент. Используй его с умом.',
  'Сейчас — лучшее время для того, чтобы начать.',
  'Постоянство побеждает интенсивность.',
  'Успех — это сумма маленьких усилий, повторяемых день за днём.',
  'Отвлечения крадут время. Верни его себе.',
  'Глубокая работа — ключ к мастерству.',
  'Каждая завершённая сессия — это победа над хаосом.',
];

// ─── Avatar unlock levels ────────────────────────────────────────────

export const AVATAR_UNLOCK_LEVELS: number[] = [1, 3, 5, 8, 10, 13, 16, 20, 25, 30];

// ─── Theme unlock levels ─────────────────────────────────────────────

export const THEME_UNLOCK_LEVELS: Record<ThemeId, number> = {
  dark:   1,
  light:  1,
  ocean:  5,
  sunset: 10,
  forest: 15,
  amoled: 20,
};

// ─── Weekly challenge templates ──────────────────────────────────────

export const WEEKLY_CHALLENGE_TYPES: Omit<WeeklyChallenge, 'progress' | 'weekStart'>[] = [
  {
    description: 'Выполните 3 упражнения с результатом ≥ 90%',
    type: 'perfect-exercises',
    target: 3,
    xpReward: 50,
  },
  {
    description: 'Завершите 7 сессий за неделю',
    type: 'total-sessions',
    target: 7,
    xpReward: 50,
  },
  {
    description: 'Накопите 30 минут фокусировки за неделю',
    type: 'focus-time',
    target: 30,
    xpReward: 50,
  },
  {
    description: 'Пройдите 5 упражнений без единой ошибки',
    type: 'no-errors',
    target: 5,
    xpReward: 75,
  },
];
