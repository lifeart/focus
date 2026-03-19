import type { SoundManager } from './types.js';
import { createAppState } from './core/state.js';
import { createSoundManager } from './core/sound.js';
import { createRouter } from './router.js';
import { renderNav, updateNavActive } from './ui/components/nav.js';
import { initI18n, detectLocale } from './core/i18n.js';

// Screens
import { renderDashboard } from './ui/screens/dashboard.js';
import { renderExerciseSelect } from './ui/screens/exercise-select.js';
import { renderExercisePlay } from './ui/screens/exercise-play.js';
import { renderResults } from './ui/screens/results.js';
import { renderStats } from './ui/screens/stats.js';
import { renderSettings } from './ui/screens/settings.js';
import { renderOnboarding } from './ui/screens/onboarding.js';

// ─── App State ──────────────────────────────────────────────────────

export const appState = createAppState();

// ─── Sound Manager (lazy AudioContext) ──────────────────────────────

let audioContext: AudioContext | null = null;
let _soundManager: SoundManager | null = null;

function ensureAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

export function getSoundManager(): SoundManager {
  if (!_soundManager) {
    _soundManager = createSoundManager(ensureAudioContext());
    _soundManager.setEnabled(appState.getData().settings.soundEnabled);
  }
  return _soundManager;
}

// ─── Router ─────────────────────────────────────────────────────────

const router = createRouter();

// Register routes
router.register('/', renderDashboard);
router.register('/dashboard', renderDashboard);
router.register('/exercises', renderExerciseSelect);
router.register('/play/:exerciseId', renderExercisePlay);
router.register('/session', renderExercisePlay);
router.register('/results', renderResults);
router.register('/stats', renderStats);
router.register('/settings', renderSettings);
router.register('/onboarding', renderOnboarding);

// ─── Initialize ─────────────────────────────────────────────────────

function init(): void {
  appState.init();

  // Initialize i18n
  const data = appState.getData();

  // If first launch (not onboarded), detect browser locale
  if (!data.onboardingComplete && !data.settings.locale) {
    const detectedLocale = detectLocale();
    appState.updateData((d) => {
      d.settings.locale = detectedLocale;
    });
    appState.flush();
    initI18n(detectedLocale);
  } else {
    initI18n(data.settings.locale || 'en');
  }

  const appEl = document.getElementById('app');
  if (!appEl) {
    console.error('[main] #app element not found');
    return;
  }

  // Render nav at bottom of #app
  const navContainer = document.createElement('div');
  navContainer.id = 'nav-container';
  appEl.appendChild(navContainer);

  let cleanupNav: (() => void) | null = null;

  function refreshNav(): void {
    if (cleanupNav) cleanupNav();
    cleanupNav = renderNav(navContainer, router.getCurrentPath(), (path) => {
      router.navigate(path);
    });
  }

  // Update nav on hash change, hide on exercise/onboarding screens
  function updateNavVisibility(): void {
    const path = router.getCurrentPath();
    const hideNav = path.startsWith('/play') || path.startsWith('/onboarding') || path.startsWith('/session');
    navContainer.style.display = hideNav ? 'none' : '';
  }

  window.addEventListener('hashchange', () => {
    updateNavActive(navContainer, router.getCurrentPath());
    updateNavVisibility();
  });

  // Lazy-init AudioContext on first user interaction
  const initAudio = (): void => {
    ensureAudioContext();
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume();
    }
    document.removeEventListener('click', initAudio);
    document.removeEventListener('touchstart', initAudio);
    document.removeEventListener('keydown', initAudio);
  };
  document.addEventListener('click', initAudio);
  document.addEventListener('touchstart', initAudio);
  document.addEventListener('keydown', initAudio);

  // Determine initial route
  const currentData = appState.getData();
  const hasHash = window.location.hash && window.location.hash !== '#';

  if (!hasHash) {
    if (!currentData.onboardingComplete) {
      router.navigate('/onboarding');
    } else {
      router.navigate('/dashboard');
    }
  }

  // Start router (will render current hash)
  router.start();

  // Initial nav render
  refreshNav();
  updateNavVisibility();
}

// Boot
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { router };
