// Рисунки мальчика: восковые мелки на тетрадном листе в клетку. Каждую ночь (кроме последней) он рисует,
// что было днём; рисунок прикалывают на стену рядом с маминым — к концу забега там целая выставка.
// Рисунок задаётся маленькой «спецификацией» { kind, day, game, result, wins, losses, seed } — по ней
// он всегда рисуется одинаково (альбом в меню хранит только спецификации).
// Рисование идёт штрих за штрихом: paintDrawing(ctx, spec, k) — k от 0 до 1 — сколько уже нарисовано.
import { rng } from './paint.js';
import { FONT } from '../config/theme.js';
import { tr } from '../i18n/index.js';

export const DRAW_W = 640; export const DRAW_H = 500;
const C = {
  red: '#d8402c', orange: '#f08a24', yellow: '#f2c230', green: '#3f9a46', blue: '#2f62c4', sky: '#6aa6e8',
  black: '#2a2522', brown: '#8a5a32', gray: '#8f97a6', pink: '#e98aa0', purple: '#7b4fb0', white: '#ffffff', navy: '#26346e',
};

// ---------- подписи ----------
const CAPTIONS = {
  ttt: { win: 'Я обыграл Тихона в крестики!', loss: 'Огнёвка стучала в окно' },
  sea: { win: 'Мой кораблик потопил паучий', loss: 'Мой кораблик сгорел' },
  hangman: { win: 'Я угадал слово!', loss: 'Слово не угадал. Жарко' },
  dots: { win: 'Мои клеточки!', loss: 'Тихон занял все клеточки' },
  checkers: { win: 'Дамка!', loss: 'Тихон съел мои шашки' },
};
const MOTIF = { tictactoe: 'ttt', ttt: 'ttt', battleship: 'sea', sea: 'sea', hangman: 'hangman', words: 'hangman', dots: 'dots', checkers: 'checkers', gomoku: 'ttt', giveaway: 'checkers', mines: 'sea', proverbs: 'hangman' };
export const motifOf = (game) => MOTIF[game] || 'ttt';

export function captionFor(spec) {
  if (spec.kind === 'final_recovered') return 'Мы с мамой и Тихон';
  if (spec.kind === 'final_hospital') return 'Тихон поехал со мной';
  if (spec.kind === 'anya') return 'Аня, 7 лет';
  const c = CAPTIONS[motifOf(spec.game)] || CAPTIONS.ttt;
  return c[spec.result === 'win' ? 'win' : 'loss'];
}

// ---------- «перо»: собирает штрихи ----------
class Pen {
  constructor(seed) { this.r = rng(seed); this.list = []; }
  j(v = 1) { return (this.r() - 0.5) * 2 * v; }
  // ломаная с детской неровностью
  line(pts, color, w = 6, jitter = 1.6) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i]; const [x1, y1] = pts[i + 1];
      const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 14));
      for (let k = 0; k < n; k++) { const t = k / n; out.push([x0 + (x1 - x0) * t + this.j(jitter), y0 + (y1 - y0) * t + this.j(jitter)]); }
    }
    const last = pts[pts.length - 1]; out.push([last[0] + this.j(jitter * 0.5), last[1] + this.j(jitter * 0.5)]);
    this.list.push({ pts: out, color, w });
    return this;
  }
  // детский круг: начинается где попало и чуть заходит на себя
  ring(cx, cy, rx, ry, color, w = 6) {
    const a0 = this.r() * Math.PI * 2; const pts = [];
    const n = Math.max(12, Math.round((rx + ry) / 3));
    for (let i = 0; i <= n * 1.08; i++) {
      const a = a0 + (i / n) * Math.PI * 2; const wob = 1 + this.j(0.05);
      pts.push([cx + Math.cos(a) * rx * wob, cy + Math.sin(a) * ry * wob]);
    }
    this.list.push({ pts, color, w });
    return this;
  }
  // штриховка-заливка: мелок ходит туда-сюда
  hatch(x, y, w, h, color, { gap = 7, lw = 7, shape = null } = {}) {
    const pts = []; let dir = 1;
    for (let yy = y; yy <= y + h; yy += gap) {
      let xa = x; let xb = x + w;
      if (shape === 'ellipse') {
        const cy = y + h / 2; const ry = h / 2; const dy = (yy - cy) / ry;
        if (Math.abs(dy) >= 1) continue;
        const half = (w / 2) * Math.sqrt(1 - dy * dy); xa = x + w / 2 - half; xb = x + w / 2 + half;
      }
      if (dir > 0) { pts.push([xa + this.j(2), yy + this.j(1.5)]); pts.push([xb + this.j(2), yy + gap * 0.4 + this.j(1.5)]); } else { pts.push([xb + this.j(2), yy + this.j(1.5)]); pts.push([xa + this.j(2), yy + gap * 0.4 + this.j(1.5)]); }
      dir = -dir;
    }
    if (pts.length > 1) this.list.push({ pts, color, w: lw, soft: true });
    return this;
  }
  text(str, x, y, size, color, { angle = -0.03 } = {}) { this.list.push({ text: tr(str), x, y, size, color, angle }); return this; }
}

// ---------- элементы рисунка ----------
function spider(p, x, y, s = 1, { top = 18, mood = 'smile' } = {}) {
  p.line([[x, top], [x, y - 30 * s]], C.gray, 3, 0.6);
  p.hatch(x - 30 * s, y - 26 * s, 60 * s, 52 * s, C.black, { gap: 6, lw: 7, shape: 'ellipse' });
  p.ring(x, y, 32 * s, 28 * s, C.black, 6);
  for (const side of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const ay = y - 14 * s + k * 10 * s; const kx = x + side * (46 + k * 3) * s; const ky = ay - (12 - k * 6) * s;
      p.line([[x + side * 24 * s, ay], [kx, ky], [x + side * (62 + k * 2) * s, ay + (16 + k * 7) * s]], C.black, 5, 1);
    }
  }
  p.ring(x - 11 * s, y - 8 * s, 7 * s, 7 * s, C.white, 4); p.ring(x + 11 * s, y - 8 * s, 7 * s, 7 * s, C.white, 4);
  if (mood === 'smile') p.line([[x - 12 * s, y + 8 * s], [x, y + 15 * s], [x + 12 * s, y + 8 * s]], C.red, 4, 0.6);
  else p.line([[x - 12 * s, y + 13 * s], [x, y + 7 * s], [x + 12 * s, y + 13 * s]], C.red, 4, 0.6);
}

function windowBox(p, x, y, w, h, { night = false, moth = false, big = false } = {}) {
  if (night) p.hatch(x + 6, y + 6, w - 12, h - 12, C.navy, { gap: 8, lw: 8 });
  p.line([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]], C.blue, 7);
  p.line([[x + w / 2, y], [x + w / 2, y + h]], C.blue, 6); p.line([[x, y + h * 0.45], [x + w, y + h * 0.45]], C.blue, 6);
  for (let k = 0; k < 5; k++) {
    const sx = x + 16 + p.r() * (w - 32); const sy = y + 14 + p.r() * (h - 28);
    p.line([[sx - 5, sy], [sx + 5, sy]], C.sky, 3, 0.4); p.line([[sx, sy - 5], [sx, sy + 5]], C.sky, 3, 0.4);
  }
  if (moth) butterfly(p, x + w * 0.72, y + h * 0.26, big ? 1.15 : 0.8, 'fire');
}

function butterfly(p, x, y, s, kind = 'fire') {
  const a = kind === 'fire' ? C.orange : C.sky; const b = kind === 'fire' ? C.red : C.white;
  for (const side of [-1, 1]) {
    p.hatch(x + (side < 0 ? -34 : 4) * s, y - 22 * s, 30 * s, 26 * s, a, { gap: 5, lw: 6, shape: 'ellipse' });
    p.ring(x + side * 19 * s, y - 9 * s, 16 * s, 14 * s, b, 4);
    p.ring(x + side * 14 * s, y + 12 * s, 11 * s, 10 * s, b, 4);
  }
  p.line([[x, y - 18 * s], [x, y + 20 * s]], C.black, 5, 0.5);
  if (kind === 'fire') {
    for (let k = -1; k <= 1; k++) p.line([[x + k * 12 * s, y - 28 * s], [x + k * 12 * s + 5 * s, y - 38 * s], [x + k * 12 * s - 3 * s, y - 46 * s]], C.red, 3, 0.6);
  }
}

function boyInBed(p, x, y, mood) {
  p.line([[x, y + 60], [x, y - 10], [x + 8, y - 10], [x + 8, y + 22], [x + 240, y + 22], [x + 240, y + 60]], C.brown, 7);
  p.hatch(x + 46, y + 2, 186, 26, C.blue, { gap: 6, lw: 7 });
  p.line([[x + 40, y + 2], [x + 236, y + 2]], C.navy, 5);
  p.ring(x + 34, y - 8, 20, 18, C.orange, 5);
  p.line([[x + 26, y - 12], [x + 28, y - 12]], C.black, 4, 0.2); p.line([[x + 40, y - 12], [x + 42, y - 12]], C.black, 4, 0.2);
  if (mood === 'smile') p.line([[x + 26, y - 1], [x + 34, y + 4], [x + 42, y - 1]], C.red, 3, 0.4);
  else p.line([[x + 26, y + 3], [x + 34, y - 1], [x + 42, y + 3]], C.red, 3, 0.4);
}

function mom(p, x, y) {
  p.ring(x, y - 92, 17, 19, C.orange, 5);
  p.line([[x - 18, y - 96], [x - 24, y - 60]], C.brown, 6); p.line([[x + 18, y - 96], [x + 24, y - 60]], C.brown, 6);
  p.hatch(x - 26, y - 64, 52, 60, C.pink, { gap: 7, lw: 7 });
  p.line([[x, y - 72], [x - 30, y - 4], [x + 30, y - 4], [x, y - 72]], C.red, 5);
  p.line([[x - 12, y - 4], [x - 14, y + 22]], C.black, 5); p.line([[x + 12, y - 4], [x + 14, y + 22]], C.black, 5);
  p.line([[x - 14, y - 56], [x - 44, y - 30]], C.black, 5); p.line([[x + 14, y - 56], [x + 44, y - 36]], C.black, 5);
  p.line([[x - 7, y - 85], [x, y - 81], [x + 7, y - 85]], C.red, 3, 0.4);
}

function sun(p, x, y) {
  p.hatch(x - 26, y - 26, 52, 52, C.yellow, { gap: 6, lw: 7, shape: 'ellipse' });
  p.ring(x, y, 28, 28, C.orange, 5);
  for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2 + 0.2; p.line([[x + Math.cos(a) * 38, y + Math.sin(a) * 38], [x + Math.cos(a) * 56, y + Math.sin(a) * 56]], C.orange, 5); }
}

function moon(p, x, y) {
  p.line([[x + 10, y - 30], [x - 12, y - 20], [x - 18, y], [x - 10, y + 22], [x + 12, y + 30], [x - 2, y + 12], [x - 2, y - 10], [x + 10, y - 30]], C.yellow, 6);
  for (let k = 0; k < 4; k++) { const sx = x + 40 + k * 34; const sy = y - 10 + (k % 2) * 26; p.line([[sx - 6, sy], [sx + 6, sy]], C.yellow, 3, 0.3); p.line([[sx, sy - 6], [sx, sy + 6]], C.yellow, 3, 0.3); }
}

function threads(p, n) {
  for (let i = 0; i < n; i++) p.line([[DRAW_W - 20, 16], [DRAW_W - 150 - i * 50, 70 + i * 30], [DRAW_W - 330 - i * 60, 40 + i * 46]], C.gray, 3, 0.8);
}

function motif(p, game, result, x, y) {
  const win = result === 'win';
  if (game === 'ttt') {
    for (const k of [1, 2]) { p.line([[x + k * 36, y], [x + k * 36, y + 108]], C.black, 4); p.line([[x, y + k * 36], [x + 108, y + k * 36]], C.black, 4); }
    const X = (cx, cy) => { p.line([[cx - 11, cy - 11], [cx + 11, cy + 11]], C.blue, 5); p.line([[cx + 11, cy - 11], [cx - 11, cy + 11]], C.blue, 5); };
    const O = (cx, cy) => p.ring(cx, cy, 12, 12, C.red, 5);
    const g = (i, j) => [x + 18 + i * 36, y + 18 + j * 36];
    X(...g(0, 0)); X(...g(1, 1)); X(...g(2, 2)); O(...g(2, 0)); O(...g(0, 2)); if (!win) O(...g(1, 0));
    if (win) p.line([g(0, 0), g(2, 2)].map(([a, b], i) => [a + (i ? 12 : -12), b + (i ? 12 : -12)]), C.green, 6);
  } else if (game === 'sea') {
    p.line([[x - 20, y + 96], [x + 10, y + 84], [x + 40, y + 96], [x + 70, y + 84], [x + 100, y + 96], [x + 130, y + 84], [x + 160, y + 96]], C.sky, 6);
    const boat = (bx, by, tilt, flag) => {
      p.line([[bx - 30, by + tilt], [bx + 30, by - tilt], [bx + 20, by + 16 - tilt], [bx - 22, by + 16 + tilt], [bx - 30, by + tilt]], C.brown, 6);
      p.line([[bx, by], [bx, by - 46]], C.black, 4);
      p.line([[bx, by - 44], [bx + 24, by - 16], [bx, by - 12]], flag, 5);
    };
    if (win) { boat(x + 30, y + 70, 0, C.blue); boat(x + 120, y + 84, 12, C.black); p.ring(x + 150, y + 64, 6, 6, C.sky, 3); p.ring(x + 160, y + 50, 4, 4, C.sky, 3); } else { boat(x + 60, y + 70, 4, C.blue); for (let k = 0; k < 3; k++) p.line([[x + 44 + k * 16, y + 60], [x + 50 + k * 16, y + 44], [x + 42 + k * 16, y + 30]], C.orange, 4, 0.6); }
  } else if (game === 'hangman') {
    const word = win ? 'НИТЬ' : 'ЖАР';
    [...word].forEach((ch, i) => {
      p.line([[x + i * 40, y + 60], [x + i * 40 + 32, y + 60]], C.black, 4);
      p.text(ch, x + i * 40 + 16, y + 50, 38, win ? C.blue : C.red);
    });
  } else if (game === 'dots') {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) p.ring(x + i * 36, y + j * 36, 3, 3, C.black, 4);
    const box = (i, j, col, ch) => { p.line([[x + i * 36, y + j * 36], [x + i * 36 + 36, y + j * 36], [x + i * 36 + 36, y + j * 36 + 36], [x + i * 36, y + j * 36 + 36], [x + i * 36, y + j * 36]], col, 4, 0.6); p.text(ch, x + i * 36 + 18, y + j * 36 + 29, 24, col); };
    if (win) { box(0, 0, C.blue, 'Я'); box(1, 0, C.blue, 'Я'); box(1, 1, C.blue, 'Я'); box(2, 1, C.black, 'Т'); } else { box(0, 0, C.black, 'Т'); box(1, 1, C.black, 'Т'); box(2, 1, C.black, 'Т'); box(2, 0, C.blue, 'Я'); }
  } else if (game === 'checkers') {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) p.hatch(x + i * 28, y + j * 28, 26, 26, C.brown, { gap: 6, lw: 5 });
    p.line([[x, y], [x + 112, y], [x + 112, y + 112], [x, y + 112], [x, y]], C.black, 4);
    p.ring(x + 42, y + 70, 11, 11, win ? C.red : C.black, 5);
    if (win) p.line([[x + 30, y + 52], [x + 34, y + 40], [x + 42, y + 50], [x + 50, y + 40], [x + 54, y + 52]], C.yellow, 4, 0.5);
  }
}

// Список штрихов для спецификации.
export function buildStrokes(spec) {
  const p = new Pen(spec.seed || (spec.day * 97 + (spec.result === 'win' ? 7 : 3)));
  const win = spec.result === 'win';
  if (spec.kind === 'final_recovered') {
    sun(p, 110, 90);
    windowBox(p, 220, 46, 150, 120, {});
    mom(p, 270, 400); 
    // мальчик стоит рядом с мамой, держит её за руку
    p.ring(350, 322, 16, 17, C.orange, 5); p.line([[350, 340], [350, 392]], C.blue, 7); p.line([[350, 392], [338, 424]], C.black, 5); p.line([[350, 392], [362, 424]], C.black, 5);
    p.line([[350, 356], [318, 372]], C.black, 5); p.line([[350, 356], [376, 340]], C.black, 5);
    p.line([[343, 328], [350, 333], [357, 328]], C.red, 3, 0.4);
    spider(p, 500, 170, 0.85, {});
    p.line([[470, 250], [490, 236], [500, 248], [510, 236], [530, 250], [500, 282], [470, 250]], C.red, 5, 0.6);
    butterfly(p, 300, 90, 0.6, 'white');
    threads(p, 3);
    p.line([[40, 430], [600, 430]], C.green, 7);
  } else if (spec.kind === 'final_hospital') {
    moon(p, 90, 80);
    p.line([[140, 330], [140, 230], [420, 230], [420, 330], [140, 330]], C.gray, 7);
    p.hatch(146, 236, 268, 88, C.white, { gap: 7, lw: 7 });
    p.line([[420, 260], [490, 260], [520, 300], [520, 330], [420, 330]], C.gray, 7);
    p.line([[270, 250], [270, 310]], C.red, 9); p.line([[240, 280], [300, 280]], C.red, 9);
    p.ring(200, 342, 20, 20, C.black, 7); p.ring(460, 342, 20, 20, C.black, 7);
    p.line([[300, 222], [300, 210]], C.sky, 6);
    spider(p, 360, 196, 0.5, { top: 150 });
    for (let k = 0; k < 9; k++) { const sx = 40 + p.r() * 560; const sy = 140 + p.r() * 260; p.line([[sx - 5, sy], [sx + 5, sy]], C.sky, 3, 0.4); p.line([[sx, sy - 5], [sx, sy + 5]], C.sky, 3, 0.4); }
    p.line([[30, 380], [610, 380]], C.sky, 6);
  } else if (spec.kind === 'anya') {
    // тот самый мамин рисунок со стены (см. paintKidDrawing): дом, солнце, девочка с косичками,
    // паук на ниточке с подписью «ТИХОН» и крестики-нолики в углу — два крестика в одной клетке
    const X = (x) => 22 + x * 2.95; const Y = (y) => 10 + y * 2.95;
    const P = (pts) => pts.map(([x, y]) => [X(x), Y(y)]);
    p.line(P([[10, 20], [46, 20]]), C.navy, 4); p.line(P([[10, 32], [46, 32]]), C.navy, 4);
    p.line(P([[22, 8], [22, 44]]), C.navy, 4); p.line(P([[34, 8], [34, 44]]), C.navy, 4);
    for (const [cx, cy] of [[16, 14], [26.5, 27], [30.5, 23]]) {
      p.line(P([[cx - 3.2, cy - 3.2], [cx + 3.2, cy + 3.2]]), C.red, 5); p.line(P([[cx + 3.2, cy - 3.2], [cx - 3.2, cy + 3.2]]), C.red, 5);
    }
    p.ring(X(40), Y(38), 10, 10, C.navy, 4);
    p.ring(X(172), Y(32), 40, 40, C.orange, 7);
    for (let q = 0; q < 8; q++) {
      const a = q * Math.PI / 4;
      p.line(P([[172 + Math.cos(a) * 19, 32 + Math.sin(a) * 19], [172 + Math.cos(a) * 26, 32 + Math.sin(a) * 26]]), C.orange, 6);
    }
    p.line(P([[40, 126], [40, 84], [90, 84], [90, 126]]), C.red, 7);
    p.line(P([[34, 86], [65, 58], [96, 86]]), C.brown, 7);
    p.hatch(X(57), Y(99), 16 * 2.95, 12 * 2.95, C.yellow, { gap: 7, lw: 7 });
    p.line(P([[56, 98], [74, 98], [74, 112], [56, 112], [56, 98]]), C.orange, 5);
    p.line(P([[14, 128], [60, 124], [120, 127], [188, 123]]), C.green, 7);
    // девочка
    p.ring(X(112), Y(94), 17, 17, C.brown, 5);
    p.line(P([[106.5, 91], [101, 99]]), C.brown, 5); p.line(P([[117.5, 91], [123, 99]]), C.brown, 5);
    p.line(P([[100.5, 99.5], [102.5, 98.5]]), C.red, 6); p.line(P([[122, 98.5], [124, 99.5]]), C.red, 6);
    p.line(P([[109.5, 95.5], [112, 97], [114.5, 95.5]]), C.red, 3, 0.4);
    p.hatch(X(103.5), Y(107.5), 17 * 2.95, 6.5 * 2.95, C.pink, { gap: 6, lw: 6 });
    p.line(P([[106, 106], [100, 115], [124, 115], [118, 106], [106, 106]]), C.red, 6);
    p.line(P([[109, 115], [107, 126]]), C.brown, 5); p.line(P([[115, 115], [117, 126]]), C.brown, 5);
    p.line(P([[104, 107], [97, 112]]), C.brown, 5); p.line(P([[120, 107], [127, 112]]), C.brown, 5);
    // паук на ниточке
    spider(p, X(146), Y(76), 0.78, { top: 6 });
    p.text('ТИХОН', X(160), Y(110), 46, C.purple, { angle: -0.05 });
  } else {
    const n = spec.wins || 0; const loss = !win;
    windowBox(p, 50, 44, 160, 136, { night: loss, moth: loss || (spec.losses || 0) > 0, big: loss });
    if (win) sun(p, 290, 84); else moon(p, 260, 80);
    threads(p, n);
    spider(p, 520, 170, 0.8, { mood: win ? 'smile' : 'grin' });
    boyInBed(p, 40, 330, win ? 'smile' : 'sad');
    if (spec.day % 2 === 0 && win) mom(p, 330, 420);
    const mo = motifOf(spec.game);
    motif(p, mo, spec.result, mo === 'hangman' ? 330 : 380, 250);
  }
  return p.list;
}

// ---------- бумага ----------
const paperCache = new Map();
function paper(seed) {
  if (paperCache.has(seed)) return paperCache.get(seed);
  const c = document.createElement('canvas'); c.width = DRAW_W; c.height = DRAW_H;
  const ctx = c.getContext('2d'); const r = rng(seed);
  ctx.fillStyle = '#fbf8ef'; ctx.fillRect(0, 0, DRAW_W, DRAW_H);
  // тетрадная клетка
  ctx.strokeStyle = 'rgba(96,140,200,0.28)'; ctx.lineWidth = 1;
  for (let x = 10; x < DRAW_W; x += 20) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, DRAW_H); ctx.stroke(); }
  for (let y = 10; y < DRAW_H; y += 20) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(DRAW_W, y + 0.5); ctx.stroke(); }
  // поля и неровный край вырванного листа слева
  ctx.strokeStyle = 'rgba(220,80,80,0.45)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(DRAW_W - 40, 0); ctx.lineTo(DRAW_W - 40, DRAW_H); ctx.stroke();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath(); ctx.moveTo(0, 0);
  for (let y = 0; y <= DRAW_H; y += 8) ctx.lineTo(3 + r() * 6, y);
  ctx.lineTo(0, DRAW_H); ctx.closePath(); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  // лёгкая желтизна и грязь от пальцев
  for (let k = 0; k < 5; k++) {
    const gx = r() * DRAW_W; const gy = r() * DRAW_H;
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 120 + r() * 120);
    g.addColorStop(0, 'rgba(180,150,90,0.06)'); g.addColorStop(1, 'rgba(180,150,90,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, DRAW_W, DRAW_H);
  }
  paperCache.set(seed, c);
  return c;
}

let grainPattern = null;
function grain(ctx) {
  if (!grainPattern) {
    const c = document.createElement('canvas'); c.width = 96; c.height = 96;
    const g = c.getContext('2d'); const img = g.createImageData(96, 96); const r = rng(77);
    for (let i = 0; i < 96 * 96; i++) { const v = r(); img.data[i * 4 + 3] = v < 0.22 ? 200 : v < 0.4 ? 90 : 0; }
    g.putImageData(img, 0, 0);
    grainPattern = c;
  }
  return ctx.createPattern(grainPattern, 'repeat');
}

function strokeLen(s) {
  if (s.text) return 60 + s.text.length * 30;
  let L = 0; for (let i = 1; i < s.pts.length; i++) L += Math.hypot(s.pts[i][0] - s.pts[i - 1][0], s.pts[i][1] - s.pts[i - 1][1]);
  return L;
}

function drawStroke(ctx, s, frac) {
  if (s.text) {
    const n = Math.ceil(s.text.length * frac);
    if (!n) return;
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.angle);
    ctx.font = `700 ${s.size}px ${FONT.hand}`; ctx.fillStyle = s.color; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = 0.9; ctx.fillText(s.text.slice(0, n), 0, 0);
    ctx.restore();
    return;
  }
  const pts = s.pts; const total = strokeLen(s) * frac;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [dx, dy, a, k] of [[0, 0, 0.88, 1], [0.9, -0.7, 0.4, 0.7]]) {
    ctx.strokeStyle = s.color; ctx.globalAlpha = s.soft ? a * 0.8 : a; ctx.lineWidth = s.w * k;
    ctx.beginPath(); ctx.moveTo(pts[0][0] + dx, pts[0][1] + dy);
    let L = 0;
    for (let i = 1; i < pts.length; i++) {
      const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (L + seg > total) {
        const t = (total - L) / seg;
        ctx.lineTo(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t + dx, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t + dy);
        break;
      }
      L += seg; ctx.lineTo(pts[i][0] + dx, pts[i][1] + dy);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// Нарисовать рисунок на ctx (размер DRAW_W × DRAW_H) до готовности k.
export function paintDrawing(ctx, spec, k = 1, cache = {}) {
  if (!cache.strokes) {
    cache.strokes = buildStrokes(spec);
    cache.strokes.push({ text: tr(captionFor(spec)), x: DRAW_W / 2 - 10, y: DRAW_H - 26, size: 40, color: '#3a3a8a', angle: -0.025 });
    cache.lens = cache.strokes.map(strokeLen); cache.total = cache.lens.reduce((a, b) => a + b, 0);
    cache.layer = document.createElement('canvas'); cache.layer.width = DRAW_W; cache.layer.height = DRAW_H;
  }
  const layer = cache.layer; const lc = layer.getContext('2d');
  lc.clearRect(0, 0, DRAW_W, DRAW_H);
  let left = cache.total * Math.max(0, Math.min(1, k));
  for (let i = 0; i < cache.strokes.length && left > 0; i++) {
    const L = cache.lens[i];
    drawStroke(lc, cache.strokes[i], Math.min(1, left / L));
    left -= L;
  }
  // зерно бумаги «съедает» воск
  lc.globalCompositeOperation = 'destination-out'; lc.fillStyle = grain(lc); lc.globalAlpha = 0.55;
  lc.fillRect(0, 0, DRAW_W, DRAW_H); lc.globalAlpha = 1; lc.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, DRAW_W, DRAW_H);
  ctx.drawImage(paper((spec.seed || spec.day || 1) + 11), 0, 0);
  ctx.drawImage(layer, 0, 0);
  return cache;
}

// Готовая текстура рисунка (для стены, альбома, финала).
export function drawingTexture(scene, key, spec) {
  if (scene.textures.exists(key)) return key;
  const c = document.createElement('canvas'); c.width = DRAW_W; c.height = DRAW_H;
  paintDrawing(c.getContext('2d'), spec, 1);
  scene.textures.addImage(key, c);
  return key;
}

export const specKey = (spec) => `drawing_${spec.kind || 'day'}_${spec.day || 0}_${spec.game || ''}_${spec.result || ''}_${spec.wins || 0}_${spec.seed || 0}`;
