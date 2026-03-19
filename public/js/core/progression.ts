import type {
  ExerciseResult,
  ExerciseId,
  ProgressionData,
  DifficultyState,
  EarnedBadge,
  WeeklyChallenge,
  BadgeTier,
} from '../types.js';
import {
  xpForLevel,
  LEVEL_TITLES,
  SCORE_TIERS,
  BADGE_DEFINITIONS,
  WEEKLY_CHALLENGE_TYPES,
} from '../constants.js';

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
  return LEVEL_TITLES[clamped] || LEVEL_TITLES[30];
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

export function getScoreTier(score: number): { label: string; showPercent: boolean } {
  for (const tier of SCORE_TIERS) {
    if (score >= tier.min && score <= tier.max) {
      return { label: tier.label, showPercent: tier.showPercent };
    }
  }
  // Fallback
  return { label: SCORE_TIERS[0].label, showPercent: SCORE_TIERS[0].showPercent };
}
