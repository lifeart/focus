import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDefaultAppData } from '../public/js/constants';

// Since storage uses localStorage which is not available in node,
// we test the data structure and migration logic

describe('createDefaultAppData', () => {
  it('creates valid default data', () => {
    const data = createDefaultAppData();
    expect(data.version).toBe(2);
    expect(data.onboardingComplete).toBe(false);
    expect(data.profile.name).toBe('');
    expect(data.settings.dailyGoalMinutes).toBe(10);
    expect(data.settings.soundEnabled).toBe(true);
    expect(data.settings.theme).toBe('dark');
    expect(data.progression.totalXP).toBe(0);
    expect(data.progression.level).toBe(1);
    expect(data.exerciseHistory).toEqual([]);
    expect(data.history).toEqual([]);
  });

  it('initializes all exercise difficulty states', () => {
    const data = createDefaultAppData();
    const exercises = ['go-no-go', 'n-back', 'flanker', 'visual-search', 'breathing', 'pomodoro'];
    for (const ex of exercises) {
      expect(data.difficulty[ex as any]).toBeDefined();
      expect(data.difficulty[ex as any].currentLevel).toBe(1);
    }
  });

  it('initializes all personal records to 0', () => {
    const data = createDefaultAppData();
    const exercises = ['go-no-go', 'n-back', 'flanker', 'visual-search', 'breathing', 'pomodoro'];
    for (const ex of exercises) {
      expect(data.progression.personalRecords[ex as any]).toBe(0);
    }
  });
});
