# Architecture Review: Focus Training App

**Reviewer**: Senior Frontend Architect
**Date**: 2026-03-19
**Overall Rating: 7.5 / 10**

---

## 1. Architecture & Module Structure

**Rating: 8/10**

The project follows a clean, layered architecture:

```
public/js/
  main.ts          -- app entry, wiring
  router.ts        -- hash-based SPA router
  types.ts         -- all type definitions
  constants.ts     -- config, tables, defaults
  core/            -- business logic (state, storage, progression, adaptive, i18n)
  exercises/       -- exercise implementations (go-no-go, n-back, flanker, etc.)
  ui/
    renderer.ts    -- DOM utilities
    components/    -- reusable UI pieces
    screens/       -- route-level screens
```

**Strengths:**
- Clear separation between core logic, exercises, and UI.
- The `Exercise` interface (`setup/start/pause/resume/stop/destroy`) is well-designed -- each exercise is self-contained.
- `Disposables` pattern for lifecycle management is solid.
- Constants are centralized; types are comprehensive.
- No `console.log` in production code -- only `console.error` and `console.warn` for genuine error conditions.

**Issues:**

### 1a. Implicit Circular Dependency via `main.ts` Singleton

Seven screen modules import `{ appState, getSoundManager }` from `../../main.js`. While esbuild resolves this at bundle time (IIFE format), it creates a conceptual circular dependency: `main.ts` imports screens, and screens import `main.ts`. This makes screens impossible to test in isolation and tightly couples them to the global singleton.

**Recommendation:** Extract `appState` and `getSoundManager` into a dedicated `core/context.ts` module. Screens import from context; `main.ts` initializes it. This breaks the cycle and enables testing.

### 1b. Router Lacks Typed Route Params

Route params are `Record<string, string>` -- the router has no knowledge of which params a given route expects. The `exerciseId` param is unsafely cast at `exercise-play.ts:959`:

```ts
const exerciseId = params?.exerciseId as string | undefined;
```

A route-param registry or generic typing would catch mismatches at compile time.

---

## 2. State Management

**Rating: 7/10**

**Strengths:**
- Mutable-update pattern (`updateData(d => { d.foo = bar })`) is ergonomic.
- Debounced save (1s) with `beforeunload` flush is appropriate.
- Cross-tab sync via `StorageEvent` is correctly implemented.
- Schema migration is forward-only and well-structured.

**Issues:**

### 2a. Cross-Tab Sync Race Condition

When Tab B receives a `storage` event, it overwrites its local `data` entirely:

```ts
// state.ts:84
data = newData;
```

If Tab A has a pending (debounced) save, the sequence can be:

1. Tab A modifies data, schedules save in 1s.
2. Tab B saves, triggering storage event in Tab A.
3. Tab A receives event, replaces its data with Tab B's version.
4. Tab A's pending save fires -- but now writes Tab B's data, losing Tab A's changes.

**Recommendation:** Cancel the pending save timer when handling a cross-tab sync event, or merge changes instead of wholesale replacement.

### 2b. `updateData` Mutates In-Place

`updateData` passes the live `data` object to the callback. Any code that previously called `getData()` holds a reference to the same object, so they see mutations immediately -- even before save. This is not a bug per se, but it means `getData()` does not return a snapshot. Code like:

```ts
const levelBefore = getLevel(data.progression.totalXP);
appState.updateData((d) => { d.progression.totalXP += xp; });
```

works correctly only because `levelBefore` captures a primitive. If someone stored `data.progression` as a reference, it would be a footgun.

### 2c. Streak Check in `main.ts` Copies Fields Redundantly

Lines 83-91 of `main.ts` copy progression fields one by one from `currentData2` back into the update callback. But `checkAndUpdateStreak` already mutates `currentData2.progression` in place -- and since `getData()` returns the live object, these assignments are self-referential no-ops. This is dead code that suggests confusion about the mutation model.

---

## 3. exercise-play.ts Complexity

**Rating: 6/10 -- Needs Refactoring**

At 997 lines, this is the largest file. It contains three distinct modes:
- `renderSingleExercise` (~260 lines)
- `renderSessionMode` (~415 lines)
- `renderBaselineMode` (~140 lines)

### 3a. Massive Code Duplication

The "finish exercise and update state" logic is duplicated almost verbatim between `renderSingleExercise` (lines 165-314) and `renderSessionMode.onExerciseFinish` (lines 510-651). Both contain identical blocks for:

- XP calculation
- Activity day tracking
- Streak update and freeze earning
- Personal record detection
- Difficulty update
- Weekly/daily challenge progress
- Badge checking
- Level-up detection
- Celebration data building

**Recommendation:** Extract a `finishExerciseAndUpdateState(result, options)` function into `core/` that encapsulates all post-exercise state updates. This would eliminate ~150 lines of duplication and ensure consistent behavior.

### 3b. Exercise UI Boilerplate Duplication

The header/pause-overlay/exercise-area DOM construction is repeated three times (single, session, baseline). Extract a `createExerciseShell()` factory.

### 3c. Auto-Finish Polling Pattern

All three modes use a 500ms polling interval to detect exercise completion:

```ts
const autoFinishInterval = disposables.setInterval(() => {
  if (!isPaused) exerciseElapsed += 500;
  if (exerciseElapsed >= durationMs + 500 && ...) { ... }
}, 500);
```

This is documented as intentional (to handle pause correctly), but the 500ms granularity means exercises can overrun by up to 1 second. A callback-based approach from the exercise timer would be more precise.

---

## 4. Type Safety

**Rating: 7/10**

**Strengths:**
- `strict: true` in tsconfig.
- Discriminated union for `AppEvent` is well-typed.
- Exercise types are comprehensive.

**Issues:**

### 4a. Pervasive `as any` Casts for i18n Keys

There are **30+** instances of `t(\`exercise.${exId}.name\` as any)` across the codebase. The `t()` function likely accepts a `TranslationKey` union type, and dynamic key construction breaks this. These casts suppress compile-time detection of missing translations.

**Recommendation:** Create helper functions like `exerciseName(id: ExerciseId): string` that map exercise IDs to their translation keys in a type-safe way, or use a record-based lookup pattern.

### 4b. `DifficultyParams` Index Signature

```ts
export interface DifficultyParams {
  level: number;
  isiMin?: number;
  // ...
  [key: string]: number | undefined;
}
```

The index signature `[key: string]: number | undefined` weakens type checking -- any property access is valid. Consider using discriminated union types per exercise instead.

### 4c. ListenerEntry Uses `any`

```ts
type ListenerEntry = { type: AppEvent['type']; fn: (event: any) => void; };
```

This erases the typed event payload. The `subscribe` method is correctly generic, but the internal storage loses the type. Not a runtime issue but worth noting.

---

## 5. Memory Leaks & Disposables

**Rating: 8/10**

**Strengths:**
- Every screen returns a cleanup function.
- `createDisposables()` correctly manages timeouts, intervals, RAF, event listeners.
- LIFO disposal order is correct.
- Each exercise has a `destroy()` method.

**Issues:**

### 5a. Nav Event Listeners Not Tracked in Disposables

In `nav.ts:65`, button click listeners are added via `addEventListener` but not tracked in any disposables system:

```ts
btn.addEventListener('click', () => { onNavigate(item.path); });
```

The cleanup function only removes the nav DOM node, which implicitly removes listeners. This works because the nav is re-rendered, but it is inconsistent with the pattern used everywhere else.

### 5b. Audio Context Never Closed

`ensureAudioContext()` in `main.ts` creates an `AudioContext` but never closes it. On mobile browsers, this can hold audio resources. The `appState.destroy()` method exists but is never called.

### 5c. Global Event Listeners in `main.ts`

The `hashchange` listener (line 134) and audio init listeners are added to `window`/`document` but never removed. Since `main.ts` is the app root and runs once, this is acceptable but means there is no clean teardown path.

---

## 6. Performance

**Rating: 8/10**

**Strengths:**
- Lazy AudioContext initialization.
- `getTodayExercises` iterates from the end of the array (reverse scan) for efficiency.
- History pruning to 60 days prevents unbounded localStorage growth.
- No virtual DOM overhead; direct DOM manipulation.

**Issues:**

### 6a. `activityDays.includes()` Is O(n)

In multiple places, `activityDays.includes(today)` is called. As activity days grow (365+ entries over a year), this becomes a linear scan. A `Set` would be O(1).

Similarly, `streakFreezeEarnedAt.includes(cs)` in the hot path of exercise completion.

### 6b. `updateStreak()` Sorts All Activity Days

```ts
const sorted = [...activityDays].sort();
```

This copies and sorts the entire array on every call. For a year of daily use, this is ~365 items -- still fast, but unnecessary if the array were maintained in sorted order (it already is, since days are pushed chronologically).

### 6c. Dashboard Re-Renders Everything

The dashboard creates all cards from scratch on every navigation. For a mobile app, this is fine at current scale, but there is no diffing or caching.

---

## 7. Error Handling

**Rating: 7/10**

**Strengths:**
- Router wraps cleanup calls in try/catch.
- Storage operations handle QuotaExceeded with graceful fallback (prune + retry).
- `sessionStorage` writes are wrapped in try/catch.
- Import validation checks required fields.

**Issues:**

### 7a. Unhandled Promise Rejections in Exercise Start

`startExercise()` (exercise-play.ts:318) is an async function called without `.catch()`:

```ts
startExercise(); // line 365 -- no error handling
```

If `showCountdown` or exercise setup throws, the promise rejection is unhandled. Same pattern at lines 695 (session mode) and 914 (baseline mode).

**Recommendation:** Add `.catch()` handlers or wrap in try/catch within the async function.

### 7b. No Validation of sessionStorage Data

`renderResults` parses `SESSION_RESULT_KEY` from sessionStorage with a basic try/catch but no schema validation:

```ts
result = JSON.parse(raw) as ExerciseResult;
```

Corrupted or tampered data could cause runtime errors deeper in the render path.

---

## 8. Build System

**Rating: 7/10**

**Strengths:**
- esbuild is fast and appropriate for this project size.
- CSS bundling with font handling.
- Service worker cache-busting with timestamp.
- Separate dev/prod modes.

**Issues:**

### 8a. No Content Hashing for Cache Busting

Output files are `bundle.js` and individual CSS files without content hashes. Browsers may serve stale cached versions after deployment. esbuild supports `entryNames: '[name]-[hash]'` for this.

### 8b. No Tree Shaking Verification

The IIFE format may prevent some tree-shaking optimizations. The `LEVEL_TITLES` record in `constants.ts` and `POMODORO_QUOTES` array are substantial but may not be fully used if i18n replaces them.

### 8c. `build.js` Uses CommonJS

The build script uses `require()` while the app itself is ES modules. This is functional but inconsistent. Consider migrating to ESM or at least noting the intentional choice.

### 8d. No CSS Purging

All CSS is bundled regardless of usage. For a mobile-first PWA, unused CSS impacts load time.

---

## 9. CSS Architecture

**Rating: 8/10**

**Strengths:**
- Comprehensive design token system in `variables.css`.
- Consistent spacing, typography, and color scales.
- Multiple theme support via `[data-theme]` attribute selectors.
- AMOLED theme with `box-shadow: none` -- good mobile optimization.
- Z-index scale is well-defined.

**Issues:**

### 9a. Theme Override Repetition

Shadow definitions are repeated verbatim in ocean, sunset, and forest themes. These could be inherited from the dark default since they are identical.

### 9b. Light Mode Defined Twice

Light mode values appear both in `[data-theme="light"]` and `@media (prefers-color-scheme: light)` with slightly different values (e.g., `--text-secondary: #666680` vs `#5a5a72`). This inconsistency means the explicit light theme and the auto-detected light theme render differently.

---

## 10. Code Duplication

**Rating: 6/10 -- Significant Duplication**

### 10a. Exercise Finish Logic (Critical)

As noted in section 3a, the post-exercise state update logic is duplicated between single exercise and session mode. This is the most significant duplication issue.

### 10b. MOOD_KEYS Array

Defined identically in both `dashboard.ts` (line 15) and `results.ts` (line 12). Should be extracted to a shared constant or component.

### 10c. Exercise Creation Switch Statements

`createExercise()` and `createBaselineExercise()` both have switch statements over exercise IDs. These could be unified with a factory registry.

### 10d. Monday-of-Week Calculation

`getMondayOfWeek()` logic appears in `progression.ts` and is duplicated inline in `dashboard.ts` (lines 308-315). The helper exists but is not exported/reused.

### 10e. Daily Challenge Description Key Mapping

The ternary chain mapping challenge types to i18n keys (dashboard.ts:270-283) is brittle and will need updating every time a new challenge type is added. A record-based lookup would be cleaner and safer.

---

## Additional Findings

### XSS Vectors

- `nav.ts:58` -- `iconSpan.innerHTML = item.icon` -- the icons are hardcoded SVG strings defined in the same file, so this is **safe but fragile**. If icons were ever sourced from user input or external data, this would be an XSS vector.
- `avatar.ts:82` -- `wrapper.innerHTML = buildSvg(...)` -- SVG is built from controlled params (level, color, size). The `color` comes from user profile data stored in localStorage. A malicious string in `color` (e.g., `"><script>...`) could potentially inject HTML. **Low risk** since the color is set during onboarding from a controlled palette, but no sanitization exists.
- `container.innerHTML = ''` is used 12 times for clearing containers -- this is safe.

### Hardcoded Values

- `go-no-go.ts:7` -- `DURATION_MS = 180_000` -- exercise durations are hardcoded per-exercise AND also defined in `EXERCISE_CONFIGS[id].durationSeconds`. The Go/No-Go exercise hardcodes 180s (3 min) but `EXERCISE_CONFIGS['go-no-go'].durationSeconds` is 60s. **The auto-finish timer in exercise-play.ts uses the config value (60s), but the exercise's internal timer uses 180s.** This means the exercise-play auto-finish fires at 60s while the exercise thinks it has 180s. This appears intentional (the outer timer controls actual duration) but is confusing.
- `baseline mode` hardcodes `60_000` ms duration (exercise-play.ts:902).
- `GRACE_PERIOD_MS = 200` in go-no-go.ts should be a constant in the difficulty params.

### TypeScript Strict Mode

`tsconfig.json` has `"strict": true` -- good. However, `noUncheckedIndexedAccess` is not enabled, meaning array/record access without bounds checking passes silently.

### Test Infrastructure

- `vitest.config.ts` uses `environment: 'node'` -- DOM-dependent code (exercises, screens) cannot be tested without `jsdom` or `happy-dom`.
- No test files were found in scope. The test infrastructure exists but appears unused or minimal.

---

## Summary of Recommendations (Priority Order)

| Priority | Issue | Effort |
|----------|-------|--------|
| **P0** | Extract shared `finishExercise` logic from exercise-play.ts | Medium |
| **P0** | Fix unhandled promise rejections in async exercise starts | Low |
| **P1** | Break main.ts circular dependency with context module | Medium |
| **P1** | Fix cross-tab sync race condition (cancel pending save) | Low |
| **P1** | Add content hashing to build output | Low |
| **P2** | Type-safe i18n key helpers to eliminate `as any` casts | Medium |
| **P2** | Extract MOOD_KEYS, Monday-of-week, challenge key maps | Low |
| **P2** | Split exercise-play.ts into 3 files (single/session/baseline) | Medium |
| **P2** | Light theme value inconsistency between manual and auto | Low |
| **P3** | Use Set for activityDays lookups | Low |
| **P3** | Add `noUncheckedIndexedAccess` to tsconfig | Low |
| **P3** | Add jsdom/happy-dom to test config for DOM testing | Low |
| **P3** | Sanitize avatar color to prevent potential XSS | Low |

---

## What's Done Well

1. **Zero `console.log` in production code** -- only error/warn for genuine issues.
2. **Disposables pattern** is consistently applied and correctly implemented.
3. **Type system** is comprehensive with discriminated unions for events.
4. **Storage layer** handles quota, corruption, and migration gracefully.
5. **Adaptive difficulty** algorithm is well-designed with level-up/down thresholds and plateau detection.
6. **Design token system** is thorough and supports multiple themes cleanly.
7. **No external runtime dependencies** -- the entire app is self-contained.
8. **Schema versioning** with forward-only migrations is production-ready.
