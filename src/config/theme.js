// Токены оформления интерфейса (меню, субтитры, HUD, выборы, финальные экраны).
// Стиль — «детская книжка про болезнь»: бумага, карандаш и чернила вместо плоских плашек.
// Шрифты: Kurale — заголовки, имена и кнопки (тёплая книжная антиква), Literata — текст реплик и подписи,
// Neucha — записки «от руки» (HUD, табло, дневник), Caveat — рукописные буквы внутри мира игры.
// Все — SIL Open Font License, пакеты @fontsource. Движение — мягкая кривая EASE, при prefers-reduced-motion
// остаётся только прозрачность. Холст игры 1920×1080, поэтому размеры ниже — в пикселях холста.

// Тёмные фоны — только из списка правил.
export const BG = {
  black: 0x000000, warm: 0x131209, s1: 0x181818, s2: 0x1f1f1f, s3: 0x272727, s4: 0x313131,
};

export const COLORS = {
  ink: BG.warm,         // панели и плашки
  night: BG.s1,
  deep: BG.s2,
  slate: BG.s3,
  slateHi: BG.s4,
  line: BG.s4,          // рамки (всегда со всех сторон)
  fog: 0xa9a4b8,     // приглушённый текст на тёмно-синем картоне
  paper: 0xf3ebdd,
  accent: 0xf2a65a,     // тёплый акцент: главная кнопка
  accentHi: 0xf7bd7f,
  accentInk: BG.warm,
  ember: 0xd9603b,
  win: 0x7cc47f,
  loss: 0xe0574f,
  thread: 0xdfe8f2,     // серебряная нить
  dotIdle: BG.s4,
  focus: 0xffe2b8,
};

// Бумага и чернила (светлые листки поверх сцены).
export const PAPER = {
  cream: 0xf3e8d2, light: 0xf8f1e2, shade: 0xe2d2b0, note: 0xf6e9b8, kraft: 0xc9a574,
  amber: 0xeaa45b, amberHi: 0xf4bd7c, night: 0x1b2340, nightHi: 0x26315a, nightLine: 0xe9d9b8,
};
export const INK = {
  ink: '#2b2530', soft: '#5a4f57', faded: '#8b7d74', red: '#b3412c', blue: '#2e5a8c', green: '#3c7a45',
  amber: '#b8681f', violet: '#5e3b78', pencil: '#6f665f',
};
export const INKN = {
  ink: 0x2b2530, soft: 0x5a4f57, faded: 0x8b7d74, red: 0xb3412c, blue: 0x2e5a8c, green: 0x3c7a45,
  amber: 0xb8681f, violet: 0x5e3b78, pencil: 0x6f665f,
};

export const CSS = {
  paper: '#F3EBDD',
  fog: '#A9A4B8',
  fogHi: '#D3CCC4',
  accent: '#F2A65A',
  accentInk: '#131209',
  ink: '#131209',
  win: '#7CC47F',
  loss: '#E0574F',
  chalk: '#F1EEE6',
  chalkWarm: '#F0A56A',
};

// Четыре семейства: ui — текст и подписи, display — заголовки и кнопки, note — записки от руки,
// hand — «рукописные» буквы на бумаге внутри мира игры (виселица, тетрадное поле, этикетка банки с вареньем).
export const FONT = {
  ui: 'Literata, Georgia, "Times New Roman", serif',
  display: 'Kurale, Literata, Georgia, serif',
  note: 'Neucha, Caveat, "Comic Sans MS", cursive',
  hand: 'Caveat, Neucha, cursive',
};

// Именованные стили текста (kebab case, как в правилах). [размер, высота строки, насыщенность].
// heading-1…6, title-1…5, body-1…6, button-*, caption-1…5 — как в таблице правил.
// Для экрана 1920 px добавлены следующие номера групп на крупных шагах шкалы.
export const TEXT = {
  'heading-1': [60, 60, 600], 'heading-2': [48, 48, 600], 'heading-3': [36, 40, 600],
  'heading-4': [30, 36, 600], 'heading-5': [24, 32, 600], 'heading-6': [20, 28, 600],
  'heading-7': [96, 96, 600], // название игры в меню (text-8xl)
  'heading-8': [72, 72, 600], // титр дня, итог финала (text-7xl)
  'title-1': [20, 28, 500], 'title-2': [18, 28, 500], 'title-3': [16, 24, 500], 'title-4': [14, 20, 500], 'title-5': [12, 16, 500],
  'title-6': [30, 36, 500], 'title-7': [24, 32, 500], 'title-8': [36, 40, 500],
  'body-1': [16, 24, 600], 'body-2': [16, 24, 500], 'body-3': [16, 24, 400],
  'body-4': [14, 20, 600], 'body-5': [14, 20, 500], 'body-6': [14, 20, 400],
  'body-7': [36, 40, 600], // текст субтитров
  'body-8': [30, 36, 500], // абзацы: финал, дневник
  'body-9': [24, 32, 500], // вторичный текст
  'button-lg': [18, 28, 600], 'button-md': [16, 24, 600], 'button-sm': [14, 20, 600], 'button-xsm': [12, 16, 600],
  'button-xl': [24, 32, 600], 'button-2xl': [30, 36, 600],
  'caption-1': [14, 20, 500], 'caption-2': [14, 20, 400], 'caption-3': [12, 16, 600], 'caption-4': [12, 16, 500], 'caption-5': [12, 16, 400],
  'caption-6': [20, 28, 500], 'caption-7': [18, 28, 400],
  // записки от руки (Neucha)
  'hand-1': [20, 24, 400], 'hand-2': [24, 28, 400], 'hand-3': [28, 32, 400], 'hand-4': [34, 40, 400], 'hand-5': [44, 48, 400],
};

// Семейство по группе стиля: заголовки и кнопки — Kurale, записки — Neucha, остальное — Literata.
// METRIC — естественная высота строки шрифта в Phaser (× размер); поправка lineSpacing подгоняет её к шагу.
const METRIC = { ui: 1.37, display: 1.3, note: 1.2 };
const familyOf = (name) => (name.startsWith('heading') || name.startsWith('button') ? 'display' : name.startsWith('hand') ? 'note' : 'ui');

export function text(name, extra = {}) {
  const s = TEXT[name] || TEXT['body-9'];
  const [size, lh, weight] = s;
  const fam = familyOf(name);
  return {
    fontFamily: FONT[fam], fontSize: `${size}px`, fontStyle: fam === 'ui' ? String(weight) : 'normal', color: CSS.paper,
    lineSpacing: Math.round(lh - size * METRIC[fam]), ...extra,
  };
}

export const fontSizeOf = (name) => (TEXT[name] || TEXT['body-9'])[0];

// Отступы — только эти значения.
export const SPACE = [0, 2, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96];
export const S = {
  0: 0, 25: 2, 50: 4, 75: 8, 100: 12, 200: 16, 300: 24, 400: 32, 500: 40, 600: 48, 700: 64, 800: 80, 900: 96,
};

// Радиусы Tailwind: rounded 4, md 6, lg 8, xl 12, 2xl 16, 3xl 24.
export const RADIUS = { sm: 4, md: 6, lg: 8, xl: 12, xxl: 16, xxxl: 24 };
// Вложенная форма при зазоре < 32: внутренний радиус = внешний − зазор (если > 2).
export const nestedRadius = (outer, gap) => (gap < 32 ? (outer - gap > 2 ? outer - gap : 0) : outer);

// Кривая движения cubic-bezier(0.22, 1, 0.36, 1).
export function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1; const bx = 3 * (x2 - x1) - cx; const ax = 1 - cx - bx;
  const cy = 3 * y1; const by = 3 * (y2 - y1) - cy; const ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0; if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) { const e = sx(t) - x; const d = dx(t); if (Math.abs(e) < 1e-5 || Math.abs(d) < 1e-6) break; t -= e / d; }
    t = Math.min(1, Math.max(0, t));
    return sy(t);
  };
}
export const EASE = cubicBezier(0.22, 1, 0.36, 1);
export const MOTION = { base: 500, fade: 300, fadeMin: 200 };

// Заголовок на тёмном фоне: тёплый «свечной» градиент сверху вниз и мягкая тень (как тиснение на обложке).
export function heroGradient(t) {
  try {
    const h = Math.max(1, t.height);
    const g = t.context.createLinearGradient(0, h * 0.15, 0, h * 0.9);
    g.addColorStop(0, '#FFF6E4'); g.addColorStop(0.55, '#F7DDB0'); g.addColorStop(1, '#E9AE6A');
    t.setFill(g);
    t.setShadow(0, 3, 'rgba(10,6,20,0.65)', 10, false, true);
  } catch { /* без градиента */ }
  return t;
}

export const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
