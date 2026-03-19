export interface TranslationTable {
  // HTML
  'app.title': string;

  // Nav
  'nav.home': string;
  'nav.exercises': string;
  'nav.stats': string;
  'nav.settings': string;

  // Mood
  'mood.energized': string;
  'mood.calm': string;
  'mood.tired': string;
  'mood.stressed': string;

  // Exercise names
  'exercise.go-no-go.name': string;
  'exercise.go-no-go.description': string;
  'exercise.n-back.name': string;
  'exercise.n-back.description': string;
  'exercise.flanker.name': string;
  'exercise.flanker.description': string;
  'exercise.visual-search.name': string;
  'exercise.visual-search.description': string;
  'exercise.breathing.name': string;
  'exercise.breathing.description': string;
  'exercise.pomodoro.name': string;
  'exercise.pomodoro.description': string;

  // Categories
  'category.cognitive': string;
  'category.relaxation': string;
  'category.productivity': string;

  // Score tiers
  'scoreTier.warmup': string;
  'scoreTier.goodStart': string;
  'scoreTier.great': string;
  'scoreTier.amazing': string;
  'scoreTier.perfect': string;

  // Level titles (1-30)
  'level.1': string; 'level.2': string; 'level.3': string; 'level.4': string;
  'level.5': string; 'level.6': string; 'level.7': string; 'level.8': string;
  'level.9': string; 'level.10': string; 'level.11': string; 'level.12': string;
  'level.13': string; 'level.14': string; 'level.15': string; 'level.16': string;
  'level.17': string; 'level.18': string; 'level.19': string; 'level.20': string;
  'level.21': string; 'level.22': string; 'level.23': string; 'level.24': string;
  'level.25': string; 'level.26': string; 'level.27': string; 'level.28': string;
  'level.29': string; 'level.30': string;

  // Badge names and descriptions
  'badge.sessions.name': string;
  'badge.sessions.bronze': string;
  'badge.sessions.silver': string;
  'badge.sessions.gold': string;
  'badge.weekly-goal.name': string;
  'badge.weekly-goal.bronze': string;
  'badge.weekly-goal.silver': string;
  'badge.weekly-goal.gold': string;
  'badge.go-no-go-accuracy.name': string;
  'badge.go-no-go-accuracy.bronze': string;
  'badge.go-no-go-accuracy.silver': string;
  'badge.go-no-go-accuracy.gold': string;
  'badge.n-back-level.name': string;
  'badge.n-back-level.bronze': string;
  'badge.n-back-level.silver': string;
  'badge.n-back-level.gold': string;
  'badge.focus-time.name': string;
  'badge.focus-time.bronze': string;
  'badge.focus-time.silver': string;
  'badge.focus-time.gold': string;
  'badge.breathing-sessions.name': string;
  'badge.breathing-sessions.bronze': string;
  'badge.breathing-sessions.silver': string;
  'badge.breathing-sessions.gold': string;
  'badge.personal-record.name': string;
  'badge.personal-record.bronze': string;
  'badge.personal-record.silver': string;
  'badge.personal-record.gold': string;

  // Badge tiers
  'badgeTier.bronze': string;
  'badgeTier.silver': string;
  'badgeTier.gold': string;

  // Breathing patterns
  'breathing.pattern.444': string;
  'breathing.pattern.478': string;
  'breathing.inhale': string;
  'breathing.hold': string;
  'breathing.exhale': string;
  'breathing.cycle': string;

  // Pomodoro
  'pomodoro.focus': string;
  'pomodoro.break': string;
  'pomodoro.done': string;
  'pomodoro.pauseBtn': string;
  'pomodoro.continueBtn': string;
  'pomodoro.resetBtn': string;
  'pomodoro.notification.break': string;
  'pomodoro.notification.breakOver': string;

  // Pomodoro quotes (use array index)
  'quote.0': string; 'quote.1': string; 'quote.2': string; 'quote.3': string;
  'quote.4': string; 'quote.5': string; 'quote.6': string; 'quote.7': string;
  'quote.8': string; 'quote.9': string; 'quote.10': string; 'quote.11': string;
  'quote.12': string;

  // Weekly challenges
  'challenge.perfectExercises': string;
  'challenge.totalSessions': string;
  'challenge.focusTime': string;
  'challenge.noErrors': string;

  // Dashboard
  'dashboard.greeting': string;
  'dashboard.defaultName': string;
  'dashboard.levelLabel': string;
  'dashboard.xp': string;
  'dashboard.weeklyGoal': string;
  'dashboard.today': string;
  'dashboard.todayProgress': string;
  'dashboard.weeklyChallenge': string;
  'dashboard.challengeComplete': string;
  'dashboard.startTraining': string;
  'dashboard.recentResults': string;
  'dashboard.emptyBadge': string;
  'dashboard.emptyHint': string;
  'dashboard.moodQuestion': string;

  // Time ago
  'time.justNow': string;
  'time.minAgo': string;
  'time.hoursAgo': string;
  'time.yesterday': string;
  'time.daysAgo': string;
  'time.weeksAgo': string;

  // Onboarding
  'onboarding.subtitle': string;
  'onboarding.letsGo': string;
  'onboarding.miniTest': string;
  'onboarding.tapCircles': string;
  'onboarding.pressSpace': string;
  'onboarding.start': string;
  'onboarding.correct': string;
  'onboarding.shouldntPress': string;
  'onboarding.missed': string;
  'onboarding.result': string;
  'onboarding.correctCount': string;
  'onboarding.encourage.high': string;
  'onboarding.encourage.mid': string;
  'onboarding.encourage.low': string;
  'onboarding.next': string;
  'onboarding.whatsYourName': string;
  'onboarding.namePlaceholder': string;
  'onboarding.chooseColor': string;
  'onboarding.howManyMinutes': string;
  'onboarding.startBtn': string;
  'onboarding.goal.easy': string;
  'onboarding.goal.optimal': string;
  'onboarding.goal.advanced': string;

  // Results
  'results.noData': string;
  'results.parseError': string;
  'results.bonusBanner': string;
  'results.levelLabel': string;
  'results.newRecord': string;
  'results.moodNow': string;
  'results.moodImproved': string;
  'results.moodStable': string;
  'results.moodPositive': string;
  'results.moodKeepGoing': string;
  'results.moodThanks': string;
  'results.playAgain': string;
  'results.toExercises': string;
  'results.toHome': string;

  // Metrics
  'metric.accuracy': string;
  'metric.commissionErrors': string;
  'metric.omissions': string;
  'metric.avgRT': string;
  'metric.rtVariability': string;
  'metric.hits': string;
  'metric.falseAlarms': string;
  'metric.dPrime': string;
  'metric.rtCongruent': string;
  'metric.rtIncongruent': string;
  'metric.interference': string;
  'metric.searchTime': string;
  'metric.itemsPerSec': string;
  'metric.completedCycles': string;
  'metric.duration': string;
  'metric.completion': string;
  'metric.ms': string;
  'metric.sec': string;

  // Exercise select
  'exerciseSelect.title': string;
  'exerciseSelect.noResults': string;
  'exerciseSelect.level': string;

  // Stats
  'stats.title': string;
  'stats.empty': string;
  'stats.sessions': string;
  'stats.focusTime': string;
  'stats.awards': string;
  'stats.results30d': string;
  'stats.activity': string;
  'stats.exercises': string;
  'stats.badges': string;
  'stats.weeklyRecap': string;
  'stats.min': string;

  // Settings
  'settings.title': string;
  'settings.profile': string;
  'settings.name': string;
  'settings.namePlaceholder': string;
  'settings.dailyGoal': string;
  'settings.sound': string;
  'settings.soundOn': string;
  'settings.soundOff': string;
  'settings.theme': string;
  'settings.breathingPattern': string;
  'settings.pomodoroDuration': string;
  'settings.language': string;
  'settings.data': string;
  'settings.exportData': string;
  'settings.importData': string;
  'settings.resetProgress': string;
  'settings.resetConfirm': string;
  'settings.cancel': string;
  'settings.resetBtn': string;
  'settings.levelRequired': string;

  // Theme names
  'theme.dark': string;
  'theme.light': string;
  'theme.ocean': string;
  'theme.sunset': string;
  'theme.forest': string;
  'theme.amoled': string;

  // Exercise play
  'play.exit': string;
  'play.pause': string;
  'play.pauseTitle': string;
  'play.continue': string;
  'play.finish': string;
  'play.finishSession': string;
  'play.notFound': string;
  'play.returnToList': string;
  'play.toExercises': string;
  'play.sessionPlan': string;
  'play.planInfo': string;
  'play.startBtn': string;
  'play.cancelBtn': string;
  'play.exerciseOf': string;
  'play.nextExercise': string;

  // Trial counter
  'trial.counter': string;

  // N-Back
  'nback.matchBtn': string;

  // Visual search
  'visualSearch.noTarget': string;

  // Countdown
  'countdown.go': string;

  // Streak
  'streak.daysOf': string;
  'streak.bestStreak': string;

  // Calendar months
  'month.0': string; 'month.1': string; 'month.2': string; 'month.3': string;
  'month.4': string; 'month.5': string; 'month.6': string; 'month.7': string;
  'month.8': string; 'month.9': string; 'month.10': string; 'month.11': string;

  // Day abbreviations
  'day.mon': string; 'day.tue': string; 'day.wed': string; 'day.thu': string;
  'day.fri': string; 'day.sat': string; 'day.sun': string;

  // Plurals (pipe-separated forms)
  'plural.day': string;
  'plural.hour': string;
  'plural.minute': string;
  'plural.session': string;
  'plural.week': string;

  // Weekly recap
  'recap.title': string;
  'recap.daysTrained': string;
  'recap.sessions': string;
  'recap.bestResult': string;
  'recap.weeklyXP': string;
  'recap.download': string;
  'recap.copy': string;
  'recap.copied': string;

  // Language names (shown in language selector)
  'lang.ru': string;
  'lang.en': string;
  'lang.de': string;
  'lang.fr': string;
  'lang.es': string;
}

export type TranslationKey = keyof TranslationTable;
