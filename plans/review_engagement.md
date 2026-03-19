# Engagement Quality Review

Reviewer perspective: gamification designer (Duolingo, Headspace background)
Date: 2026-03-19

---

## 1. Streak System

**Freeze mechanic: 1 freeze per 7 streak days, max 3 banked.**

Verdict: **Well-balanced, slightly stingy for new users.**

- The 7-day earn interval is appropriate. It mirrors Duolingo's "earn by showing up" philosophy.
- Max 3 is fair -- enough to cover a weekend + sick day, not so many that the streak becomes meaningless.
- **Problem for new users**: A brand-new user has 0 freezes and must maintain a 7-day streak before earning their first. The first 7 days are the most fragile period for retention, and this is exactly when users have zero safety net. Duolingo gives 1 free freeze at signup.
- **Recommendation**: Grant 1 free freeze at onboarding completion. This communicates "we want you to succeed" and reduces first-week churn by protecting the streak before it has emotional weight.
- The streak-at-risk banner and streak-saved banner are well-implemented contextual nudges. Good use of loss aversion.
- Missing: there is no push notification or reminder system. Streaks only work as retention tools when users are reminded before they break. Without notifications, streaks punish forgetfulness rather than reward commitment.

**Rating: 7/10** (solid mechanic, weak new-user safety net, no reminders)

---

## 2. Daily Challenges

**12 types ranging from easy (15 XP) to hard (30 XP).**

Verdict: **Good variety, a few design concerns.**

Strengths:
- Difficulty guard (`hard` flag) prevents new users from getting impossible challenges. Smart.
- "No repeat from yesterday" filter prevents monotony.
- Mix of activity-based (complete exercises, train minutes) and skill-based (high score, fast reaction) is solid.
- `streak-day` as a freebie challenge is clever -- it rewards just showing up.

Concerns:
- **`fast-reaction` (avg RT < 350ms)** is potentially frustrating. Reaction time is heavily influenced by device latency and screen responsiveness. A user on a slow phone might never achieve this regardless of skill. Consider raising the threshold to 400ms or making it device-adaptive.
- **`beat-personal-best`** becomes exponentially harder over time. A user who scored 98% once on Go/No-Go can never beat it again meaningfully. This challenge should either have a cooldown or target a specific exercise where the user has room to grow.
- **`accuracy-streak` (3 consecutive 80%+ scores)** requires a Standard or Deep session. A Quick session user literally cannot complete this. The daily challenge system should be session-mode-aware.
- **Deterministic hash (djb2)**: Adequate for this use case. It avoids server dependency and produces reasonable distribution across 12 types. The "no repeat" filter compensates for any clustering. One risk: the hash of sequential dates like "2026-03-18" and "2026-03-19" may cluster for small template arrays after filtering. Not a critical issue but worth monitoring.
- Missing: no "surprise" or "mystery" challenge mechanic. Duolingo's "XP roulette" or "double XP" events create anticipation. Consider a 10% chance of a "bonus challenge" that doubles XP reward.

**Rating: 7/10** (solid foundation, a few frustration edges)

---

## 3. Session Modes (Quick / Standard / Deep)

Verdict: **Clear hierarchy, Quick genuinely reduces friction.**

- Quick (1 exercise, ~1 min, skips mood modal + plan screen): This is excellent friction reduction. Going from tap to exercise in 1 tap is critical for "I only have a minute" moments. The auto-selection of the weakest exercise is a smart default.
- Standard (3-4 exercises, ~5 min): Good middle ground. Mood modal adds a reflective moment without heavy friction.
- Deep (5-6 exercises, ~10 min, breathing warm-up): The forced breathing warm-up is a thoughtful touch. The doubled weakest exercise adds targeted practice.

Concerns:
- **Quick session still navigates to `#/session`** which presumably shows a session flow. For a 1-minute exercise, even a session wrapper may feel like overhead. Consider whether Quick could go directly to the exercise.
- **No "recommended" mode indicator.** The dashboard shows all three equally after the first. Headspace uses time-of-day and recent behavior to suggest a mode. "Good morning -- try a quick session to start your day" would personalize the experience.
- **Deep session at 10 minutes is quite short** for the name "Deep Focus." Users expecting a 25+ minute session may be confused. The pomodoro exercise exists but is not part of any session mode. Consider a "Pomodoro" session type or rename "Deep" to something less ambitious.

**Rating: 8/10** (Quick is genuinely well-designed)

---

## 4. Celebration Quality

**Level-up and badge overlays, 4-second auto-dismiss, max 3 overlays per session.**

Verdict: **Satisfying but potentially interruptive.**

Strengths:
- Sound + haptic vibration + confetti is the right multi-sensory approach.
- Tap-to-dismiss is essential and present.
- Share button on badge overlays (only when navigator.share exists) is a nice social hook.
- MAX_OVERLAYS = 3 prevents celebration fatigue if a user levels up and earns 2 badges simultaneously.

Concerns:
- **4 seconds is too long for frequent celebrations, fine for rare ones.** At early levels, users level up after every 1-2 sessions. Being forced to wait 4 seconds (or tap to dismiss) every session is annoying. At later levels, level-ups are rare enough that 4 seconds feels earned. Consider scaling: 3 seconds for levels 1-5, 4 seconds for 6-15, 5 seconds for 16+.
- **Sequential overlays block interaction.** If a user earns a level-up + 2 badges, they must wait through 3 overlays (up to 12 seconds). The `await` chain in `showCelebrations` is correct but slow. Consider batching badges into a single "You earned 2 badges!" overlay with a carousel or list.
- **No micro-celebrations.** The confetti fires at 80%+ score (good threshold), but there is no small celebration for daily challenge completion, weekly goal met, or personal record. These moments deserve at least a brief animation or sound.
- **Confetti particle count (30) is modest.** For a level-up at level 20, this should feel like a bigger deal. Consider scaling particle count with level.

**Rating: 6/10** (functional but not yet "delightful")

---

## 5. XP Curve

**Formula: `80 * level^1.3`**

Computed pacing:
| Transition | XP Required | Days (standard user) |
|---|---|---|
| Level 1 to 2 | 196 | ~1 day |
| Level 2 to 3 | 333 | ~1.5 days |
| Level 4 to 5 | 648 | ~3 days |
| Level 9 to 10 | 1,596 | ~8 days |
| Level 14 to 15 | 2,704 | ~14 days |
| Level 19 to 20 | 3,930 | ~20 days |
| Level 29 to 30 | 6,658 | ~33 days |
| **Total to max** | **90,098** | **~15 months** |

Verdict: **Early levels are well-paced. Late levels are a grind but not unreasonably so.**

- Level 1-2 in one session is the "instant hook." Perfect.
- Levels 2-5 over the first week creates a steady stream of level-ups during the critical retention window. This is textbook correct.
- The exponent of 1.3 is quite gentle compared to Duolingo's steeper curve. This means the mid-game (levels 10-20) doesn't feel dramatically slower than early game. Good for a health/wellness app where you don't want users feeling "stuck."
- 15 months to max level is reasonable for a daily-use app. Duolingo takes years.
- **Concern**: The XP sources are generous enough that a user doing Deep sessions daily could reach level 10 in about 5-6 weeks. This is the point where theme unlocks (ocean at 5, sunset at 10) create good milestone rewards.
- **Missing**: No "XP boost" events or weekend multipliers. These create urgency and are a proven engagement lever.

**Rating: 8/10** (well-calibrated curve)

---

## 6. Badge System

**7 badges x 3 tiers = 21 total.**

Verdict: **Too few, and some thresholds are problematic.**

Analysis of individual badges:
- **Sessions (10/50/100)**: Bronze at 10 is about 2 weeks. Gold at 100 is about 3 months. Reasonable.
- **Weekly Goal (2/5/10)**: Gold at 10 weeks of 5/7 day attendance is achievable in ~3 months. Fair.
- **Go/No-Go Accuracy (85/92/98)**: Gold at 98% is extremely hard. Only possible at low difficulty levels. This creates a perverse incentive to NOT level up difficulty. Consider making this "achieve 98% at any difficulty" more explicit or capping at 95%.
- **N-Back Level (3/6/10)**: Level 10 (3-back at 2400ms interval) is genuinely difficult. Gold may take months of dedicated practice. This is fine for an aspirational badge.
- **Focus Time (60/300/600 minutes)**: 600 minutes = 10 hours total. At 5-10 min/day, gold takes 2-3 months. Reasonable.
- **Breathing Sessions (10/30/100)**: 100 breathing sessions is a LOT. Breathing is not in every session mode. A standard session includes breathing only every 4th session. Gold could take 6+ months. Consider lowering to 50.
- **Personal Record (5/15/30)**: Record-breaking naturally slows down over time. Gold at 30 is achievable but takes dedication.

**21 total badges is too few** for a 30-level system. Users will earn most bronze badges in the first month and then see long gaps before silver. Duolingo has 100+ achievements. Recommended additions:
- Streak badges (7-day, 30-day, 100-day streak)
- Exercise variety badges ("try all 4 cognitive exercises in one day")
- Improvement badges ("improve your score by 20% on any exercise")
- Daily challenge streak badges ("complete 7 daily challenges in a row")
- Time-of-day badges ("morning person: train before 8 AM five times")

**Rating: 5/10** (too few, some thresholds misaligned)

---

## 7. Weekly Challenges

**4 types, all reward 50 XP (except no-errors at 75 XP).**

Verdict: **Not enough variety, but the mechanic is sound.**

- `perfect-exercises` (3 exercises at 90%+): Achievable in a week of standard sessions.
- `total-sessions` (7 sessions): One per day. Fair.
- `focus-time` (30 minutes): About 3-6 standard sessions. Fair.
- `no-errors` (5 exercises at 90%+): Very similar to `perfect-exercises` but with target 5 instead of 3. This feels like a duplicate, not a distinct challenge type.

Concerns:
- **Only 4 types means heavy repetition.** After a month, users have seen every challenge ~4 times. Weekly challenges should feel fresh for at least 8-12 weeks.
- **`generateWeeklyChallenge` uses `Math.random()`**, not the deterministic hash used for daily challenges. This means refreshing the app on Monday could give a different challenge. Intentional or bug? Should use a week-based hash for consistency.
- **No difficulty scaling.** Week 1 and week 20 get the same challenges. Consider scaling targets based on user level (e.g., "Complete 7 sessions" for new users, "Complete 10 sessions" for level 15+).
- **Missing types**: "Try a new session mode," "Complete 3 deep sessions," "Earn X XP this week," "Break a personal record."

Progress tracking: `challenge.progress >= challenge.target` is straightforward and works. Progress is updated correctly in the dashboard.

**Rating: 5/10** (functional but repetitive)

---

## 8. Dashboard Information Density

**Cards displayed: Greeting, XP Progress, Weekly Goal/Streak, Daily Progress, Daily Bonus (conditional), Daily Challenge, Weekly Challenge, Baseline Prompt (conditional), Session Selector, Recent Activity.**

Verdict: **Too many cards, unclear hierarchy.**

- At maximum, a user sees ~9 cards on the dashboard. This is information overload for a focus/attention app. The irony of requiring significant attention to navigate an attention-training app should not be lost.
- **The session selector (the primary action) is card 6 of ~9.** It should be visible without scrolling. On mobile, users likely need to scroll past 3-4 cards before reaching the "Start" button.
- **Daily Challenge and Weekly Challenge** are visually similar cards stacked adjacent. They compete for attention.
- **Daily Login Bonus banner** is a nice touch but auto-removes after 3 seconds. Users who scroll down may never see it.

Recommendations:
- Move session selector to position 2 (right after greeting).
- Collapse Daily Challenge + Weekly Challenge into a single "Challenges" card with tabs or a stacked mini-view.
- Consider a "floating action button" for Quick Start that is always visible on scroll.
- The Greeting card + XP Progress card could be combined. The avatar, name, level title, and XP bar can coexist in one card.

**Rating: 5/10** (too much between "open app" and "start training")

---

## 9. Onboarding Flow

**6 steps: Welcome -> Exercise Intro -> Mini Go/No-Go -> Result -> Name -> Avatar Color -> Daily Goal.**

Verdict: **Slightly too long, but the mini-exercise is excellent.**

Strengths:
- The mini Go/No-Go exercise (10 trials, ~15 seconds) is a brilliant onboarding move. It gives users an immediate taste of the core loop before asking for any profile information. This is the "aha moment" technique that Duolingo pioneered.
- Language selector on step 1 is correct placement.
- Progress dots provide orientation.
- The 0.4s/0.25s transition animations feel responsive.
- Saving the onboarding exercise result to history + awarding XP means users arrive at the dashboard already with progress. Smart.

Concerns:
- **6 steps is 1-2 too many.** Name + Avatar Color could be a single step. Or defer avatar color to settings (most users don't care about color in their first 30 seconds).
- **No skip option.** An impatient user who just wants to try the app is forced through all 6 steps. Consider a "Skip to dashboard" link starting from step 4.
- **The mini-exercise has no skip/quit.** If a user finds it confusing or boring, they are stuck for ~23 seconds (10 trials * 1.5s ISI + 0.8s stimulus). Add a "Skip" link.
- **Missing: no explanation of XP, levels, or streaks.** Users arrive at the dashboard seeing numbers and fire icons with no context. A brief "Here's how Focus works" tooltip or a 7th "what you'll see" step might help. Alternatively, use progressive disclosure on the dashboard.

**Rating: 7/10** (mini-exercise is a standout feature)

---

## 10. Missing Engagement Features -- Biggest Gaps

**Ranked by impact on retention:**

1. **Push notifications / reminders** -- This is the single biggest gap. Without reminders, the streak system, daily challenges, and login bonuses are all passive. Users must remember to open the app. Every successful habit app (Duolingo, Headspace, Calm) sends streak-at-risk notifications, daily challenge reminders, and "you're almost at your goal" nudges. This is non-negotiable for retention.

2. **Social/competitive features** -- No leaderboards, no friends, no sharing (beyond the badge share button). Social accountability is one of the strongest retention levers. Even a simple weekly leaderboard ("you beat 60% of Focus users this week") would help. The badge share button exists but is underutilized.

3. **Leagues/seasonal events** -- Duolingo's league system (bronze -> silver -> gold leagues, weekly promotion/demotion) is one of the most effective engagement mechanics in mobile apps. Focus has no equivalent. A monthly "focus challenge" or seasonal event could drive re-engagement.

4. **Comeback mechanic** -- When a user churns (e.g., no activity for 7+ days), there is no re-engagement path. The streak is already broken, so the loss-aversion lever is gone. A "welcome back" bonus XP day, a reduced daily goal, or a "restart your streak with protection" mechanic would help.

5. **Progress insights / trends** -- The dashboard shows recent results but no trends over time. "Your reaction time improved 15% this month" or "You've been most consistent on Wednesdays" provides a reason to come back beyond gamification -- it provides genuine value.

6. **Difficulty feedback loop** -- The adaptive difficulty system exists in the code but is invisible to users. Showing "You've been promoted to Level 4!" for an exercise creates a sense of progression separate from the XP system. This is free engagement.

7. **Content variety / surprise events** -- No random "double XP hour," no "mystery challenge," no seasonal themes. Surprise and variable rewards are core to engagement psychology (the "slot machine" effect, used ethically). The bonus event system exists (`bonusEvent` in SessionResult) but seems underutilized.

---

## Overall Engagement Rating

### 6.5 / 10

**Context**: Compared to best-in-class habit apps (Duolingo 9.5/10, Headspace 8/10, Calm 7.5/10).

**Strengths**: The core gamification loop (XP, levels, streaks, badges, challenges) is complete and thoughtfully implemented. The XP curve is well-paced. Session modes are well-differentiated. The onboarding mini-exercise is a standout. The streak freeze mechanic and daily challenge difficulty guards show design maturity.

**Weaknesses**: The app is missing the entire "outer loop" of engagement -- notifications, social features, come-back mechanics, and surprise events. The badge system is too thin. Dashboard hierarchy buries the primary action. Weekly challenges lack variety. Celebrations, while present, lack the polish and scaling that makes them genuinely delightful over months of use.

**Path to 8/10**: (1) Add push notification reminders, (2) expand badges to 30-40 total, (3) restructure dashboard to surface "Start" above the fold, (4) add a monthly/seasonal challenge event, (5) show progress insights and trends.

**Path to 9/10**: Additionally add social features (leaderboards, friend challenges), comeback mechanics, variable reward events, and scale celebration quality to match user milestone significance.
