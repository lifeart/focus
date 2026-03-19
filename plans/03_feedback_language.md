# Feature: Feedback Language Improvements + Result Encouragement

## Summary

This plan covers five interconnected changes to improve the emotional tone of the Focus app: (1) softening negative onboarding feedback, (2) adding tiered encouragement messages on the results screen, (3) notifying users when the adaptive difficulty system changes their level, (4) reducing N-Back exercise duration from 5 minutes to 3 minutes, and (5) replacing the impossible "no errors" weekly challenge with a realistic "90%+ accuracy" goal. All text changes span all 5 supported languages (en, ru, de, fr, es).

## Motivation (adolescent psychology -- ADHD frustration management)

Adolescents with ADHD are especially sensitive to negative feedback, which can trigger frustration spirals and disengagement. Research on rejection sensitive dysphoria (RSD) in ADHD populations shows that even mild negative phrasing ("Don't press!", "Missed!") can feel punitive. Reframing feedback to be instructional rather than evaluative reduces emotional reactivity and improves task persistence. Additionally, showing encouragement at every score tier (not just high scores) reinforces a growth mindset, and explaining difficulty adjustments helps users feel the system is on their side rather than judging them.

## Changes

### 1. Onboarding Language Fixes

Three existing translation keys need updated values in all 5 language files.

**Key: `onboarding.shouldntPress`**
Current vs New:
- en: `"Don't press!"` -> `"Hold steady!"`
- ru: `"Не нужно!"` -> `"Держись!"`
- de: `"Nicht drücken!"` -> `"Ruhig bleiben!"`
- fr: `"Pas touche !"` -> `"Tiens bon !"`
- es: `"¡No toques!"` -> `"¡Mantente firme!"`

**Key: `onboarding.missed`**
Current vs New:
- en: `"Missed!"` -> `"That one got away — stay ready!"`
- ru: `"Пропуск!"` -> `"Ушло — будь наготове!"`
- de: `"Verpasst!"` -> `"Entwischt — bleib bereit!"`
- fr: `"Raté !"` -> `"Raté — reste concentré !"`
- es: `"¡Perdido!"` -> `"Se escapó — ¡mantente atento!"`

**Key: `onboarding.encourage.low`**
Current vs New:
- en: `"Not bad! It only gets better!"` -> `"Great first try! Your brain is already starting to learn."`
- ru: `"Неплохо! Будет только лучше!"` -> `"Отличная первая попытка! Твой мозг уже начинает учиться."`
- de: `"Nicht schlecht! Es wird besser!"` -> `"Toller erster Versuch! Dein Gehirn lernt schon."`
- fr: `"Pas mal ! Ça ne fera que s'améliorer !"` -> `"Super premier essai ! Ton cerveau apprend déjà."`
- es: `"¡Nada mal! ¡Solo puede mejorar!"` -> `"¡Gran primer intento! Tu cerebro ya está aprendiendo."`

**Files to modify:** `en.ts`, `ru.ts`, `de.ts`, `fr.ts`, `es.ts` (no changes to `keys.ts` -- keys already exist).

**No code changes needed** in `onboarding.ts` since it already references these keys via `t()`.

### 2. Results Screen Encouragement

Add a tiered encouragement message that appears below the score on the results screen for every score tier. Currently, the results screen shows the score + tier label (e.g., "72% -- Good Start") but no encouragement message.

#### 2a. New Translation Keys

Add 5 new keys to `TranslationTable` in `keys.ts`:
```
'results.encourage.warmup': string;
'results.encourage.goodStart': string;
'results.encourage.great': string;
'results.encourage.amazing': string;
'results.encourage.perfect': string;
```

Values per language:

**`results.encourage.warmup`** (0-59%):
- en: `"Every session makes your brain stronger. Keep going!"`
- ru: `"Каждая сессия делает мозг сильнее. Продолжай!"`
- de: `"Jede Sitzung macht dein Gehirn stärker. Weiter so!"`
- fr: `"Chaque session renforce ton cerveau. Continue !"`
- es: `"Cada sesión fortalece tu cerebro. ¡Sigue adelante!"`

**`results.encourage.goodStart`** (60-74%):
- en: `"You're building real skills. Nice work!"`
- ru: `"Ты развиваешь настоящие навыки. Отличная работа!"`
- de: `"Du baust echte Fähigkeiten auf. Gut gemacht!"`
- fr: `"Tu développes de vraies compétences. Bravo !"`
- es: `"Estás desarrollando habilidades reales. ¡Buen trabajo!"`

**`results.encourage.great`** (75-84%):
- en: `"Strong performance! Your focus is improving."`
- ru: `"Сильный результат! Твоя концентрация растёт."`
- de: `"Starke Leistung! Deine Konzentration verbessert sich."`
- fr: `"Belle performance ! Ta concentration s'améliore."`
- es: `"¡Gran rendimiento! Tu concentración está mejorando."`

**`results.encourage.amazing`** (85-94%):
- en: `"Incredible focus! You're in the zone."`
- ru: `"Невероятный фокус! Ты в потоке."`
- de: `"Unglaublicher Fokus! Du bist in der Zone."`
- fr: `"Concentration incroyable ! Tu es dans la zone."`
- es: `"¡Enfoque increíble! Estás en la zona."`

**`results.encourage.perfect`** (95-100%):
- en: `"Flawless! Peak performance."`
- ru: `"Безупречно! Пиковая производительность."`
- de: `"Makellos! Spitzenleistung."`
- fr: `"Impeccable ! Performance maximale."`
- es: `"¡Impecable! Rendimiento máximo."`

#### 2b. Code Changes in `results.ts`

In `/Users/lifeart/Repos/ivetta/focus/public/js/ui/screens/results.ts`, after the `scoreLabelEl` is set (around line 245), add a helper function that maps `tier.tier` (a `ScoreTier` type) to the corresponding translation key:

```typescript
function getEncouragementMessage(tier: ScoreTier): string {
  const keyMap: Record<ScoreTier, string> = {
    'warmup': 'results.encourage.warmup',
    'good-start': 'results.encourage.goodStart',
    'great': 'results.encourage.great',
    'amazing': 'results.encourage.amazing',
    'perfect': 'results.encourage.perfect',
  };
  return t(keyMap[tier] as any);
}
```

Then create a new element after `scoreSection`:
```typescript
const encourageEl = el('div', { className: 'results-encouragement' }, [
  getEncouragementMessage(tier.tier),
]);
```

Insert `encourageEl` in the assembly section (after `scoreSection`, before `metricsSection`).

Add CSS class `.results-encouragement` in `layout.css` with styling: centered text, `var(--text-secondary)` color, `var(--text-base)` font size, some vertical margin.

### 3. Difficulty Adjustment Notification

Currently, `updateDifficulty()` in `adaptive.ts` silently changes the level. Users have no idea the difficulty was adjusted.

#### 3a. New Translation Keys

Add 2 new keys to `TranslationTable` in `keys.ts`:
```
'difficulty.levelDown': string;
'difficulty.levelUp': string;
```

Values:

**`difficulty.levelDown`**:
- en: `"We adjusted the difficulty to match your pace"`
- ru: `"Мы подстроили сложность под твой темп"`
- de: `"Wir haben die Schwierigkeit an dein Tempo angepasst"`
- fr: `"Nous avons ajusté la difficulté à ton rythme"`
- es: `"Ajustamos la dificultad a tu ritmo"`

**`difficulty.levelUp`**:
- en: `"Challenge increased! You're ready for the next level"`
- ru: `"Сложность повышена! Ты готов к следующему уровню"`
- de: `"Herausforderung erhöht! Du bist bereit für die nächste Stufe"`
- fr: `"Défi augmenté ! Tu es prêt pour le niveau suivant"`
- es: `"¡Desafío aumentado! Estás listo para el siguiente nivel"`

#### 3b. Modify `updateDifficulty` Return Type

In `/Users/lifeart/Repos/ivetta/focus/public/js/core/adaptive.ts`, extend the return of `updateDifficulty` to include a `levelChanged` direction indicator. Two approaches:

**Option A (preferred -- minimal change):** Add a `levelChange` field to `DifficultyState`:
```typescript
export interface DifficultyState {
  // existing fields...
  lastLevelChange?: 'up' | 'down'; // populated when level changes, cleared on next call with no change
}
```

In `updateDifficulty`, set `lastLevelChange` when `newLevel !== state.currentLevel`:
- If `newLevel > state.currentLevel`: `lastLevelChange = 'up'`
- If `newLevel < state.currentLevel`: `lastLevelChange = 'down'`
- Otherwise: `lastLevelChange = undefined`

#### 3c. Store Pending Notification

In `exercise-play.ts`, after calling `updateDifficulty()` (lines 161 and 409), check if `lastLevelChange` is set. If so, store a flag in `sessionStorage` (e.g., `focus:difficulty_change = 'up' | 'down'`).

#### 3d. Show Toast on Next Session Start

Create a lightweight toast component at `/Users/lifeart/Repos/ivetta/focus/public/js/ui/components/toast.ts`:
- Renders an absolutely/fixedly positioned banner at the top of the screen
- Auto-dismisses after 3 seconds with a fade-out animation
- Takes a message string

In `exercise-play.ts`, at the beginning of `startExercise()`, check `sessionStorage` for the difficulty change flag. If present, show the toast with the appropriate `t('difficulty.levelDown')` or `t('difficulty.levelUp')` message, then remove the flag.

Add `.toast` CSS styles in `layout.css` (similar to existing `.bonus-banner` or `.record-banner` styles).

### 4. N-Back Duration Fix

#### 4a. In `n-back.ts`

Change line 7 from:
```typescript
const DURATION_MS = 300_000; // 5 minutes
```
to:
```typescript
const DURATION_MS = 180_000; // 3 minutes
```

#### 4b. In `constants.ts`

Change `EXERCISE_CONFIGS['n-back'].durationSeconds` from `90` to `180`. 

**Wait -- discrepancy detected.** The `EXERCISE_CONFIGS` in `constants.ts` line 44 says `durationSeconds: 90` for n-back, but the actual `DURATION_MS` in `n-back.ts` is `300_000` (300 seconds / 5 minutes). These are out of sync. The `durationSeconds` in `EXERCISE_CONFIGS` is likely used for session plan time estimates (see `play.planInfo` template). The actual timer logic uses `DURATION_MS` from `n-back.ts`.

**Action:** Change `DURATION_MS` in `n-back.ts` to `180_000` (3 minutes). Also update `EXERCISE_CONFIGS['n-back'].durationSeconds` to `180` so the session plan displays the correct estimate.

### 5. Remove/Soften "No Errors" Challenge

#### 5a. Translation Key Changes

Modify existing key `challenge.noErrors` in all 5 language files:

- en: `"Complete 5 exercises without a single error"` -> `"Complete 5 exercises with 90%+ accuracy"`
- ru: `"Пройдите 5 упражнений без единой ошибки"` -> `"Пройдите 5 упражнений с точностью 90%+"`
- de: `"Schließe 5 Übungen ohne Fehler ab"` -> `"Schließe 5 Übungen mit 90%+ Genauigkeit ab"`
- fr: `"Réalisez 5 exercices sans aucune erreur"` -> `"Réalisez 5 exercices avec 90%+ de précision"`
- es: `"Completa 5 ejercicios sin ningún error"` -> `"Completa 5 ejercicios con 90%+ de precisión"`

#### 5b. Update Challenge Logic

In `constants.ts`, update `WEEKLY_CHALLENGE_TYPES` for the `no-errors` entry. Change description to use the translation system (the description field in `WEEKLY_CHALLENGE_TYPES` is currently hardcoded Russian, but it is overridden by the dashboard which uses the translation key). No change needed there since the dashboard already maps type to key.

The actual challenge progress tracking must be found and updated. The challenge type is `'no-errors'` and its `target` is `5`. The condition needs to change from "score === 100" to "score >= 90". Search for where challenge progress is incremented.

Looking at `dashboard.ts` line 233, the dashboard only displays the challenge. The progress tracking likely happens in `exercise-play.ts` or a progression helper. Let me check.
