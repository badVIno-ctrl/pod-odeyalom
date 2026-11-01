// Общие константы игры.
export const GAME_TITLE = 'Под одеялом';
export const GAME_SUBTITLE = 'пять дней жара';

export const WIDTH = 1920;
export const HEIGHT = 1080;

export const TOTAL_DAYS = 5;
export const WINS_TO_RECOVER = 3;
export const LOSSES_TO_HOSPITAL = 3;

export const TEMP_START = 38.7;
export const TEMP_WIN_DELTA = -0.7;
export const TEMP_LOSS_DELTA = 0.5;

// Спрайт мальчика в кровати по температуре (границы включительно).
export const BOY_STATES = [
  { max: 37.5, key: 'boy_bed_healthy' },
  { max: 38.9, key: 'boy_bed_sick' },
  { max: 39.7, key: 'boy_bed_very_sick' },
  { max: Infinity, key: 'boy_bed_critical' },
];

// Субтитр без звука висит (base + perChar × длина текста) мс.
export const SUBTITLE_FALLBACK = { base: 1500, perChar: 55 };

// Паук «думает» перед ходом.
export const SPIDER_THINK_MS = { min: 500, max: 900 };

// Реплики паука во время партии: шанс после хода мальчика и минимальный интервал в ходах.
export const QUIP = { chance: 0.25, minMovesBetween: 3 };

// color — на тёмном фоне, ink — «чернила» имени на бумажном листке субтитров.
export const SPEAKERS = {
  'Мама': { color: '#F2B98A', ink: '#9a3b45' },
  'Мальчик': { color: '#A9CCF2', ink: '#2e5a8c' },
  'Паук': { color: '#E58A4E', ink: '#a04a18' },
  'Врач': { color: '#9FD3C7', ink: '#2f6b5a' },
  'Фельдшер': { color: '#8FB4FF', ink: '#3b4f8f' },
  // тайная глава «Аня»: тридцать зим назад
  'Аня': { color: '#F4A9C4', ink: '#a3416b' },
  'Мама Ани': { color: '#D8C39A', ink: '#7a5a2a' },
};

export const isDebug = () => new URLSearchParams(window.location.search).get('debug') === '1';

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
