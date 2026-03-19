# Feature: Quick Session Mode

## Summary

Add a session type selector to the dashboard that lets users choose between Quick (1 exercise, ~1 min), Standard (3-4 exercises, ~5 min), and Deep Focus (5-6 exercises, ~10 min) sessions. Quick sessions skip the mood modal and session plan screen, going straight into a single exercise with minimal friction.

## Motivation

The current "Start Training" flow requires multiple taps before arriving at an exercise: click Start Training, pick a mood, navigate to the exercise list, choose an exercise. For ADHD teens -- the primary audience -- this creates an activation barrier. Each additional step is a chance to abandon the session. A Quick Session mode provides a "minimum viable session" that gets the user into an exercise within one tap. Even 60 seconds of training is better than zero, and completing a quick session preserves streaks, earns XP, and reinforces the habit loop. Standard and Deep options remain for users who want longer training.

## Current State

### How sessions work today

1. **Dashboard** (`public/js/ui/screens/dashboard.ts`): A single "Start Training" button calls `showMoodModal()`. The mood modal stores the mood in `sessionStorage` then navigates to `#/exercises`.
2. **Exercise Select** (`public/js/ui/screens/exercise-select.ts`): Shows a categorized list of exercises. Tapping one navigates to `#/play/:exerciseId` (single exercise mode).
3. **Session mode** (`public/js/ui/screens/exercise-play.ts`, `renderSessionMode`): Exists at `#/session` route but is **unreachable** from the UI -- nothing navigates to `#/session`. It uses `createSessionPlan()` to pick 3-4 exercises, shows a plan screen, then runs exercises sequentially with transition screens.
4. **Session planning** (`public/js/core/session.ts`, `createSessionPlan`): Picks 3 cognitive exercises (or 4 if breathing is skipped). Breathing is included if >3 sessions since last breathing exercise. Estimates total minutes from `EXERCISE_CONFIGS[id].durationSeconds`.
5. **Exercise durations** (`public/js/constants.ts`): go-no-go 60s, n-back 90s, flanker 60s, visual-search 60s, breathing 120s.

### Key observations

- The `#/session` route is registered in `main.ts` line 50 but nothing links to it.
- `renderSessionMode` shows a plan screen, then runs exercises one by one with transitions.
- `renderSingleExercise` handles one exercise with its own XP/state saving logic (including 20% bonus event chance).
- Session mode has its own XP/state saving per-exercise (no bonus event), plus a `SessionResult` saved to `appState.data.history`.
- The `SessionPlan` type is `{ exercises: ExerciseId[], estimatedMinutes: number, includesBreathing: boolean }`.
- Navigation hides the nav bar for routes starting with `/play`, `/onboarding`, or `/session` (main.ts line 99).

## Implementation

### 1. Session Types

Define a new union type and a constant for session type configuration:

```typescript
// In types.ts
export type SessionType = 'quick' | 'standard' | 'deep';
```

```typescript
// In constants.ts
export const SESSION_TYPE_KEY = 'focus:session_type';

export const SESSION_TYPE_CONFIG: Record<SessionType, {
  exerciseCount: { min: number; max: number };
  estimatedMinutes: number;
  skipMoodModal: boolean;
  skipPlanScreen: boolean;
}> = {
  quick:    { exerciseCount: { min: 1, max: 1 }, estimatedMinutes: 1, skipMoodModal: true, skipPlanScreen: true },
  standard: { exerciseCount: { min: 3, max: 4 }, estimatedMinutes: 5, skipMoodModal: false, skipPlanScreen: false },
  deep:     { exerciseCount: { min: 5, max: 6 }, estimatedMinutes: 10, skipMoodModal: false, skipPlanScreen: false },
};
```

### 2. Session Planning Functions

Add two new functions to `public/js/core/session.ts`:

**`createQuickSession(difficulty, history)`**: Picks 1 exercise. Selection logic:
1. Find the cognitive exercise with the lowest recent score average (weakest skill).
2. If all scores are equal (or no history), pick the exercise played least recently.
3. Never include breathing or pomodoro (these are not suitable for ~60s quick sessions).
4. Returns a `SessionPlan` with 1 exercise.

**`createDeepSession(difficulty, history)`**: Picks 5-6 exercises. Selection logic:
1. Always include breathing (regardless of recency).
2. Include all 4 cognitive exercises.
3. Add a second round of the weakest cognitive exercise (for 6 total) OR keep at 5 if variety is preferred.
4. Order: breathing first (as warm-up), then cognitive exercises in difficulty order.

The existing `createSessionPlan()` remains unchanged and serves as the "standard" session.

**New `createSessionByType(type, difficulty, history)` dispatcher**:
```typescript
export function createSessionByType(
  type: SessionType,
  difficulty: Record<ExerciseId, DifficultyState>,
  history: ExerciseResult[],
): SessionPlan {
  switch (type) {
    case 'quick': return createQuickSession(difficulty, history);
    case 'deep': return createDeepSession(difficulty, history);
    default: return createSessionPlan(difficulty, history);
  }
}
```

### 3. Dashboard UI Changes

In `public/js/ui/screens/dashboard.ts`, replace the single "Start Training" button (section 6, lines 267-284) with a session type selector:

**Layout**: Three cards inside `quickStartCard`, each a button/card:
- **Quick** -- icon: lightning bolt, label: `t('dashboard.sessionQuick')`, subtitle: `t('dashboard.sessionQuickDesc')` (~1 min)
- **Standard** -- icon: target, label: `t('dashboard.sessionStandard')`, subtitle: `t('dashboard.sessionStandardDesc')` (~5 min)  
- **Deep Focus** -- icon: brain, label: `t('dashboard.sessionDeep')`, subtitle: `t('dashboard.sessionDeepDesc')` (~10 min)

**Click handlers**:
- **Quick**: Store `'quick'` in `sessionStorage` under `SESSION_TYPE_KEY`. Navigate directly to `#/session` (skip mood modal, skip plan screen).
- **Standard**: Store `'standard'` in `SESSION_TYPE_KEY`. Show mood modal, then navigate to `#/session` (shows plan screen).
- **Deep**: Store `'deep'` in `SESSION_TYPE_KEY`. Show mood modal, then navigate to `#/session` (shows plan screen).

The mood modal's navigation target changes from `#/exercises` to `#/session`.

### 4. Exercise Play Integration

In `public/js/ui/screens/exercise-play.ts`, modify `renderSessionMode`:

1. Read session type from `sessionStorage.getItem(SESSION_TYPE_KEY)` (default to `'standard'`).
2. Call `createSessionByType(type, ...)` instead of `createSessionPlan(...)`.
3. If `type === 'quick'`:
   - Skip `showPlan()` -- go directly to `startNextExercise()` (which calls `runExercise` for the first exercise).
   - Skip transition screens between exercises (there is only 1 anyway).
   - After the single exercise completes, `finishSession()` runs as normal -- saves `SessionResult`, navigates to `#/results`.
4. For `'deep'` sessions, behavior is identical to current session mode, just with more exercises from `createDeepSession`.
5. Clean up `SESSION_TYPE_KEY` from sessionStorage in `finishSession()` or on cleanup.

**Specific code changes in `renderSessionMode`**:
- After `const plan = createSessionByType(type, ...)`, check `type`:
  ```typescript
  const sessionType = (sessionStorage.getItem(SESSION_TYPE_KEY) || 'standard') as SessionType;
  const plan = createSessionByType(sessionType, data.difficulty, data.exerciseHistory);
  ```
- Replace the final `showPlan()` call with:
  ```typescript
  if (sessionType === 'quick') {
    startNextExercise(); // Skip plan screen, go straight to exercise
  } else {
    showPlan();
  }
  ```
- In `startNextExercise()`, for quick sessions skip the transition screen:
  ```typescript
  if (currentExerciseIndex === 0 || sessionType === 'quick') {
    runExercise(nextExId);
  } else {
    showTransition(nextExId);
  }
  ```

### 5. Streak / XP / Daily Challenge Counting

Quick sessions must still count for all progression mechanics. The existing `renderSessionMode` already handles per-exercise XP, activity days, personal records, difficulty updates, and session result storage. No changes needed to the progression logic -- a 1-exercise session produces a valid `SessionResult` with `exercises.length === 1`.

### 6. i18n Keys

Add the following keys to `TranslationTable` in `public/js/i18n/keys.ts`:

```typescript
// Session type selector
'dashboard.sessionQuick': string;
'dashboard.sessionQuickDesc': string;
'dashboard.sessionStandard': string;
'dashboard.sessionStandardDesc': string;
'dashboard.sessionDeep': string;
'dashboard.sessionDeepDesc': string;
'dashboard.chooseSession': string;
```

**English** (`public/js/i18n/en.ts`):
```typescript
'dashboard.chooseSession': 'Choose your session',
'dashboard.sessionQuick': 'Quick',
'dashboard.sessionQuickDesc': '1 exercise \u00B7 ~1 min',
'dashboard.sessionStandard': 'Standard',
'dashboard.sessionStandardDesc': '3-4 exercises \u00B7 ~5 min',
'dashboard.sessionDeep': 'Deep Focus',
'dashboard.sessionDeepDesc': '5-6 exercises \u00B7 ~10 min',
```

**Russian** (`public/js/i18n/ru.ts`):
```typescript
'dashboard.chooseSession': '\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u0435\u0441\u0441\u0438\u044E',
'dashboard.sessionQuick': '\u0411\u044B\u0441\u0442\u0440\u0430\u044F',
'dashboard.sessionQuickDesc': '1 \u0443\u043F\u0440\u0430\u0436\u043D\u0435\u043D\u0438\u0435 \u00B7 ~1 \u043C\u0438\u043D',
'dashboard.sessionStandard': '\u0421\u0442\u0430\u043D\u0434\u0430\u0440\u0442\u043D\u0430\u044F',
'dashboard.sessionStandardDesc': '3-4 \u0443\u043F\u0440\u0430\u0436\u043D\u0435\u043D\u0438\u044F \u00B7 ~5 \u043C\u0438\u043D',
'dashboard.sessionDeep': '\u0413\u043B\u0443\u0431\u043E\u043A\u0438\u0439 \u0444\u043E\u043A\u0443\u0441',
'dashboard.sessionDeepDesc': '5-6 \u0443\u043F\u0440\u0430\u0436\u043D\u0435\u043D\u0438\u0439 \u00B7 ~10 \u043C\u0438\u043D',
```

Same keys must also be added to `de.ts`, `fr.ts`, `es.ts` with appropriate translations.

### 7. CSS

Add styles to the existing stylesheet for the session type selector:

- `.session-type-selector` -- flex container, 3 columns on wide screens, stacked on mobile
- `.session-type-card` -- card-like button with icon, title, subtitle
- `.session-type-card--quick` / `--standard` / `--deep` -- accent color variants
- Highlight the recommended option (standard) with a subtle border or "recommended" badge

### 8. Tests

Tests to add (following existing test patterns):

1. **`createQuickSession` unit tests**:
   - Returns exactly 1 exercise
   - Never returns breathing or pomodoro
   - Picks weakest exercise when scores differ
   - Picks least-recent exercise when scores are equal
   - Works with empty history

2. **`createDeepSession` unit tests**:
   - Returns 5-6 exercises
   - Always includes breathing
   - Includes all 4 cognitive exercises
   - Estimates ~10 minutes

3. **`createSessionByType` dispatcher test**:
   - Dispatches to correct function for each type

4. **Integration / navigation tests**:
   - Quick session button navigates to `#/session` without mood modal
   - Standard/Deep buttons show mood modal first
   - Quick session skips plan screen
   - Session result is saved after quick session

## Files Modified

| File | Change |
|------|--------|
| `public/js/types.ts` | Add `SessionType` union type |
| `public/js/constants.ts` | Add `SESSION_TYPE_KEY`, `SESSION_TYPE_CONFIG` |
| `public/js/core/session.ts` | Add `createQuickSession()`, `createDeepSession()`, `createSessionByType()` |
| `public/js/ui/screens/dashboard.ts` | Replace single "Start Training" button with 3-card session type selector; update mood modal navigation target from `#/exercises` to `#/session` |
| `public/js/ui/screens/exercise-play.ts` | Read session type from sessionStorage; conditionally skip plan/transition screens for quick sessions; use `createSessionByType` |
| `public/js/i18n/keys.ts` | Add 7 new translation keys |
| `public/js/i18n/en.ts` | Add English translations for 7 keys |
| `public/js/i18n/ru.ts` | Add Russian translations for 7 keys |
| `public/js/i18n/de.ts` | Add German translations for 7 keys |
| `public/js/i18n/fr.ts` | Add French translations for 7 keys |
| `public/js/i18n/es.ts` | Add Spanish translations for 7 keys |
| `public/css/` (stylesheet) | Add `.session-type-selector` and `.session-type-card` styles |

## Risks / Edge Cases

1. **Empty exercise history**: `createQuickSession` must handle the case where there is no history at all. Fallback: pick the first exercise in `COGNITIVE_ORDER` (go-no-go, the easiest).

2. **Quick session still triggers sessionStorage cleanup**: The `SESSION_TYPE_KEY` must be cleaned up after the session finishes or the user exits, otherwise a subsequent "Standard" session might accidentally read stale state.

3. **Back navigation during quick session**: If a user navigates away mid-exercise (browser back, etc.), the cleanup function in `renderSessionMode` handles destroying the exercise. This works the same regardless of session type.

4. **Daily goal tracking**: A 60-second quick session contributes ~1 minute toward the daily goal. Users with a 10-minute daily goal would need many quick sessions to meet it. This is by design -- quick sessions are better than nothing, not a replacement for standard sessions.

5. **Mood data missing for quick sessions**: Since quick sessions skip the mood modal, the `SessionResult.mood` field will be undefined. The results screen must handle this gracefully (it already does, since `mood` is optional on `SessionResult`).

6. **The `#/exercises` route remains accessible**: Users can still navigate to exercise-select via the nav bar to pick individual exercises. The session type selector is an alternative path, not a replacement.

7. **Session type persisted only in sessionStorage**: If the browser tab is closed mid-session, the type is lost. This is acceptable since sessionStorage is already used for mood and result data in the same ephemeral way.

### Critical Files for Implementation
- `/Users/lifeart/Repos/ivetta/focus/public/js/core/session.ts` - Add createQuickSession, createDeepSession, createSessionByType functions
- `/Users/lifeart/Repos/ivetta/focus/public/js/ui/screens/dashboard.ts` - Replace Start Training button with session type selector cards
- `/Users/lifeart/Repos/ivetta/focus/public/js/ui/screens/exercise-play.ts` - Read session type, conditionally skip plan/transition screens
- `/Users/lifeart/Repos/ivetta/focus/public/js/i18n/keys.ts` - Add new translation key type definitions
- `/Users/lifeart/Repos/ivetta/focus/public/js/types.ts` - Add SessionType union type
