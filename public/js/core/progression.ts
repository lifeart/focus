import type {
  ExerciseResult,
  ExerciseId,
  ProgressionData,
  DifficultyState,
  EarnedBadge,
  WeeklyChallenge,
  DailyChallenge,
  BadgeTier,
  ScoreTier,
} from '../types.js';
import {
  xpForLevel,
  SCORE_TIERS,
  BADGE_DEFINITIONS,
  WEEKLY_CHALLENGE_TYPES,
  DAILY_CHALLENGE_TYPES,
  STREAK_FREEZE_MAX,
  STREAK_FREEZE_EARN_INTERVAL,
  XP_SOURCES,
} from '../constants.js';
import { td } from './i18n.js';

// ─── XP Calculation ──────────────────────────────────────────────────

export function calculateXP(
  result: ExerciseResult,
  isSessionComplete: boolean,
  isStreakDay: boolean,
): number {
  // Exercise score: map 0-100 to 10-50
  let xp = Math.round(10 + (result.score / 100) * 40);

  if (isSessionComplete) xp += 30;
  if (isStreakDay) xp += XP_SOURCES.streakDay;
  if (result.score >= 95) xp += 25;

  return xp;
}

// ─── Level & Title ───────────────────────────────────────────────────

export function getLevel(totalXP: number): number {
  let cumulative = 0;
  for (let l = 2; l <= 30; l++) {
    cumulative += xpForLevel(l);
    if (totalXP < cumulative) return l - 1;
  }
  return 30;
}

export function getLevelTitle(level: number): string {
  const clamped = Math.max(1, Math.min(30, level));
  return td(`level.${clamped}`);
}

export function getXPProgress(totalXP: number): { current: number; required: number; percent: number } {
  const level = getLevel(totalXP);
  // Calculate XP spent on levels up to current
  let spent = 0;
  for (let l = 2; l <= level; l++) {
    spent += xpForLevel(l);
  }
  const current = totalXP - spent;
  const required = xpForLevel(level + 1);
  const percent = required > 0 ? Math.min(100, Math.round((current / required) * 100)) : 100;
  return { current, required, percent };
}

// ─── Streak ──────────────────────────────────────────────────────────

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday = 1
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function updateStreak(activityDays: string[]): {
  currentWeekDays: number;
  weeklyGoalMet: boolean;
  longestStreak: number;
} {
  if (activityDays.length === 0) {
    return { currentWeekDays: 0, weeklyGoalMet: false, longestStreak: 0 };
  }

  // Current week (Mon-Sun) days count
  const today = new Date();
  const monday = getMondayOfWeek(today);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const mondayStr = monday.toISOString().slice(0, 10);
  const sundayStr = sunday.toISOString().slice(0, 10);

  const currentWeekDays = activityDays.filter(
    (d) => d >= mondayStr && d <= sundayStr,
  ).length;

  const weeklyGoalMet = currentWeekDays >= 5;

  // Longest consecutive streak
  const sorted = [...activityDays].sort();
  let longestStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diffDays = (curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000);

    if (Math.round(diffDays) === 1) {
      currentStreak++;
      if (currentStreak > longestStreak) longestStreak = currentStreak;
    } else if (Math.round(diffDays) > 1) {
      currentStreak = 1;
    }
    // If diffDays === 0 (duplicate day), skip
  }

  return { currentWeekDays, weeklyGoalMet, longestStreak };
}

// ─── Current Streak ─────────────────────────────────────────────────

/**
 * Walk backward from today counting consecutive days covered by
 * activity or freeze usage. If today is not yet covered, start from yesterday.
 */
export function getCurrentStreak(activityDays: string[], freezeUsedDays: string[]): number {
  const coveredSet = new Set<string>([...activityDays, ...freezeUsedDays]);
  if (coveredSet.size === 0) return 0;

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // Determine start date: today if covered, else yesterday
  let cursor: Date;
  if (coveredSet.has(todayStr)) {
    cursor = new Date(today);
  } else {
    cursor = new Date(today);
    cursor.setDate(cursor.getDate() - 1);
    const yesterdayStr = cursor.toISOString().slice(0, 10);
    if (!coveredSet.has(yesterdayStr)) return 0;
  }

  let streak = 0;
  while (true) {
    const dateStr = cursor.toISOString().slice(0, 10);
    if (!coveredSet.has(dateStr)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/**
 * Called on app open. Processes gap days between lastStreakCheckDate and today.
 * Consumes freezes for gap days, resets streak if freezes run out.
 * Also checks for freeze earning at 7-day milestones.
 */
export function checkAndUpdateStreak(progression: ProgressionData): {
  freezeConsumed: boolean;
  streakLost: boolean;
  currentStreak: number;
  freezeEarned: boolean;
  newFreezeCount: number;
} {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // Already checked today — no-op
  if (progression.lastStreakCheckDate === todayStr) {
    return {
      freezeConsumed: false,
      streakLost: false,
      currentStreak: progression.currentStreak,
      freezeEarned: false,
      newFreezeCount: progression.streakFreezes,
    };
  }

  let freezeConsumed = false;
  let streakLost = false;

  // First run — no gap penalties
  if (!progression.lastStreakCheckDate) {
    progression.lastStreakCheckDate = todayStr;
    progression.currentStreak = getCurrentStreak(
      progression.activityDays,
      progression.streakFreezeUsedDays,
    );
    // Check freeze earning
    const { earned, newFreezeCount } = checkFreezeEarning(progression);
    return {
      freezeConsumed: false,
      streakLost: false,
      currentStreak: progression.currentStreak,
      freezeEarned: earned,
      newFreezeCount,
    };
  }

  // Find gap days between lastStreakCheckDate (exclusive) and today (exclusive)
  const lastCheck = new Date(progression.lastStreakCheckDate + 'T00:00:00Z');
  const gapDays: string[] = [];
  const cursor = new Date(lastCheck);
  cursor.setDate(cursor.getDate() + 1);

  while (cursor.toISOString().slice(0, 10) < todayStr) {
    const dateStr = cursor.toISOString().slice(0, 10);
    // Only count as gap if no activity that day
    if (!progression.activityDays.includes(dateStr)) {
      gapDays.push(dateStr);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  // Process gaps: consume freezes or break streak
  for (const gapDay of gapDays) {
    if (progression.streakFreezes > 0 && progression.currentStreak > 0) {
      // Consume a freeze
      progression.streakFreezes--;
      progression.streakFreezeUsedDays.push(gapDay);
      freezeConsumed = true;
    } else if (progression.currentStreak > 0) {
      // No freezes left — streak breaks
      streakLost = true;
      progression.currentStreak = 0;
      break;
    }
  }

  // Recalculate current streak
  progression.currentStreak = getCurrentStreak(
    progression.activityDays,
    progression.streakFreezeUsedDays,
  );

  // Update longest streak
  if (progression.currentStreak > progression.longestStreak) {
    progression.longestStreak = progression.currentStreak;
  }

  // Check freeze earning
  const { earned, newFreezeCount } = checkFreezeEarning(progression);

  // Update last check date
  progression.lastStreakCheckDate = todayStr;

  return {
    freezeConsumed,
    streakLost,
    currentStreak: progression.currentStreak,
    freezeEarned: earned,
    newFreezeCount,
  };
}

function checkFreezeEarning(progression: ProgressionData): {
  earned: boolean;
  newFreezeCount: number;
} {
  let earned = false;
  const streak = progression.currentStreak;

  // Check every 7-day milestone
  if (streak > 0 && streak % STREAK_FREEZE_EARN_INTERVAL === 0) {
    if (
      !progression.streakFreezeEarnedAt.includes(streak) &&
      progression.streakFreezes < STREAK_FREEZE_MAX
    ) {
      progression.streakFreezes++;
      progression.streakFreezeEarnedAt.push(streak);
      earned = true;
    }
  }

  return { earned, newFreezeCount: progression.streakFreezes };
}

// ─── Badges ──────────────────────────────────────────────────────────

function getBadgeValue(
  badgeId: string,
  progression: ProgressionData,
  difficulty: Record<ExerciseId, DifficultyState>,
): number {
  switch (badgeId) {
    case 'sessions':
      return progression.totalSessionCount;
    case 'weekly-goal': {
      // Count how many weeks the weekly goal was met
      // Approximate: count distinct weeks with >= 5 activity days
      const weekMap = new Map<string, number>();
      for (const day of progression.activityDays) {
        const d = new Date(day);
        const mon = getMondayOfWeek(d);
        const key = mon.toISOString().slice(0, 10);
        weekMap.set(key, (weekMap.get(key) || 0) + 1);
      }
      let count = 0;
      for (const v of weekMap.values()) {
        if (v >= 5) count++;
      }
      return count;
    }
    case 'go-no-go-accuracy':
      return progression.personalRecords['go-no-go'] || 0;
    case 'n-back-level':
      return difficulty['n-back']?.currentLevel || 0;
    case 'focus-time':
      return Math.floor(progression.totalFocusTimeMs / 60000);
    case 'breathing-sessions':
      return progression.breathingSessions;
    case 'personal-record':
      return progression.recordsBroken;
    default:
      return 0;
  }
}

export function checkBadges(
  progression: ProgressionData,
  difficulty: Record<ExerciseId, DifficultyState>,
): EarnedBadge[] {
  const newBadges: EarnedBadge[] = [];
  const now = Date.now();

  for (const def of BADGE_DEFINITIONS) {
    const value = getBadgeValue(def.id, progression, difficulty);
    const tiers: BadgeTier[] = ['gold', 'silver', 'bronze'];

    for (const tier of tiers) {
      if (value >= def.condition[tier]) {
        const alreadyEarned = progression.earnedBadges.some(
          (b) => b.id === def.id && b.tier === tier,
        );
        if (!alreadyEarned) {
          newBadges.push({ id: def.id, tier, earnedAt: now });
        }
        break; // Only award highest unearned tier
      }
    }
  }

  return newBadges;
}

// ─── Weekly Challenge ────────────────────────────────────────────────

export function generateWeeklyChallenge(): WeeklyChallenge {
  const template = WEEKLY_CHALLENGE_TYPES[Math.floor(Math.random() * WEEKLY_CHALLENGE_TYPES.length)];
  const monday = getMondayOfWeek(new Date());

  return {
    ...template,
    progress: 0,
    weekStart: monday.toISOString().slice(0, 10),
  };
}

export function checkWeeklyChallenge(
  challenge: WeeklyChallenge,
  progression: ProgressionData,
): boolean {
  return challenge.progress >= challenge.target;
}

// ─── Score Tier ──────────────────────────────────────────────────────

// Map from ScoreTier id to translation key suffix
const TIER_KEY_MAP: Record<string, string> = {
  'warmup': 'warmup',
  'good-start': 'goodStart',
  'great': 'great',
  'amazing': 'amazing',
  'perfect': 'perfect',
};

export function getScoreTier(score: number): { label: string; tier: ScoreTier; showPercent: boolean } {
  for (const tierDef of SCORE_TIERS) {
    if (score >= tierDef.min && score <= tierDef.max) {
      const keySuffix = TIER_KEY_MAP[tierDef.tier] || tierDef.tier;
      return { label: td(`scoreTier.${keySuffix}`), tier: tierDef.tier, showPercent: tierDef.showPercent };
    }
  }
  // Fallback
  const firstTier = SCORE_TIERS[0];
  const keySuffix = TIER_KEY_MAP[firstTier.tier] || firstTier.tier;
  return { label: td(`scoreTier.${keySuffix}`), tier: firstTier.tier, showPercent: firstTier.showPercent };
}

// ─── Daily Challenge ──────────────────────────────────────────────────

/**
 * Simple deterministic hash of a date string (djb2).
 * Returns a non-negative integer.
 */
export function dateHash(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash + dateStr.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Get exercises completed today from the full exercise history.
 * Iterates from the end for performance (recent entries are at the end).
 */
export function getTodayExercises(exerciseHistory: ExerciseResult[], dateStr?: string): ExerciseResult[] {
  const todayStr = dateStr || new Date().toISOString().slice(0, 10);
  const results: ExerciseResult[] = [];
  for (let i = exerciseHistory.length - 1; i >= 0; i--) {
    const rDate = new Date(exerciseHistory[i].timestamp).toISOString().slice(0, 10);
    if (rDate === todayStr) {
      results.push(exerciseHistory[i]);
    } else if (rDate < todayStr) {
      // Past entries, no need to continue
      break;
    }
  }
  return results;
}

/**
 * Generate a deterministic daily challenge for a given date.
 * Applies "no repeat from yesterday" filter and difficulty guard for hard challenges.
 */
export function generateDailyChallenge(
  dateStr: string,
  previousChallengeType?: string,
  userHasHistory?: boolean,
  userNBackLevel?: number,
): DailyChallenge {
  const hash = dateHash(dateStr);

  // Filter out hard challenges if user is new (no history)
  let templates = DAILY_CHALLENGE_TYPES.filter((tmpl) => {
    if (tmpl.hard && !userHasHistory) return false;
    // n-back-level: require user has reached at least level 2
    if (tmpl.type === 'n-back-level' && (userNBackLevel || 1) < 2) return false;
    // fast-reaction: require user has some go-no-go history
    if (tmpl.type === 'fast-reaction' && !userHasHistory) return false;
    return true;
  });

  // "No repeat from yesterday" filter
  if (previousChallengeType && templates.length > 1) {
    const filtered = templates.filter((tmpl) => tmpl.type !== previousChallengeType);
    if (filtered.length > 0) {
      templates = filtered;
    }
  }

  const idx = hash % templates.length;
  const template = templates[idx];
  return {
    type: template.type,
    target: template.target,
    progress: 0,
    date: dateStr,
    xpReward: template.xpReward,
    completed: false,
    exerciseId: template.exerciseId,
    threshold: template.threshold,
  };
}

/**
 * Check daily challenge progress after an exercise completes.
 * Returns a new DailyChallenge with updated progress/completed state.
 */
export function checkDailyChallengeProgress(
  challenge: DailyChallenge,
  result: ExerciseResult,
  progression: ProgressionData,
  exerciseHistory: ExerciseResult[],
): DailyChallenge {
  if (challenge.completed) return challenge;

  const todayStr = challenge.date;
  const todayExercises = getTodayExercises(exerciseHistory, todayStr);
  let updated = { ...challenge };

  switch (challenge.type) {
    case 'high-score-exercise':
      if (
        result.exerciseId === challenge.exerciseId &&
        result.score >= (challenge.threshold || 90)
      ) {
        updated.progress = updated.target;
      }
      break;

    case 'complete-exercises':
      // Count today's exercises (result is already in exerciseHistory at this point)
      updated.progress = Math.min(todayExercises.length, updated.target);
      break;

    case 'beat-personal-best': {
      // personalRecords may already be updated to result.score by finishExercise.
      // Check if there's an older exercise in history with a lower score for the same exerciseId.
      const currentRecord = progression.personalRecords[result.exerciseId] || 0;
      if (currentRecord > 0 && result.score >= currentRecord) {
        // Look for a previous result with a lower score for this exercise
        const hasOlderLowerScore = exerciseHistory.some(
          (ex) => ex.exerciseId === result.exerciseId && ex !== result && ex.score < result.score && ex.score > 0,
        );
        if (hasOlderLowerScore) {
          updated.progress = updated.target;
        }
      }
      break;
    }

    case 'train-minutes': {
      // Sum today's exercise durations in minutes
      let totalMs = 0;
      for (const ex of todayExercises) {
        totalMs += ex.durationMs;
      }
      updated.progress = Math.min(Math.floor(totalMs / 60000), updated.target);
      break;
    }

    case 'multi-exercise-score': {
      // Count distinct exerciseIds with score >= threshold completed today
      const threshold = challenge.threshold || 80;
      const qualifying = new Set<string>();
      for (const ex of todayExercises) {
        if (ex.score >= threshold) {
          qualifying.add(ex.exerciseId);
        }
      }
      updated.progress = Math.min(qualifying.size, updated.target);
      break;
    }

    case 'specific-exercise':
      if (result.exerciseId === challenge.exerciseId) {
        updated.progress = updated.target;
      }
      break;

    case 'low-lapse-rate':
      if (
        result.metrics.lapseRate != null &&
        result.metrics.lapseRate < (challenge.threshold || 5) / 100
      ) {
        updated.progress = updated.target;
      }
      break;

    case 'breathing-session':
      if (result.exerciseId === 'breathing') {
        updated.progress = updated.target;
      }
      break;

    case 'fast-reaction':
      if (
        result.exerciseId === 'go-no-go' &&
        result.metrics.meanRT != null &&
        result.metrics.meanRT < (challenge.threshold || 350)
      ) {
        updated.progress = updated.target;
      }
      break;

    case 'n-back-level':
      if (
        result.exerciseId === 'n-back' &&
        result.level >= (challenge.threshold || 3)
      ) {
        updated.progress = updated.target;
      }
      break;

    case 'streak-day':
      // Any exercise completion counts
      updated.progress = updated.target;
      break;

    case 'accuracy-streak': {
      // Track consecutive 80%+ scores in today's exercises
      const threshold = challenge.threshold || 80;
      let consecutiveCount = 0;
      let maxConsecutive = 0;
      // todayExercises is in reverse order (most recent first), so reverse it
      const ordered = [...todayExercises].reverse();
      for (const ex of ordered) {
        if (ex.score >= threshold) {
          consecutiveCount++;
          if (consecutiveCount > maxConsecutive) {
            maxConsecutive = consecutiveCount;
          }
        } else {
          consecutiveCount = 0;
        }
      }
      updated.progress = Math.min(maxConsecutive, updated.target);
      break;
    }
  }

  if (updated.progress >= updated.target) {
    updated.completed = true;
  }

  return updated;
}
