# Feature: Exercise Visual Polish

## Summary
Move all inline styles out of exercise TypeScript files into CSS classes in `exercises.css`, add stimulus entry/exit animations using existing keyframe infrastructure, enhance stimulus visuals with gradients and glows, introduce a within-exercise streak counter for engagement, improve the results screen celebration, and add screen transitions at the router level.

## Motivation (UX quality, theme support, teen engagement)
- **Theme support**: Inline styles with hardcoded hex colors (`#4ecdc4`, `#ff6b6b`, `#e0e0e0`, `#ffd93d`) bypass the CSS custom property system entirely. Moving to CSS classes that reference `var(--*)` tokens allows themes (ocean, sunset, forest, and light mode) to restyle exercises automatically.
- **UX quality**: Stimulus appearance/disappearance is currently instant (DOM insert/remove). Adding entry and exit animations (scale-in, fade-out, slide-in, stagger) gives visual continuity and a polished feel expected in modern apps.
- **Teen engagement**: A streak counter ("5 in a row!") with milestone celebrations provides immediate, gratifying feedback during the exercise -- not just at the end. Combined with improved confetti and a score ring on the results screen, this keeps the user invested throughout the session.

## Changes

### 1. Move Inline Styles to CSS Classes

#### go-no-go.ts -- `createShape()` (lines 56-73)

**Current inline styles:**
- `shape.style.width = '100px'`
- `shape.style.height = '100px'`
- `shape.style.margin = '0 auto'`
- `shape.style.transition = 'transform 0.1s ease'`
- Go: `shape.style.borderRadius = '50%'`, `shape.style.backgroundColor = randomGoColor()` (picks from `['#4ecdc4', '#45b7d1', '#96ceb4', '#ffd93d']`)
- No-Go: `shape.style.borderRadius = '0'`, `shape.style.backgroundColor = '#ff6b6b'`

**Also in `setup()`** (lines 267-271):
- `stimulusArea.style.display = 'flex'`
- `stimulusArea.style.alignItems = 'center'`
- `stimulusArea.style.justifyContent = 'center'`
- `stimulusArea.style.minHeight = '200px'`
- `stimulusArea.style.cursor = 'pointer'`
- `stimulusArea.style.userSelect = 'none'`

**Replace with CSS classes:**
- `.gng-stimulus` -- base shape (100px square, margin auto, transition)
- `.gng-stimulus--go` -- circle (border-radius 50%, background via CSS var `--gng-go-color`)
- `.gng-stimulus--nogo` -- square (border-radius 0, background `var(--error)`)
- The `stimulusArea` inline styles are already covered by `.exercise-stimulus-area` in exercises.css (lines 543-552); just add `cursor: pointer` to that class.

**Handling go color randomization**: Keep the `randomGoColor()` call in JS but set it via `shape.style.setProperty('--gng-go-color', color)` so the class can reference `background: var(--gng-go-color)`. This keeps the random selection in JS while the rest is CSS.

#### flanker.ts -- `createArrowSpan()` (lines 66-82)

**Current inline styles:**
- `span.style.fontSize = '3rem'`
- `span.style.margin = '0 0.25rem'`
- `span.style.display = 'inline-block'`
- `span.style.userSelect = 'none'`
- `span.style.lineHeight = '1'`
- Center arrow: `span.style.color = '#ffd93d'`, `span.style.transform = 'scale(1.3)'`, `span.style.textShadow = '0 0 12px rgba(255,217,61,0.6)'`
- Flanker arrow: `span.style.color = '#e0e0e0'`

**Replace with:**
- `.flanker-arrow` -- base arrow span (font-size, margin, display, user-select, line-height, color `var(--text-secondary)`)
- `.flanker-arrow--target` -- center arrow (color `var(--primary)`, transform scale(1.3), text-shadow using `var(--primary-glow)`)

#### flanker.ts -- `createNeutralSpan()` (lines 84-94)

**Current inline styles:** same base as arrow but color `#e0e0e0`.

**Replace with:**
- `.flanker-arrow--neutral` -- neutral dash (same base, color `var(--text-secondary)`)

#### flanker.ts -- arrow row (lines 118-122)

**Current inline styles on `row`:**
- `row.style.display = 'flex'`
- `row.style.alignItems = 'center'`
- `row.style.justifyContent = 'center'`
- `row.style.gap = '0.3rem'`

**Replace with:** `.flanker-row` class (flex row, center, gap).

#### flanker.ts -- `stimulusArea` setup (lines 342-346)

Same pattern as go-no-go: already covered by `.exercise-stimulus-area`.

#### flanker.ts -- button styles (lines 351-373)

**Current inline styles on `btnLeft` and `btnRight`:**
- fontSize, padding, border, borderRadius, background, color, cursor, touchAction, userSelect, webkitUserSelect (10 properties each)

**Already have CSS:** `.flanker-btn` in exercises.css (lines 681-708) covers all of these. **Action:** Remove all `btnLeft.style.*` and `btnRight.style.*` lines; the existing `.flanker-btn` class handles it.

#### flanker.ts -- `buttonRow` (lines 375-379)

**Current inline styles:** display flex, justify-content center, gap 2rem, marginTop 2rem.

**Already have CSS:** `.flanker-buttons` in exercises.css (lines 715-720). Remove inline styles.

#### visual-search.ts -- `createShapeElement()` (lines 87-112)

**Current inline styles:**
- Dynamic `size` = `Math.max(44, Math.floor(200 / currentGridSize))`
- `div.style.width/height = size + 'px'`
- `div.style.cursor = 'pointer'`
- `div.style.touchAction = 'manipulation'`
- `div.style.userSelect/webkitUserSelect = 'none'`
- `div.style.transition = 'transform 0.1s'`
- red-circle: `background: '#ff6b6b'`, `borderRadius: '50%'`
- blue-circle: `background: '#45b7d1'`, `borderRadius: '50%'`
- red-square: `background: '#ff6b6b'`, `borderRadius: '0'`

**Replace with:**
- `.vs-item` -- base (cursor, touch-action, user-select, transition, aspect-ratio: 1). Width set via CSS custom property `--vs-item-size` set in JS.
- `.vs-item--red-circle` -- background `var(--error)`, border-radius 50%
- `.vs-item--blue-circle` -- background `var(--primary)`, border-radius 50%
- `.vs-item--red-square` -- background `var(--error)`, border-radius 0

#### visual-search.ts -- `gridContainer` setup (lines 322-329)

**Current inline styles:** display grid, gridTemplateColumns, gap, justifyItems, alignItems, maxWidth, margin, padding.

**Already partially in CSS:** `.visual-search-grid` (exercises.css lines 725-732) has display grid, gap, justify-items, align-items, margin, padding. Only `gridTemplateColumns` and `maxWidth` need to stay dynamic (set via JS `style.gridTemplateColumns` or CSS var).

#### visual-search.ts -- `noTargetBtn` (lines 331-344)

**Current inline styles:** 12 properties.

**Already in CSS:** `.visual-search-no-target-btn` (exercises.css lines 734-767). Remove all inline styles.

#### n-back.ts -- `stimulusArea` (lines 326-331)

**Current inline styles:** display flex, flex-direction column, align-items center, justify-content center, min-height 200px, user-select none.

**Already in CSS:** `.nback-stimulus-area` (exercises.css lines 609-617). Remove inline styles.

### 2. Stimulus Entry/Exit Animations

#### Go/No-Go: scale-in from 0 (200ms elastic ease), fade-out on removal

**New keyframe:**
```
@keyframes stimulusPopIn {
  0%   { opacity: 0; transform: scale(0); }
  70%  { transform: scale(1.1); }
  100% { opacity: 1; transform: scale(1); }
}
```

- `.gng-stimulus` gets `animation: stimulusPopIn 200ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards`
- For exit: before removing, add `.gng-stimulus--exit` class with `animation: fadeOut 150ms ease forwards`, then remove after animation ends. Modify `removeStimulus()` to animate out by listening for `animationend`.

#### Flanker: slide-in from Y offset with opacity

**New keyframe:**
```
@keyframes flankerSlideIn {
  0%   { opacity: 0; transform: translateY(12px); }
  100% { opacity: 1; transform: translateY(0); }
}
```

- `.flanker-row` gets `animation: flankerSlideIn 200ms ease forwards`

#### Visual Search: stagger-fade-in for grid items

- Each `.vs-item` gets `animation: scaleIn 150ms ease forwards` with `opacity: 0` initial state
- JS assigns `animation-delay` inline: `item.style.animationDelay = `${index * 20}ms`` (stagger 20ms per item for a ~200ms cascade on a 3x3 grid). This is one acceptable inline style since it is index-dependent.
- Alternatively, use CSS custom property `--vs-delay` set per item.

#### N-Back: enhance existing `nback-letter-fade`

The existing `nbackFadeIn` keyframe already animates scale 0.8 to 1 with opacity. Enhance to add a subtle "pop":
```
@keyframes nbackFadeIn {
  0%   { opacity: 0; transform: scale(0.7); }
  60%  { opacity: 1; transform: scale(1.05); }
  100% { opacity: 1; transform: scale(1); }
}
```

### 3. Stimulus Visual Enhancement

#### Go circles: radial gradient + soft glow
```css
.gng-stimulus--go {
  background: radial-gradient(circle at 35% 35%, 
    color-mix(in srgb, var(--gng-go-color) 100%, white 20%), 
    var(--gng-go-color));
  box-shadow: 0 0 24px color-mix(in srgb, var(--gng-go-color) 50%, transparent);
  border-radius: 50%;
}
```

#### No-Go squares: diagonal stripe overlay + "stop" feel
```css
.gng-stimulus--nogo {
  background: 
    repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(0,0,0,0.1) 6px, rgba(0,0,0,0.1) 8px),
    var(--error);
  box-shadow: 0 0 20px var(--error-subtle);
  border-radius: var(--radius-sm);
}
```

#### Flanker arrows: CSS var colors (theme-aware)
Already addressed in section 1 -- colors become `var(--primary)` for target, `var(--text-secondary)` for flankers.

#### Visual search shapes: subtle shadow for depth
```css
.vs-item {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
```

### 4. Within-Exercise Streak Counter

**Concept:** A small counter element below the trial counter that shows consecutive correct answers. Resets on incorrect. At milestones (5, 10, 15, 20...) shows a brief "+N" bounce animation.

**Implementation:**

1. **New shared helper** in `helpers.ts`:
   ```ts
   export function createStreakTracker(container: HTMLElement, disposables: Disposables)
   ```
   Returns an object `{ onCorrect(): void; onIncorrect(): void; getStreak(): number; destroy(): void }`.

2. **DOM structure:** A `<div class="exercise-streak">` placed after the trial counter in `.exercise-header`. Contains:
   - `.exercise-streak__count` -- text like "3 in a row"
   - `.exercise-streak__milestone` -- the "+5" pop that appears and fades

3. **CSS classes:**
   - `.exercise-streak` -- positioned, font styling, initially hidden (opacity 0 when streak is 0)
   - `.exercise-streak--active` -- visible when streak >= 2
   - `.exercise-streak__milestone` -- absolute positioned, animation `milestonePopUp`

4. **New keyframe:**
   ```
   @keyframes milestonePopUp {
     0%   { opacity: 0; transform: translateY(0) scale(0.5); }
     40%  { opacity: 1; transform: translateY(-10px) scale(1.1); }
     100% { opacity: 0; transform: translateY(-20px) scale(1); }
   }
   ```

5. **Integration in each exercise:**
   - In `handleResponse()` / `onStimulusEnd()` after determining correct/incorrect, call `streakTracker.onCorrect()` or `streakTracker.onIncorrect()`.
   - In `setup()`, create the streak tracker and append its element to the header.

6. **i18n:** Add key `streak.count` = "{{count}} in a row" to locale files.

### 5. Results Score Celebration Enhancement

#### SVG ring that fills as score counts up

Replace the plain `scoreValueEl` text with an SVG ring + centered text:

1. Create an SVG element with two `<circle>` elements (background track + progress arc) similar to the existing pomodoro timer ring pattern (exercises.css lines 379-414).
2. As the score counter increments (already animated in `results.ts` lines 247-257), update `stroke-dashoffset` on the progress circle proportionally.

**New CSS classes:**
- `.results-ring` -- container (width 160px, height 160px, position relative)
- `.results-ring__svg` -- absolute, full size, rotated -90deg
- `.results-ring__track` -- stroke `var(--surface-2)`, no fill
- `.results-ring__progress` -- stroke `var(--primary)`, animated dash offset
- `.results-ring__value` -- absolute centered text (the score number)

#### Particle burst on completion

When the score counter reaches its target:
1. Create 12-16 small particles (divs) positioned at the ring's center
2. Each flies outward in a random direction with fadeout

**New keyframe:**
```
@keyframes particleBurst {
  0%   { opacity: 1; transform: translate(0, 0) scale(1); }
  100% { opacity: 0; transform: translate(var(--px), var(--py)) scale(0); }
}
```
JS sets `--px` and `--py` CSS custom properties per particle for random directions.

#### Haptic feedback

After the score animation completes:
```ts
if ('vibrate' in navigator) {
  navigator.vibrate([50, 30, 80]);
}
```

Guard behind feature detection. No-op on desktop.

#### Improved confetti

In `createConfetti()`:
- Increase piece count from 30 to 50
- Add horizontal drift via a new keyframe:
  ```
  @keyframes confetti-fall-drift {
    0%   { opacity: 1; transform: translateY(-10vh) translateX(0) rotate(0deg); }
    100% { opacity: 0; transform: translateY(100vh) translateX(var(--drift)) rotate(720deg); }
  }
  ```
- Each piece gets a random `--drift` value between -80px and 80px.
- Add `border-radius` variety (circles, rectangles, triangles via clip-path).

### 6. Screen Transitions

**Approach:** Add a fade transition at the router level. In `router.ts`, instead of immediately clearing `rc.innerHTML = ''`, fade out the old content, then fade in the new.

**Implementation:**

1. Add a CSS class `.screen-transition-exit` with `animation: fadeOut 150ms ease forwards`.
2. Add `.screen-transition-enter` with `animation: fadeIn 150ms ease forwards`.
3. In `router.ts` `render()` function:
   - Add `.screen-transition-exit` to `rc`.
   - Wait 150ms (via `setTimeout` or `animationend` listener).
   - Clear content, render new screen, add `.screen-transition-enter`.
   - Remove `.screen-transition-enter` after animation completes.
4. Use `prefers-reduced-motion` to skip the transition (already handled by the existing `@media (prefers-reduced-motion: reduce)` rule in animations.css which sets all animation-durations to 0.01ms).

### CSS Details

#### New CSS classes to add to `exercises.css`:

```css
/* Go/No-Go stimulus */
.gng-stimulus {
  width: 100px;
  height: 100px;
  margin: 0 auto;
  transition: transform 0.1s ease;
  animation: stimulusPopIn 200ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
.gng-stimulus--go {
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%,
    color-mix(in srgb, var(--gng-go-color) 80%, white),
    var(--gng-go-color));
  box-shadow: 0 0 24px color-mix(in srgb, var(--gng-go-color) 40%, transparent);
}
.gng-stimulus--nogo {
  border-radius: var(--radius-sm);
  background:
    repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(0,0,0,0.1) 6px, rgba(0,0,0,0.1) 8px),
    var(--error);
  box-shadow: 0 0 20px var(--error-subtle);
}
.gng-stimulus--exit {
  animation: fadeOut 150ms ease forwards;
}

/* Flanker */
.flanker-arrow {
  font-size: 3rem;
  margin: 0 0.25rem;
  display: inline-block;
  user-select: none;
  line-height: 1;
  color: var(--text-secondary);
}
.flanker-arrow--target {
  color: var(--primary);
  transform: scale(1.3);
  text-shadow: 0 0 12px var(--primary-glow);
}
.flanker-arrow--neutral {
  color: var(--text-secondary);
}
.flanker-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  animation: flankerSlideIn 200ms ease forwards;
}

/* Visual Search items */
.vs-item {
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
  transition: transform 0.1s;
  width: var(--vs-item-size, 44px);
  height: var(--vs-item-size, 44px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  animation: scaleIn 150ms ease forwards;
  opacity: 0;
}
.vs-item--red-circle {
  background: var(--error);
  border-radius: 50%;
}
.vs-item--blue-circle {
  background: var(--primary);
  border-radius: 50%;
}
.vs-item--red-square {
  background: var(--error);
  border-radius: 0;
}

/* Streak counter */
.exercise-streak {
  font-family: var(--font-heading);
  font-size: var(--text-xs);
  color: var(--text-muted);
  text-align: center;
  opacity: 0;
  transition: opacity 200ms ease;
  position: relative;
}
.exercise-streak--active {
  opacity: 1;
  color: var(--primary);
}
.exercise-streak__milestone {
  position: absolute;
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
  font-weight: var(--weight-bold);
  color: var(--primary);
  animation: milestonePopUp 800ms ease forwards;
  pointer-events: none;
}

/* Results ring */
.results-ring {
  width: 160px;
  height: 160px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
}
.results-ring__svg {
  position: absolute;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}
.results-ring__track {
  fill: none;
  stroke: var(--surface-2);
  stroke-width: 6;
}
.results-ring__progress {
  fill: none;
  stroke: var(--primary);
  stroke-width: 6;
  stroke-linecap: round;
  transition: stroke-dashoffset 20ms linear;
}
.results-ring__value {
  font-family: var(--font-heading);
  font-size: 3rem;
  font-weight: var(--weight-bold);
  color: var(--primary);
}

/* Screen transitions */
.screen-transition-exit {
  animation: fadeOut 150ms ease forwards;
}
.screen-transition-enter {
  animation: fadeIn 150ms ease forwards;
}

/* Particle burst */
.result-particle {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  animation: particleBurst 600ms ease-out forwards;
  pointer-events: none;
}
```

#### New keyframes to add to `animations.css`:

```css
@keyframes stimulusPopIn {
  0%   { opacity: 0; transform: scale(0); }
  70%  { transform: scale(1.1); opacity: 1; }
  100% { opacity: 1; transform: scale(1); }
}

@keyframes flankerSlideIn {
  0%   { opacity: 0; transform: translateY(12px); }
  100% { opacity: 1; transform: translateY(0); }
}

@keyframes milestonePopUp {
  0%   { opacity: 0; transform: translateX(-50%) translateY(0) scale(0.5); }
  30%  { opacity: 1; transform: translateX(-50%) translateY(-10px) scale(1.1); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-24px) scale(1); }
}

@keyframes particleBurst {
  0%   { opacity: 1; transform: translate(0, 0) scale(1); }
  100% { opacity: 0; transform: translate(var(--px), var(--py)) scale(0); }
}

@keyframes confetti-fall-drift {
  0%   { opacity: 1; transform: translateY(-10vh) translateX(0) rotate(0deg); }
  100% { opacity: 0; transform: translateY(100vh) translateX(var(--drift)) rotate(720deg); }
}
```

Also update existing `nbackFadeIn` keyframe (in exercises.css) to add the overshoot.

### Tests

1. **Unit tests for streak tracker:**
   - `onCorrect()` increments streak; `onIncorrect()` resets to 0.
   - Milestone detection at 5, 10, 15.
   - `getStreak()` returns correct value.

2. **CSS class application tests:**
   - For each exercise, verify that `createShape()` / `createArrowSpan()` / `createShapeElement()` returns elements with the expected CSS classes and no unexpected inline styles (except dynamic values like `--gng-go-color` and `--vs-item-size`).

3. **Animation safety:**
   - Verify `prefers-reduced-motion` media query still applies (already covered by existing animations.css rule).
   - Verify exit animations complete before DOM removal (test that `animationend` handler fires).

4. **Router transition test:**
   - Navigate between two routes; verify `.screen-transition-exit` is added then removed, and `.screen-transition-enter` is added then removed.

5. **Results ring test:**
   - Verify SVG `stroke-dashoffset` updates proportionally to score during count-up.
   - Verify haptic feedback only called when `navigator.vibrate` exists.

6. **Visual regression:**
   - Manual check each exercise in at least two themes (default dark + ocean) to confirm colors come from CSS vars correctly.

## Files Modified

| File | Change |
|------|--------|
| `public/css/exercises.css` | Add `.gng-stimulus`, `.flanker-arrow`, `.flanker-row`, `.vs-item`, `.exercise-streak`, `.results-ring` classes and variants |
| `public/css/animations.css` | Add `stimulusPopIn`, `flankerSlideIn`, `milestonePopUp`, `particleBurst`, `confetti-fall-drift` keyframes; update `nbackFadeIn` |
| `public/js/exercises/go-no-go.ts` | Replace inline styles in `createShape()` and `setup()` with CSS classes; add exit animation in `removeStimulus()`; integrate streak tracker |
| `public/js/exercises/flanker.ts` | Replace inline styles in `createArrowSpan()`, `createNeutralSpan()`, button setup, row setup with CSS classes; integrate streak tracker |
| `public/js/exercises/visual-search.ts` | Replace inline styles in `createShapeElement()`, grid setup, button setup with CSS classes; add stagger delay; integrate streak tracker |
| `public/js/exercises/n-back.ts` | Remove `stimulusArea` inline styles (already in CSS); update `nbackFadeIn` keyframe reference; integrate streak tracker |
| `public/js/exercises/helpers.ts` | Add `createStreakTracker()` helper function |
| `public/js/ui/screens/results.ts` | Add SVG score ring, particle burst, haptic feedback, improved confetti |
| `public/js/router.ts` | Add fade transition between screens in `render()` function |
| `public/css/layout.css` | Update `.confetti-piece` to use `confetti-fall-drift` keyframe |
| `public/js/core/i18n.ts` (or locale JSON) | Add `streak.count` translation key |

## Risks / Edge Cases

1. **Exit animation timing**: If stimulus removal is animated (150ms fade-out), this delays the next trial. The ISI already provides a gap (1200-1800ms for Go/No-Go, 1200-1800ms for Flanker, 500ms for Visual Search), so 150ms is well within budget. However, if the user responds instantly and the next stimulus is scheduled, ensure the exit animation does not overlap with the next entry. Solution: complete exit animation before scheduling next trial, or cancel exit animation if next stimulus arrives.

2. **`color-mix()` browser support**: `color-mix(in srgb, ...)` is supported in all modern browsers (Chrome 111+, Firefox 113+, Safari 16.2+). For older browsers, provide a fallback `background-color` before the `background` shorthand.

3. **Visual search stagger delay performance**: On a 7x7 grid (49 items), stagger of 20ms means the last item appears at ~980ms. This is fine but should be capped. Consider 15ms stagger for larger grids (>25 items).

4. **Router transition blocks render**: The 150ms fade-out delay means the new screen is not rendered for 150ms. This could feel slow if the user navigates rapidly. Mitigation: cancel any in-progress transition if a new navigation occurs.

5. **Haptic feedback**: `navigator.vibrate()` requires user gesture context in some browsers and may not work during automated animation. Wrap in try/catch.

6. **Streak counter in Go/No-Go**: Correct rejection (not responding to No-Go) counts as correct. The streak should increment for correct rejections too, since it measures overall performance.

7. **Theme-dependent shape colors**: Moving Go/No-Go go-circle colors from hardcoded hex to CSS vars means the random color palette should be defined as CSS custom properties (e.g., `--gng-go-1`, `--gng-go-2`, etc.) that each theme can override. The JS picks a random index and sets `--gng-go-color` to the chosen var.

### Critical Files for Implementation
- `/Users/lifeart/Repos/ivetta/focus/public/css/exercises.css` - Primary target for all new CSS classes replacing inline styles
- `/Users/lifeart/Repos/ivetta/focus/public/css/animations.css` - Add new keyframes for stimulus animations, streak milestone, particles
- `/Users/lifeart/Repos/ivetta/focus/public/js/exercises/helpers.ts` - Add createStreakTracker() shared utility
- `/Users/lifeart/Repos/ivetta/focus/public/js/exercises/go-no-go.ts` - Largest inline style removal (createShape + setup), animation integration
- `/Users/lifeart/Repos/ivetta/focus/public/js/ui/screens/results.ts` - SVG ring, particle burst, haptic feedback, improved confetti
