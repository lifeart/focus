# Plans 01-06 Review

---

## Plan 01: Streak System

### Domain Expert Review

- Loss aversion via streaks is well-established for daily engagement. Good fit for adolescents.
- **Concern**: "Streak at risk!" messaging could trigger anxiety in ADHD users prone to rejection-sensitive dysphoria. Consider softer phrasing like "Train today to keep your streak going" (which Plan 04's daily challenge type `streak-day` already uses -- good model).
- **Edge case**: Users who travel across time zones may lose streaks unfairly. The plan acknowledges UTC dates but does not address the UX consequence.
- **Edge case**: A user who opens the app but does NOT complete a session will see "Streak at risk!" but has no freeze consumed. If they close the app and come back the next day, `checkAndUpdateStreak` runs and the freeze is consumed then. This is correct but the UX flow needs clarity -- the "at risk" warning should explain they need to complete a session, not just open the app.

### Dev Review

- **Accurate references**: `ProgressionData` is at lines 130-146 in types.ts -- confirmed. `updateStreak()` is at line 76 in progression.ts -- confirmed. `streak-display.ts` structure matches.
- **`updateStreak()` already computes a local `currentStreak` variable** (line 104) but only for longest-streak calculation and does NOT return it. The plan correctly identifies this gap.
- **`longestStreak` claim is wrong**: Plan says "stored as a number but never written to." In fact, `longestStreak` IS written -- `updateStreak()` returns it and the dashboard calls `updateStreak()` (dashboard.ts line 180). However, it is recalculated each time from `activityDays`, so the stored field in `ProgressionData` is indeed never directly written outside of `createDefaultAppData`. The plan's point is valid but imprecisely stated.
- **Data version bump**: Plan proposes bumping `CURRENT_DATA_VERSION` to 2. This is correct. However, Plan 04 also adds fields to `ProgressionData` but says "No version bump needed" because the fields are optional. This inconsistency needs reconciliation -- either both bump or neither does.
- **`main.ts init()` invocation**: Plan says to call `checkAndUpdateStreak()` after `appState.init()`. Need to verify `main.ts` exports are accessible -- the plan references it but does not list `main.ts` in "Files Modified" (it does mention it in the implementation section). This is listed correctly in the files list on line 109.
- **sessionStorage for "streak saved" flag**: Reasonable approach, consistent with existing patterns.

### QA Review

- Test cases 1-12 are comprehensive for the pure logic.
- **Missing**: Test for timezone edge case (user at UTC+12 midnight boundary).
- **Missing**: Integration test for the "Streak at risk!" display logic on dashboard.
- **Missing**: Test for concurrent tab scenario -- two tabs open, both call `checkAndUpdateStreak` simultaneously.

### Changes Needed

1. Soften "Streak at risk!" i18n text to be less anxiety-inducing. Change `streak.atRisk` from "Streak at risk! Train today." to "Keep your streak -- train today!" in all languages.
2. Clarify in plan that `longestStreak` IS computed and returned by `updateStreak()` but is not persisted directly to the data model by any caller; the value in `ProgressionData.longestStreak` is stale/default.
3. Add edge case: what happens if `activityDays` contains future dates (clock skew)? `getCurrentStreak` walking backward from today would skip them, but they should be filtered.

---

## Plan 02: Celebrations

### Domain Expert Review

- Celebration overlays are critical for engagement, especially for adolescents who need immediate reinforcement.
- 4-second auto-dismiss + tap-to-dismiss is good. Avoid making overlays feel like obstacles.
- **Concern**: Sequential overlays (level-up then badges) could stack up. If a user earns a level-up + 3 badges, that is 4 sequential overlays x 4 seconds = 16 seconds of forced celebration. Cap at 2-3 overlays, batch remaining badges into a summary.
- Share button is good for social reinforcement but only if it works reliably. If `navigator.share` is flaky on the target devices, a broken share button is worse than none.

### Dev Review

- **`AppEvent` references accurate**: `level-up` at line 209, `badge-earned` at line 210 -- confirmed.
- **`playLevelUp()` and `playBadge()`**: Confirmed in sound.ts (lines 93-111). Fully implemented, never called.
- **`checkBadges()` exists**: Confirmed at progression.ts line 164. Returns `EarnedBadge[]`. Never called outside of itself.
- **Line references for exercise-play.ts**: Plan says `finishExercise()` at "line ~117" and `onExerciseFinish()` at "line ~361". Actual: `finishExercise()` starts at line 110, `onExerciseFinish()` starts at line 361. Close enough.
- **Session mode double-fire concern**: The plan acknowledges this (Risk #1) and proposes accumulating celebration data. Good. But the plan does not specify WHERE the accumulation happens -- it should be a `let celebrationData` variable scoped to `renderSessionMode` that gets updated in each `onExerciseFinish` call, then written to sessionStorage once in `finishSession()`.
- **Confetti extraction**: Plan proposes extracting to `confetti.ts`. The existing confetti in results.ts (lines 139-182) is straightforward to extract. Good refactoring.
- **`z-index: var(--z-toast)` = 400**: Plan says "above everything." Verify no other z-index conflicts. The plan correctly identifies `--z-overlay: 300` and `--z-toast: 400`.

### QA Review

- Test cases are solid (10 tests).
- **Missing**: Test for the session-mode accumulation path (multiple exercises, one level-up detected, only one overlay shown).
- **Missing**: Test for early exit during celebration -- user navigates away while overlay is showing. Verify disposables cleanup removes the overlay from `document.body`.
- **Missing**: Test that `checkBadges()` correctly handles awarding gold when user already has bronze+silver (the `break` after highest unearned tier in progression.ts line 183 means it awards highest tier first, which is gold. But if user has gold, it skips to silver, etc. Verify this is correct for the "award NEW badges" use case).

### Changes Needed

1. Add a cap on sequential overlays: max 3 (1 level-up + 2 badges). If more badges, show a summary card.
2. Specify that `celebrationData` accumulation for session mode should be a local variable in `renderSessionMode`, written to sessionStorage in `finishSession()`.
3. In `checkBadges()` -- the existing logic awards the HIGHEST eligible tier per badge that is not yet earned. If the user jumps from having nothing to qualifying for gold, they get gold (not bronze first). This is intentional per the code but the plan should acknowledge this edge case explicitly in the overlay (showing "Gold" directly without showing bronze/silver progression).

---

## Plan 03: Feedback Language

### Domain Expert Review

- Excellent psychological framing. "Hold steady!" instead of "Don't press!" is textbook positive instruction for ADHD users.
- "That one got away -- stay ready!" is great reframing from punitive to instructional.
- Results screen encouragement at every tier is important -- currently low scorers get no encouragement.
- **Concern**: "Great first try! Your brain is already starting to learn" for `onboarding.encourage.low` may feel patronizing to older adolescents (16-18). Consider a more neutral tone: "Good start! Your brain is warming up."
- Reducing N-Back from 5 min to 3 min is correct for ADHD users. 5 minutes is too long for sustained attention.
- Replacing "no errors" with "90%+ accuracy" is the right call.

### Dev Review

- **N-Back duration discrepancy identified correctly**: `EXERCISE_CONFIGS['n-back'].durationSeconds` is 90 (constants.ts line 44) while `DURATION_MS` in n-back.ts is 300,000 (5 minutes / 300 seconds). These are deeply out of sync. The plan says to set `DURATION_MS` to 180,000 and `durationSeconds` to 180. However, this creates another problem: `durationSeconds` in EXERCISE_CONFIGS is used by the auto-finish timer in exercise-play.ts (lines 201-217), which computes `durationMs = exConfig.durationSeconds * 1000`. If `durationSeconds = 180` and the internal `DURATION_MS = 180_000`, the exercise timer and the auto-finish timer will race, causing potential double-finish. **The actual exercise (n-back.ts) handles its own end via `timer.getElapsed() >= DURATION_MS` check at line 179**. The auto-finish in exercise-play.ts is a redundant safety net. Setting both to 180 seconds is correct but the plan should note this dual-timer issue.
- **Wait -- actually**: Go-no-go has `DURATION_MS = 180_000` (3 min) in go-no-go.ts line 7, but `durationSeconds: 60` in EXERCISE_CONFIGS. This means the auto-finish timer in exercise-play.ts fires at 60 seconds, stopping the exercise early, while the internal timer runs for 3 minutes. **This is a fundamental pre-existing bug or the exercise's internal timer is the display timer only and the auto-finish is the actual terminator.** Looking more carefully: the auto-finish fires at `durationMs + 500` = 60,500ms. The exercise's internal timer counts 180,000ms for display. This means exercises are actually cut short by the auto-finish at 60s for Go/No-Go, but the DURATION_MS is used for estimated trial count calculation and timer display. This is confusing but seems intentional -- the actual exercise duration is controlled by `EXERCISE_CONFIGS.durationSeconds` via the auto-finish mechanism, not by the internal `DURATION_MS`. **Plan 03 is therefore wrong**: changing n-back's `DURATION_MS` to 180,000 won't change the actual exercise duration. The auto-finish uses `EXERCISE_CONFIGS[exId].durationSeconds * 1000`. To make N-Back 3 minutes, change `durationSeconds` to 180. But also check whether this is consistent with other exercises -- Go/No-Go has `durationSeconds: 60` which is 1 minute, and flanker has `durationSeconds: 60`. So the current N-Back `durationSeconds: 90` means it runs for 90 seconds (1.5 min), not 5 minutes.
- **Actually, wait again**: Re-reading exercise-play.ts line 200-217 more carefully -- the auto-finish polls `exerciseElapsed` which increments by 500ms each interval (pausing excluded). It fires when `exerciseElapsed >= durationMs + 500`. So `durationMs = EXERCISE_CONFIGS['n-back'].durationSeconds * 1000 = 90 * 1000 = 90000`. The auto-finish fires at ~90.5s. Meanwhile, the n-back exercise's own timer tracks 300,000ms (5 min) for the display and internal trial generation. The exercise will be stopped at 90s by the external auto-finish, but the timer display will show counting toward 5 minutes. **This is definitely a bug.** The internal `DURATION_MS` and `EXERCISE_CONFIGS.durationSeconds` should match. For the fix: set `DURATION_MS` in n-back.ts to match whatever `durationSeconds` is set to. If target is 3 minutes, both should be 180.
- **"no-errors" challenge fix**: The plan says to find where challenge progress is incremented. It correctly identifies that **weekly challenge progress is never incremented** (confirmed by grep -- `weeklyChallenge.progress` is only read on dashboard, never written in exercise-play.ts). So changing the threshold from 100% to 90% is moot until the weekly challenge progress tracking is actually implemented. The plan trails off ("Let me check.") at line 224, suggesting incompleteness.
- **Difficulty notification**: Plan proposes adding `lastLevelChange` to `DifficultyState`. Looking at adaptive.ts, `updateDifficulty` returns a new `DifficultyState`. Adding an optional field there works. However, `DifficultyState` is defined in types.ts (line 105-111) and is persisted in `AppData.difficulty`. Adding `lastLevelChange` to the persisted data is wasteful since it is ephemeral. Better: have `updateDifficulty` return a tuple `[DifficultyState, 'up' | 'down' | null]` or return an extended result object.
- **Toast component**: Plan proposes creating a new toast.ts. This conflicts with Plan 04 which also needs toast-like UI (daily bonus animation). Should be a shared component.

### QA Review

- No formal test section in this plan. Tests are implied but not enumerated.
- **Missing**: Test that results screen shows correct encouragement message for each tier boundary (59, 60, 74, 75, 84, 85, 94, 95).
- **Missing**: Test that the n-back duration change actually affects exercise length (integration test).
- **Missing**: Test that the "no errors" challenge condition change works (blocked on implementing progress tracking).

### Changes Needed

1. **Critical**: Fix the N-Back duration analysis. Both `DURATION_MS` in n-back.ts AND `EXERCISE_CONFIGS['n-back'].durationSeconds` in constants.ts must be updated consistently. Set `durationSeconds: 180` and `DURATION_MS = 180_000`. Also note and fix the pre-existing discrepancy where `durationSeconds: 90` != `DURATION_MS: 300_000`.
2. **Critical**: The plan is incomplete -- section 5b ("Update Challenge Logic") trails off at line 224 with "Let me check." This section must be completed. The actual fix requires: (a) implementing weekly challenge progress tracking in exercise-play.ts `finishExercise()`, and (b) changing the condition from `score === 100` to `score >= 90`. However, since progress is never tracked (pre-existing bug), this plan should either scope the fix to just the i18n text change OR include implementing the weekly challenge progress tracking.
3. **Architecture**: Don't add `lastLevelChange` to `DifficultyState` (which is persisted). Instead, return it as a separate value from `updateDifficulty`. E.g., `updateDifficulty(state, score): { state: DifficultyState; levelChange: 'up' | 'down' | null }`.
4. Add a test plan section with explicit test cases.
5. Merge toast component work with Plan 04's need for toast/notification UI.

---

## Plan 04: Daily Challenges

### Domain Expert Review

- Daily challenges are a strong engagement loop. 13 challenge types provide good variety.
- **Concern**: Some challenge types are impossible for new users. `beat-personal-best` on day 1 (no history), `n-back-level` at level 3+ (default is level 1), `fast-reaction` under 350ms (very demanding). The seeded deterministic assignment means some users on day 1 could get an impossible challenge.
- **Concern**: `no-pause-session` punishes a coping mechanism. ADHD users may NEED to pause. This challenge type subtly discourages a healthy behavior.
- **Login bonus of 10 XP**: Good for habit formation. Minimal enough to not be game-breaking.
- **13 templates with simple hash modulo**: Consecutive days will sometimes repeat. With 13 templates the expected repeat cycle is short. This may feel stale. Consider at minimum a "no same as yesterday" filter.

### Dev Review

- **Accurate analysis of weekly challenge system**: The plan correctly identifies that `weeklyChallenge.progress` is never incremented (confirmed by grep). Good.
- **Line references**: `WeeklyChallenge` at types.ts 162-169 -- confirmed (actual 162-169). `generateWeeklyChallenge()` at progression.ts 193-202 -- confirmed (actual 193-202). Dashboard weekly challenge code at lines 211-228 -- confirmed (actual 211-228, 230 for check).
- **`Math.random()` for weekly challenge**: Correctly identified as non-deterministic. Daily uses deterministic hash -- good.
- **`dateHash` function**: The plan's hash implementation `((hash << 5) - hash + charCodeAt)` is the classic djb2 hash. Works fine but with only 13 templates, collision rate is ~7.7% per day pair. Acceptable.
- **Optional fields approach**: Adding `dailyChallenge?` and `lastDailyBonusDate?` as optional is safe and avoids a version bump. This contradicts Plan 01's approach of bumping the version. Need consistency.
- **Performance concern (Risk #6)**: `getTodayExercises()` filtering full `exerciseHistory` is valid. However, `exerciseHistory` is pruned to 60 days by `pruneOldHistory` in storage.ts. For typical users (1-5 exercises/day x 60 days = 60-300 entries), performance is fine.
- **Checking logic for 13 types**: The plan provides a table of check logic per type. Several types require data not currently available in `finishExercise()`:
  - `no-pause-session`: Requires knowing if `pause()` was called. The plan acknowledges this (Risk #4) but does not specify how to add the `wasPaused` flag.
  - `train-minutes`: Uses `totalFocusTimeMs` but needs TODAY's total vs previous day's. The formula given is wrong -- it should compare today's exercise history minutes, not total accumulated.
  - `accuracy-streak`: Requires tracking consecutive scores across exercises within today. Complex state management.

### QA Review

- 9 test cases listed. Reasonable coverage.
- **Missing**: Tests for each of the 13 challenge type check conditions (only one generic "per type" test mentioned).
- **Missing**: Test for impossible challenges (e.g., `beat-personal-best` with no history).
- **Missing**: Test for `no-pause-session` flag tracking.
- **Missing**: Stress test for `dateHash` distribution across 365 days to verify reasonable spread.

### Changes Needed

1. **Remove `no-pause-session` challenge type**. Pausing is a healthy coping mechanism for ADHD users. Discouraging it is counterproductive.
2. Fix `train-minutes` check logic: should use `getTodayExercises()` to sum today's `durationMs`, not compare `totalFocusTimeMs` across days.
3. Add a "no repeat from yesterday" filter in `generateDailyChallenge` -- store previous day's challenge type and skip it in selection.
4. Add a difficulty guard: challenges like `n-back-level` (level 3+) and `fast-reaction` (350ms) should check user's current difficulty level / history. If the user has never reached the required level, swap to an easier challenge.
5. Specify how `wasPaused` flag is tracked (if `no-pause-session` is kept -- but per point 1, remove it).
6. The plan says to fix weekly challenge progress tracking as part of this work. This should be explicit: add `updateWeeklyChallengeProgress()` calls in `finishExercise()` for each weekly challenge type.

---

## Plan 05: Quick Session

### Domain Expert Review

- Excellent feature for ADHD users. Reducing activation barrier is the single most impactful UX improvement for this population.
- 1-tap to exercise is the right target. Skipping mood modal for quick sessions makes sense.
- **Concern**: Replacing the single "Start Training" button with 3 cards increases decision complexity. For ADHD users, more choices = more friction. Consider keeping one prominent button ("Quick Start") with the other options as secondary/expandable.
- **Concern**: Quick sessions contribute only ~1 minute to daily goal. If the daily goal is 10 minutes, this creates a feeling of inadequacy. The plan acknowledges this (Risk #4) but consider showing "1 of 10 min done -- one more?" as encouragement rather than just leaving the progress bar nearly empty.

### Dev Review

- **`#/session` route unreachable**: Confirmed. Plan correctly identifies that nothing navigates to `#/session` (dashboard navigates to `#/exercises` via mood modal).
- **`createSessionPlan` in session.ts**: The plan correctly describes the current behavior.
- **Quick session exercise selection**: "Weakest skill" algorithm needs access to `exerciseHistory` scores per exercise. This data is available in `appState.getData().exerciseHistory`. Good.
- **`renderSessionMode` modification**: Plan says to read `SESSION_TYPE_KEY` from sessionStorage and call `createSessionByType`. The modification to `showPlan()` / `startNextExercise()` is straightforward.
- **Mood data missing (Risk #5)**: `SessionResult.mood` is optional (types.ts line 182: `mood?: Mood`). Results screen reads from `SESSION_MOOD_KEY` in sessionStorage (results.ts line 297). For quick sessions, `SESSION_MOOD_KEY` won't be set. The mood comparison section will show "Thank you" instead of a comparison. This is fine.
- **Session mode's `finishSession()` aggregates results**: For a 1-exercise session, the aggregated result will have `exercises.length === 1`. The results screen renders it as a single exercise result. This works.
- **Dashboard modification scope**: Replacing lines 267-284 (the Start Training button area) is correctly scoped.
- **Deep session breathing ordering**: Plan says "breathing first (as warm-up)". This contradicts the current session plan which puts breathing at a variable position. Placing breathing first is a good design choice for deep sessions.

### QA Review

- Tests cover key scenarios (9 test cases across 4 categories).
- **Missing**: Test that quick session still saves to `SessionResult` and appears in dashboard recent activity.
- **Missing**: Test for deep session with 6 exercises (verify all cognitive + breathing + repeat weakest).
- **Missing**: Test that `SESSION_TYPE_KEY` is cleaned up after session finishes (Risk #2).
- **Missing**: Test that navigating directly to `#/session` without setting `SESSION_TYPE_KEY` defaults to "standard" gracefully.

### Changes Needed

1. Consider a UX where "Quick Start" is the prominent primary button and "Standard" / "Deep Focus" are smaller secondary options, rather than 3 equal cards. This reduces decision paralysis.
2. In `createQuickSession`, specify the fallback order when scores are equal AND no history: the plan says "first in COGNITIVE_ORDER (go-no-go)" but `COGNITIVE_ORDER` is not defined in the codebase. Specify the actual fallback: `['go-no-go', 'flanker', 'visual-search', 'n-back']` or similar.
3. Add cleanup of `SESSION_TYPE_KEY` in both `finishSession()` AND in the cleanup return function of `renderSessionMode` (to handle navigation-away).
4. The plan does not mention what happens when `#/session` is accessed directly (e.g., page refresh during session). Currently `renderSessionMode` will re-plan and restart. This is acceptable but worth noting.

---

## Plan 06: Exercise Visuals

### Domain Expert Review

- Moving inline styles to CSS is the right architectural direction for theme support.
- Stimulus animations (200ms pop-in) add polish without impacting cognitive task timing.
- **Concern**: Within-exercise streak counter ("5 in a row!") adds visual noise during tasks that require concentration. For ADHD users, additional moving/changing elements in the visual field can be distracting. Make the streak counter subtle (small, muted color) and consider making it opt-in via settings, or showing only at milestones (5, 10, ...) rather than continuously.
- **Concern**: Exit animations (150ms fade-out) on stimuli could interfere with inter-stimulus interval timing. If the ISI is 500ms (visual search), a 150ms exit animation consumes 30% of the gap. This could create a perception of slower pacing.
- SVG score ring on results is a nice visual upgrade.

### Dev Review

- **Inline style removal -- go-no-go.ts**: Plan references lines 56-73 for `createShape()`. Actual code is at lines 56-73. Confirmed accurate.
- **Inline style removal -- flanker.ts**: Plan references `createArrowSpan()` at lines 66-82. Actual code at lines 66-82. Confirmed. `createNeutralSpan()` at lines 84-94 confirmed. Arrow row at lines 118-122 confirmed.
- **flanker.ts button styles**: Plan says `.flanker-btn` already exists in exercises.css (lines 681-708). Need to verify this claim. The plan assumes these CSS classes exist but they may not -- the claim should be verified before implementation.
- **visual-search.ts `createShapeElement()`**: Plan references lines 87-112. Confirmed at lines 87-112.
- **CSS variable `--gng-go-color`**: Good approach. The JS sets the CSS custom property, CSS handles the rest. However, the `randomGoColor()` function returns hardcoded hex values (`#4ecdc4` etc.). For full theme support, these should be theme-aware CSS variables (`--gng-go-1` through `--gng-go-4`) defined per theme in variables.css. The plan mentions this in Risk #7 but should be explicit in the implementation section.
- **`color-mix()` browser support**: The plan notes Chrome 111+, Firefox 113+, Safari 16.2+. These are modern enough for a 2026 app. However, add fallback for older Safari on older iPhones (Safari 16.2 = iOS 16.2, Dec 2022). Consider adding a fallback `background-color` before the `background` shorthand.
- **Router transition (Section 6)**: The plan proposes adding fade transitions in router.ts `render()`. Looking at the actual code (router.ts lines 86-119), the render function does: cleanup old, `rc.innerHTML = ''`, render new. Adding a 150ms delay between cleanup and render means the new screen is delayed. This blocks navigation. The plan acknowledges this (Risk #4) but the mitigation (cancel in-progress transition) adds complexity. **Consider making transitions opt-out for exercise screens** where navigation speed matters.
- **Exit animation on stimulus removal**: The plan says to listen for `animationend` before DOM removal. This requires modifying `removeStimulus()` in go-no-go.ts to add class, wait for event, then remove. The current code likely does `shape.remove()` directly. This is doable but adds timing complexity and a potential memory leak if `animationend` never fires.
- **`nbackFadeIn` modification**: The plan proposes changing the existing keyframe to add overshoot. This changes the visual behavior for existing users. Should be fine but note it is not backward-compatible visually.

### QA Review

- 6 test categories with multiple sub-cases. Good coverage.
- **Missing**: Performance test for stagger delay on 7x7 grid (49 items x 20ms = 980ms). Verify this does not cause jank.
- **Missing**: Test that `prefers-reduced-motion` correctly suppresses ALL new animations (the plan relies on the existing blanket rule but should verify new keyframes are covered).
- **Missing**: Test for exit animation cleanup -- if exercise is destroyed during exit animation, verify no orphaned elements.
- **Regression risk**: Removing inline styles from 4 exercise files simultaneously is high-risk. If any CSS class is missing or mis-named, exercises will look broken. Recommend implementing one exercise at a time with visual verification.

### Changes Needed

1. Make within-exercise streak counter visible only at milestones (5, 10, 15, 20) as a brief flash, not continuously. Continuous display is distracting for ADHD users during cognitive tasks.
2. Define theme-aware Go/No-Go color palette in `variables.css` per theme (`--gng-go-1` through `--gng-go-4`) rather than keeping hardcoded hex in JS.
3. Add `color-mix()` fallback for older browsers: place a simple `background-color: var(--gng-go-color)` before the gradient `background` declaration.
4. For router transitions, skip the fade for routes starting with `/play` and `/session` to avoid delaying exercise start.
5. Implement inline style removal one exercise at a time to reduce regression risk. Suggest order: go-no-go first (simplest), then flanker, then visual-search, then n-back.
6. Verify that `.flanker-btn`, `.flanker-buttons`, `.visual-search-no-target-btn`, `.nback-stimulus-area` CSS classes actually exist in exercises.css before relying on them (plan asserts they do but provides line numbers that should be verified).

---

## Cross-Plan Analysis

### File Conflict Matrix

| File | 01 | 02 | 03 | 04 | 05 | 06 |
|------|----|----|----|----|----|----|
| `types.ts` | X | | | X | X | |
| `constants.ts` | X | X | X | X | X | |
| `progression.ts` | X | X | | X | | |
| `storage.ts` | X | | | | | |
| `exercise-play.ts` | X | X | X | X | X | |
| `dashboard.ts` | X | | | X | X | |
| `results.ts` | | X | X | | | X |
| `streak-display.ts` | X | | | | | |
| `i18n/keys.ts` | X | X | X | X | X | X |
| `i18n/en.ts` (+ all locales) | X | X | X | X | X | X |
| `animations.css` | | X | | | | X |
| `layout.css` | | X | X | | X | |
| `exercises.css` | | | | | | X |
| `router.ts` | | | | | | X |
| `go-no-go.ts` | | | | | | X |
| `flanker.ts` | | | | | | X |
| `visual-search.ts` | | | | | | X |
| `n-back.ts` | | | X | | | X |
| `adaptive.ts` | | | X | | | |
| `session.ts` | | | | | X | |
| `main.ts` | X | | | | | |
| `helpers.ts` | | | | | | X |

### High-Conflict Files

1. **`exercise-play.ts`**: Modified by Plans 01, 02, 03, 04, 05. This is the most critical conflict zone. All plans add logic to `finishExercise()` (single mode) and `onExerciseFinish()` (session mode). These modifications are additive (streak update, celebration detection, difficulty notification, daily challenge progress, session type handling) and do not conflict structurally, but the function will become very long. Consider extracting a `postExerciseHooks()` function.

2. **`constants.ts`**: Modified by Plans 01, 02, 03, 04, 05. Additive changes (new constants). No structural conflicts.

3. **`types.ts`**: Modified by Plans 01, 04, 05. All add new types/fields. No conflicts.

4. **`dashboard.ts`**: Modified by Plans 01, 04, 05. Plan 01 changes streak display options. Plan 04 adds daily challenge card. Plan 05 replaces the Start Training button. These modify different sections of the dashboard but the card ordering needs coordination.

5. **`results.ts`**: Modified by Plans 02, 03, 06. Plan 02 adds celebration overlay integration. Plan 03 adds encouragement message. Plan 06 adds SVG score ring and improved confetti. Plan 02 also extracts confetti to a shared module, which Plan 06 then modifies. Order matters: Plan 02 must extract confetti before Plan 06 modifies it.

### Recommended Implementation Order

1. **Plan 06 (Exercise Visuals)** -- First. Touches exercise files that no other plan modifies. CSS-only changes reduce conflict risk. Establishes the CSS class foundation. No data model changes.

2. **Plan 03 (Feedback Language)** -- Second. Primarily i18n text changes (low conflict). The N-Back duration fix and difficulty notification are isolated changes. Toast component created here can be reused by Plan 04.

3. **Plan 01 (Streak System)** -- Third. Data model changes (`ProgressionData` extension, version bump, migration) establish the foundation for Plans 02 and 04.

4. **Plan 02 (Celebrations)** -- Fourth. Depends on Plan 01 for streak data (streak freeze earned celebrations could be added). Depends on Plan 06 for confetti being in good shape. Extracts confetti to shared module.

5. **Plan 04 (Daily Challenges)** -- Fifth. Builds on the patterns established by Plans 01 (data model extension) and 03 (challenge fix). Uses toast component from Plan 03. Includes fix for weekly challenge progress tracking bug.

6. **Plan 05 (Quick Session)** -- Last. Modifies dashboard and exercise-play.ts most heavily. Benefits from all prior changes being stable. The session type selector replaces the Start Training button, which could conflict with Plan 04's dashboard layout changes if done earlier.

### Shared Infrastructure to Build First

1. **Toast/notification component** (`ui/components/toast.ts`): Needed by Plans 03 (difficulty notification), 04 (daily bonus), and 01 (streak saved banner). Build once, reuse.

2. **Confetti shared module** (`ui/components/confetti.ts`): Needed by Plans 02 and 06. Extract from results.ts early.

3. **`postExerciseHooks()` pattern**: Plans 01, 02, 03, 04 all add code to `finishExercise()` / `onExerciseFinish()`. Define a hook system or at minimum a single extracted function that calls all post-exercise logic in sequence (streak update, celebration check, challenge progress, difficulty notification).

4. **Data model version strategy**: Plan 01 bumps version to 2 with migration. Plans 04 and 05 add optional fields without version bump. Decide on one approach: either all use optional fields (no version bumps) or all coordinate on a single version bump (v1 -> v2 with all new fields).

### Pre-Existing Bugs to Fix Before Implementation

1. **Weekly challenge progress never incremented**: `weeklyChallenge.progress` is never updated in `exercise-play.ts`. Plans 03 and 04 both reference this. Fix as part of Plan 04.

2. **N-Back duration mismatch**: `EXERCISE_CONFIGS['n-back'].durationSeconds = 90` but `n-back.ts DURATION_MS = 300_000` (300s). The auto-finish timer uses the config value (90s), the display timer uses the internal value (300s). These must be synchronized. Fix as part of Plan 03.

3. **Go/No-Go duration mismatch**: `EXERCISE_CONFIGS['go-no-go'].durationSeconds = 60` but `go-no-go.ts DURATION_MS = 180_000` (180s). Same issue as N-Back. The auto-finish fires at 60s but the display shows 3 minutes. This may be the intended design (60s actual with 3min display timer) but is confusing. Investigate and document.
