# Feature: Level-Up Celebration + Badge Unlock Ceremony

## Summary

Add full-screen celebration overlays that appear when the user levels up or earns a badge after completing an exercise. The level-up overlay shows the new level number, title, and any unlocked content (themes, avatar items). The badge overlay shows the badge icon, name, tier, and description, with a share button. Both include animations, sounds, and haptic feedback.

## Motivation

The app already defines `level-up` and `badge-earned` event types in `AppEvent` (types.ts lines 209-210), has `playLevelUp()` and `playBadge()` sound methods fully implemented in sound.ts, has `checkBadges()` logic in progression.ts, and has `THEME_UNLOCK_LEVELS` and `AVATAR_UNLOCK_LEVELS` constants. However, none of this is wired up: the events are never emitted, `checkBadges()` is never called, and the sounds are never played. The user currently sees only the results screen with an XP number and level label but no celebration when they cross a level threshold or earn a badge. This is a significant gap in the engagement loop.

## Current State

**What exists and works:**
- `AppEvent` union type includes `'level-up'` and `'badge-earned'` variants
- `SoundManager` has `playLevelUp()` (celebratory C5-E5-G5-C6 arpeggio) and `playBadge()` (sparkle effect)
- `checkBadges()` in progression.ts correctly evaluates all 7 badge definitions across 3 tiers
- `getLevel()`, `getLevelTitle()`, `getXPProgress()` exist and work
- `THEME_UNLOCK_LEVELS` maps themes to required levels: ocean=5, sunset=10, forest=15, amoled=20
- `AVATAR_UNLOCK_LEVELS` array: [1, 3, 5, 8, 10, 13, 16, 20, 25, 30]
- Confetti system exists in results.ts (reusable pattern)
- CSS animations.css has bounceIn, scaleIn, fadeIn, pulse, glowPulse, confetti-fall keyframes
- Z-index scale: `--z-overlay: 300`, `--z-toast: 400`
- Disposables pattern used consistently for cleanup

**What is missing:**
- `'level-up'` event is never emitted (exercise-play.ts adds XP but does not compare level before/after)
- `'badge-earned'` event is never emitted
- `checkBadges()` is never called after exercises
- No overlay UI component exists
- No i18n keys for celebration text
- No CSS for celebration overlays

## Implementation

### Step 1: Wire Up Level-Up and Badge Detection in exercise-play.ts

In `finishExercise()` (single-exercise mode, line ~117) and `onExerciseFinish()` (session mode, line ~361), after the `appState.updateData()` call and before navigating:

1. **Capture level before XP addition.** Before `appState.updateData()`, read `getLevel(data.progression.totalXP)` and store as `levelBefore`.
2. **After `updateData()`, compute `levelAfter`** from the new totalXP.
3. **If `levelAfter > levelBefore`**, emit the `level-up` event:
   ```
   appState.emit({ type: 'level-up', newLevel: levelAfter, title: getLevelTitle(levelAfter) })
   ```
4. **Call `checkBadges()`** with the updated progression and difficulty data. For each returned badge, push it into `progression.earnedBadges` and emit:
   ```
   appState.emit({ type: 'badge-earned', badge })
   ```
5. **Store celebration data in sessionStorage** so the results screen can display overlays. Use a new key `focus:celebrations` containing a JSON object:
   ```ts
   interface CelebrationData {
     levelUp?: { newLevel: number; title: string; unlockedThemes: ThemeId[]; unlockedAvatarLevel: boolean };
     badges: EarnedBadge[];
   }
   ```

This approach is needed because the results screen is a separate route (hash navigation causes full re-render), so we cannot pass data via function arguments.

### Step 2: Create Celebration Overlay Module

**New file:** `public/js/ui/components/celebration-overlay.ts`

This module exports two functions:

#### `showLevelUpOverlay(container, data, sound, disposables): Promise<void>`

- Creates a fixed full-screen overlay element (`position: fixed; inset: 0; z-index: var(--z-toast)`) with a dark semi-transparent backdrop.
- Content (centered flex column):
  - Star/trophy emoji scaled large with `bounceIn` animation
  - "Level Up!" heading with `slideUp` animation (delayed 200ms)
  - Large level number with `scaleIn` animation (delayed 400ms)
  - Level title text with `fadeIn` animation (delayed 600ms)
  - Unlocked content list (if any themes or avatar levels unlocked) with stagger delays
- Calls `sound.playLevelUp()`
- Calls `navigator.vibrate([100, 50, 200])` if available
- Spawns confetti (reuse the pattern from results.ts, extract to shared helper)
- Returns a Promise that resolves after 4 seconds OR on tap/click (whichever comes first)
- On dismiss: fade-out animation (300ms), then remove from DOM

#### `showBadgeOverlay(container, badge, badgeDef, sound, disposables): Promise<void>`

- Creates a fixed full-screen overlay (same pattern)
- Content:
  - Badge icon emoji enlarged (64px+) with `bounceIn`
  - Badge name with `slideUp`
  - Tier indicator (Bronze/Silver/Gold) with colored accent
  - Description text with `fadeIn`
  - Share button (visible only if `navigator.share` is available)
- Calls `sound.playBadge()`
- Calls `navigator.vibrate([50, 30, 50])` if available
- Share button calls `navigator.share({ title, text })` with badge info
- Returns a Promise that resolves after 4s or tap
- On dismiss: fade-out animation, remove

#### `showCelebrations(container, celebrationData, sound, disposables): Promise<void>`

- Orchestrator function
- If `celebrationData.levelUp` exists, await `showLevelUpOverlay()`
- Then for each badge in `celebrationData.badges`, await `showBadgeOverlay()` sequentially
- This guarantees level-up shows first, then badges one by one

### Step 3: Integrate into Results Screen

In `renderResults` (results.ts), after assembling the DOM but before the cleanup return:

1. Read `focus:celebrations` from sessionStorage
2. If data exists, call `showCelebrations()` passing `document.body` as the container (so the overlay sits above the results screen, not inside its scrollable area)
3. Clear the sessionStorage key after reading
4. Use the existing `disposables` for cleanup

The celebrations show immediately on entering the results screen, overlaying on top. The results content renders behind and is visible after dismissal.

### Step 4: Extract Confetti to Shared Helper

**New file:** `public/js/ui/components/confetti.ts`

Move the `createConfetti()` function and `CONFETTI_COLORS` from results.ts into this shared module. Update results.ts to import from the new location. The celebration overlay will also import it.

### Step 5: Determine Unlocked Content

In the celebration data preparation (Step 1), determine what was unlocked by reaching the new level:

- **Themes:** Check `THEME_UNLOCK_LEVELS` for any theme where `unlockLevel === newLevel`. Example: reaching level 5 unlocks "ocean".
- **Avatar levels:** Check if `newLevel` is in `AVATAR_UNLOCK_LEVELS`. Example: reaching level 3 unlocks a new avatar tier.

Pass this data so the overlay can show "You unlocked: Ocean Theme" or "New avatar style available!"

### Animation Details

**New keyframes to add to `animations.css`:**

```css
/* Level number reveal — scales up from 0 with overshoot */
@keyframes levelReveal {
  0%   { opacity: 0; transform: scale(0); }
  60%  { opacity: 1; transform: scale(1.2); }
  80%  { transform: scale(0.95); }
  100% { transform: scale(1); }
}

/* Badge shine — diagonal shimmer across badge icon */
@keyframes badgeShine {
  0%   { background-position: -100% 0; }
  100% { background-position: 200% 0; }
}

/* Overlay backdrop fade */
@keyframes overlayFadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* Tier label color pulse for gold */
@keyframes goldPulse {
  0%   { text-shadow: 0 0 10px #FFD700; }
  50%  { text-shadow: 0 0 20px #FFD700, 0 0 30px #FFA500; }
  100% { text-shadow: 0 0 10px #FFD700; }
}
```

**CSS classes (add to `layout.css` or a new `celebrations.css`):**

```css
.celebration-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.85);
  z-index: var(--z-toast); /* 400 — above everything */
  animation: overlayFadeIn 300ms ease forwards;
  cursor: pointer;
  gap: var(--space-md);
  padding: var(--space-xl);
}

.celebration-overlay--dismiss {
  animation: fadeOut 300ms ease forwards;
}

.celebration__icon { font-size: 4rem; animation: bounceIn 600ms ease forwards; }
.celebration__level { font-size: 3rem; font-weight: 800; animation: levelReveal 800ms ease 400ms both; }
.celebration__title { font-size: 1.5rem; color: var(--primary); animation: fadeIn 400ms ease 600ms both; }
.celebration__heading { font-size: 1.75rem; animation: slideUp 400ms ease 200ms both; }
.celebration__unlocks { animation: fadeIn 400ms ease 800ms both; }

.celebration__badge-icon { font-size: 5rem; animation: bounceIn 600ms ease forwards; }
.celebration__tier--bronze { color: #CD7F32; }
.celebration__tier--silver { color: #C0C0C0; }
.celebration__tier--gold  { color: #FFD700; animation: goldPulse 2s ease infinite; }

.celebration__share-btn {
  margin-top: var(--space-md);
  animation: fadeIn 400ms ease 1s both;
}

.celebration__dismiss-hint {
  position: absolute;
  bottom: var(--space-xl);
  color: var(--text-secondary);
  font-size: 0.875rem;
  animation: fadeIn 400ms ease 1.5s both;
}
```

**Confetti reuse:** The existing `confetti-fall` keyframe and `.confetti-piece` / `.confetti-container` styles are already sufficient. The celebration overlay will append confetti to itself.

**Reduced motion:** The existing `@media (prefers-reduced-motion: reduce)` rule in animations.css already blankets all animations to 0.01ms. The overlays will still show content, just without motion.

### i18n

**New translation keys to add to `TranslationTable` (keys.ts) and all 5 locale files:**

| Key | English | Russian |
|-----|---------|---------|
| `celebration.levelUp` | `Level Up!` | `Новый уровень!` |
| `celebration.newLevel` | `Level {level}` | `Уровень {level}` |
| `celebration.levelTitle` | `{title}` | `{title}` |
| `celebration.unlockedTheme` | `Theme unlocked: {theme}` | `Открыта тема: {theme}` |
| `celebration.unlockedAvatar` | `New avatar style!` | `Новый стиль аватара!` |
| `celebration.tapToDismiss` | `Tap to continue` | `Нажмите, чтобы продолжить` |
| `celebration.badgeEarned` | `Badge Earned!` | `Получен значок!` |
| `celebration.badgeTier` | `{tier} Tier` | `Уровень: {tier}` |
| `celebration.share` | `Share` | `Поделиться` |
| `celebration.shareText` | `I earned the {badge} ({tier}) badge in Focus!` | `Я получил значок {badge} ({tier}) в Focus!` |

German, French, and Spanish translations should follow the same pattern. The key naming follows the existing convention (`namespace.key`).

### Tests

**New test file:** `tests/celebrations.test.ts`

Test cases:

1. **Level-up detection:** Given totalXP at level boundary minus 1, adding enough XP should detect `levelBefore < levelAfter`.
2. **No false positive:** Adding XP that does not cross a level boundary should not produce a level-up.
3. **Multiple level jumps:** If a large XP bonus skips levels (e.g., level 2 to level 4), the overlay should show the final level reached.
4. **Badge detection integration:** After updating progression data, `checkBadges()` returns newly earned badges not already in `earnedBadges`.
5. **Badge deduplication:** Calling `checkBadges()` twice without changes returns empty array on second call.
6. **Unlocked content calculation:** At level 5, `THEME_UNLOCK_LEVELS` correctly identifies "ocean" as newly unlocked. At level 3, `AVATAR_UNLOCK_LEVELS` includes 3.
7. **CelebrationData serialization:** Verify JSON round-trip of celebration data via sessionStorage.
8. **Sequential display:** If both level-up and badge exist, level-up promise resolves before badge overlay is created (test orchestrator logic).
9. **Dismiss on tap:** Overlay resolves its promise when click event fires.
10. **Auto-dismiss timeout:** Overlay resolves after 4 seconds if no interaction.

**Existing test file to update:** `tests/progression.test.ts` — add coverage for `checkBadges()` if not already present (currently the function exists but grep shows no tests calling it).

## Files Modified

| File | Change |
|------|--------|
| `public/js/ui/screens/exercise-play.ts` | Add level-before/after comparison, call `checkBadges()`, emit events, store celebration data in sessionStorage |
| `public/js/ui/screens/results.ts` | Read celebration data from sessionStorage, call `showCelebrations()`, extract confetti to shared module |
| `public/js/ui/components/celebration-overlay.ts` | **NEW** — Level-up overlay, badge overlay, orchestrator |
| `public/js/ui/components/confetti.ts` | **NEW** — Extracted confetti helper (from results.ts) |
| `public/css/animations.css` | Add `levelReveal`, `badgeShine`, `overlayFadeIn`, `goldPulse` keyframes |
| `public/css/layout.css` | Add `.celebration-overlay` and related CSS classes |
| `public/js/i18n/keys.ts` | Add 10 new `celebration.*` keys to `TranslationTable` |
| `public/js/i18n/en.ts` | Add English translations for celebration keys |
| `public/js/i18n/ru.ts` | Add Russian translations for celebration keys |
| `public/js/i18n/de.ts` | Add German translations |
| `public/js/i18n/fr.ts` | Add French translations |
| `public/js/i18n/es.ts` | Add Spanish translations |
| `public/js/constants.ts` | Add `SESSION_CELEBRATIONS_KEY` constant |
| `tests/celebrations.test.ts` | **NEW** — Test level-up detection, badge detection, orchestration |

## Risks / Edge Cases

1. **Double-fire on session mode:** In session mode, XP is added per exercise. Each exercise could trigger a level-up. The celebration data should accumulate (only one level-up for the highest level, but multiple badges are fine). The finishSession() function at line 489 aggregates results and navigates to results. Solution: accumulate celebration data across exercises in the session, write once before navigating.

2. **Rapid navigation away:** If user navigates away from the results screen while an overlay is showing, the overlay remains as a fixed-position orphan. Solution: the overlay must be cleaned up via the disposables pattern, removing from `document.body` on dispose.

3. **AudioContext suspended:** On iOS/Safari the AudioContext may be suspended if no prior user interaction on the results page. The existing `initAudio` handler in main.ts should handle this, but the overlay's tap-to-dismiss provides a user gesture that can resume it as a fallback.

4. **sessionStorage quota:** CelebrationData is small (< 1KB). No risk.

5. **Multiple badges in one exercise:** Possible (e.g., first session at 10 sessions could earn "sessions bronze" and "focus-time bronze" simultaneously). The sequential overlay display handles this.

6. **Level 30 cap:** `getLevel()` caps at 30. No level-up possible beyond 30. No special handling needed (levelBefore will equal levelAfter).

7. **prefers-reduced-motion:** Already handled globally in animations.css. Content is still readable; only motion is suppressed.

8. **Web Share API unavailability:** The share button is only shown when `navigator.share` is available (desktop Chrome, Safari, all mobile). Falls back to hidden button gracefully.

### Critical Files for Implementation
- `/Users/lifeart/Repos/ivetta/focus/public/js/ui/screens/exercise-play.ts` - Core logic: add level/badge detection before navigation to results
- `/Users/lifeart/Repos/ivetta/focus/public/js/ui/screens/results.ts` - Integration point: read celebration data and show overlays on screen entry
- `/Users/lifeart/Repos/ivetta/focus/public/js/core/progression.ts` - Contains getLevel, checkBadges, getLevelTitle used for detection logic
- `/Users/lifeart/Repos/ivetta/focus/public/js/i18n/keys.ts` - Must add celebration key types for TypeScript compilation
- `/Users/lifeart/Repos/ivetta/focus/public/css/animations.css` - Add new keyframe definitions for celebration animations
