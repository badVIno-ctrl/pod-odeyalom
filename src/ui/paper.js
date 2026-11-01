// Бумага, картон и карандаш, нарисованные кодом (Canvas 2D) — основа интерфейса вместо плоских плашек.
// paperTexture() рисует лист один раз и кэширует его как текстуру (ключ зависит от размера и вида),
// ink*() — «рукописные» линии для Phaser.Graphics: чуть неровные, с нажимом, как карандашом.
// Неровность задаётся seed, поэтому при перерисовке форма не «дрожит».

// ---------- случайные числа с зерном ----------
export function rng(seed = 1) {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hexToRgb = (n) => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
const rgba = (n, a = 1) => { const [r, g, b] = hexToRgb(n); return `rgba(${r},${g},${b},${a})`; };
const shade = (n, k) => {
  const [r, g, b] = hexToRgb(n);
  const f = (v) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
  return (f(r) << 16) | (f(g) << 8) | f(b);
};

// ---------- зерно бумаги (один раз на игру) ----------
let grainCanvas = null;
function grain() {
  if (grainCanvas) return grainCanvas;
  const S = 256;
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S); const r = rng(11);
  // мягкий шум: сумма двух масштабов
  const low = new Float32Array(33 * 33); for (let i = 0; i < low.length; i++) low[i] = r();
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const gx = (x / S) * 32; const gy = (y / S) * 32; const ix = Math.floor(gx); const iy = Math.floor(gy);
      const fx = gx - ix; const fy = gy - iy;
      const at = (i, j) => low[(j % 33) * 33 + (i % 33)];
      const l = at(ix, iy) * (1 - fx) * (1 - fy) + at(ix + 1, iy) * fx * (1 - fy) + at(ix, iy + 1) * (1 - fx) * fy + at(ix + 1, iy + 1) * fx * fy;
      const v = 236 + l * 14 + r() * 7 - (r() < 0.004 ? 40 : 0);
      const k = (y * S + x) * 4;
      img.data[k] = v; img.data[k + 1] = v - 2; img.data[k + 2] = v - 6; img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // волокна
  for (let i = 0; i < 140; i++) {
    const x = r() * S; const y = r() * S; const a = r() * Math.PI; const len = 6 + r() * 18;
    ctx.strokeStyle = `rgba(120,96,60,${0.05 + r() * 0.08})`; ctx.lineWidth = 0.6 + r() * 0.6;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + (r() - 0.5) * 4, y + Math.sin(a) * len * 0.5 + (r() - 0.5) * 4, x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  grainCanvas = c;
  return c;
}

// ---------- контур листа ----------
// edge: 'cut' — ровно отрезанный край (лёгкая неровность), 'torn' — рваный (сверху/снизу), 'soft' — скруглённая карточка.
function sheetPoints(x, y, w, h, { seed = 1, edge = 'cut', tornSides = 'tb', corner = 3 } = {}) {
  const r = rng(seed);
  const pts = [];
  const side = (x0, y0, x1, y1, torn) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const step = torn ? 5 : 22;
    const amp = torn ? 2.6 : edge === 'soft' ? 0.4 : 0.9;
    const n = Math.max(2, Math.round(len / step));
    const nx = -(y1 - y0) / len; const ny = (x1 - x0) / len;
    let drift = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      drift = drift * 0.6 + (r() - 0.5) * amp * 1.4;
      const j = torn ? (r() - 0.5) * amp * 2 + drift * 0.5 : drift;
      pts.push([x0 + (x1 - x0) * t + nx * j, y0 + (y1 - y0) * t + ny * j]);
    }
  };
  const c = edge === 'soft' ? 0 : corner;
  const T = edge === 'torn' && tornSides.includes('t'); const B = edge === 'torn' && tornSides.includes('b');
  const L = edge === 'torn' && tornSides.includes('l'); const R = edge === 'torn' && tornSides.includes('r');
  // углы чуть «обмяты»: срезаем на c пикселей
  side(x + c, y, x + w - c, y, T);
  side(x + w - c, y, x + w, y + c, false);
  side(x + w, y + c, x + w, y + h - c, R);
  side(x + w, y + h - c, x + w - c, y + h, false);
  side(x + w - c, y + h, x + c, y + h, B);
  side(x + c, y + h, x, y + h - c, false);
  side(x, y + h - c, x, y + c, L);
  side(x, y + c, x + c, y, false);
  return pts;
}

function tracePts(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
}

function roundRectPath(ctx, x, y, w, h, rad) {
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

// Неровная карандашная линия по точкам (для Canvas 2D).
function pencilPath(ctx, pts, { seed = 3, amp = 0.8, close = false } = {}) {
  const r = rng(seed);
  ctx.beginPath();
  const all = close ? [...pts, pts[0]] : pts;
  all.forEach(([px, py], i) => {
    const jx = (r() - 0.5) * amp * 2; const jy = (r() - 0.5) * amp * 2;
    if (!i) ctx.moveTo(px + jx, py + jy); else ctx.lineTo(px + jx, py + jy);
  });
}

function rectPts(x, y, w, h, step = 26) {
  const pts = [];
  const seg = (x0, y0, x1, y1) => { const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step)); for (let i = 0; i < n; i++) pts.push([x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]); };
  seg(x, y, x + w, y); seg(x + w, y, x + w, y + h); seg(x + w, y + h, x, y + h); seg(x, y + h, x, y);
  return pts;
}

// Полоска скотча: полупрозрачная, края «зубчиками».
function drawTape(ctx, cx, cy, w, h, angle, seed) {
  const r = rng(seed);
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(angle);
  ctx.beginPath();
  const zig = (x, top, bottom, dir) => { const n = 6; for (let i = 0; i <= n; i++) ctx.lineTo(x + dir * (r() * 3), top + (bottom - top) * i / n); };
  ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, -h / 2);
  zig(w / 2, -h / 2, h / 2, 1);
  ctx.lineTo(-w / 2, h / 2);
  for (let i = 6; i >= 0; i--) ctx.lineTo(-w / 2 - r() * 3, -h / 2 + h * i / 6);
  ctx.closePath();
  ctx.fillStyle = 'rgba(236,226,196,0.72)';
  ctx.shadowColor = 'rgba(40,25,10,0.18)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(-w / 2, -h / 2 + 2, w, h * 0.28);
  ctx.strokeStyle = 'rgba(150,130,90,0.25)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
}

// Маленькая звёздочка-орнамент (уголки тёмных карточек).
function drawStar(ctx, x, y, s, color) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2; const rr = i % 2 ? s * 0.32 : s;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill(); ctx.restore();
}

// ---------- виды листов ----------
const KINDS = {
  cream: { base: 0xf3e8d2, grain: 0.55, edgeTone: 0xb89c70, light: 0.05, dark: -0.07 },
  light: { base: 0xf8f1e2, grain: 0.45, edgeTone: 0xc0a47a, light: 0.04, dark: -0.05 },
  note: { base: 0xf5e7b4, grain: 0.5, edgeTone: 0xc2a25c, light: 0.04, dark: -0.08 },
  kraft: { base: 0xc9a574, grain: 0.7, edgeTone: 0x8a6a40, light: 0.05, dark: -0.1 },
  amber: { base: 0xe9a45a, grain: 0.5, edgeTone: 0x9a5a22, light: 0.08, dark: -0.1 },
  amberHi: { base: 0xf3bb78, grain: 0.45, edgeTone: 0xa8682c, light: 0.08, dark: -0.08 },
  night: { base: 0x1d2643, grain: 0.32, edgeTone: 0x0a0f22, light: 0.06, dark: -0.25, dark0: true },
  nightHi: { base: 0x283461, grain: 0.32, edgeTone: 0x0a0f22, light: 0.06, dark: -0.22, dark0: true },
  chalk: { base: 0x2b3a35, grain: 0.35, edgeTone: 0x101814, light: 0.05, dark: -0.2, dark0: true },
};

// opts: kind, seed, edge ('cut'|'torn'|'soft'), tornSides ('tb'), ruled (null|'grid'|'lines'),
//       tape (null|'top'|'corners'|'left'), shadow (true), border (для тёмных: двойная рамка и звёздочки),
//       radius (для 'soft'), alpha (прозрачность листа, для «призрачных» кнопок)
export function paperTexture(scene, w, h, opts = {}) {
  w = Math.round(w); h = Math.round(h);
  const o = { kind: 'cream', seed: 1, edge: 'cut', tornSides: 'tb', ruled: null, tape: null, shadow: true, border: false, radius: 14, alpha: 1, ...opts };
  const key = `paper:${o.kind}:${w}x${h}:${o.seed}:${o.edge}${o.tornSides}:${o.ruled}:${o.tape}:${o.shadow ? 1 : 0}:${o.border ? 1 : 0}:${o.radius}:${o.alpha}`;
  if (scene.textures.exists(key)) return key;
  const pad = o.shadow ? 30 : 8;
  const tex = scene.textures.createCanvas(key, w + pad * 2, h + pad * 2);
  const ctx = tex.context;
  drawSheet(ctx, pad, pad, w, h, o);
  tex.refresh();
  return key;
}

export function drawSheet(ctx, x, y, w, h, o) {
  const K = KINDS[o.kind] || KINDS.cream;
  const pts = o.edge === 'soft' ? null : sheetPoints(x, y, w, h, o);
  const path = () => (pts ? tracePts(ctx, pts) : roundRectPath(ctx, x, y, w, h, o.radius));
  ctx.save();
  ctx.globalAlpha = o.alpha;
  // тень
  if (o.shadow) {
    ctx.save();
    ctx.shadowColor = 'rgba(14,8,4,0.42)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 8;
    path(); ctx.fillStyle = rgba(K.base, 1); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.shadowColor = 'rgba(14,8,4,0.25)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
    path(); ctx.fillStyle = rgba(K.base, 1); ctx.fill();
    ctx.restore();
  }
  ctx.save();
  path(); ctx.clip();
  // основа: свет слева сверху, тень справа снизу
  const lg = ctx.createLinearGradient(x, y, x + w * 0.6, y + h * 1.2);
  lg.addColorStop(0, rgba(shade(K.base, K.light)));
  lg.addColorStop(0.55, rgba(K.base));
  lg.addColorStop(1, rgba(shade(K.base, K.dark)));
  ctx.fillStyle = lg; ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  // зерно
  ctx.globalCompositeOperation = K.dark0 ? 'overlay' : 'multiply';
  ctx.globalAlpha = o.alpha * K.grain;
  ctx.fillStyle = ctx.createPattern(grain(), 'repeat');
  ctx.save(); ctx.translate((o.seed * 37) % 256, (o.seed * 91) % 256); ctx.fillRect(x - 300, y - 300, w + 600, h + 600); ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = o.alpha;
  // линовка
  if (o.ruled === 'grid') {
    const step = 28;
    ctx.strokeStyle = 'rgba(86,128,182,0.28)'; ctx.lineWidth = 1;
    for (let gx = x + 14; gx < x + w; gx += step) { ctx.beginPath(); ctx.moveTo(gx + 0.5, y); ctx.lineTo(gx + 0.5, y + h); ctx.stroke(); }
    for (let gy = y + 14; gy < y + h; gy += step) { ctx.beginPath(); ctx.moveTo(x, gy + 0.5); ctx.lineTo(x + w, gy + 0.5); ctx.stroke(); }
  } else if (o.ruled === 'lines') {
    ctx.strokeStyle = 'rgba(86,128,182,0.3)'; ctx.lineWidth = 1.2;
    for (let gy = y + 58; gy < y + h - 8; gy += 36) { ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(196,72,60,0.45)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x + 64, y); ctx.lineTo(x + 64, y + h); ctx.stroke();
  }
  // края темнее (старение бумаги)
  const rg = ctx.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.3, x + w / 2, y + h / 2, Math.hypot(w, h) * 0.62);
  rg.addColorStop(0, 'rgba(0,0,0,0)');
  rg.addColorStop(1, K.dark0 ? 'rgba(0,0,0,0.35)' : rgba(K.edgeTone, 0.22));
  ctx.fillStyle = rg; ctx.fillRect(x, y, w, h);
  ctx.restore();
  // кромка: светлая волосяная линия у рваного края и тонкий контур
  ctx.save();
  path();
  ctx.lineWidth = 1.2; ctx.strokeStyle = K.dark0 ? 'rgba(0,0,0,0.5)' : rgba(K.edgeTone, 0.55); ctx.stroke();
  ctx.restore();
  if (o.edge === 'torn' && !K.dark0) {
    ctx.save(); path(); ctx.clip();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,252,240,0.55)'; path(); ctx.stroke();
    ctx.restore();
  }
  // рамка тёмной карточки: двойная «вышитая» линия и звёздочки по углам
  if (o.border) {
    const ins = 12;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(240,222,186,0.55)'; ctx.lineWidth = 1.6;
    pencilPath(ctx, rectPts(x + ins, y + ins, w - ins * 2, h - ins * 2), { seed: o.seed + 5, amp: 0.6, close: true }); ctx.stroke();
    ctx.strokeStyle = 'rgba(240,222,186,0.22)'; ctx.lineWidth = 1;
    ctx.setLineDash([6, 7]);
    pencilPath(ctx, rectPts(x + ins + 6, y + ins + 6, w - (ins + 6) * 2, h - (ins + 6) * 2), { seed: o.seed + 9, amp: 0.4, close: true }); ctx.stroke();
    ctx.setLineDash([]);
    for (const [sx, sy] of [[x + ins, y + ins], [x + w - ins, y + ins], [x + ins, y + h - ins], [x + w - ins, y + h - ins]]) drawStar(ctx, sx, sy, 7, 'rgba(242,190,110,0.9)');
    ctx.restore();
  }
  // скотч
  if (o.tape) {
    const r = rng(o.seed + 17);
    if (o.tape === 'top') drawTape(ctx, x + w / 2 + (r() - 0.5) * w * 0.2, y + 2, Math.min(150, w * 0.35), 34, (r() - 0.5) * 0.12, o.seed);
    if (o.tape === 'left') drawTape(ctx, x + 40, y + 6, 110, 32, -0.5 + (r() - 0.5) * 0.1, o.seed);
    if (o.tape === 'corners') {
      drawTape(ctx, x + 22, y + 14, 96, 30, -0.62 + (r() - 0.5) * 0.1, o.seed);
      drawTape(ctx, x + w - 22, y + 14, 96, 30, 0.62 + (r() - 0.5) * 0.1, o.seed + 1);
    }
  }
  ctx.restore();
}

// Мягкая тень-«подушка» под предметом (для кнопок: при наведении растёт).
export function blobShadowTexture(scene, w, h, blur = 14) {
  w = Math.round(w); h = Math.round(h);
  const key = `shadow:${w}x${h}:${blur}`;
  if (scene.textures.exists(key)) return key;
  const pad = blur * 2 + 4;
  const tex = scene.textures.createCanvas(key, w + pad * 2, h + pad * 2);
  const ctx = tex.context;
  ctx.shadowColor = 'rgba(10,6,2,0.55)'; ctx.shadowBlur = blur; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  ctx.fillStyle = 'rgba(10,6,2,0.55)';
  roundRectPath(ctx, pad, pad, w, h, Math.min(16, h / 2)); ctx.fill();
  tex.refresh();
  return key;
}

// ---------- карандаш для Phaser.Graphics ----------
// Линия из точек с лёгким дрожанием; два прохода дают «нажим».
export function inkStroke(g, pts, { color = 0x2b2530, alpha = 1, width = 2.4, seed = 1, amp = 0.9, close = false, passes = 2 } = {}) {
  const all = close ? [...pts, pts[0]] : pts;
  for (let p = 0; p < passes; p++) {
    const r = rng(seed + p * 101);
    g.lineStyle(p ? width * 0.55 : width, color, p ? alpha * 0.55 : alpha);
    g.beginPath();
    all.forEach(([x, y], i) => {
      const jx = (r() - 0.5) * amp * 2; const jy = (r() - 0.5) * amp * 2;
      if (!i) g.moveTo(x + jx, y + jy); else g.lineTo(x + jx, y + jy);
    });
    g.strokePath();
  }
  return g;
}

// Карандашный круг: начинается и заканчивается с нахлёстом, как обводят от руки.
export function inkCircle(g, cx, cy, rad, { seed = 1, over = 0.16, squash = 1, ...opt } = {}) {
  const r = rng(seed);
  const a0 = r() * Math.PI * 2; const n = Math.max(14, Math.round(rad * 1.2));
  const pts = [];
  for (let i = 0; i <= n * (1 + over); i++) {
    const a = a0 + (i / n) * Math.PI * 2;
    const k = 1 + (r() - 0.5) * 0.06 + (i / n) * 0.05;
    pts.push([cx + Math.cos(a) * rad * k, cy + Math.sin(a) * rad * k * squash]);
  }
  return inkStroke(g, pts, { seed: seed + 7, amp: 0.5, ...opt });
}

export function inkRect(g, x, y, w, h, opt = {}) {
  return inkStroke(g, rectPts(x, y, w, h, 18), { close: true, ...opt });
}

export function inkLine(g, x0, y0, x1, y1, opt = {}) {
  const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 14));
  const pts = []; for (let i = 0; i <= n; i++) pts.push([x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]);
  return inkStroke(g, pts, opt);
}

// Галочка и крестик (отметки дней).
export function inkCheck(g, x, y, s, opt = {}) {
  return inkStroke(g, [[x - s * 0.55, y - s * 0.05], [x - s * 0.15, y + s * 0.4], [x + s * 0.62, y - s * 0.55]], { width: 3.2, amp: 0.5, ...opt });
}
export function inkCross(g, x, y, s, opt = {}) {
  inkStroke(g, [[x - s * 0.45, y - s * 0.45], [x + s * 0.48, y + s * 0.47]], { width: 3, amp: 0.5, ...opt });
  return inkStroke(g, [[x + s * 0.46, y - s * 0.48], [x - s * 0.44, y + s * 0.45]], { width: 3, amp: 0.5, seed: (opt.seed || 1) + 3, ...opt });
}

// Волнистая подчёркивающая линия.
export function inkUnderline(g, x, y, w, opt = {}) {
  const pts = []; const n = Math.max(4, Math.round(w / 12)); const r = rng(opt.seed || 5);
  for (let i = 0; i <= n; i++) pts.push([x + (w * i) / n, y + Math.sin(i * 0.9 + r() * 0.6) * 1.6]);
  return inkStroke(g, pts, { width: 2.6, ...opt });
}

// Небольшой случайный наклон листка (в градусах), стабильный для одного и того же seed.
export const tilt = (seed, max = 1.2) => (rng(seed)() - 0.5) * 2 * max;
