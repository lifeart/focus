# QA Review: Focus Attention Training App Test Suite

Reviewed: 13 test files against their corresponding source files.

---

## CRITICAL ISSUES

These are tests that are wrong, give false confidence, or mask real bugs.

### 1. `scoring.test.ts` — Tests a local replica, NOT the actual source code

**Severity: CRITICAL**

The entire `scoring.test.ts` file recreates scoring formulas locally (`goNoGoScore`, `flankerScore`, `nBackScore`) and tests those local copies. It never imports or calls the actual scoring functions from the exercise source files (`go-no-go.ts`, `flanker.ts`, `n-back.ts`). If the real scoring logic drifts from these local copies, every test will still pass while the app is broken. These tests verify nothing about the production code.

**Files:** `/Users/lifeart/Repos/ivetta/focus/tests/scoring.test.ts`

### 2. `celebrations.test.ts` — `getLevelTitle` assertions are too weak

**Severity: HIGH**

The `getLevelTitle` tests only check `toBeTruthy()` and `typeof === 'string'`. Since `getLevelTitle` calls `t()` which falls back to returning the key itself (e.g., `"level.5"`), these tests would pass even if every translation was missing. The test should assert the actual expected title value.

**Files:** `/Users/lifeart/Repos/ivetta/focus/tests/celebrations.test.ts` (lines 222-237)

### 3. `progression.test.ts` — `getLevelTitle` tests assert Russian while i18n may be English

**Severity: HIGH**

`progression.test.ts` line 59 asserts `getLevelTitle(1)` returns `'Новичок'` and line 64 asserts level 30 returns `'Абсолют'`. However, `getLevelTitle` calls `t('level.1')`, which depends on the current i18n locale. The test file does not mock or set the locale. Since `i18n.ts` initializes `currentLocale = 'ru'` at module level, this works only by accident — if any other test (e.g., `i18n.test.ts`) runs first and sets locale to `'en'`, these assertions will fail. This is an **order-dependent test**.

**Files:** `/Users/lifeart/Repos/ivetta/focus/tests/progression.test.ts` (lines 58-66)

### 4. `progression.test.ts` — `getScoreTier` tests also depend on locale

**Severity: HIGH**

Lines 111-122 assert `getScoreTier(30)` returns `label: 'Разминка'` and `getScoreTier(97)` returns `label: 'Идеально'`. Since `getScoreTier` calls `t()` to get the label, these assertions depend on the Russian locale being active. Same order-dependency issue as above.

**Files:** `/Users/lifeart/Repos/ivetta/focus/tests/progression.test.ts` (lines 110-122)

### 5. `adaptive.test.ts` — Level-up via 3-score average fires even on score > 88

**Severity: MEDIUM**

The test at line 29 ("levels up when avg of last 3 >= 75") uses scores [76, 78, 75] which average to 76.33. This correctly triggers the avg >= 75 path. However, the test does NOT verify that the `score > 88` instant-level-up path is NOT also firing. In `updateDifficulty`, if a score is > 88, the level increments immediately. Then the avg >= 75 check can ALSO trigger, potentially incrementing the level twice. Looking at the source: the level-down block has `if (newLevel === state.currentLevel)` guard, but the avg-up block does NOT check whether `newLevel` already changed. A score of 89 with recentScores of [80, 80] would trigger BOTH conditions (score > 88 AND avg >= 75), incrementing `newLevel` by 2.

This is an **actual bug in the source code** that the tests do not catch. The test on line 23 verifies score=89 goes from level 5 to 6 (correct for the > 88 path), but it also triggers the avg path if recentScores had qualifying values (they don't in this specific test because recentScores is empty, but the code path is still vulnerable).

**Files:** `/Users/lifeart/Repos/ivetta/focus/public/js/core/adaptive.ts` (lines 17-26), `/Users/lifeart/Repos/ivetta/focus/tests/adaptive.test.ts`

### 6. `i18n.test.ts` — Global mock pollution affects all subsequent tests

**Severity: HIGH**

`i18n.test.ts` calls `vi.stubGlobal('document', docMock)` and `vi.stubGlobal('navigator', ...)` at the top level. These stubs persist beyond the file if Vitest runs tests in the same worker. The `beforeEach` resets `docMock` properties but not the global stubs themselves. This is particularly dangerous because `progression.test.ts` imports `getLevelTitle` which calls `t()` which reads `currentTable` — a module-level variable set by `setLocale()`. If `i18n.test.ts` runs first and calls `setLocale('en')`, the `currentTable` in the shared module scope stays as English, breaking `progression.test.ts` Russian assertions.

**Files:** `/Users/lifeart/Repos/ivetta/focus/tests/i18n.test.ts` (lines 10-17)

---

## GAPS

Important untested code paths.

### 1. `storage.ts` — `loadAppData`, `saveAppData`, `importData`, `exportData`, `onStorageChange`, `pruneOldHistory` are NOT tested

`storage.test.ts` only tests `createDefaultAppData` from `constants.ts`. The actual storage module (`loadAppData`, `saveAppData`, `importData`, `exportData`, `onStorageChange`, `pruneOldHistory`) has zero test coverage. These functions handle localStorage, JSON parsing errors, QuotaExceededError retry logic, and data validation — all critical paths with high bug potential.

**Files:** `/Users/lifeart/Repos/ivetta/focus/public/js/core/storage.ts`

### 2. `progression.ts` — `generateWeeklyChallenge` and `checkWeeklyChallenge` are untested

These functions exist in the source but have no test coverage. `generateWeeklyChallenge` uses `Math.random()` which would need mocking.

**Files:** `/Users/lifeart/Repos/ivetta/focus/public/js/core/progression.ts` (lines 356-372)

### 3. `progression.ts` — `getXPProgress` has minimal coverage

Only one test case checks `getXPProgress(0)`. No tests verify behavior at level boundaries, at max level, or that the percent calculation is correct for mid-level XP values.

**Files:** `/Users/lifeart/Repos/ivetta/focus/tests/progression.test.ts` (lines 68-75)

### 4. `adaptive.ts` — `updateDifficulty` does not test `lastLevelChange` or `lastMicroAdjustment` return values

The source returns `lastLevelChange: 'up' | 'down' | undefined` and `lastMicroAdjustment` timestamp, but no test verifies these values are set correctly.

**Files:** `/Users/lifeart/Repos/ivetta/focus/tests/adaptive.test.ts`

### 5. `adaptive.ts` — `getMicroAdjustment` clamp for n-back (min 1500) and flanker (min 0.30) not tested

Only the go-no-go isiMax clamp to 400 is tested (line 135-139). The n-back `stimulusInterval` clamp to 1500 and flanker `congruentRatio` clamp to 0.30 are not tested.

**Files:** `/Users/lifeart/Repos/ivetta/focus/tests/adaptive.test.ts`

### 6. `router.ts` — No test for re-rendering prevention (`if (path === currentPath) return`)

The router has logic to skip re-rendering when navigating to the same path. This is untested.

**Files:** `/Users/lifeart/Repos/ivetta/focus/public/js/router.ts` (line 87)

### 7. `router.ts` — No test for cleanup error handling (try/catch on cleanup)

The router wraps cleanup calls in try/catch (lines 101-106). No test verifies that a throwing cleanup function does not crash the router.

**Files:** `/Users/lifeart/Repos/ivetta/focus/public/js/router.ts`

### 8. `baseline.ts` — `getBaselineParams` with non-baseline exercise IDs not tested

What happens when you call `getBaselineParams('visual-search')` or `getBaselineParams('breathing')`? The function works because DIFFICULTY_TABLE has entries for all exercises, but this is undocumented and untested.

### 9. `helpers.ts` — `createExerciseTimer`, `showCountdown`, `showFeedback` are untested

These are DOM-dependent helpers that have no test coverage. `createExerciseTimer` contains timing/drift-correction logic that would benefit from testing.

**Files:** `/Users/lifeart/Repos/ivetta/focus/public/js/exercises/helpers.ts` (lines 6-74)

### 10. `session.ts` — `createSessionPlan` with all exercises recently played (insufficient alternatives)

The fallback path on line 38 (`pool = available.length >= targetCognitive ? available : [...COGNITIVE_ORDER]`) is not exercised when there are exactly enough alternatives but the last exercise is excluded.

### 11. `badges.test.ts` — `weekly-goal`, `go-no-go-accuracy`, `n-back-level`, `personal-record` badge types never tested

Only `sessions`, `focus-time`, and `breathing-sessions` badges are tested. Four out of seven badge definitions have no coverage.

**Files:** `/Users/lifeart/Repos/ivetta/focus/tests/badges.test.ts`

### 12. `daily-challenge.test.ts` — `fast-reaction` exerciseId filter for flanker (not go-no-go) edge case

The `fast-reaction` challenge type checks `result.exerciseId === 'go-no-go'` in the source. The test verifies the wrong-exercise path with `flanker` but never tests what happens when exerciseId is `'go-no-go'` but meanRT is exactly at the threshold (boundary condition).

---

## IMPROVEMENTS

Better assertions or additional cases needed.

### 1. `streak.test.ts` — `getCurrentStreak` depends on system date

All `isoDate(n)` calls use `new Date()` internally. If tests run across midnight, dates computed at different points in the test could be different days, causing intermittent failures. Replace with a fixed reference date.

**Files:** `/Users/lifeart/Repos/ivetta/focus/tests/streak.test.ts` (lines 6-9)

### 2. `streak.test.ts` — `checkAndUpdateStreak` mutates its input

The tests verify mutation side effects on `prog` object (e.g., `expect(prog.streakFreezes).toBe(1)` on line 98). The function modifies the `progression` parameter in place, which is a risky API. Tests should document this is intentional or verify the return value more thoroughly rather than relying on mutation.

### 3. `session.test.ts` — `createQuickSession` picks weakest exercise uses loop for non-determinism

Line 124-129 runs 20 iterations to verify breathing/pomodoro are never returned. Since the function is deterministic (no randomness), a single call suffices. The loop adds test runtime without value.

### 4. `daily-challenge.test.ts` — `getTodayExercises` relies on UTC timestamps

The test uses `new Date('2026-03-19T10:00:00Z').getTime()` but `getTodayExercises` converts timestamps via `new Date(timestamp).toISOString().slice(0, 10)`. This works correctly because `toISOString()` always returns UTC, but the source code has a subtle bug: the early-exit optimization on line 423 (`else if (rDate < todayStr)`) assumes the history is sorted chronologically. If history is unsorted, the function could miss matching entries after the first past-date entry. No test verifies behavior with unsorted history.

**Files:** `/Users/lifeart/Repos/ivetta/focus/public/js/core/progression.ts` (lines 416-429)

### 5. `helpers.test.ts` — `formatTime` does not test negative inputs or very large values

`formatTime` uses `Math.ceil(ms / 1000)` which would produce unexpected results for negative inputs. No boundary test exists.

### 6. `helpers.test.ts` — `jitteredInterval` test uses randomness but does not mock `Math.random`

The test runs 100 iterations to check range (line 89-96). While this is unlikely to fail, it is technically non-deterministic. Mocking `Math.random` to return 0 and 1 (boundary values) would make it deterministic and test edges.

### 7. `i18n.test.ts` — `detectLocale` tests stub `navigator` globally but don't restore

Each `detectLocale` test calls `vi.stubGlobal('navigator', ...)` but never restores the previous value. The `beforeEach` on line 22 does not reset `navigator`. Later tests in the same file or other files could see stale navigator values.

### 8. `celebrations.test.ts` and `badges.test.ts` — Significant overlap

Both files test `checkBadges` with similar scenarios (10 sessions = bronze, 100 sessions = gold, deduplication). This duplication increases maintenance burden without additional coverage.

### 9. `adaptive.test.ts` — Boundary value at score exactly 88 not tested

The source uses `score > 88` (strict greater-than). A test with `score = 88` would verify the boundary is correct. Currently tested: 89 (levels up) and 90 (levels up), but 88 (should NOT level up) is missing.

### 10. `adaptive.test.ts` — Boundary value at score exactly 45 not tested

The source uses `score < 45` for instant level-down. A test with `score = 45` (should NOT level down) is missing. Currently only `score = 44` is tested.

### 11. `progression.test.ts` — `calculateXP` perfect score bonus test has misleading comment

Line 40: `expect(xp).toBe(73); // 10 + 38.4 ≈ 48 + 25` — the comment math is wrong. The actual calculation: `10 + (96/100) * 40 = 10 + 38.4 = 48.4`, rounded to `48`, plus `25` (perfect bonus) = `73`. The comment says `38.4 ≈ 48` which conflates the rounded intermediate with the base component.

### 12. `router.test.ts` — Missing test for hashchange event driven navigation

The tests call `router.navigate()` directly. No test verifies that manually changing `window.location.hash` (simulating browser back/forward) triggers the correct route. The mock infrastructure supports it (hashChangeListeners), but it's not exercised.

### 13. `daily-challenge.test.ts` — `no-pause-session` exclusion test uses fragile date generation

Lines 525-532 generate dates like `2026-13-01` (month 13) which are invalid. The loop goes up to 365 days with `month = Math.floor((d - 1) / 28) + 1` which can produce months 1-13. Month 13 is invalid but `dateHash` just hashes the string regardless. The test technically works but tests invalid date strings that would never occur in production.

---

## SUMMARY

| Category | Count |
|----------|-------|
| Critical Issues | 6 |
| Coverage Gaps | 12 |
| Improvements | 13 |

**Highest priority fixes:**

1. Replace `scoring.test.ts` with tests that import actual exercise scoring functions, not local replicas.
2. Add locale setup/teardown to `progression.test.ts` to prevent order-dependent failures.
3. Add real tests for `storage.ts` (loadAppData, saveAppData, importData with mocked localStorage).
4. Fix the double-level-up bug in `adaptive.ts` where both `score > 88` and `avg >= 75` can increment the level simultaneously.
5. Strengthen `getLevelTitle` assertions from `toBeTruthy()` to exact expected values.
6. Test the four untested badge types (`weekly-goal`, `go-no-go-accuracy`, `n-back-level`, `personal-record`).
