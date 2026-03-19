// Locale type
export type Locale = 'ru' | 'en' | 'de' | 'fr' | 'es';

// Exercise IDs as union type
export type ExerciseId = 'go-no-go' | 'n-back' | 'flanker' | 'visual-search' | 'breathing' | 'pomodoro';

// Exercise category
export type ExerciseCategory = 'cognitive' | 'relaxation' | 'productivity';

// Badge tier
export type BadgeTier = 'bronze' | 'silver' | 'gold';

// Badge ID - union type of all badge identifiers
export type BadgeId =
  | 'sessions' | 'weekly-goal' | 'go-no-go-accuracy' | 'n-back-level'
  | 'focus-time' | 'breathing-sessions' | 'personal-record';

// Mood types for mood check
export type Mood = 'energized' | 'calm' | 'tired' | 'stressed';

// Theme ID
export type ThemeId = 'dark' | 'light' | 'ocean' | 'sunset' | 'forest' | 'amoled';

// Score tier label
export type ScoreTier = 'warmup' | 'good-start' | 'great' | 'amazing' | 'perfect';

// Breathing pattern
export type BreathingPattern = '4-4-4' | '4-7-8';

export interface ExerciseConfig {
  id: ExerciseId;
  name: string;
  description: string;
  category: ExerciseCategory;
  icon: string; // emoji or unicode symbol
  durationSeconds: number;
  minLevel: number;
  maxLevel: number;
}

export interface DifficultyParams {
  level: number;
  // Go/No-Go
  isiMin?: number;
  isiMax?: number;
  noGoRatio?: number;
  stimulusDuration?: number;
  // N-Back
  nLevel?: number;
  stimulusInterval?: number;
  // Flanker
  congruentRatio?: number;
  responseDeadline?: number;
  flankerIsiMin?: number;
  flankerIsiMax?: number;
  // Visual Search
  gridSize?: number;
  // General
  [key: string]: number | undefined;
}

export interface ExerciseMetrics {
  accuracy: number; // 0-1
  totalTrials: number;
  correctTrials: number;
  // Go/No-Go specific
  commissionErrors?: number;
  omissionErrors?: number;
  meanRT?: number;
  rtVariability?: number; // CV
  // N-Back specific
  hits?: number;
  misses?: number;
  falseAlarms?: number;
  dPrime?: number;
  // Flanker specific
  rtCongruent?: number;
  rtIncongruent?: number;
  interferenceScore?: number;
  // Visual Search specific
  searchTime?: number;
  itemsPerSecond?: number;
}

export interface ExerciseResult {
  exerciseId: ExerciseId;
  timestamp: number;
  durationMs: number;
  level: number;
  score: number; // 0-100
  metrics: ExerciseMetrics;
  xpEarned: number;
}

export interface DifficultyState {
  exerciseId: ExerciseId;
  currentLevel: number;
  recentScores: number[]; // last N scores
  sessionsAtCurrentLevel: number;
  lastMicroAdjustment?: number; // timestamp
}

export interface UserProfile {
  name: string;
  avatarColor: string;
  avatarLevel: number;
  createdAt: number;
}

export interface AppSettings {
  dailyGoalMinutes: number; // 5, 10, or 15
  soundEnabled: boolean;
  theme: ThemeId;
  breathingPattern: BreathingPattern;
  pomodoroMinutes: number; // 15, 20, or 25
  showStreak: boolean;
  locale: Locale;
}

export interface ProgressionData {
  totalXP: number;
  level: number;
  // Streak
  activityDays: string[]; // ISO date strings of days with activity
  longestStreak: number;
  // Badges
  earnedBadges: EarnedBadge[];
  // Personal records
  personalRecords: Record<ExerciseId, number>; // best score per exercise
  recordsBroken: number; // total times a record was broken
  // Weekly
  weeklyChallenge?: WeeklyChallenge;
  totalSessionCount: number;
  totalFocusTimeMs: number;
  breathingSessions: number;
}

export interface EarnedBadge {
  id: BadgeId;
  tier: BadgeTier;
  earnedAt: number;
}

export interface BadgeDefinition {
  id: BadgeId;
  name: string;
  description: Record<BadgeTier, string>;
  icon: string;
  condition: Record<BadgeTier, number>; // threshold values
}

export interface WeeklyChallenge {
  description: string;
  type: 'perfect-exercises' | 'total-sessions' | 'focus-time' | 'no-errors';
  target: number;
  progress: number;
  weekStart: string; // ISO date of Monday
  xpReward: number;
}

export interface SessionPlan {
  exercises: ExerciseId[];
  estimatedMinutes: number;
  includesBreathing: boolean;
}

export interface SessionResult {
  startedAt: number;
  completedAt: number;
  exercises: ExerciseResult[];
  totalXP: number;
  mood?: Mood;
  bonusEvent?: boolean; // random bonus event
}

export interface AppData {
  version: number;
  profile: UserProfile;
  settings: AppSettings;
  progression: ProgressionData;
  difficulty: Record<ExerciseId, DifficultyState>;
  history: SessionResult[];
  exerciseHistory: ExerciseResult[];
  onboardingComplete: boolean;
}

// Typed events - discriminated union
export type AppEvent =
  | { type: 'exercise-complete'; result: ExerciseResult }
  | { type: 'session-complete'; result: SessionResult }
  | { type: 'xp-gained'; amount: number; total: number }
  | { type: 'level-up'; newLevel: number; title: string }
  | { type: 'badge-earned'; badge: EarnedBadge }
  | { type: 'difficulty-changed'; exerciseId: ExerciseId; newLevel: number; direction: 'up' | 'down' }
  | { type: 'record-broken'; exerciseId: ExerciseId; oldRecord: number; newRecord: number }
  | { type: 'settings-changed'; settings: AppSettings }
  | { type: 'profile-updated'; profile: UserProfile }
  | { type: 'data-imported' }
  | { type: 'data-reset' }
  | { type: 'weekly-challenge-complete'; challenge: WeeklyChallenge };

// Event listener type
export type EventListener<T extends AppEvent['type']> = (event: Extract<AppEvent, { type: T }>) => void;

// Exercise interface (composition pattern)
export interface Exercise {
  id: ExerciseId;
  setup(container: HTMLElement): void;
  start(): void;
  pause(): void;
  resume(): void;
  stop(): ExerciseResult;
  destroy(): void;
}

// Exercise factory type
export type ExerciseFactory = (id: ExerciseId, level: number, params: DifficultyParams, sound: SoundManager) => Exercise;

// Sound manager interface
export interface SoundManager {
  playCorrect(): void;
  playIncorrect(): void;
  playStart(): void;
  playEnd(): void;
  playTick(): void;
  playLevelUp(): void;
  playBadge(): void;
  setEnabled(enabled: boolean): void;
  isEnabled(): boolean;
}

// Disposables interface
export interface Disposables {
  addTimeout(id: ReturnType<typeof setTimeout>): void;
  addInterval(id: ReturnType<typeof setInterval>): void;
  addRAF(id: number): void;
  addListener(el: EventTarget, event: string, handler: EventListenerOrEventListenerObject): void;
  addCleanup(fn: () => void): void;
  setTimeout(fn: () => void, ms: number): ReturnType<typeof setTimeout>;
  setInterval(fn: () => void, ms: number): ReturnType<typeof setInterval>;
  requestAnimationFrame(fn: FrameRequestCallback): number;
  dispose(): void;
}

// Screen render function type
export type ScreenRender = (container: HTMLElement, params?: Record<string, string>) => (() => void) | void;

// Route definition
export interface Route {
  pattern: string;
  screen: ScreenRender;
}
