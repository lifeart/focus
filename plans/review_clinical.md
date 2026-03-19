# Clinical Validity Review: Focus App Cognitive Exercises

**Reviewer**: Neuropsychologist specializing in computerized cognitive assessment for adolescents
**Date**: 2026-03-19
**Scope**: All exercise implementations, helper functions, difficulty tables, adaptive engine, baseline module

---

## 1. Go/No-Go Task

### 1.1 Paradigm Fidelity
- **Acceptable**: Classic Go/No-Go with color-based Go (multiple colors) vs. No-Go (single red). Shape differentiation (CSS class `gng-stimulus--go` vs `gng-stimulus--nogo`) is appropriate.
- **ISSUE (Minor)**: Using four different Go colors introduces a feature-search component that is not part of the standard Go/No-Go paradigm. In the canonical version, Go and No-Go differ on exactly one feature. Multiple Go colors may slightly reduce prepotent response strength because participants cannot build a single stimulus-response mapping; they must learn a category rule. This is acceptable for a training app but deviates from laboratory paradigms.

### 1.2 Timing
- **ISI**: 1200-1800ms at Level 1, decreasing to 500-800ms at Level 10. Appropriate range; typical lab ISIs are 1000-2000ms.
- **Stimulus duration**: 500ms at Level 1, 300ms at Level 10. Reasonable.
- **ISSUE (Moderate)**: `GRACE_PERIOD_MS = 200` is added to Go stimulus display time but NOT to No-Go stimulus display time (line 134-136). This means Go stimuli are visible for `stimulusDuration + 200ms` while No-Go stimuli disappear after `stimulusDuration`. The differential display duration is a confound: participants learn that stimuli that linger are Go stimuli, providing an implicit timing cue that undermines the inhibitory demand. In a valid paradigm, stimulus duration should be identical for Go and No-Go trials.
- **ISSUE (Minor)**: `Date.now()` has ~1ms resolution on most browsers but can have 5-16ms jitter depending on browser timer resolution. For a training app this is acceptable; for a clinical measurement tool, `performance.now()` would be preferable.

### 1.3 Scoring
- **Formula**: `50% * (1 - commissionRate) + 30% * accuracy + 20% * (1 - CV)`.
- **ISSUE (Moderate)**: The `stabilityScore = (1 - cv) * 20` can go negative when CV > 1.0 (which occurs when SD > mean, possible with very variable RTs). The final score is clamped to [0, 100], but the composite weighting becomes distorted. CV should be clamped to [0, 1] before scoring, or a different transformation used.
- **ISSUE (Minor)**: Commission rate is double-computed: once in `computeMetrics()` (stored but not in the metrics object) and again in `computeScore()`. Not a bug, but redundant.

### 1.4 Trial Generation
- **ISSUE (Moderate)**: `isGoTrial()` uses independent `Math.random() >= noGoRatio` per trial. With 20-30% No-Go ratio and ~90-130 trials per session, there is no constraint preventing long runs of Go-only trials (which would reduce prepotent response buildup) or clusters of No-Go trials. Standard practice is to use block-randomized sequences ensuring the target ratio is met within blocks of 10-20 trials.
- **ISSUE (Minor)**: No explicit minimum number of No-Go trials is guaranteed. With pure randomization and short sessions, the actual No-Go ratio could deviate significantly from the intended ratio.

### 1.5 Metrics
- **CV**: Correctly calculated (see Section 9 below).
- **Lapse rate**: Correctly calculated.
- **MISSING**: d-prime is not computed for Go/No-Go, though it is a signal-detection task. Commission/omission rates are reported, which is acceptable, but d-prime would add clinical utility.

---

## 2. N-Back Task

### 2.1 Paradigm Fidelity
- **Good**: Letter-based N-Back with 10-letter pool (A-J), pre-generated sequence, 30% match rate. This is standard.
- **Good**: First N trials are correctly excluded from scoring (line 228).
- **Good**: Queue display shows the last N letters (excluding current), which is an appropriate training scaffold.

### 2.2 Timing
- **Stimulus interval**: 3000ms at Level 1 down to 2400ms at Level 10. Standard N-Back uses 2000-3000ms. Acceptable.
- **ISSUE (Minor)**: The stimulus remains visible for the entire `stimulusInterval`. There is no blank ISI between stimuli. Standard N-Back paradigms typically show the stimulus for 500ms then a blank ISI. Continuous stimulus presence may reduce working memory demand because participants can re-encode. However, for adolescent training this may be an intentional design choice to reduce frustration.

### 2.3 Lure Trials
- **ISSUE (BUG - High)**: The lure logic has an indexing error. For an N-1 lure (match at position N-1 back), the code at line 66 checks `seq[i - nLevel + 1]`. Let's trace: if we want a letter that matches what was `N-1` positions back, we need `seq[i - (nLevel - 1)] = seq[i - nLevel + 1]`. This is correct for N-1 lures.
- For N+1 lures (line 70): `seq[i - nLevel - 1]` = letter at position `i - (nLevel + 1)`, which IS `N+1` positions back. Correct.
- **ISSUE (Moderate)**: The `useLures` flag is controlled by `level >= 3` (the difficulty level, not `nLevel`). However, looking at the difficulty table, `nLevel = 1` at difficulty levels 1-4, `nLevel = 2` at levels 5-7, `nLevel = 3` at levels 8-10. So lure trials activate at difficulty level 3, when `nLevel` is still 1. **For 1-back, N-1 lures mean matching 0 positions back (the current letter itself) and N+1 lures mean matching 2 positions back.** The N-1 case is nonsensical: `seq[i - nLevel + 1] = seq[i]` which is the position being generated -- but `seq[i]` doesn't exist yet at generation time since we're deciding what to push. The code reads `seq[i - nLevel + 1]` where `nLevel=1`, so `seq[i - 1 + 1] = seq[i]`, which is an out-of-bounds read (undefined). This means `lureLetter` will be `undefined`, and the condition `seq[i - nLevel + 1] !== avoid` will likely pass (undefined !== some letter), setting `lureLetter = undefined`. Then `if (lureLetter)` would be falsy for `undefined`, so it falls through to the N+1 branch. For `nLevel=1`, N+1 requires `i >= nLevel - 1 = 0` and `nLevel >= 2` -- this fails because `nLevel=1`. So no lure is created. **In practice, lure generation silently fails at nLevel=1**, which means lure trials at difficulty levels 3-4 (nLevel=1) produce zero actual lures despite `LURE_RATE = 0.15`. The code records `lurePositions` for these indices anyway, but the letters placed are regular non-targets. This is a **data integrity bug**: metrics will report `lureTrials: 0` or `lureFalseAlarms: 0` incorrectly.
- **ISSUE (Minor)**: At `nLevel=2`, N-1 lures use `seq[i - 1]` (the immediately previous letter) and N+1 lures use `seq[i - 3]`. This is correct.
- **ISSUE (Minor)**: At `nLevel=3`, N-1 lures use `seq[i - 2]` and N+1 lures use `seq[i - 4]`. Correct.

### 2.4 Scoring
- **Score formula**: Maps d' from [0, 4] to [0, 100]. If d' <= 0, uses accuracy * 100.
- **ISSUE (Minor)**: d' can be negative (false alarm rate > hit rate), but the fallback uses accuracy which ignores the signal-detection relationship. For clinical purposes, negative d' should be reflected in a very low score, not masked by accuracy.
- **ISSUE (Minor)**: d' of 4.0 maps to 100, but d' values above 3.5 are extremely rare in adolescents. The scale is compressed: most meaningful variation happens between d' 0.5-2.5, which maps to only scores 12-62. Consider a nonlinear mapping.

### 2.5 Match Rate
- **30% match rate**: Standard. Good.

---

## 3. Flanker Task

### 3.1 Paradigm Fidelity
- **Good**: Classic Eriksen flanker with 5-item horizontal array (2 flankers + center + 2 flankers).
- **Good**: Three trial types: congruent, incongruent, neutral (dashes). Matches modern flanker designs.
- **Good**: Correct computation of interference (incongruent - congruent), facilitation (neutral - congruent), and inhibition cost (incongruent - neutral).

### 3.2 Neutral Trial Ratio
- **20% neutral ratio**: This is on the high end. Typical flanker studies use 0-33% neutral trials. 20% is acceptable.
- **ISSUE (Moderate)**: The effective congruent:incongruent ratio within the remaining 80% is controlled by `congruentRatio`. At Level 1, this gives: 20% neutral, 56% congruent (0.80 * 0.70), 24% incongruent. At Level 10: 20% neutral, 32% congruent, 48% incongruent. **The proportion of incongruent trials at Level 10 (48%) is very high.** When incongruent trials are near 50%, the interference effect diminishes because participants no longer build a prepotent response to the flanker direction. Standard flanker tasks use 25-33% incongruent to maintain robust interference. At Level 10, the interference effect may paradoxically shrink, making the task easier in terms of the measured construct (conflict monitoring) while appearing harder in terms of raw accuracy.

### 3.3 Timing
- **ISI**: 500-700ms at Level 1, 400-520ms at Level 10. This is very short. Standard flanker ISIs are 1000-1500ms. Short ISIs increase time pressure and may conflate processing speed with attentional control.
- **Response deadline**: 2000ms at Level 1 to 1000ms at Level 10. The Level 10 deadline of 1000ms is aggressive for adolescents. Typical RT in flanker tasks for this age group is 500-800ms for correct trials, leaving only 200-500ms margin. This may produce excessive timeout errors at high levels.

### 3.4 Scoring
- **ISSUE (Moderate)**: Score is simply `accuracy * 100`. This ignores the interference score entirely, which is the primary cognitive measure of the flanker task. A clinically meaningful score should weight both accuracy and the magnitude of the interference effect. An adolescent who is 90% accurate but shows a 200ms interference effect has poorer attentional control than one who is 85% accurate with a 30ms interference effect.

### 3.5 Trial Generation
- **Same issue as Go/No-Go**: Pure random trial-type selection with no block balancing. Runs of identical trial types are possible.

---

## 4. Visual Search Task

### 4.1 Paradigm Fidelity
- **Good**: Conjunction search (target = red circle among blue circles and red squares). This requires feature binding, appropriate for visual attention assessment.
- **Good**: 50/50 target present/absent ratio. Standard.
- **Good**: Grid size varies across three levels (base-1, base, base+1) for slope calculation.

### 4.2 Search Slope
- **ISSUE (Moderate)**: With only 3 set-size levels and random assignment, many trials at each set size may have very different sample sizes. Linear regression on 3 points (or sometimes 2 if one variant is underrepresented) is statistically fragile.
- **ISSUE (Moderate)**: Set sizes are `gridSize^2`, so for base=3: {4, 9, 16}. For base=5: {16, 25, 36}. The set-size steps are unequal (quadratic growth). Linear regression assumes equal spacing is not required, but the leverage of the largest set size will dominate the slope estimate. This is not incorrect, but interpretation differs from standard visual search paradigms that use linearly-spaced set sizes (e.g., 4, 8, 12, 16).
- **ISSUE (Minor)**: At base=3, gridSizeVariants = [3-1=2, 3, 4], producing set sizes {4, 9, 16}. A 2x2 grid with only 4 items is very sparse for conjunction search and may produce ceiling performance.
- **ISSUE (Minor)**: At base=7 (Level 9-10), gridSizeVariants = [6, 7, 7] because `Math.min(7, 7+1)` caps at 7. So only two distinct set sizes exist, making slope estimation unreliable (2-point regression has no residual degrees of freedom).

### 4.3 Scoring
- **Same issue as Flanker**: Score = accuracy * 100. Does not incorporate search slope or search time, which are the primary measures of visual search efficiency.

### 4.4 Target-Absent Timeout
- **ISSUE (Minor)**: Line 194-195: When a target-absent trial times out (10s), it is scored as correct (`correct: true, rt: null`). This inflates accuracy for target-absent trials where the participant simply did not respond. A non-response should not be counted as a correct rejection.

---

## 5. Breathing Exercise

### 5.1 Paradigm Fidelity
- **Good**: Two validated patterns (4-4-4 box breathing, 4-7-8 relaxation breathing). Both are evidence-based.
- **Good**: Smooth animation using `requestAnimationFrame` with smoothstep easing. Appropriate visual pacing guide.
- **No clinical concerns**: This is a guided relaxation exercise, not a cognitive assessment. Score = completion ratio, which is appropriate.

### 5.2 Hold Phase
- **Concern (Minor)**: The 4-7-8 pattern has a 7-second hold. For younger adolescents (12-13), this may be uncomfortably long. Consider age-gating or a progressive introduction.

---

## 6. Helper Functions (Metric Calculations)

### 6.1 Coefficient of Variation (calculateCV)
- **Correct**: `SD / mean` using population variance. Standard formula for CV.
- **ISSUE (Minor)**: Uses population variance (`/ n`) rather than sample variance (`/ (n-1)`). For trial counts > 20 this is negligible, but for baseline assessment (60s, ~20-30 trials), Bessel's correction would be more appropriate.

### 6.2 d-Prime (calculateDPrime)
- **Good**: Uses a well-known rational approximation of the inverse normal CDF (Peter Acklam's algorithm). Numerically accurate to ~1.15e-9.
- **Good**: Clamps hit rate and false alarm rate to [0.01, 0.99] to avoid infinite z-scores. Standard 1/(2N) correction would be more principled, but this clamping is acceptable for a training app.
- **ISSUE (Minor)**: The clamping bounds are fixed at 0.01/0.99 regardless of trial count. With ~18 match trials in N-Back (30% of ~60 trials), a 100% hit rate should be corrected to 1 - 1/(2*18) = 0.972, not 0.99. The 0.99 clamp slightly overestimates d' for perfect performers. Similarly, 0.01 slightly underestimates for zero false alarms. This has minimal practical impact.

### 6.3 Lapse Rate (calculateLapseRate)
- **Correct**: Proportion of RTs > mean + 3*SD. Standard definition used in ADHD research.
- **Good**: Minimum 3 trials required. Appropriate guard.
- **ISSUE (Minor)**: With population SD (not sample SD), the threshold is slightly conservative. Negligible impact.

### 6.4 Search Slope (calculateSearchSlope)
- **Correct**: Standard OLS linear regression slope `(n*sumXY - sumX*sumY) / (n*sumXX - sumX^2)`. Mathematically correct.
- **Limitation**: No R-squared or goodness-of-fit metric returned. A poor-fitting slope is still reported as if meaningful.

---

## 7. Difficulty Tables (10 Levels)

### 7.1 Go/No-Go
- **Good**: Smooth progression from easy to hard across ISI, No-Go ratio, and stimulus duration.
- **ISSUE (Minor)**: No-Go ratio increases only from 0.20 to 0.30. Literature suggests 0.20-0.50 range for meaningful variation in inhibitory demand. The upper levels may not sufficiently challenge high-performing adolescents.
- **ISSUE (Minor)**: Level 10 ISI of 500-800ms with 300ms stimulus duration and 200ms grace period means the total trial cycle can be as short as 700ms. At this speed, the task becomes a simple reaction time task rather than an inhibition task.

### 7.2 N-Back
- **Good**: Progressive increase from 1-back to 3-back across 10 levels.
- **ISSUE (Moderate)**: The jump from nLevel=1 (levels 1-4) to nLevel=2 (level 5) is a major difficulty cliff. Within nLevel=1, only stimulus interval changes (3000 to 2100ms), which is a relatively minor manipulation. The transition to 2-back is the primary cognitive challenge. Consider introducing 2-back earlier (level 3-4) to smooth the progression.
- **ISSUE (Minor)**: No 4-back or higher is offered. For gifted adolescents who master 3-back, the ceiling may be too low.

### 7.3 Flanker
- **Calibration issues discussed in Section 3.2** (incongruent ratio too high at upper levels).
- **ISSUE (Minor)**: ISI range is very tight (only 20ms between adjacent levels). The progression may not feel perceptibly different from one level to the next.

### 7.4 Visual Search
- **ISSUE (Moderate)**: Only grid size varies. No manipulation of distractor heterogeneity, target-distractor similarity, or display duration. Grid size alone is a relatively weak manipulation of search difficulty. At Level 1 (3x3=9 items), conjunction search is already quite fast for adolescents.
- **ISSUE (Minor)**: Levels 1-2 are identical (gridSize=3), as are 3-4, 5-6, 7-8, 9-10. Effectively only 5 distinct difficulty levels exist, not 10.

---

## 8. Adaptive Difficulty Engine

### 8.1 Level-Up Logic
- **Instant up**: score > 88. Reasonable but aggressive.
- **Sustained up**: 3-session average >= 75. Good.
- **Instant down**: score < 45. Reasonable.
- **Sustained down**: 2 consecutive scores < 65. Reasonable.
- **ISSUE (Moderate)**: Both level-up checks are applied to the same score. If score = 90 and the 3-session average is also >= 75, the instant check triggers first. This is fine, but the logic allows only single-level jumps. A participant scoring 95+ repeatedly still advances one level at a time, which may be frustratingly slow for high performers.
- **ISSUE (Minor)**: The `recentScores` window is 5, but sustained-down only looks at last 2. A participant with scores [80, 80, 60, 60, 60] would level down after the 4th score (two consecutive < 65). This is appropriate.

### 8.2 Micro-Adjustments
- **Good concept**: After 5 sessions at one level without change, a micro-adjustment is applied.
- **ISSUE (Minor)**: `isPlateauDetected()` checks `sessionsAtCurrentLevel >= 5 && lastMicroAdjustment !== undefined`, but `lastMicroAdjustment` is only set in `updateDifficulty()` when `sessionsAtCurrentLevel >= 5`. This means the function works correctly but the naming is confusing -- it detects that a plateau WAS detected, not that one IS occurring now.
- **ISSUE (Moderate)**: Micro-adjustments are not cumulative. Calling `getMicroAdjustment()` always adjusts from the base level parameters by a fixed delta. If a participant plateaus for 10 sessions, they still only get one step of micro-adjustment. The function should track how many micro-adjustments have been applied and increment accordingly.

---

## 9. Baseline Assessment

### 9.1 Design
- Fixed Level 1 parameters, 60 seconds per exercise, three exercises (Go/No-Go, Flanker, N-Back).
- **ISSUE (Moderate)**: 60 seconds produces very few trials:
  - Go/No-Go: ~35-40 trials (with ~1500ms average cycle). With 20% No-Go ratio, only ~7-8 No-Go trials. Commission error rate based on 7 trials has a standard error of ~18%. This is too noisy for a reliable baseline.
  - N-Back: ~20 trials (3000ms interval). With 30% match rate, only ~6 match trials. d' based on 6 signal trials is unreliable.
  - Flanker: ~25-30 trials. With 20% neutral and 70/30 congruent/incongruent split of remainder, only ~6-7 incongruent trials. Interference score based on 6 trials is very noisy.
- **ISSUE (High)**: A 60-second baseline is insufficient for stable individual-level metrics. Clinical computerized assessments typically require 3-5 minutes minimum per task. The current baseline will produce unreliable reference points for tracking improvement.

### 9.2 Comparison
- **Simple score difference**: `currentScore - baselineScore`. No standard error of measurement, no reliable change index. A 5-point improvement could be noise.
- **ISSUE (Moderate)**: No consideration of regression to the mean. Participants who score low on baseline are expected to improve regardless of intervention.

### 9.3 Re-assessment
- Every 20 sessions. This is reasonable for a training app (roughly monthly for daily users).

---

## 10. Cross-Cutting Issues

### 10.1 Timer Precision
- All exercises use `Date.now()` for RT measurement. This has variable precision across browsers (1ms on Chrome, up to 16ms on some Firefox/Safari configurations). `performance.now()` provides sub-millisecond precision and is preferable for RT measurement. For a training app this is acceptable; for clinical use it is not.

### 10.2 No Practice Trials
- None of the exercises include practice trials with feedback before the timed assessment begins. Standard neuropsychological computerized assessments always include untimed practice to ensure the participant understands the task. Without practice, the first several trials of each session include learning/orientation effects that contaminate the data.

### 10.3 No Outlier RT Filtering
- Correct RTs are used as-is. Standard practice is to exclude RTs < 100-150ms (anticipatory responses) and RTs > 3*SD above mean (attentional lapses) before computing mean RT and interference scores. Lapse rate is computed but lapses are included in mean RT calculations, inflating estimates.
- **ISSUE (Moderate)**: In Go/No-Go, a response at RT = 50ms is likely an anticipatory or accidental press, not a genuine response. No minimum RT filter exists.

### 10.4 No Response Conflict Tracking
- Flanker: Post-error slowing and conflict adaptation (Gratton effect) are not tracked. These are clinically informative markers of cognitive control.

### 10.5 3-Minute Duration
- All cognitive exercises run for 3 minutes (180,000ms). This is short for reliable individual-level assessment but appropriate for a daily training tool targeting adolescents. Fatigue and boredom effects are minimized.

### 10.6 Pause/Resume Handling
- All exercises correctly cancel pending timeouts on pause and reschedule on resume. No data contamination from pauses.
- **ISSUE (Minor)**: In Go/No-Go and Flanker, pausing mid-trial cancels the current trial without recording it. The trial is lost from the data. This is acceptable for training but means trial count varies.

---

## Summary of Issues by Severity

### HIGH (Affects validity or contains bugs)
1. **N-Back lure generation fails silently at nLevel=1** (difficulty levels 3-4): Lure positions are marked but no actual lure letters are placed. Metrics report phantom lure data.
2. **Baseline assessment too short** (60s): Produces unreliable individual metrics (~6-8 signal trials per condition).
3. **Go/No-Go differential stimulus duration**: Go stimuli visible 200ms longer than No-Go, providing an implicit timing cue that undermines inhibitory demand.

### MODERATE (Affects measurement quality)
4. **All exercises**: No minimum RT filter. Anticipatory responses (< 100-150ms) contaminate data.
5. **All exercises**: No practice/familiarization trials before timed assessment.
6. **Trial generation**: Pure random without block balancing allows ratio drift and long same-type runs (Go/No-Go, Flanker).
7. **Flanker scoring**: Uses accuracy only; ignores interference effect, the primary cognitive measure.
8. **Visual Search scoring**: Uses accuracy only; ignores search slope and search time.
9. **Go/No-Go scoring**: CV can exceed 1.0, producing negative stability component.
10. **Visual Search at base=7**: Only two distinct set sizes (6 and 7), making slope estimation unreliable.
11. **Visual Search target-absent timeout**: Non-response scored as correct, inflating accuracy.
12. **N-Back difficulty cliff**: nLevel jumps from 1 to 2 at level 5 with no intermediate scaffold.
13. **Flanker at high levels**: Incongruent ratio approaching 50% may paradoxically reduce interference effect.
14. **Adaptive micro-adjustments**: Not cumulative; plateau > 5 sessions still only applies one step.

### MINOR (Best-practice deviations, limited practical impact)
15. **Timer precision**: `Date.now()` vs `performance.now()` (~1-16ms jitter).
16. **CV calculation**: Population variance vs sample variance.
17. **d-prime clamping**: Fixed 0.01/0.99 vs trial-count-adjusted 1/(2N).
18. **Go/No-Go**: d-prime not computed (only commission/omission rates).
19. **N-Back**: No blank ISI between stimuli (continuous display).
20. **N-Back scoring**: d' to score mapping is compressed; most useful range maps to 12-62.
21. **N-Back**: Negative d' falls back to accuracy, masking poor discrimination.
22. **Visual Search**: Only 5 distinct difficulty levels despite 10-level table.
23. **Flanker ISI**: Very short (400-700ms), may conflate speed and attentional control.
24. **Baseline comparison**: No reliable change index or regression-to-mean correction.
25. **Go/No-Go No-Go ratio**: Max 30% may not sufficiently challenge high performers.

---

## Recommendations (Prioritized)

1. **Fix N-Back lure generation**: Gate lures on `nLevel >= 2` (not `level >= 3`), or properly handle the nLevel=1 edge case.
2. **Equalize Go/No-Go stimulus duration**: Remove the grace period differential or apply it equally to both Go and No-Go trials.
3. **Increase baseline duration** to at least 120 seconds per exercise to double trial counts.
4. **Add minimum RT filter** (e.g., < 150ms) across all exercises. Exclude anticipatory responses from metrics.
5. **Add practice trials** (5-10 untimed trials with explicit feedback) before each exercise begins.
6. **Use block-randomized trial generation** to ensure target ratios are maintained within blocks.
7. **Incorporate primary cognitive measures into scoring**: interference effect for Flanker, search slope for Visual Search.
8. **Clamp CV to [0, 1]** before using it in Go/No-Go score formula.
9. **Fix target-absent timeout** in Visual Search: do not score non-responses as correct.
10. **Smooth N-Back difficulty curve**: Introduce 2-back at level 3 or 4 instead of level 5.
