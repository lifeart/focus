import { describe, it, expect, beforeEach } from 'vitest';
import { getCurrentStreak, checkAndUpdateStreak } from '../public/js/core/progression';
import { migrateSchema } from '../public/js/core/storage';
import type { ProgressionData } from '../public/js/types';

function isoDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
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

describe('getCurrentStreak', () => {
  it('returns correct count for consecutive days including today', () => {
    const days = [isoDate(0), isoDate(1), isoDate(2)];
    expect(getCurrentStreak(days, [])).toBe(3);
  });

  it('gap breaks streak', () => {
    // today, yesterday, then skip a day, then 4 days ago
    const days = [isoDate(0), isoDate(1), isoDate(4)];
    expect(getCurrentStreak(days, [])).toBe(2);
  });

  it('today not active but yesterday active = streak alive', () => {
    const days = [isoDate(1), isoDate(2), isoDate(3)];
    expect(getCurrentStreak(days, [])).toBe(3);
  });

  it('freeze days fill gaps', () => {
    // Active today and 3 days ago, freeze used for 1 and 2 days ago
    const activityDays = [isoDate(0), isoDate(3)];
    const freezeDays = [isoDate(1), isoDate(2)];
    expect(getCurrentStreak(activityDays, freezeDays)).toBe(4);
  });

  it('returns 0 for no activity', () => {
    expect(getCurrentStreak([], [])).toBe(0);
  });

  it('returns 0 when last activity was 3 days ago with no freeze', () => {
    const days = [isoDate(3)];
    expect(getCurrentStreak(days, [])).toBe(0);
  });
});

describe('checkAndUpdateStreak', () => {
  it('no gap, no action when already checked today', () => {
    const prog = makeProgression({
      currentStreak: 5,
      lastStreakCheckDate: isoDate(0),
      activityDays: [isoDate(0), isoDate(1), isoDate(2), isoDate(3), isoDate(4)],
    });
    const result = checkAndUpdateStreak(prog);
    expect(result.freezeConsumed).toBe(false);
    expect(result.streakLost).toBe(false);
    expect(result.currentStreak).toBe(5);
  });

  it('one gap day with freeze available: freeze consumed', () => {
    // Last checked 2 days ago, active 2 days ago but NOT yesterday, not today
    const prog = makeProgression({
      currentStreak: 3,
      streakFreezes: 2,
      lastStreakCheckDate: isoDate(2),
      activityDays: [isoDate(2), isoDate(3), isoDate(4)],
    });
    const result = checkAndUpdateStreak(prog);
    expect(result.freezeConsumed).toBe(true);
    expect(result.streakLost).toBe(false);
    expect(prog.streakFreezes).toBe(1); // one freeze consumed for yesterday gap
    expect(prog.streakFreezeUsedDays).toContain(isoDate(1));
  });

  it('one gap day with no freeze: streak reset', () => {
    const prog = makeProgression({
      currentStreak: 3,
      streakFreezes: 0,
      lastStreakCheckDate: isoDate(2),
      activityDays: [isoDate(2), isoDate(3), isoDate(4)],
    });
    const result = checkAndUpdateStreak(prog);
    expect(result.streakLost).toBe(true);
  });

  it('multiple gap days exhaust freezes then break streak', () => {
    // Last checked 4 days ago, active 4 days ago, 3 gap days, 1 freeze
    const prog = makeProgression({
      currentStreak: 5,
      streakFreezes: 1,
      lastStreakCheckDate: isoDate(4),
      activityDays: [isoDate(4), isoDate(5), isoDate(6), isoDate(7), isoDate(8)],
    });
    const result = checkAndUpdateStreak(prog);
    // 3 gap days (3 ago, 2 ago, 1 ago), only 1 freeze
    expect(result.freezeConsumed).toBe(true);
    expect(result.streakLost).toBe(true);
    expect(prog.streakFreezes).toBe(0);
  });

  it('first run (empty lastStreakCheckDate): no gap penalties', () => {
    const prog = makeProgression({
      currentStreak: 0,
      lastStreakCheckDate: '',
      activityDays: [isoDate(0), isoDate(1)],
    });
    const result = checkAndUpdateStreak(prog);
    expect(result.freezeConsumed).toBe(false);
    expect(result.streakLost).toBe(false);
    expect(result.currentStreak).toBe(2);
    expect(prog.lastStreakCheckDate).toBe(isoDate(0));
  });

  it('freeze earning at 7-day milestone', () => {
    // Build a 7-day streak
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(isoDate(i));
    }
    const prog = makeProgression({
      currentStreak: 6,
      streakFreezes: 0,
      lastStreakCheckDate: isoDate(1),
      activityDays: days,
      streakFreezeEarnedAt: [],
    });
    const result = checkAndUpdateStreak(prog);
    // After checking, currentStreak should be 7, which triggers freeze earn
    expect(result.currentStreak).toBe(7);
    expect(result.freezeEarned).toBe(true);
    expect(result.newFreezeCount).toBe(1);
  });

  it('freeze cap at 3', () => {
    const days = [];
    for (let i = 0; i < 21; i++) {
      days.push(isoDate(i));
    }
    const prog = makeProgression({
      currentStreak: 20,
      streakFreezes: 2,
      lastStreakCheckDate: isoDate(1),
      activityDays: days,
      streakFreezeEarnedAt: [7, 14],
    });
    const result = checkAndUpdateStreak(prog);
    // 21-day streak triggers 3rd freeze
    expect(result.currentStreak).toBe(21);
    expect(result.freezeEarned).toBe(true);
    expect(result.newFreezeCount).toBe(3);

    // Now try a 28-day scenario — should NOT earn 4th
    const days2 = [];
    for (let i = 0; i < 28; i++) {
      days2.push(isoDate(i));
    }
    const prog2 = makeProgression({
      currentStreak: 27,
      streakFreezes: 3,
      lastStreakCheckDate: isoDate(1),
      activityDays: days2,
      streakFreezeEarnedAt: [7, 14, 21],
    });
    const result2 = checkAndUpdateStreak(prog2);
    expect(result2.freezeEarned).toBe(false);
    expect(result2.newFreezeCount).toBe(3);
  });
});

describe('v1 -> v2 migration', () => {
  it('adds streak fields to v1 data', () => {
    const v1Data = {
      version: 1,
      profile: { name: 'Test', avatarColor: '#000', avatarLevel: 1, createdAt: Date.now() },
      settings: {
        dailyGoalMinutes: 10,
        soundEnabled: true,
        theme: 'dark',
        breathingPattern: '4-4-4',
        pomodoroMinutes: 25,
        showStreak: true,
        locale: 'en',
      },
      progression: {
        totalXP: 100,
        level: 2,
        activityDays: ['2026-01-01', '2026-01-02'],
        longestStreak: 2,
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
        totalSessionCount: 5,
        totalFocusTimeMs: 300000,
        breathingSessions: 0,
      },
      difficulty: {},
      history: [],
      exerciseHistory: [],
      onboardingComplete: true,
    };

    const migrated = migrateSchema(v1Data);
    expect(migrated.version).toBe(2);
    expect(migrated.progression.currentStreak).toBe(0);
    expect(migrated.progression.streakFreezes).toBe(0);
    expect(migrated.progression.streakFreezeUsedDays).toEqual([]);
    expect(migrated.progression.lastStreakCheckDate).toBe('');
    expect(migrated.progression.streakFreezeEarnedAt).toEqual([]);
  });

  it('does not overwrite existing v2 data', () => {
    const v2Data = {
      version: 2,
      profile: { name: 'Test', avatarColor: '#000', avatarLevel: 1, createdAt: Date.now() },
      settings: {
        dailyGoalMinutes: 10,
        soundEnabled: true,
        theme: 'dark',
        breathingPattern: '4-4-4',
        pomodoroMinutes: 25,
        showStreak: true,
        locale: 'en',
      },
      progression: {
        totalXP: 100,
        level: 2,
        activityDays: [],
        longestStreak: 5,
        currentStreak: 3,
        streakFreezes: 2,
        streakFreezeUsedDays: ['2026-01-01'],
        lastStreakCheckDate: '2026-01-05',
        streakFreezeEarnedAt: [7],
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
        totalSessionCount: 5,
        totalFocusTimeMs: 300000,
        breathingSessions: 0,
      },
      difficulty: {},
      history: [],
      exerciseHistory: [],
      onboardingComplete: true,
    };

    const migrated = migrateSchema(v2Data);
    expect(migrated.version).toBe(2);
    expect(migrated.progression.currentStreak).toBe(3);
    expect(migrated.progression.streakFreezes).toBe(2);
    expect(migrated.progression.streakFreezeUsedDays).toEqual(['2026-01-01']);
    expect(migrated.progression.lastStreakCheckDate).toBe('2026-01-05');
    expect(migrated.progression.streakFreezeEarnedAt).toEqual([7]);
  });
});
