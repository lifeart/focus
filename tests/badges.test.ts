import { describe, it, expect } from 'vitest';
import { checkBadges } from '../public/js/core/progression';
import type { ProgressionData, DifficultyState, ExerciseId, EarnedBadge } from '../public/js/types';

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

describe('checkBadges', () => {
  it('returns empty array when no badges earned', () => {
    const progression = makeProgression();
    const difficulty = makeDefaultDifficulty();
    const newBadges = checkBadges(progression, difficulty);
    expect(newBadges).toEqual([]);
  });

  it('returns newly earned sessions badge at bronze (10 sessions)', () => {
    const progression = makeProgression({ totalSessionCount: 10 });
    const difficulty = makeDefaultDifficulty();
    const newBadges = checkBadges(progression, difficulty);
    const sessionBadge = newBadges.find((b) => b.id === 'sessions');
    expect(sessionBadge).toBeDefined();
    expect(sessionBadge!.tier).toBe('bronze');
  });

  it('returns sessions badge at silver (50 sessions)', () => {
    const progression = makeProgression({ totalSessionCount: 50 });
    const difficulty = makeDefaultDifficulty();
    const newBadges = checkBadges(progression, difficulty);
    const sessionBadge = newBadges.find((b) => b.id === 'sessions');
    expect(sessionBadge).toBeDefined();
    // 50 < 100 (gold), so gold is not met. 50 >= 50 (silver), so silver is awarded.
    expect(sessionBadge!.tier).toBe('silver');
  });

  it('returns sessions badge at gold (100 sessions)', () => {
    const progression = makeProgression({ totalSessionCount: 100 });
    const difficulty = makeDefaultDifficulty();
    const newBadges = checkBadges(progression, difficulty);
    const sessionBadge = newBadges.find((b) => b.id === 'sessions');
    expect(sessionBadge).toBeDefined();
    expect(sessionBadge!.tier).toBe('gold');
  });

  it('does not duplicate already-earned badges', () => {
    const existingBadge: EarnedBadge = { id: 'sessions', tier: 'bronze', earnedAt: Date.now() };
    const progression = makeProgression({
      totalSessionCount: 15,
      earnedBadges: [existingBadge],
    });
    const difficulty = makeDefaultDifficulty();
    const newBadges = checkBadges(progression, difficulty);
    // Should not re-earn bronze sessions badge
    const bronzeSessionBadges = newBadges.filter(
      (b) => b.id === 'sessions' && b.tier === 'bronze',
    );
    expect(bronzeSessionBadges.length).toBe(0);
  });

  it('awards higher tier even if lower tier already earned', () => {
    const existingBadge: EarnedBadge = { id: 'sessions', tier: 'bronze', earnedAt: Date.now() };
    const progression = makeProgression({
      totalSessionCount: 55,
      earnedBadges: [existingBadge],
    });
    const difficulty = makeDefaultDifficulty();
    const newBadges = checkBadges(progression, difficulty);
    const sessionBadge = newBadges.find((b) => b.id === 'sessions');
    expect(sessionBadge).toBeDefined();
    expect(sessionBadge!.tier).toBe('silver');
  });

  it('returns focus-time badge at bronze (60 minutes)', () => {
    const progression = makeProgression({
      totalFocusTimeMs: 60 * 60000, // 60 minutes in ms
    });
    const difficulty = makeDefaultDifficulty();
    const newBadges = checkBadges(progression, difficulty);
    const focusBadge = newBadges.find((b) => b.id === 'focus-time');
    expect(focusBadge).toBeDefined();
    expect(focusBadge!.tier).toBe('bronze');
  });

  it('returns focus-time badge at silver (300 minutes)', () => {
    const progression = makeProgression({
      totalFocusTimeMs: 300 * 60000,
    });
    const difficulty = makeDefaultDifficulty();
    const newBadges = checkBadges(progression, difficulty);
    const focusBadge = newBadges.find((b) => b.id === 'focus-time');
    expect(focusBadge).toBeDefined();
    expect(focusBadge!.tier).toBe('silver');
  });

  it('returns focus-time badge at gold (600 minutes)', () => {
    const progression = makeProgression({
      totalFocusTimeMs: 600 * 60000,
    });
    const difficulty = makeDefaultDifficulty();
    const newBadges = checkBadges(progression, difficulty);
    const focusBadge = newBadges.find((b) => b.id === 'focus-time');
    expect(focusBadge).toBeDefined();
    expect(focusBadge!.tier).toBe('gold');
  });

  it('returns breathing-sessions badge at bronze', () => {
    const progression = makeProgression({ breathingSessions: 10 });
    const difficulty = makeDefaultDifficulty();
    const newBadges = checkBadges(progression, difficulty);
    const breathingBadge = newBadges.find((b) => b.id === 'breathing-sessions');
    expect(breathingBadge).toBeDefined();
    expect(breathingBadge!.tier).toBe('bronze');
  });

  it('returns multiple badge types at once', () => {
    const progression = makeProgression({
      totalSessionCount: 10,
      totalFocusTimeMs: 60 * 60000,
      breathingSessions: 10,
    });
    const difficulty = makeDefaultDifficulty();
    const newBadges = checkBadges(progression, difficulty);
    const badgeIds = newBadges.map((b) => b.id);
    expect(badgeIds).toContain('sessions');
    expect(badgeIds).toContain('focus-time');
    expect(badgeIds).toContain('breathing-sessions');
  });

  it('does not return badges when value is below threshold', () => {
    const progression = makeProgression({ totalSessionCount: 5 });
    const difficulty = makeDefaultDifficulty();
    const newBadges = checkBadges(progression, difficulty);
    const sessionBadge = newBadges.find((b) => b.id === 'sessions');
    expect(sessionBadge).toBeUndefined();
  });

  // ─── weekly-goal badge ─────────────────────────────────────────────
  it('awards weekly-goal badge at bronze (2 weeks with >= 5 activity days)', () => {
    // Create 2 full weeks of activity (Mon-Fri each week)
    const activityDays: string[] = [];
    // Week 1: Jan 6-10 2025 (Mon-Fri)
    for (let d = 6; d <= 10; d++) {
      activityDays.push(`2025-01-${String(d).padStart(2, '0')}`);
    }
    // Week 2: Jan 13-17 2025 (Mon-Fri)
    for (let d = 13; d <= 17; d++) {
      activityDays.push(`2025-01-${String(d).padStart(2, '0')}`);
    }
    const progression = makeProgression({ activityDays });
    const difficulty = makeDefaultDifficulty();
    const newBadges = checkBadges(progression, difficulty);
    const weeklyBadge = newBadges.find((b) => b.id === 'weekly-goal');
    expect(weeklyBadge).toBeDefined();
    expect(weeklyBadge!.tier).toBe('bronze');
  });

  // ─── go-no-go-accuracy badge ──────────────────────────────────────
  it('awards go-no-go-accuracy badge at bronze (personal record >= 85)', () => {
    const progression = makeProgression({
      personalRecords: {
        'go-no-go': 85,
        'n-back': 0,
        'flanker': 0,
        'visual-search': 0,
        'breathing': 0,
        'pomodoro': 0,
      },
    });
    const difficulty = makeDefaultDifficulty();
    const newBadges = checkBadges(progression, difficulty);
    const accBadge = newBadges.find((b) => b.id === 'go-no-go-accuracy');
    expect(accBadge).toBeDefined();
    expect(accBadge!.tier).toBe('bronze');
  });

  it('awards go-no-go-accuracy badge at gold (personal record >= 98)', () => {
    const progression = makeProgression({
      personalRecords: {
        'go-no-go': 98,
        'n-back': 0,
        'flanker': 0,
        'visual-search': 0,
        'breathing': 0,
        'pomodoro': 0,
      },
    });
    const difficulty = makeDefaultDifficulty();
    const newBadges = checkBadges(progression, difficulty);
    const accBadge = newBadges.find((b) => b.id === 'go-no-go-accuracy');
    expect(accBadge).toBeDefined();
    expect(accBadge!.tier).toBe('gold');
  });

  // ─── n-back-level badge ───────────────────────────────────────────
  it('awards n-back-level badge at bronze (currentLevel >= 3)', () => {
    const difficulty = makeDefaultDifficulty();
    difficulty['n-back'].currentLevel = 3;
    const progression = makeProgression();
    const newBadges = checkBadges(progression, difficulty);
    const nBackBadge = newBadges.find((b) => b.id === 'n-back-level');
    expect(nBackBadge).toBeDefined();
    expect(nBackBadge!.tier).toBe('bronze');
  });

  it('awards n-back-level badge at gold (currentLevel >= 10)', () => {
    const difficulty = makeDefaultDifficulty();
    difficulty['n-back'].currentLevel = 10;
    const progression = makeProgression();
    const newBadges = checkBadges(progression, difficulty);
    const nBackBadge = newBadges.find((b) => b.id === 'n-back-level');
    expect(nBackBadge).toBeDefined();
    expect(nBackBadge!.tier).toBe('gold');
  });

  // ─── personal-record badge ────────────────────────────────────────
  it('awards personal-record badge at bronze (recordsBroken >= 5)', () => {
    const progression = makeProgression({ recordsBroken: 5 });
    const difficulty = makeDefaultDifficulty();
    const newBadges = checkBadges(progression, difficulty);
    const prBadge = newBadges.find((b) => b.id === 'personal-record');
    expect(prBadge).toBeDefined();
    expect(prBadge!.tier).toBe('bronze');
  });

  it('awards personal-record badge at gold (recordsBroken >= 30)', () => {
    const progression = makeProgression({ recordsBroken: 30 });
    const difficulty = makeDefaultDifficulty();
    const newBadges = checkBadges(progression, difficulty);
    const prBadge = newBadges.find((b) => b.id === 'personal-record');
    expect(prBadge).toBeDefined();
    expect(prBadge!.tier).toBe('gold');
  });
});
