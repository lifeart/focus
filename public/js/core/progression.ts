import type {
  ExerciseResult,
  ExerciseId,
  ProgressionData,
  DifficultyState,
  EarnedBadge,
  WeeklyChallenge,
  BadgeTier,
  ScoreTier,
} from '../types.js';
import {
  xpForLevel,
  SCORE_TIERS,
  BADGE_DEFINITIONS,
  WEEKLY_CHALLENGE_TYPES,
  STREAK_FREEZE_MAX,
  STREAK_FREEZE_EARN_INTERVAL,
} from '../constants.js';
import { t } from './i18n.js';

// ─── XP Calculation ──────────────────────────────────────────────────

export function calculateXP(
  result: ExerciseResult,
  isSessionComplete: boolean,
  isStreakDay: boolean,
): number {
  // Exercise score: map 0-100 to 10-50
  let xp = Math.round(10 + (result.score / 100) * 40);

  if (isSessionComplete) xp += 30;
  if (isStreakDay) xp += 20;
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
  return t(`level.${clamped}` as any);
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
      return { label: t(`scoreTier.${keySuffix}` as any), tier: tierDef.tier, showPercent: tierDef.showPercent };
    }
  }
  // Fallback
  const firstTier = SCORE_TIERS[0];
  const keySuffix = TIER_KEY_MAP[firstTier.tier] || firstTier.tier;
  return { label: t(`scoreTier.${keySuffix}` as any), tier: firstTier.tier, showPercent: firstTier.showPercent };
}
