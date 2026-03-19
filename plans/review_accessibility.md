# Accessibility Review: Focus Training App

**Reviewer:** Accessibility Specialist & UX Researcher (Adolescent Mobile Wellness)
**Date:** 2026-03-19
**Scope:** WCAG 2.1 AA compliance, mobile accessibility, input method parity, i18n

---

## Overall Accessibility Rating: 6 / 10

The app demonstrates awareness of accessibility basics (focus-visible, sr-only class, reduced-motion, 44px touch targets) but has significant gaps in screen reader support, ARIA semantics, and several contrast issues across themes. For an adolescent wellness app, these gaps could exclude users with disabilities at a critical developmental stage.

---

## 1. Color Contrast

### Dark Theme (Default)
| Pair | Foreground | Background | Approx Ratio | Verdict |
|------|-----------|------------|-------------|---------|
| `--text` on `--bg` | #e8e8f0 | #0f0f1a | ~15:1 | PASS |
| `--text-secondary` on `--bg` | #9898b0 | #0f0f1a | ~6.5:1 | PASS |
| `--text-muted` on `--bg` | #6a6a82 | #0f0f1a | ~3.5:1 | FAIL (normal text) |
| `--text-muted` on `--surface` | #6a6a82 | #1a1a2e | ~2.8:1 | FAIL |
| `--primary` on `--bg` | #7c5cfc | #0f0f1a | ~4.7:1 | Borderline PASS |
| `--warning` on `--bg` | #ffe66d | #0f0f1a | ~13.5:1 | PASS |
| `--warning` badge text on `--warning-subtle` | #ffe66d | rgba(255,230,109,0.12) over dark | ~2:1 | FAIL |
| `.btn--primary` text | #ffffff | #7c5cfc | ~4.6:1 | Borderline PASS |

### Light Theme
| Pair | Foreground | Background | Approx Ratio | Verdict |
|------|-----------|------------|-------------|---------|
| `--text` on `--bg` | #1a1a2e | #f5f5fa | ~14:1 | PASS |
| `--text-secondary` on `--bg` | #5a5a72 (media) / #666680 (data-theme) | #f5f5fa | ~5.5:1 | PASS |
| `--text-muted` on `--bg` | #8888a0 | #f5f5fa | ~3.5:1 | FAIL (normal text) |
| `--primary` on `--bg` | #6b4ce6 | #f5f5fa | ~4.2:1 | FAIL (normal text, passes large) |

### Forest Theme
| Pair | Foreground | Background | Approx Ratio | Verdict |
|------|-----------|------------|-------------|---------|
| `--primary` on `--bg` | #2d6a4f | #0a1a0a | ~3.2:1 | FAIL (normal text) |
| `--text-muted` on `--surface` | #5a8a5a | #152815 | ~2.8:1 | FAIL |

### Findings
- **CRITICAL:** `--text-muted` fails AA contrast in every theme. It is used for nav labels, stat labels, trial counters, exercise metadata, day labels, timestamps, and score tier labels. This is pervasive.
- **HIGH:** Forest theme's `--primary` (#2d6a4f on #0a1a0a) fails AA for normal text. Primary-colored text (level labels, score values, links) is unreadable.
- **HIGH:** Badge components (`.badge--warning`, `.badge--success`) use semantic colors on subtle backgrounds. Against dark backgrounds, these semi-transparent backgrounds produce very low contrast.
- **MEDIUM:** `.nav__label` uses 10px font (`0.625rem`) with `--text-muted` color. Double failure: contrast + font size.
- **MEDIUM:** Progress bar label and percent use `--text-xs` (12px) with `--text-secondary`. Borderline.

### Recommendations
- Increase `--text-muted` lightness by at least 30% in dark themes (e.g., #8a8aa2 for default dark).
- Increase `--text-muted` darkness in light theme (e.g., #666680).
- Audit Forest theme primary color; consider a lighter green (#40916c or lighter).
- Badge components should use opaque backgrounds calculated for contrast.
- Nav labels should use `--text-secondary` instead of `--text-muted`, or increase size.

---

## 2. Touch Targets

### Passing (>=44px)
- `.btn` base: `min-height: 44px` -- PASS
- `.btn--lg`: larger padding -- PASS
- `.nback-match-btn`: `min-height: 48px` -- PASS
- `.flanker-btn`: `min-height: 64px`, `min-width: 80px` -- PASS
- `.visual-search-no-target-btn`: `min-height: 48px` -- PASS
- `.response-btn` (flanker circles): 80x80px -- PASS
- `.settings__toggle`: 48x28px -- width PASS, height FAIL
- `.onboarding__color-btn`: 48x48px -- PASS
- `.vs-item`: `--vs-item-size: 44px` default -- PASS (just barely)

### Failing (<44px)
- **`.btn--sm`: `min-height: 36px`** -- FAIL. Used for secondary actions. Adolescent users with motor difficulties need at least 44px.
- **`.modal__close`: 32x32px** -- FAIL. Close buttons are critical interaction points.
- **`.nav__item`**: `padding: 4px 8px` with no explicit min-height. The icon is 24px + label ~10px + 2px gap = ~36px. With padding, approximately 44px total. -- BORDERLINE. The `min-width: 48px` is set but min-height is not explicit.
- **`.settings__toggle`**: 48x28px. The height of 28px is a FAIL for the touch target.
- **`.chip` / `.chip--interactive`**: `padding: 0.25rem 0.75rem` = very small vertical size, likely ~24px. -- FAIL if interactive.
- **`.onboarding__lang-btn`**: `padding: 0.25rem 0.75rem`. Approximately 28px tall. -- FAIL.
- **`.gng-stimulus`**: 100x100px -- PASS.
- **`.nback-queue-letter`**: 36x36px -- not interactive, informational only -- N/A.
- **Onboarding progress dots**: 8x8px -- not interactive -- N/A.
- **`.settings-option`**: `padding: 8px 16px`, `min-width: 60px` but no min-height. Likely ~36px. -- FAIL.

### Recommendations
- Set `min-height: 44px` on `.btn--sm`, `.modal__close`, `.settings__toggle`, `.onboarding__lang-btn`, `.settings-option`.
- Add `min-height: 44px` to `.chip--interactive`.
- Ensure `.nav__item` has an explicit `min-height: 44px`.

---

## 3. Keyboard Navigation

### What works
- **Go/No-Go**: Space bar triggers response. PASS.
- **N-Back**: M key triggers match. PASS.
- **Flanker**: ArrowLeft/ArrowRight trigger responses. PASS.
- **Onboarding mini-exercise**: Space bar triggers response. PASS.
- **Focus-visible**: Global `:focus-visible` outline styled with 2px solid primary + 2px offset. PASS.
- **Buttons** have `:focus-visible` styling on `.btn`. PASS.

### What fails
- **Visual Search**: No keyboard handler found in visual-search.ts (not in the files read, but no keydown listener registered). Users must click/tap grid items. -- CRITICAL FAIL. The exercise is completely inaccessible to keyboard users.
- **Breathing exercise**: Passive exercise (no input), but start/stop controls should be keyboard-accessible. Likely OK if using buttons.
- **Pomodoro**: Same as breathing -- relies on buttons, which should work.
- **Tab order**: The app is a SPA rendered into `#app` via JS. No `tabindex` management is visible. When screens change, focus is not programmatically moved to the new screen. Users would be lost after navigation. -- HIGH.
- **Nav items**: Rendered as `<button>` elements -- keyboard accessible. PASS.
- **Modal/Pause overlay**: No focus trap. When pause overlay appears, keyboard focus can escape behind the overlay. -- HIGH.
- **Exercise play header buttons** (Exit, Pause): Created as buttons, keyboard accessible. PASS.
- **Onboarding goal cards and color buttons**: Created as `<div>` or `<button>` -- goal cards are `<div>` with click handlers, not keyboard focusable. -- FAIL.
- **Settings chips/theme cards**: Created with click handlers on divs -- need to verify, but the pattern suggests no keyboard support for selection UI. -- LIKELY FAIL.

### Recommendations
- Add keyboard support to Visual Search (e.g., arrow keys to navigate grid, Enter/Space to select).
- Implement focus management: when navigating between screens, move focus to the screen heading or first interactive element.
- Add focus trap to modal/pause overlays.
- Ensure onboarding goal cards and settings selection cards are either `<button>` elements or have `role="button"` + `tabindex="0"` + keydown handlers.

---

## 4. Screen Reader Support

### Findings
- **CRITICAL: Almost no ARIA attributes in the entire codebase.** The only `aria-label` found is on nav buttons. No `aria-live`, `aria-current`, `aria-pressed`, `aria-selected`, `aria-describedby`, `aria-modal`, `role="alert"`, `role="dialog"`, `role="navigation"`, `role="main"`, `role="progressbar"`, etc.
- **No landmark roles**: The `<nav>` element is created as a `<nav>` semantic element (good), but the main content area (`#app > div`) has no `role="main"` or `<main>` element.
- **No live regions**: Exercise feedback (correct/incorrect), timer countdowns, score updates, and toast notifications are not announced to screen readers. The feedback-flash is purely visual.
- **No alt text**: SVG icons in nav are inline SVGs without `aria-hidden="true"` or descriptive `<title>` elements. They have `aria-label` on the parent button, but the SVG itself may be read aloud redundantly.
- **Progress dots**: Onboarding progress dots have no `aria-label` or `role="progressbar"`. Screen reader users cannot know their progress.
- **Exercise stimulus**: Go/No-Go stimuli are purely visual (colored shapes). Screen reader users cannot distinguish Go vs No-Go. -- CRITICAL for the core exercise.
- **Toast notifications**: No `role="alert"` or `aria-live="polite"`. Screen readers will not announce them.
- **Modal/Pause overlay**: No `role="dialog"` or `aria-modal="true"`.
- **Timer display**: No `aria-live` region. Screen reader users cannot track remaining time.
- **Toggle switches**: `.settings__toggle` has no `role="switch"` or `aria-checked`.
- **Active nav item**: Uses class `nav__item--active` but no `aria-current="page"`.

### Recommendations
- Add `<main>` landmark around screen content.
- Add `role="navigation"` label or keep `<nav>` element (already done).
- Add `aria-current="page"` to active nav item.
- Add `aria-live="polite"` regions for: exercise feedback, timer, score, toast.
- Add `role="alert"` to toast notifications.
- Add `role="dialog"` and `aria-modal="true"` to modals and pause overlay.
- Add `role="switch"` and `aria-checked` to toggle buttons.
- Add `aria-hidden="true"` to decorative SVG icons.
- Add text-based announcements for Go/No-Go stimuli (e.g., sr-only "Go" or "Stop" text).
- Add `role="progressbar"` with `aria-valuenow`/`aria-valuemax` to progress bars.

---

## 5. Focus Indicators

### What works
- Global `:focus-visible` with `2px solid var(--primary)` + `2px offset`. -- PASS.
- `.btn:focus-visible` has matching outline. -- PASS.
- `.input:focus` has `border-color: var(--primary)` + `box-shadow: 0 0 0 3px var(--primary-subtle)`. -- PASS.
- Form elements preserve visible focus. -- PASS.

### What fails
- **Forest theme focus indicator**: `--primary` is #2d6a4f (dark green on dark background). The focus ring contrast against `--bg` (#0a1a0a) is approximately 2.5:1. -- FAIL. WCAG requires 3:1 minimum for focus indicators.
- **Cards with click handlers** (`.card--interactive`, onboarding goal cards): No `:focus-visible` styling specific to cards. If made keyboard-focusable, they would rely on the global outline, which may be clipped by `border-radius: var(--radius-xl)` and `overflow: hidden`.
- **Custom toggle** (`.settings__toggle`): Not a native element, may not receive focus ring.

### Recommendations
- Ensure focus ring color has >=3:1 contrast against adjacent backgrounds in all themes. Consider using a high-contrast outline (e.g., double ring or white + primary).
- Test that `outline-offset: 2px` is visible on rounded elements.

---

## 6. Reduced Motion

### What works
- `@media (prefers-reduced-motion: reduce)` is implemented. It sets:
  - `animation-duration: 0.01ms !important`
  - `animation-iteration-count: 1 !important`
  - `transition-duration: 0.01ms !important`
  - `scroll-behavior: auto !important`
- Utility animation classes are reset to `opacity: 1; transform: none; animation: none;`.
- This is a thorough, well-implemented universal reduction. -- PASS.

### What could be improved
- **Exercise-specific animations** (stimulus pop-in, breathing circle expansion, flanker slide-in, confetti, countdown scale): All are covered by the universal `*` selector reduction. Good.
- **Breathing exercise**: The circle scaling IS the exercise mechanic. Under reduced motion, the animation will effectively not play. The exercise may become unusable. Consider using a size change with no animation (instant snap) or an alternative indicator (text-only phase display). -- MEDIUM.
- **Onboarding step transitions** (`ob-fade-in`, `ob-fade-out`): These inject via `<style>`. The `prefers-reduced-motion` media query in animations.css will still apply because it targets `*`. -- PASS.

### Recommendations
- For the breathing exercise, provide a fallback that still communicates inhale/exhale phases without relying on animation (e.g., text-only mode).

---

## 7. Font Sizes

### What works
- Base font size: `html { font-size: 16px }`. -- PASS.
- Input fields: `font-size: var(--text-base)` (16px) prevents iOS auto-zoom. -- PASS.
- Body text: `var(--text-base)` = 1rem = 16px. -- PASS.
- Headings scale from 18px to 40px. -- PASS.
- Text uses `rem` units throughout -- resizable. -- PASS.

### What fails
- **`.nav__label`**: `font-size: 0.625rem` = **10px**. Below minimum. Hard to read for adolescents, especially on small screens. -- FAIL.
- **`--text-xs: 0.75rem`** = 12px. Used for: badge text, progress labels, trial counters, stat labels, calendar headers, exercise metadata, chip text, activity timestamps. This is heavily used throughout the app. While 12px is common in mobile apps, WCAG does not mandate minimum font size. However, for an adolescent audience, 12px is too small. -- ADVISORY.
- **`--text-sm: 0.875rem`** = 14px. Used for: card subtitles, button text, input text (settings), screen subtitles, descriptions. Acceptable but tight. -- ADVISORY.
- **Small phones media query** (max-width: 359px): Reduces spacing but does not reduce font sizes further. Good -- text does not get smaller. -- PASS.

### Recommendations
- Increase `.nav__label` to at least `0.75rem` (12px), preferably `0.8125rem` (13px).
- Consider bumping `--text-xs` to `0.8125rem` (13px) for the adolescent audience.
- Test text reflow at 200% zoom. The `max-width: 480px` constraint and `rem`-based sizing should handle this, but verify no horizontal scrolling occurs.

---

## 8. Offline Experience (PWA)

### What works
- Service worker registers on load. -- PASS.
- Cache-first strategy for assets, network-first for navigation with fallback to `index.html`. -- PASS.
- All critical assets are pre-cached: HTML, CSS, JS bundle, fonts, favicon, manifest. -- PASS.
- App data is stored in localStorage (via `appState`) -- persists offline. -- PASS.
- `manifest.json` is complete with icons, shortcuts, orientation, categories. -- PASS.
- `viewport-fit=cover` + safe area env() handling. -- PASS.
- `display: standalone` PWA mode. -- PASS.

### What fails
- **Service worker cache paths are wrong**: The SW caches `./bundle.js`, `./variables.css`, etc. But the actual paths in the HTML are `js/bundle.js`, `css/variables.css`. Unless the build step copies to dist with flattened paths, these may not match. -- POTENTIAL FAIL (depends on build/deploy).
- **No offline indicator**: When the app is offline and content would normally be fetched, there is no user-facing message. The SPA just works from cache. However, if a user installs the PWA fresh and goes offline before the first load, there is no graceful error. -- MEDIUM.
- **No cache versioning strategy visible**: `CACHE_NAME = 'focus-v1'` is hardcoded. Updates require changing this and redeploying. No runtime cache invalidation. -- LOW (architectural, not accessibility).

### Recommendations
- Verify SW cache paths match actual deployed file paths.
- Add an offline banner or toast when connectivity is lost (optional but helpful for adolescent users who may not understand why something fails).

---

## 9. Error States

### What works
- Exercise not found: Shows a stub screen with "Not found" message and a button to return to exercises. -- PASS.
- Input validation: Onboarding name input defaults to "Player" if left empty. -- PASS.
- Service worker registration: `.catch(() => {})` silently ignores errors. Acceptable. -- PASS.

### What fails
- **No error boundary**: If an exercise crashes (e.g., JS error), there is no catch/recovery. The screen would go blank. -- HIGH.
- **No feedback for invalid input**: The name input in onboarding accepts any input. No character limit, no feedback for very long names that may overflow UI. -- LOW.
- **Session storage failures**: Wrapped in try/catch with empty catch. If sessionStorage is full/unavailable, results silently fail to persist between screens. The user would see empty results. -- MEDIUM.
- **Exercise input errors**: No feedback if user responds during ISI (inter-stimulus interval). Not technically an error, but premature responses are silently ignored. Could confuse users. -- LOW.
- **Localization fallback**: If a translation key is missing, behavior is unclear from the code reviewed. If it falls through to undefined, the user sees "undefined" text. -- MEDIUM.

### Recommendations
- Add a global error boundary that shows a friendly "Something went wrong" screen with a restart option.
- Add character limit and visual feedback on the name input.
- Add a fallback for sessionStorage failures (e.g., pass data via URL hash or app state).

---

## 10. Input Methods

### Touch
- Tap targets meet 44px minimum for most elements (see Section 2 for exceptions).
- `touch-action: manipulation` on buttons prevents double-tap zoom. -- PASS.
- `-webkit-tap-highlight-color: transparent` removes default tap feedback. -- PASS (but consider adding custom feedback).
- Go/No-Go: `touchstart` + `click` listeners on stimulus area. -- PASS.
- N-Back: `touchstart` + `click` on match button. -- PASS (but double-fires: both touchstart and click will call `handleMatch()` on touch devices; `respondedThisTrial` flag prevents double-counting). -- PASS.
- Flanker: `touchstart`/`touchend` swipe detection on stimulus area + `click` on buttons. -- PASS.
- Visual Search: `click` on grid items. No `touchstart`. -- PASS (click works on mobile).

### Keyboard
- Go/No-Go: Space. -- PASS.
- N-Back: M key. -- PASS (but not discoverable; no on-screen hint for keyboard users).
- Flanker: ArrowLeft/ArrowRight. -- PASS.
- Visual Search: **No keyboard support.** -- CRITICAL FAIL.
- Breathing/Pomodoro: Button-based controls. -- PASS.

### Mouse
- All click handlers work for mouse. -- PASS.
- Hover states on buttons, cards, nav items. -- PASS.

### Parity issues
- **Visual Search is touch/mouse only.** Keyboard users are completely blocked.
- **Flanker swipe detection** is touch-only (intentionally -- buttons provide the alternative). -- PASS.
- **N-Back keyboard shortcut (M)** is not communicated on-screen. Add a hint or instruction.
- **Go/No-Go keyboard shortcut (Space)** is mentioned in onboarding ("Press space"). -- PASS.

### Recommendations
- Add keyboard navigation to Visual Search (critical).
- Display keyboard shortcut hints in exercise UI for keyboard users.

---

## 11. Safe Areas

### What works
- `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">` -- enables safe area insets. PASS.
- `.screen` padding includes `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`. -- PASS.
- `.nav` includes `padding-bottom: env(safe-area-inset-bottom)`. -- PASS.
- Standalone PWA mode adjusts padding for status bar. -- PASS.
- Toast position includes `env(safe-area-inset-top)`. -- PASS.

### What could be improved
- **Left/right safe areas**: No `env(safe-area-inset-left)` or `env(safe-area-inset-right)` in landscape mode. The app is portrait-oriented (`"orientation": "portrait"` in manifest), but if a user overrides, content could be clipped behind the notch in landscape. -- LOW.
- **Countdown overlay**: Uses `position: fixed; inset: 0`. The countdown number is centered, so safe areas are not an issue. -- PASS.
- **Pause overlay and modal**: Full-screen overlays with centered content. -- PASS.

### Recommendations
- Add horizontal safe area insets to `.screen` for landscape edge case, or ensure the portrait lock is enforced.

---

## 12. Multi-Language Support

### Languages reviewed
- English (`en`), Russian (`ru`), German (`de`), French (`fr`), Spanish (`es`)

### What works
- Complete translation tables for all 5 languages. -- PASS.
- Language selector in onboarding. -- PASS.
- Language setting persists and reloads. -- PASS.
- Russian Cyrillic script renders correctly with Inter font (cyrillic subsets are loaded). -- PASS.
- Font family includes broad fallbacks. -- PASS.

### Text overflow risks
- **Russian nav labels**: "Упражнения" (10 chars), "Статистика" (10 chars), "Настройки" (9 chars) at 10px font size in the 48px min-width nav items. These are very tight. -- HIGH risk of overflow or truncation.
- **German nav labels**: "Einstellungen" (13 chars) at 10px. Very likely to overflow 48px min-width. -- HIGH risk.
- **Exercise names in exercise header**: Russian "Реакция Go/No-Go" and German "N-Back Gedachtnis" in a flex layout with two buttons. The title has `text-align: center`, `min-width: 0`, `flex: 1`, and `font-size: var(--text-sm)` (14px). Should truncate gracefully with flex shrinking, but no `overflow: hidden` or `text-overflow: ellipsis` is applied. -- MEDIUM risk.
- **Onboarding "Let's go" button**: Russian "Начнем!" vs German "Los geht's!" -- both short enough. -- PASS.
- **Session plan item names**: Exercise names in session plan. Russian names are longer. Flex layout with icon and name should handle it. -- LOW risk.
- **`manifest.json` lang is "en"** only. No localized manifest. PWA install prompt will always show English app name. -- LOW.
- **`<html lang="en">` is hardcoded.** When the user switches to Russian, the `lang` attribute remains "en". Screen readers will use English pronunciation rules for Russian text. -- CRITICAL.

### Recommendations
- Update `<html lang>` attribute dynamically when the user changes language.
- Add `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` to `.nav__label` and `.exercise-title`.
- Test all nav labels in Russian and German on 320px-wide screens.
- Consider longer `min-width` for nav items or shorter translation labels for German.

---

## Summary of Critical Issues

| # | Issue | Severity | WCAG Criterion |
|---|-------|----------|----------------|
| 1 | No ARIA landmarks, live regions, or roles throughout the app | Critical | 1.3.1, 4.1.2 |
| 2 | Visual Search exercise has no keyboard support | Critical | 2.1.1 |
| 3 | Exercise stimuli are purely visual with no text alternative | Critical | 1.1.1, 1.3.1 |
| 4 | `--text-muted` fails contrast in all themes (used pervasively) | Critical | 1.4.3 |
| 5 | `<html lang>` is hardcoded to "en" regardless of selected language | Critical | 3.1.1 |
| 6 | No focus management when screens change | High | 2.4.3 |
| 7 | No focus trap on modals/overlays | High | 2.4.3, 2.1.2 |
| 8 | Nav label font size is 10px | High | 1.4.4 |
| 9 | Several touch targets below 44px (modal close, toggle, chips, lang buttons) | High | 2.5.5 |
| 10 | Forest theme primary color fails contrast for normal text | High | 1.4.3 |
| 11 | Toast notifications not announced to screen readers | High | 4.1.3 |
| 12 | Text overflow risk in Russian/German nav labels | Medium | 1.4.4 |
| 13 | Toggle switches lack `role="switch"` and `aria-checked` | Medium | 4.1.2 |
| 14 | Breathing exercise unusable under reduced-motion | Medium | 2.3.3 |
| 15 | No error boundary for exercise crashes | Medium | 3.3.3 |

---

## What the App Does Well

1. **Reduced motion support** is thorough and uses the correct universal approach.
2. **Touch-action: manipulation** prevents accidental zoom on interactive elements.
3. **Focus-visible** is globally styled with a clear primary-colored outline.
4. **`.sr-only` class** exists (though it is not used in the JS code reviewed).
5. **16px base font** and `rem`-based sizing throughout.
6. **Input font size** prevents iOS auto-zoom.
7. **Safe area handling** is comprehensive for portrait mode.
8. **Buttons for nav** items (not links/divs) -- correct semantic choice.
9. **44px minimum touch targets** on most primary buttons and exercise controls.
10. **Full offline support** via service worker with appropriate caching strategy.

---

## Priority Remediation Roadmap

### Phase 1 (Critical -- do first)
- Add ARIA landmarks (`<main>`, `role="dialog"`, `aria-live` regions).
- Add keyboard support to Visual Search.
- Add screen reader alternatives for visual-only stimuli (Go/No-Go colors).
- Fix `<html lang>` to update dynamically.
- Increase `--text-muted` contrast across all themes.

### Phase 2 (High -- do next)
- Implement focus management (move focus on screen transitions).
- Add focus trap to modals and overlays.
- Increase nav label font size.
- Fix undersized touch targets.
- Fix Forest theme primary color contrast.
- Add `role="alert"` to toast component.

### Phase 3 (Medium -- improve)
- Add `role="switch"` and `aria-checked` to toggles.
- Add `text-overflow: ellipsis` to nav labels and exercise titles.
- Provide breathing exercise alternative for reduced-motion.
- Add error boundary.
- Test 200% zoom on 320px screen.
