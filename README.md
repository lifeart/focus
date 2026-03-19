# Focus -- Attention Training

Focus is a progressive web app (PWA) for cognitive training targeting attention, working memory, and inhibitory control. Designed for adolescents and young adults, it implements established neuropsychological paradigms -- Go/No-Go, N-Back, Flanker, and Visual Search -- in a gamified, mobile-first interface with adaptive difficulty and clinically relevant performance metrics.

## Features

### Cognitive Exercises

- **Go/No-Go** -- Inhibitory control training. Respond to "go" stimuli, withhold response on "no-go" stimuli. Tracks commission/omission errors and reaction time variability (IIV).
- **N-Back** -- Working memory training. Identify stimuli matching those presented N steps earlier. Includes lure trials for clinical depth. Reports d-prime, hits, misses, and false alarms.
- **Flanker** -- Attentional conflict resolution. Identify the direction of a central arrow while ignoring flanking distractors. Includes neutral trials. Measures congruent/incongruent RT and interference scores.
- **Visual Search** -- Visual attention and scanning efficiency. Locate a target among distractors on a grid. Tracks search time, items per second, and search slope.

### Wellness and Productivity

- **Breathing** -- Guided breathing exercises (box breathing 4-4-4, relaxation breathing 4-7-8) for pre-session calming and focus preparation.
- **Pomodoro** -- Configurable focus timer (15/20/25 minutes) with motivational quotes.

### Adaptive Difficulty

Each cognitive exercise supports 10 difficulty levels. The adaptive engine adjusts parameters (stimulus duration, inter-stimulus interval, no-go ratio, N-level, congruent ratio, grid size) based on recent performance, with micro-adjustments to keep users in their zone of proximal development.

### Clinical Metrics

The app captures metrics drawn from clinical neuropsychology:

- **Reaction time variability (IIV)** -- coefficient of variation in response times, a marker of attentional lapses
- **d-prime** -- signal detection sensitivity in N-Back, separating true memory from guessing
- **Commission and omission errors** -- false responses and missed targets in Go/No-Go
- **Interference score** -- RT cost of incongruent vs. congruent trials in Flanker
- **Lapse detection** -- identification of abnormally slow responses
- **Search slope** -- relationship between set size and search time in Visual Search

A baseline assessment mode allows tracking cognitive improvement over time.

### Gamification

- XP system with 30 levels and named titles
- 7 badge types (bronze, silver, gold tiers)
- Daily streaks and longest streak tracking
- Weekly challenges (perfect exercises, total sessions, focus time, zero-error runs)
- Personal records per exercise
- Random bonus events

### Personalization

- **Themes**: Dark, Light, Ocean, Sunset, Forest, AMOLED -- unlocked progressively as the user levels up
- **Languages**: English, Russian, German, French, Spanish (with automatic browser locale detection)
- **Mood tracking**: Pre- and post-session mood check-in (energized, calm, tired, stressed)
- Customizable daily goals (5, 10, or 15 minutes)
- Avatar system with level-gated unlocks

### PWA Support

- Service worker for offline access
- Installable on mobile home screens
- Web App Manifest with theme color and icons

## Getting Started

### Prerequisites

- Node.js (18+)

### Installation

```sh
npm install
```

### Development

```sh
npm run dev
```

Starts the development server with live rebuild via esbuild.

### Production Build

```sh
npm run build:prod
```

Outputs optimized, minified bundles to `public/js/bundle.js`.

### Tests

```sh
npm test
```

Runs the test suite with Vitest.

## Project Structure

```
public/
  index.html              -- App entry point
  manifest.json           -- PWA manifest
  sw.js                   -- Service worker
  css/                    -- Stylesheets (variables, base, components, layout, exercises, animations)
  js/
    main.ts               -- App initialization, routing, audio context
    router.ts             -- Hash-based SPA router
    types.ts              -- TypeScript type definitions
    constants.ts          -- Exercise configs, difficulty tables, badge definitions, XP tables
    core/
      state.ts            -- Centralized app state management
      storage.ts          -- LocalStorage persistence
      adaptive.ts         -- Adaptive difficulty engine
      progression.ts      -- XP, levels, badges, streaks, weekly challenges
      session.ts          -- Session orchestration
      sound.ts            -- Procedural audio feedback (Web Audio API)
      i18n.ts             -- Internationalization runtime
      disposables.ts      -- Resource cleanup (timeouts, intervals, listeners)
    exercises/
      go-no-go.ts         -- Go/No-Go exercise implementation
      n-back.ts           -- N-Back exercise implementation
      flanker.ts          -- Flanker exercise implementation
      visual-search.ts    -- Visual Search exercise implementation
      breathing.ts        -- Breathing exercise implementation
      pomodoro.ts         -- Pomodoro timer implementation
      helpers.ts          -- Shared exercise utilities
    i18n/
      en.ts, ru.ts,       -- Translation files
      de.ts, fr.ts, es.ts
      keys.ts             -- Translation key definitions
    ui/
      renderer.ts         -- DOM rendering utilities
      screens/            -- Screen components (dashboard, exercise-select, exercise-play, results, stats, settings, onboarding)
      components/         -- Reusable UI components (nav, avatar, badge-card, chart, progress-bar, streak-display, timer, weekly-recap)
```

## Clinical Background

The exercises in Focus are based on well-established neuropsychological paradigms commonly used in ADHD and executive function research:

- **Go/No-Go paradigm** -- Measures response inhibition, a core deficit in ADHD. Commission errors (false alarms to no-go stimuli) reflect inhibitory control failures, while omission errors and RT variability reflect sustained attention deficits.
- **N-Back task** -- Assesses working memory updating, one of the three core executive functions (Miyake et al., 2000). The inclusion of lure trials (stimuli matching at N+1 or N-1 positions) increases sensitivity to proactive interference.
- **Eriksen Flanker task** -- Measures attentional conflict monitoring and resolution. The interference effect (RT cost of incongruent flankers) reflects the efficiency of the anterior cingulate cortex in conflict detection.
- **Visual Search** -- Evaluates the efficiency of visual attention deployment. Search slope (the increase in RT per additional distractor) distinguishes between parallel (feature) and serial (conjunction) search strategies.

These paradigms are not diagnostic tools. Focus is a training application intended for cognitive exercise and self-improvement, not clinical assessment.

## Tech Stack

- **TypeScript** -- Strict typing throughout the codebase
- **esbuild** -- Fast bundling and minification
- **Vitest** -- Unit testing framework
- **Web Audio API** -- Procedural sound generation (no audio files)
- **PWA** -- Service worker, manifest, offline-first architecture
- **No frameworks** -- Vanilla TypeScript with a custom router, state manager, and component system

## License

TBD
