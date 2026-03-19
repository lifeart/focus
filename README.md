# Focus

A brain training app for teens. Four cognitive exercises based on real neuropsychology, wrapped in a gamified PWA that works offline.

Built with zero frameworks — just TypeScript, CSS, and the Web Audio API.

## What it does

**Four cognitive exercises**, each targeting a specific executive function:

| Exercise | What it trains | Key metric |
|---|---|---|
| **Go/No-Go** | Impulse control | Commission errors, RT variability |
| **N-Back** | Working memory | d-prime (signal detection) |
| **Flanker** | Selective attention | Interference score |
| **Visual Search** | Visual scanning | Search slope (ms/item) |

Plus **breathing exercises** (box 4-4-4, relaxation 4-7-8) and a **Pomodoro timer**.

Each exercise adapts across 10 difficulty levels based on your recent scores. The difficulty engine uses tighter thresholds than typical apps (75/65 instead of 80/60) to keep you in the optimal learning zone.

## What makes it clinical

This isn't a casual brain game. The metrics come from actual neuropsychological assessment:

- **IIV** (intra-individual variability) — RT consistency is the strongest marker of attention problems in teens
- **Lapse detection** — flags responses >3 SD above your mean RT (momentary attention lapses)
- **Lure trials** in N-Back — items that match at N+1 or N-1, not N. Catches familiarity-based false alarms
- **Neutral trials** in Flanker — separates facilitation (congruent faster than neutral) from inhibition cost (incongruent slower than neutral)
- **Search slope** — linear regression of RT vs set size. Steeper = less efficient visual processing
- **Baseline assessment** — fixed Level 1 test every 20 sessions to measure real improvement vs practice effects

All scored per-exercise, not averaged into a meaningless composite number.

## What keeps teens coming back

The engagement system is designed around ADHD-specific reward sensitivity:

- **Streak system** with freeze protection — earn 1 freeze per 7-day streak (max 3). Miss a day, freeze auto-activates. Soft "keep your streak" messaging instead of punishing "streak lost" anxiety
- **Daily challenges** — 12 types, deterministic per day (same for all users), with difficulty guards so new users don't get impossible challenges
- **Quick / Standard / Deep sessions** — 1-minute quick session goes straight to your weakest exercise, no mood modal, no plan screen. Removes the activation barrier
- **Level-up celebrations** with sound, haptics, confetti, and unlock announcements
- **Badge ceremonies** — 7 badges x 3 tiers, shown as full-screen overlays with share button
- **Daily login bonus** — 10 XP just for opening the app
- **30 levels** with named titles (Newcomer through Absolute), theme unlocks at 5/10/15/20

The feedback language is ADHD-friendly throughout: "Hold steady!" instead of "Don't press!", tiered encouragement at every score level, and the app tells you when difficulty adjusts ("We matched the difficulty to your pace").

## Languages

English, Russian, German, French, Spanish. Auto-detects browser language. Switch anytime (reloads the app). All 390+ translation keys verified for parity across all 5 languages.

## Tech

| | |
|---|---|
| Language | TypeScript (strict) |
| Bundler | esbuild |
| Tests | Vitest — 270 tests across 13 files |
| Audio | Web Audio API (procedural, no files) |
| Fonts | Self-hosted Inter + Space Grotesk (no Google Fonts CDN) |
| State | Custom reactive store with localStorage persistence and cross-tab sync |
| Router | Hash-based SPA router with param extraction |
| PWA | Service worker, manifest, offline-first, installable |
| Frameworks | None |

Bundle: ~380kb JS, ~70kb CSS. Zero external requests.

## Run it

```sh
npm install
npm run dev        # dev server with live rebuild
npm test           # 270 tests
npm run build      # production build to dist/
```

Requires Node 18+.

## Project layout

```
public/
  js/
    core/           # state, storage, adaptive difficulty, progression, streaks, i18n
    exercises/      # go-no-go, n-back, flanker, visual-search, breathing, pomodoro
    ui/screens/     # dashboard, exercise-play, results, stats, settings, onboarding
    ui/components/  # nav, avatar, charts, streak-display, celebrations, confetti
    i18n/           # en, ru, de, fr, es translation files
  css/              # design tokens, components, layout, exercises, animations, fonts
tests/              # 13 test files covering all core logic
plans/              # feature plans and domain expert reviews
```

## Clinical disclaimer

The exercises are based on validated paradigms (Go/No-Go, N-Back, Eriksen Flanker, Visual Search) from the ADHD and executive function literature. This app is for cognitive training and self-improvement — not clinical diagnosis. It does not replace professional assessment.

## License

TBD
