# Feature: Current Streak Counter + Streak Freezes

## Summary

Add a prominent current-streak counter (consecutive days with at least one completed session) and a streak-freeze system that automatically protects the streak when the user misses a day. Freezes are earned by maintaining a 7-day streak (1 free freeze per 7-day milestone, max 3 banked). The dashboard will prominently display the current streak with a fire icon and the number of available freezes with a snowflake icon. When a freeze is consumed, a "Streak saved!" banner appears on the next app open.

## Motivation

Streak mechanics exploit loss aversion -- once users build a streak of several days, the psychological cost of losing it drives daily return visits. Research from Duolingo shows that streak freezes reduce churn by approximately 15-20% because they forgive occasional misses without destroying progress. Currently the app only tracks `longestStreak` and weekly-dot progress, which are passive indicators. A prominent current-streak counter with freeze protection turns the streak into an active motivational loop.

## Current State

- **`ProgressionData.activityDays`**: `string[]` of ISO date strings pushed whenever the user completes any exercise.
- **`ProgressionData.longestStreak`**: stored as a number but never written to -- `updateStreak()` computes it on the fly.
- **`updateStreak()` in `progression.ts`**: returns `{ currentWeekDays, weeklyGoalMet, longestStreak }`. Computes longest consecutive-day run. Does NOT compute current (ongoing) streak.
- **`streak-display.ts`**: renders 7 Mon-Sun dots, "{done} of {goal} days", "Best streak: N days". No current-streak counter.
- **No streak freeze concept exists anywhere.**

## Implementation

### Data Model Changes

**`public/js/types.ts` -- `ProgressionData`, add:**
```typescript
currentStreak: number;
streakFreezes: number;            // 0-3
streakFreezeUsedDays: string[];   // ISO dates when freeze consumed
lastStreakCheckDate: string;
streakFreezeEarnedAt: number[];   // streak milestones where freezes were earned
```

**`public/js/types.ts` -- `AppEvent` union, add:**
```typescript
| { type: 'streak-freeze-used'; date: string; remainingFreezes: number }
| { type: 'streak-lost'; previousStreak: number }
```

**`public/js/constants.ts`:**
```typescript
export const STREAK_FREEZE_MAX = 3;
export const STREAK_FREEZE_EARN_INTERVAL = 7;
```
Add defaults in `createDefaultAppData()`. Bump `CURRENT_DATA_VERSION` to 2.

**`public/js/core/storage.ts`:** Add migration from version 1 to 2.

### Logic Changes

**`public/js/core/progression.ts`:**

1. **`getCurrentStreak(activityDays, freezeUsedDays)`**: Build combined set of activity+freeze days. Walk backwards from today (or yesterday if today not active). Count consecutive covered days.

2. **`checkAndUpdateStreak(progression)`**: Called on app open. Finds gap days between `lastStreakCheckDate` and today. For each gap: consume freeze if available, else break streak. Recalculate `currentStreak`, `longestStreak`. Check freeze earning at 7-day milestones.

3. **Update `updateStreak()` return** to include `currentStreak`.

**Invocation points:**
- `main.ts init()`: Call `checkAndUpdateStreak()` after `appState.init()`. Store "streak saved" flag in sessionStorage.
- `exercise-play.ts`: After adding activity day, update `currentStreak` and `longestStreak`, check freeze earning.

### UI Changes

**`streak-display.ts`:**
- Large current-streak number with fire icon ("12" + "day streak")
- Snowflake icons for banked freezes (filled/dimmed)
- "Streak saved!" banner (slide-in animation) when freeze was consumed
- "Streak at risk!" warning when no freezes and no session today

**`dashboard.ts`:**
- Pass new options to `renderStreakDisplay()`
- Compute `streakAtRisk` and `streakSaved`

### i18n

| Key | English | Russian |
|---|---|---|
| `streak.current` | `'{n}-day streak'` | `'Серия: {n} {unit}'` |
| `streak.currentZero` | `'Start your streak!'` | `'Начни серию!'` |
| `streak.freezes` | `'{n} of {max} streak freezes'` | `'{n} из {max} заморозок серии'` |
| `streak.freezeEarned` | `'Streak freeze earned!'` | `'Заморозка получена!'` |
| `streak.saved` | `'Streak saved!'` | `'Серия сохранена!'` |
| `streak.atRisk` | `'Streak at risk! Train today.'` | `'Серия под угрозой! Тренируйся сегодня.'` |
| `streak.lost` | `'Streak lost. Start a new one!'` | `'Серия потеряна. Начни заново!'` |
| `dashboard.streak` | `'Streak'` | `'Серия'` |

Plus de.ts, fr.ts, es.ts translations.

### Tests (`tests/streak.test.ts`)

1. `getCurrentStreak` -- consecutive days returns correct count
2. `getCurrentStreak` -- gap breaks streak
3. `getCurrentStreak` -- today not yet active, yesterday active = streak alive
4. `getCurrentStreak` -- freeze days fill gaps
5. `checkAndUpdateStreak` -- no gap, no action
6. `checkAndUpdateStreak` -- one gap day, freeze available: consumed
7. `checkAndUpdateStreak` -- one gap day, no freeze: streak reset
8. `checkAndUpdateStreak` -- multiple gap days exhaust freezes
9. `checkAndUpdateStreak` -- already checked today: no-op
10. Freeze earning at 7-day milestone
11. Freeze cap at 3
12. Backward compatibility migration from v1 to v2

## Files Modified

- `public/js/types.ts` -- ProgressionData fields, AppEvent variants
- `public/js/constants.ts` -- freeze constants, defaults, version bump
- `public/js/core/progression.ts` -- getCurrentStreak(), checkAndUpdateStreak()
- `public/js/core/storage.ts` -- v1->v2 migration
- `public/js/main.ts` -- call checkAndUpdateStreak() on init
- `public/js/ui/components/streak-display.ts` -- redesigned component
- `public/js/ui/screens/dashboard.ts` -- pass new streak options
- `public/js/ui/screens/exercise-play.ts` -- update streak on session complete
- `public/js/i18n/keys.ts` + all 5 language files
- `tests/streak.test.ts` (new)

## Risks / Edge Cases

- **Timezone**: App uses UTC dates (`toISOString().slice(0,10)`). Streak system should use same convention for consistency.
- **First day**: `getCurrentStreak` returns 0 or 1. `checkAndUpdateStreak` treats empty `lastStreakCheckDate` as first check with no gap penalties.
- **Backward compatibility**: v1->v2 migration computes `currentStreak` from existing `activityDays`, initializes freeze fields to defaults.
- **Long absence**: 10-day absence with 3 freezes = first 3 gap days covered, then streak breaks. Intentional.
- **Cross-tab sync**: New fields auto-sync via existing `onStorageChange` mechanism.
