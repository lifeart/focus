# Feature: Daily Challenge System

## Summary

Add a daily challenge system alongside the existing weekly challenge to create a stronger daily engagement loop. Each day, every user sees the same deterministic challenge (seeded by date). Completing a daily challenge awards 15-30 XP. Opening the app each day also awards a 10 XP daily login bonus.

## Motivation

- **Daily engagement hooks**: The weekly challenge resets only once per week. A daily challenge gives users a fresh reason to open the app every single day.
- **Variable goals**: Different challenge types keep training from feeling repetitive. Some days demand accuracy, others volume, others specific exercises.
- **Login bonus**: A small guaranteed reward for simply opening the app builds the habit loop before the user even starts an exercise.
- **Complements weekly system**: Daily challenges are smaller/faster than weekly ones. Together they provide both short-term and medium-term goal structures.

## Current State

### How weekly challenges work

**Data model**: `WeeklyChallenge` interface in `types.ts` (line 162-169) has `description`, `type` (union of 4 string literals), `target`, `progress`, `weekStart` (ISO date string of Monday), and `xpReward`. It is stored as an optional field `weeklyChallenge?` on `ProgressionData` (line 142).

**Generation**: `generateWeeklyChallenge()` in `progression.ts` (line 193-202) picks a random template from `WEEKLY_CHALLENGE_TYPES` (4 templates in `constants.ts` lines 397-422), sets `progress: 0`, and `weekStart` to the current Monday. It uses `Math.random()` (non-deterministic).

**Refresh trigger**: In `dashboard.ts` (lines 211-228), on every dashboard render the code checks if `weeklyChallenge` is missing or if `weekStart` does not match the current Monday. If stale, it generates a new one and persists via `appState.updateData()`.

**Progress checking**: `checkWeeklyChallenge()` in `progression.ts` (lines 204-209) simply returns `challenge.progress >= challenge.target`. However, the weekly challenge `progress` field is **never actually incremented** anywhere in the codebase - this appears to be an incomplete feature. The `exercise-play.ts` `finishExercise()` function (lines 131-163) updates XP, session count, focus time, records, and difficulty, but does not touch `weeklyChallenge.progress`.

**UI**: Dashboard renders a card (lines 235-251) with title, progress badge, description (translated via key mapping), and a progress bar.

**Events**: `AppEvent` union includes `weekly-challenge-complete` (types.ts line 217) but it is never emitted.

**i18n**: Four challenge translation keys exist: `challenge.perfectExercises`, `challenge.totalSessions`, `challenge.focusTime`, `challenge.noErrors` - defined in `keys.ts` and all 5 locale files.

## Implementation

### Data Model

#### New `DailyChallenge` interface (add to `types.ts`)

```typescript
export type DailyChallengeType =
  | 'high-score-exercise'    // Score X%+ on a specific exercise
  | 'complete-exercises'     // Complete N exercises
  | 'beat-personal-best'    // Beat personal best in any exercise
  | 'no-pause-session'      // Complete a session without pausing
  | 'train-minutes'         // Train for N minutes total
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
```

#### Extend `ProgressionData` (in `types.ts`)

Add two new optional fields:

```typescript
export interface ProgressionData {
  // ... existing fields ...
  dailyChallenge?: DailyChallenge;
  lastDailyBonusDate?: string;  // ISO date of last login bonus
}
```

#### Extend `AppEvent` union (in `types.ts`)

```typescript
export type AppEvent =
  // ... existing variants ...
  | { type: 'daily-challenge-complete'; challenge: DailyChallenge }
  | { type: 'daily-bonus'; amount: number };
```

#### Extend `XP_SOURCES` (in `constants.ts`)

```typescript
export const XP_SOURCES = {
  // ... existing ...
  dailyChallengeComplete: 20,  // base; actual varies 15-30
  dailyLoginBonus: 10,
} as const;
```

### Challenge Types (13 templates)

Add `DAILY_CHALLENGE_TYPES` array to `constants.ts`:

| # | Type | Description (en) | Target | XP | Difficulty |
|---|------|-----------------|--------|-----|-----------|
| 1 | `high-score-exercise` | Score 90%+ on Go/No-Go | 1 (with threshold 90, exerciseId 'go-no-go') | 20 | Medium |
| 2 | `complete-exercises` | Complete 2 exercises | 2 | 15 | Easy |
| 3 | `beat-personal-best` | Beat your personal best in any exercise | 1 | 30 | Hard |
| 4 | `no-pause-session` | Complete an exercise without pausing | 1 | 20 | Medium |
| 5 | `train-minutes` | Train for 5 minutes total | 5 | 15 | Easy |
| 6 | `multi-exercise-score` | Score 80%+ on 3 different exercises | 3 (with threshold 80) | 25 | Hard |
| 7 | `specific-exercise` | Complete an N-Back session | 1 (exerciseId 'n-back') | 15 | Easy |
| 8 | `low-lapse-rate` | Achieve less than 5% attention lapses | 1 (threshold 5) | 25 | Hard |
| 9 | `breathing-session` | Complete a breathing session | 1 | 15 | Easy |
| 10 | `fast-reaction` | Average reaction time under 350ms in Go/No-Go | 1 (threshold 350) | 25 | Hard |
| 11 | `n-back-level` | Complete N-Back at level 3+ | 1 (threshold 3) | 20 | Medium |
| 12 | `streak-day` | Train today to keep your streak going | 1 | 15 | Easy |
| 13 | `accuracy-streak` | Score 80%+ on 3 exercises in a row | 3 (threshold 80) | 25 | Hard |

Each template is a `DailyChallengeTemplate` object (similar to `WEEKLY_CHALLENGE_TYPES`):

```typescript
export interface DailyChallengeTemplate {
  type: DailyChallengeType;
  target: number;
  xpReward: number;
  exerciseId?: ExerciseId;
  threshold?: number;
}
```

### Generation Logic

Add `generateDailyChallenge(dateStr: string): DailyChallenge` to `progression.ts`.

**Seeded random**: Use a simple hash of the date string to produce a deterministic index into `DAILY_CHALLENGE_TYPES`. This ensures all users get the same challenge on the same day.

```typescript
function dateHash(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash + dateStr.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function generateDailyChallenge(dateStr: string): DailyChallenge {
  const idx = dateHash(dateStr) % DAILY_CHALLENGE_TYPES.length;
  const template = DAILY_CHALLENGE_TYPES[idx];
  return {
    ...template,
    progress: 0,
    date: dateStr,
    completed: false,
  };
}
```

**Refresh at midnight local time**: On dashboard render, compare `progression.dailyChallenge?.date` against today's ISO date. If different or missing, generate a new one. This is the same pattern used for weekly challenges (dashboard.ts lines 211-228).

### Daily Login Bonus

On dashboard render, check `progression.lastDailyBonusDate` against today. If different:
1. Award 10 XP
2. Set `lastDailyBonusDate` to today
3. Emit `{ type: 'daily-bonus', amount: 10 }`
4. Show a brief animation/toast on the dashboard

### Dashboard UI

Modify `renderDashboard` in `dashboard.ts` to insert the daily challenge card **above** the weekly challenge card (between section 4 "Daily Progress" and section 5 "Weekly Challenge").

**Card structure**:
- Title: "Daily Challenge" with date indicator
- If not completed: progress badge (`progress/target`), description text, progress bar
- If completed: green "Completed!" badge, checkmark animation, XP reward shown
- Login bonus: When awarding the daily bonus, show a brief "+10 XP" floating animation at the top of the dashboard before it settles

**Card ordering** (new order):
1. Greeting card
2. XP Progress card
3. Weekly Goal card
4. Daily Progress card
5. **Daily Challenge card** (NEW)
6. Weekly Challenge card
7. Baseline prompt (conditional)
8. Quick Start button
9. Recent Activity card

### Checking Logic

Add `checkDailyChallenge(challenge: DailyChallenge, result: ExerciseResult, progression: ProgressionData, exerciseHistory: ExerciseResult[]): DailyChallenge` to `progression.ts`.

**When to check**: In `exercise-play.ts` `finishExercise()` function, after updating progression data (around line 163), add a block that:
1. Reads `d.progression.dailyChallenge`
2. If it exists, is for today, and is not completed, evaluate progress
3. If newly completed, emit `daily-challenge-complete` event, award XP

**Also**: Fix the existing weekly challenge progress update in the same location - currently weekly challenge progress is never incremented (this is a bug in the existing code).

**How to match criteria per type**:

| Type | Check logic |
|------|------------|
| `high-score-exercise` | `result.exerciseId === challenge.exerciseId && result.score >= challenge.threshold` |
| `complete-exercises` | Increment progress by 1 for every completed exercise today |
| `beat-personal-best` | Compare `result.score` against `prevRecord` (already computed in finishExercise) |
| `no-pause-session` | Track via a flag in exercise-play; if `pause()` was never called, increment |
| `train-minutes` | `Math.floor(d.progression.totalFocusTimeMs / 60000)` for today vs. yesterday |
| `multi-exercise-score` | Count distinct exerciseIds with score >= threshold completed today |
| `specific-exercise` | `result.exerciseId === challenge.exerciseId` |
| `low-lapse-rate` | `result.metrics.lapseRate != null && result.metrics.lapseRate < challenge.threshold / 100` |
| `breathing-session` | `result.exerciseId === 'breathing'` |
| `fast-reaction` | `result.exerciseId === 'go-no-go' && result.metrics.meanRT != null && result.metrics.meanRT < challenge.threshold` |
| `n-back-level` | `result.exerciseId === 'n-back' && result.level >= challenge.threshold` |
| `streak-day` | Always true on any exercise completion (just training counts) |
| `accuracy-streak` | Track consecutive 80%+ scores in today's exerciseHistory |

**Helper**: Add `getTodayExercises(exerciseHistory: ExerciseResult[]): ExerciseResult[]` that filters by today's date.

### i18n

#### New keys to add to `TranslationTable` (keys.ts)

```typescript
// Daily challenges
'dashboard.dailyChallenge': string;
'dashboard.dailyChallengeComplete': string;
'dashboard.dailyBonus': string;
'dailyChallenge.highScoreExercise': string;
'dailyChallenge.completeExercises': string;
'dailyChallenge.beatPersonalBest': string;
'dailyChallenge.noPauseSession': string;
'dailyChallenge.trainMinutes': string;
'dailyChallenge.multiExerciseScore': string;
'dailyChallenge.specificExercise': string;
'dailyChallenge.lowLapseRate': string;
'dailyChallenge.breathingSession': string;
'dailyChallenge.fastReaction': string;
'dailyChallenge.nBackLevel': string;
'dailyChallenge.streakDay': string;
'dailyChallenge.accuracyStreak': string;
```

#### English values (en.ts)

```
'dashboard.dailyChallenge': 'Daily Challenge',
'dashboard.dailyChallengeComplete': 'Done!',
'dashboard.dailyBonus': '+{xp} XP daily bonus!',
'dailyChallenge.highScoreExercise': 'Score 90%+ on Go/No-Go',
'dailyChallenge.completeExercises': 'Complete 2 exercises',
'dailyChallenge.beatPersonalBest': 'Beat your personal best in any exercise',
'dailyChallenge.noPauseSession': 'Complete an exercise without pausing',
'dailyChallenge.trainMinutes': 'Train for 5 minutes total',
'dailyChallenge.multiExerciseScore': 'Score 80%+ on 3 different exercises',
'dailyChallenge.specificExercise': 'Complete an N-Back session',
'dailyChallenge.lowLapseRate': 'Achieve less than 5% attention lapses',
'dailyChallenge.breathingSession': 'Complete a breathing session',
'dailyChallenge.fastReaction': 'Average reaction time under 350ms in Go/No-Go',
'dailyChallenge.nBackLevel': 'Complete N-Back at level 3+',
'dailyChallenge.streakDay': 'Train today to keep your streak',
'dailyChallenge.accuracyStreak': 'Score 80%+ on 3 exercises in a row',
```

#### Russian values (ru.ts)

```
'dashboard.dailyChallenge': 'Ежедневный вызов',
'dashboard.dailyChallengeComplete': 'Выполнено!',
'dashboard.dailyBonus': '+{xp} XP бонус за вход!',
'dailyChallenge.highScoreExercise': 'Наберите 90%+ в Go/No-Go',
'dailyChallenge.completeExercises': 'Пройдите 2 упражнения',
'dailyChallenge.beatPersonalBest': 'Побейте личный рекорд в любом упражнении',
'dailyChallenge.noPauseSession': 'Пройдите упражнение без пауз',
'dailyChallenge.trainMinutes': 'Тренируйтесь 5 минут',
'dailyChallenge.multiExerciseScore': 'Наберите 80%+ в 3 разных упражнениях',
'dailyChallenge.specificExercise': 'Пройдите сессию N-Back',
'dailyChallenge.lowLapseRate': 'Менее 5% провалов внимания',
'dailyChallenge.breathingSession': 'Пройдите дыхательную сессию',
'dailyChallenge.fastReaction': 'Среднее время реакции менее 350мс в Go/No-Go',
'dailyChallenge.nBackLevel': 'Пройдите N-Back на уровне 3+',
'dailyChallenge.streakDay': 'Потренируйтесь сегодня для серии',
'dailyChallenge.accuracyStreak': 'Наберите 80%+ в 3 упражнениях подряд',
```

The same keys must be added to `de.ts`, `fr.ts`, and `es.ts` with appropriate translations.

### Tests

Add a new test file `tests/daily-challenge.test.ts` (or extend existing test structure if present):

1. **Generation determinism**: `generateDailyChallenge('2026-03-19')` called twice returns identical challenge
2. **Generation variety**: Different dates produce different challenges (test 7+ dates, assert not all same)
3. **Date rollover**: Calling with '2026-03-19' vs '2026-03-20' returns different (or at least re-generates)
4. **Progress checking per type**: For each of the 13 challenge types, test that the correct conditions advance progress
5. **Completion**: Verify that once `progress >= target`, `completed` becomes true and XP is awarded exactly once
6. **Login bonus**: Verify bonus is awarded only once per day, even if dashboard renders multiple times
7. **Edge case**: Challenge carries over if app is open across midnight (next dashboard render regenerates)
8. **Edge case**: No crash if exerciseHistory is empty when checking daily challenge
9. **Backward compatibility**: Old data without `dailyChallenge` field loads correctly (field is optional)

## Files Modified

| File | Change |
|------|--------|
| `public/js/types.ts` | Add `DailyChallengeType`, `DailyChallenge` interface, extend `ProgressionData`, extend `AppEvent` |
| `public/js/constants.ts` | Add `DailyChallengeTemplate` interface, `DAILY_CHALLENGE_TYPES` array, extend `XP_SOURCES` |
| `public/js/core/progression.ts` | Add `dateHash()`, `generateDailyChallenge()`, `checkDailyChallengeProgress()`, `getTodayExercises()` |
| `public/js/ui/screens/dashboard.ts` | Add daily challenge card rendering, daily login bonus logic with animation |
| `public/js/ui/screens/exercise-play.ts` | Call `checkDailyChallengeProgress()` in `finishExercise()` (both single and session modes around lines 131-163 and 379-403) |
| `public/js/i18n/keys.ts` | Add 16 new translation keys |
| `public/js/i18n/en.ts` | Add English translations for 16 keys |
| `public/js/i18n/ru.ts` | Add Russian translations for 16 keys |
| `public/js/i18n/de.ts` | Add German translations for 16 keys |
| `public/js/i18n/fr.ts` | Add French translations for 16 keys |
| `public/js/i18n/es.ts` | Add Spanish translations for 16 keys |

## Risks / Edge Cases

1. **Data migration**: Adding optional fields to `ProgressionData` is safe since they are optional (`?`). The `createDefaultAppData()` function does not set them, so existing users will simply get `undefined` and the dashboard will generate the first daily challenge on next visit. No version bump needed.

2. **Weekly challenge progress bug**: The existing weekly challenge `progress` field is never updated in `exercise-play.ts`. This should be fixed as part of this work (or flagged separately). The daily challenge implementation should NOT repeat this oversight.

3. **Timezone sensitivity**: Using `new Date().toISOString().slice(0, 10)` returns UTC dates. If a user is in UTC+12 and opens the app at 11 PM local time, the date will be "tomorrow" in UTC. The existing code already uses this pattern for `activityDays`, so for consistency we should keep it. However, if a local-time approach is ever adopted, both daily and weekly challenges must be updated together.

4. **Pause detection**: The `no-pause-session` challenge type requires knowing if `pause()` was called. Currently `exercise-play.ts` calls `exercise.pause()` when the pause button is clicked (need to add a `wasPaused` boolean flag to finishExercise scope).

5. **Seeded random collision**: With 13 templates and a simple hash, some dates will map to the same challenge on consecutive days. This is acceptable but can be mitigated by using a more complex hash or adding a "no repeat from yesterday" rule.

6. **Performance**: `getTodayExercises()` filters the full `exerciseHistory` array. For users with thousands of entries this could be slow. Consider iterating from the end and stopping once timestamps are before today.

7. **Daily bonus double-award**: If two tabs are open and both render the dashboard simultaneously, both could award the bonus. The `onStorageChange` cross-tab sync mitigates this somewhat, but a guard (`lastDailyBonusDate` check) must be applied inside `updateData` atomically.

---

### Critical Files for Implementation

- `/Users/lifeart/Repos/ivetta/focus/public/js/types.ts` - Core interfaces to extend: DailyChallenge, ProgressionData, AppEvent
- `/Users/lifeart/Repos/ivetta/focus/public/js/core/progression.ts` - Add generation and checking logic for daily challenges
- `/Users/lifeart/Repos/ivetta/focus/public/js/ui/screens/dashboard.ts` - Daily challenge card rendering and login bonus logic
- `/Users/lifeart/Repos/ivetta/focus/public/js/ui/screens/exercise-play.ts` - Hook daily challenge progress updates into finishExercise (two locations: single play ~line 131, session play ~line 379)
- `/Users/lifeart/Repos/ivetta/focus/public/js/constants.ts` - DAILY_CHALLENGE_TYPES templates array and XP_SOURCES extension
