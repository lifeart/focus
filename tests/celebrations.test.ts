import { describe, it, expect } from 'vitest';
import { getLevel, getLevelTitle, checkBadges } from '../public/js/core/progression';
import { THEME_UNLOCK_LEVELS, AVATAR_UNLOCK_LEVELS, xpForLevel } from '../public/js/constants';
import type { ProgressionData, DifficultyState, ExerciseId, EarnedBadge, ThemeId } from '../public/js/types';

// ─── Helpers ──────────────────────────────────────────────────────────

function makeDefaultDifficulty(): Record<ExerciseId, DifficultyState> {
  const ids: ExerciseId[] = ['go-no-go', 'n-back', 'flanker', 'visual-search', 'breathing', 'pomodoro'];
  const result = {} as Record<ExerciseId, DifficultyState>;
  for (const id of ids) {
    result[id] = {
      exerciseId: id,
      currentLevel: 1,
      recentScores: [],
      sessionsAtCurrentLevel: 0,
    };
  }
  return result;
}

function makeProgression(overrides?: Partial<ProgressionData>): ProgressionData {
  return {
    totalXP: 0,
    level: 1,
    activityDays: [],
    longestStreak: 0,
    currentStreak: 0,
    streakFreezes: 0,
    streakFreezeUsedDays: [],
    lastStreakCheckDate: '',
    streakFreezeEarnedAt: [],
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
    ...overrides,
  };
}

/** Get the cumulative XP needed to reach a specific level. */
function cumulativeXPForLevel(level: number): number {
  let total = 0;
  for (let l = 2; l <= level; l++) {
    total += xpForLevel(l);
  }
  return total;
}

// ─── Level-up detection ───────────────────────────────────────────────

describe('Level-up detection', () => {
  it('detects level-up when XP crosses threshold', () => {
    // XP just below level 2 threshold
    const xpBelow = cumulativeXPForLevel(2) - 1;
    const levelBefore = getLevel(xpBelow);
    expect(levelBefore).toBe(1);

    // Add enough XP to cross into level 2
    const xpAfter = cumulativeXPForLevel(2);
    const levelAfter = getLevel(xpAfter);
    expect(levelAfter).toBe(2);
    expect(levelAfter).toBeGreaterThan(levelBefore);
  });

  it('does not detect level-up when XP stays within same level', () => {
    const xpBefore = cumulativeXPForLevel(2) + 10;
    const levelBefore = getLevel(xpBefore);

    const xpAfter = xpBefore + 20;
    const levelAfter = getLevel(xpAfter);

    expect(levelAfter).toBe(levelBefore);
  });

  it('handles multiple level jumps showing final level', () => {
    const levelBefore = getLevel(0);
    expect(levelBefore).toBe(1);

    // Jump to level 4
    const xpForLevel4 = cumulativeXPForLevel(4);
    const levelAfter = getLevel(xpForLevel4 + 100);
    expect(levelAfter).toBeGreaterThanOrEqual(4);
    expect(levelAfter).toBeGreaterThan(levelBefore);
  });

  it('caps at level 30', () => {
    expect(getLevel(999999)).toBe(30);
    // Adding more XP should still be level 30
    expect(getLevel(9999999)).toBe(30);
  });
});

// ─── Badge detection integration ──────────────────────────────────────

describe('Badge detection with checkBadges', () => {
  it('returns newly earned badges', () => {
    const progression = makeProgression({ totalSessionCount: 10 });
    const difficulty = makeDefaultDifficulty();
    const newBadges = checkBadges(progression, difficulty);
    expect(newBadges.length).toBeGreaterThan(0);
    expect(newBadges.some((b) => b.id === 'sessions' && b.tier === 'bronze')).toBe(true);
  });

  it('returns empty array on second call without changes (deduplication)', () => {
    const progression = makeProgression({ totalSessionCount: 10 });
    const difficulty = makeDefaultDifficulty();

    const firstCall = checkBadges(progression, difficulty);
    expect(firstCall.length).toBeGreaterThan(0);

    // Push earned badges into progression
    for (const badge of firstCall) {
      progression.earnedBadges.push(badge);
    }

    // Second call should return nothing new
    const secondCall = checkBadges(progression, difficulty);
    expect(secondCall.length).toBe(0);
  });

  it('awards highest eligible tier directly (gold without bronze/silver)', () => {
    const progression = makeProgression({ totalSessionCount: 100 });
    const difficulty = makeDefaultDifficulty();
    const newBadges = checkBadges(progression, difficulty);
    const sessionBadge = newBadges.find((b) => b.id === 'sessions');
    expect(sessionBadge).toBeDefined();
    expect(sessionBadge!.tier).toBe('gold');
  });
});

// ─── Unlocked content calculation ─────────────────────────────────────

describe('Unlocked content at level thresholds', () => {
  it('identifies ocean theme unlocked at level 5', () => {
    const unlocked: ThemeId[] = [];
    for (const [themeId, unlockLevel] of Object.entries(THEME_UNLOCK_LEVELS)) {
      if (unlockLevel === 5) {
        unlocked.push(themeId as ThemeId);
      }
    }
    expect(unlocked).toContain('ocean');
  });

  it('identifies avatar unlock at level 3', () => {
    expect(AVATAR_UNLOCK_LEVELS.includes(3)).toBe(true);
  });

  it('no theme unlock at level 2', () => {
    const unlocked: ThemeId[] = [];
    for (const [themeId, unlockLevel] of Object.entries(THEME_UNLOCK_LEVELS)) {
      if (unlockLevel === 2) {
        unlocked.push(themeId as ThemeId);
      }
    }
    expect(unlocked.length).toBe(0);
  });
});

// ─── CelebrationData serialization ───────────────────────────────────

describe('CelebrationData serialization', () => {
  it('round-trips through JSON', () => {
    const data = {
      levelUp: {
        newLevel: 5,
        title: 'Alert Mind',
        unlockedThemes: ['ocean' as ThemeId],
        unlockedAvatarLevel: true,
      },
      badges: [
        { id: 'sessions' as const, tier: 'bronze' as const, earnedAt: Date.now() },
      ] as EarnedBadge[],
    };

    const serialized = JSON.stringify(data);
    const deserialized = JSON.parse(serialized);

    expect(deserialized.levelUp.newLevel).toBe(5);
    expect(deserialized.levelUp.title).toBe('Alert Mind');
    expect(deserialized.levelUp.unlockedThemes).toEqual(['ocean']);
    expect(deserialized.levelUp.unlockedAvatarLevel).toBe(true);
    expect(deserialized.badges.length).toBe(1);
    expect(deserialized.badges[0].id).toBe('sessions');
    expect(deserialized.badges[0].tier).toBe('bronze');
  });

  it('handles celebration with only badges (no level-up)', () => {
    const data = {
      badges: [
        { id: 'focus-time' as const, tier: 'silver' as const, earnedAt: Date.now() },
      ] as EarnedBadge[],
    };

    const serialized = JSON.stringify(data);
    const deserialized = JSON.parse(serialized);

    expect(deserialized.levelUp).toBeUndefined();
    expect(deserialized.badges.length).toBe(1);
  });

  it('handles empty celebration data', () => {
    const data = { badges: [] as EarnedBadge[] };
    const serialized = JSON.stringify(data);
    const deserialized = JSON.parse(serialized);
    expect(deserialized.badges.length).toBe(0);
  });
});

// ─── getLevelTitle ────────────────────────────────────────────────────

describe('getLevelTitle for celebration display', () => {
  it('returns correct title for level 5', () => {
    const title = getLevelTitle(5);
    expect(title).toBeTruthy();
    expect(typeof title).toBe('string');
  });

  it('returns correct title for level 30', () => {
    const title = getLevelTitle(30);
    expect(title).toBeTruthy();
  });

  it('clamps out-of-range levels', () => {
    const title = getLevelTitle(0);
    expect(title).toBeTruthy(); // Should clamp to level 1
  });
});
