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

// Session type
export type SessionType = 'quick' | 'standard' | 'deep';

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
  searchSlope?: number; // ms per additional item (linear regression)
  // Flanker neutral trial metrics
  rtNeutral?: number;
  facilitationScore?: number; // rtNeutral - rtCongruent
  inhibitionCost?: number; // rtIncongruent - rtNeutral
  // N-Back lure trial metrics
  lureTrials?: number;
  lureFalseAlarms?: number;
  // Cross-exercise clinical metrics
  lapseRate?: number; // proportion of RTs > mean + 3*SD
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
  lastLevelChange?: 'up' | 'down';
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
  currentStreak: number;
  streakFreezes: number; // 0-3
  streakFreezeUsedDays: string[]; // ISO dates when freeze consumed
  lastStreakCheckDate: string;
  streakFreezeEarnedAt: number[]; // streak milestones where freezes were earned
  // Badges
  earnedBadges: EarnedBadge[];
  // Personal records
  personalRecords: Record<ExerciseId, number>; // best score per exercise
  recordsBroken: number; // total times a record was broken
  // Weekly
  weeklyChallenge?: WeeklyChallenge;
  // Daily
  dailyChallenge?: DailyChallenge;
  lastDailyBonusDate?: string;  // ISO date of last login bonus
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

// Daily challenge types (12 types — no 'no-pause-session')
export type DailyChallengeType =
  | 'high-score-exercise'    // Score X%+ on a specific exercise
  | 'complete-exercises'     // Complete N exercises
  | 'beat-personal-best'    // Beat personal best in any exercise
  | 'train-minutes'         // Train for N minutes total today
  | 'multi-exercise-score'  // Score X%+ on N different exercises
  | 'specific-exercise'     // Complete a specific exercise
  | 'low-lapse-rate'        // Achieve <X% attention lapses
  | 'breathing-session'     // Complete a breathing session
  | 'fast-reaction'         // Average RT under X ms in Go/No-Go
  | 'n-back-level'          // Complete N-Back at level N+
  | 'streak-day'            // Train on a streak day (just show up)
  | 'accuracy-streak'       // Get 3 exercises in a row with 80%+
  ;

export interface DailyChallenge {
  type: DailyChallengeType;
  target: number;
  progress: number;
  date: string;          // ISO date string (YYYY-MM-DD)
  xpReward: number;      // 15-30
  completed: boolean;
  // Optional context for parameterized challenges
  exerciseId?: ExerciseId;
  threshold?: number;     // e.g. 90 for "score 90%+"
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

export interface BaselineResult {
  timestamp: number;
  sessionNumber: number; // which session this baseline was taken at
  exercises: ExerciseResult[];
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
  baseline?: BaselineResult;
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
  | { type: 'weekly-challenge-complete'; challenge: WeeklyChallenge }
  | { type: 'streak-freeze-used'; date: string; remainingFreezes: number }
  | { type: 'streak-lost'; previousStreak: number }
  | { type: 'daily-challenge-complete'; challenge: DailyChallenge }
  | { type: 'daily-bonus'; amount: number };

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
