// Иней на стекле окна: мороз «записывает» ход болезни.
// • Кромка инея растёт от рам к середине стёкол — с каждым днём глубже, ночью заметно подрастает на глазах.
// • Победа (серебряная нить): на одном из стёкол иней вырастает узором паутины — Тихон плетёт и здесь.
// • Искра Огнёвки: бабочка бьётся о верхнее правое стекло — там, где она ударила, иней тает кругом и стекает каплями.
// Всё восстанавливается по истории забега (GameState.frost), поэтому следы прошлых дней остаются на стекле.
// Рисуется в одну canvas-текстуру поверх стекла (рамы окна нарисованы на фоне; текстура обрезана по стёклам).
import { rng } from './paint.js';

// Стёкла окна в координатах сцены (см. paintEnv: рама 470..890 × 170..590, переплёт x = 680, y ≈ 346).
export const PANES = [
  { x: 481, y: 181, w: 194, h: 160 }, // 0 верхнее левое
  { x: 685, y: 181, w: 194, h: 160 }, // 1 верхнее правое — стекло Огнёвки
  { x: 481, y: 351, w: 194, h: 228 }, // 2 нижнее левое
  { x: 685, y: 351, w: 194, h: 228 }, // 3 нижнее правое
];
export const FROST_ORIGIN = { x: 481, y: 181 };
const W = 398; const H = 398;
// порядок стёкол для паутинок инея (по числу побед)
export const WEB_PANES = [0, 3, 2];
const ICE = (a) => `rgba(236,246,255,${a.toFixed(3)})`;

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// Кристаллы кромки: для каждого стекла — набор «папоротников» от рам внутрь.
function makeCrystals(pane, seed) {
  const r = rng(seed); const list = [];
  const edges = [
    { x0: pane.x, y0: pane.y, dx: 1, dy: 0, len: pane.w, nx: 0, ny: 1 },
    { x0: pane.x, y0: pane.y + pane.h, dx: 1, dy: 0, len: pane.w, nx: 0, ny: -1 },
    { x0: pane.x, y0: pane.y, dx: 0, dy: 1, len: pane.h, nx: 1, ny: 0 },
    { x0: pane.x + pane.w, y0: pane.y, dx: 0, dy: 1, len: pane.h, nx: -1, ny: 0 },
  ];
  for (const e of edges) {
    // снизу инея больше: там холоднее и копится конденсат
    const dens = e.ny < 0 ? 5 : 7.5;
    for (let s = r() * dens; s < e.len; s += dens * (0.6 + r() * 0.9)) {
      const base = Math.atan2(e.ny, e.nx) + (r() - 0.5) * 1.1;
      list.push({
        x: e.x0 + e.dx * s - FROST_ORIGIN.x, y: e.y0 + e.dy * s - FROST_ORIGIN.y,
        a: base, len: 0.35 + r() * 0.85 * (e.ny < 0 ? 1.25 : 1), seed: Math.floor(r() * 1e6), w: 0.7 + r() * 0.8,
      });
    }
  }
  return list;
}

function fern(ctx, x, y, a, len, lvl, r, alpha, lw) {
  if (len < 2) return;
  const ex = x + Math.cos(a) * len; const ey = y + Math.sin(a) * len;
  ctx.strokeStyle = ICE(alpha); ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
  if (lvl <= 0) return;
  const n = 3 + Math.floor(r() * 3);
  for (let k = 1; k <= n; k++) {
    const t = k / (n + 1);
    const px = x + (ex - x) * t; const py = y + (ey - y) * t;
    const sl = len * (0.42 - t * 0.22) * (0.7 + r() * 0.5);
    fern(ctx, px, py, a - 1.05 + (r() - 0.5) * 0.3, sl, lvl - 1, r, alpha * 0.85, lw * 0.7);
    fern(ctx, px, py, a + 1.05 + (r() - 0.5) * 0.3, sl, lvl - 1, r, alpha * 0.85, lw * 0.7);
  }
}

// Паутинка инея: лучи — стебли с иголками, круги — бусины изморози. k 0..1 — насколько выросла.
function drawWebFrost(ctx, web, k) {
  const r = rng(web.seed); const rays = 9; const R = web.R;
  const angles = Array.from({ length: rays }, (_, i) => (i / rays) * Math.PI * 2 + web.rot + (r() - 0.5) * 0.18);
  const lens = angles.map(() => R * (0.82 + r() * 0.2));
  const grow = Math.min(1, k * 1.5);
  ctx.save(); ctx.lineCap = 'round';
  angles.forEach((a, i) => {
    const L = lens[i] * grow; const rr = rng(web.seed + i * 17);
    fern(ctx, web.cx, web.cy, a, L, 1, rr, 0.62, 1.5);
  });
  const rings = 4;
  for (let j = 1; j <= rings; j++) {
    const start = 0.3 + j * 0.13; if (k <= start) continue;
    const kk = Math.min(1, (k - start) / 0.25);
    const q = j / (rings + 0.6);
    ctx.strokeStyle = ICE(0.5 - j * 0.04); ctx.lineWidth = 1.2;
    ctx.beginPath();
    const steps = Math.max(1, Math.round(rays * kk));
    for (let s = 0; s <= steps; s++) {
      const i = s % rays; const a = angles[i]; const L = lens[i] * q;
      const x = web.cx + Math.cos(a) * L; const y = web.cy + Math.sin(a) * L;
      if (s === 0) ctx.moveTo(x, y);
      else {
        const am = (angles[(s - 1) % rays] + (i === 0 ? a + Math.PI * 2 : a)) / 2; const Lm = L * 0.9;
        ctx.quadraticCurveTo(web.cx + Math.cos(am) * Lm, web.cy + Math.sin(am) * Lm, x, y);
      }
    }
    ctx.stroke();
    // бусины изморози на пересечениях
    for (let s = 0; s < steps; s++) {
      const a = angles[s]; const L = lens[s] * q;
      ctx.fillStyle = ICE(0.85); ctx.beginPath(); ctx.arc(web.cx + Math.cos(a) * L, web.cy + Math.sin(a) * L, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.fillStyle = ICE(0.7 * grow); ctx.beginPath(); ctx.arc(web.cx, web.cy, 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Шторы на фоне заходят на края стёкол (см. paintEnv): иней под ними не рисуется.
function curtainMask(ctx) {
  const Wx = 470; const Wy = 170; const Ww = 420; const Wh = 420;
  ctx.save(); ctx.translate(-FROST_ORIGIN.x, -FROST_ORIGIN.y);
  ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = '#000';
  for (const [cx, dir] of [[Wx - 40, 1], [Wx + Ww + 40, -1]]) {
    for (let k = 0; k < 5; k++) {
      const x0 = cx - 50 + k * 22;
      ctx.beginPath(); ctx.moveTo(x0 - 1, Wy - 26); ctx.lineTo(x0 + 23, Wy - 26);
      ctx.quadraticCurveTo(x0 + 27 + dir * 18, Wy + 300, x0 + 31 + dir * 8, Wy + Wh + 60);
      ctx.lineTo(x0 + 5 + dir * 8, Wy + Wh + 60); ctx.quadraticCurveTo(x0 - 1 + dir * 18, Wy + 300, x0 - 1, Wy - 26); ctx.fill();
    }
  }
  ctx.restore();
}

export class FrostGlass {
  // state: { level (глубина кромки 0..1), webs: [{pane, seed}], melts: [{x, y, r, seed}] } — координаты сцены
  constructor(scene, { depth = 46.5, key = 'frost_glass', state }) {
    this.scene = scene;
    this.key = key;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    this.tex = scene.textures.createCanvas(key, W, H);
    this.ctx = this.tex.getContext();
    this.base = canvas(W, H); this.webLayer = canvas(W, H);
    this.crystals = PANES.map((p, i) => makeCrystals(p, 4100 + i * 131));
    this.level = state.level ?? 0.3;
    // сохранение могло прийти из старой версии: берём только понятные записи
    this.webs = (state.webs || []).filter((w) => w && PANES[w.pane]).map((w) => ({ ...this.webGeom(w), k: 1 }));
    this.melts = (state.melts || []).filter((m) => m && Number.isFinite(m.x) && Number.isFinite(m.y)).map((m) => ({ ...m, k: 1 }));
    this.image = scene.add.image(FROST_ORIGIN.x, FROST_ORIGIN.y, key).setOrigin(0, 0).setDepth(depth);
    this.paintBase(); this.paintWebs(); this.compose();
    scene.events.once('shutdown', () => { this.stopAnim(); if (scene.textures.exists(key)) scene.textures.remove(key); });
  }

  webGeom(w) {
    const p = PANES[w.pane]; const r = rng(w.seed);
    const R = Math.min(p.w, p.h) * 0.4;
    return {
      pane: w.pane, seed: w.seed, R, rot: r() * Math.PI,
      cx: p.x - FROST_ORIGIN.x + p.w / 2 + (r() - 0.5) * (p.w - 2 * R) * 0.6,
      cy: p.y - FROST_ORIGIN.y + p.h / 2 + (r() - 0.5) * (p.h - 2 * R) * 0.6,
    };
  }

  clip(ctx, i) {
    const p = PANES[i];
    ctx.beginPath(); ctx.rect(p.x - FROST_ORIGIN.x, p.y - FROST_ORIGIN.y, p.w, p.h); ctx.clip();
  }

  // Кромка инея: мягкая дымка у рам + папоротники. Глубина — level (0..1 → 10..58 px).
  paintBase() {
    const ctx = this.base.getContext('2d'); ctx.clearRect(0, 0, W, H);
    const D = 10 + 48 * this.level;
    PANES.forEach((p, i) => {
      ctx.save(); this.clip(ctx, i);
      const x = p.x - FROST_ORIGIN.x; const y = p.y - FROST_ORIGIN.y;
      // стекло Огнёвки теплее — инея там меньше
      const kd = i === 1 ? 0.62 : 1;
      const d = D * kd;
      const sides = [
        [x, y, x, y + d * 0.8, 0], [x, y + p.h, x, y + p.h - d * 1.2, 0],
        [x, y, x + d * 0.9, y, 0], [x + p.w, y, x + p.w - d * 0.9, y, 0],
      ];
      for (const [x0, y0, x1, y1] of sides) {
        const g = ctx.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, ICE(0.34)); g.addColorStop(0.55, ICE(0.1)); g.addColorStop(1, ICE(0));
        ctx.fillStyle = g; ctx.fillRect(x, y, p.w, p.h);
      }
      ctx.lineCap = 'round';
      for (const c of this.crystals[i]) {
        const r = rng(c.seed);
        fern(ctx, c.x, c.y, c.a, c.len * d * 0.85, 2, r, 0.42, c.w);
      }
      // изморозь-искорки
      const r = rng(900 + i);
      for (let k = 0; k < 40 + 70 * this.level; k++) {
        const e = r(); const t = r(); const dd = Math.pow(r(), 2) * d;
        let px; let py;
        if (e < 0.25) { px = x + t * p.w; py = y + dd; } else if (e < 0.55) { px = x + t * p.w; py = y + p.h - dd * 1.2; } else if (e < 0.78) { px = x + dd; py = y + t * p.h; } else { px = x + p.w - dd; py = y + t * p.h; }
        ctx.fillStyle = ICE(0.5 + r() * 0.45); ctx.fillRect(px, py, 1.4, 1.4);
      }
      ctx.restore();
    });
  }

  paintWebs() {
    const ctx = this.webLayer.getContext('2d'); ctx.clearRect(0, 0, W, H);
    for (const w of this.webs) { ctx.save(); this.clip(ctx, w.pane); drawWebFrost(ctx, w, w.k); ctx.restore(); }
  }

  compose() {
    const ctx = this.ctx; ctx.clearRect(0, 0, W, H);
    ctx.drawImage(this.base, 0, 0); ctx.drawImage(this.webLayer, 0, 0);
    for (const m of this.melts) {
      const x = m.x - FROST_ORIGIN.x; const y = m.y - FROST_ORIGIN.y; const R = m.r * Math.min(1, m.k * 1.4);
      if (R < 1) continue;
      const r = rng(m.seed || 7);
      ctx.save(); ctx.globalCompositeOperation = 'destination-out';
      const g = ctx.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.72, 'rgba(0,0,0,0.92)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
      // талая вода стекает вниз дорожками
      const drips = 2 + Math.floor(r() * 3); const dk = Math.max(0, m.k - 0.35) / 0.65;
      for (let k = 0; k < drips; k++) {
        const dx = x + (r() - 0.5) * R * 1.2; const len = (18 + r() * 46) * dk; const y0 = y + R * 0.55;
        ctx.lineCap = 'round';
        for (let s = 0; s < 6; s++) {
          ctx.lineWidth = 3.4 - s * 0.45; ctx.strokeStyle = 'rgba(0,0,0,0.95)';
          ctx.beginPath(); ctx.moveTo(dx, y0 + len * s / 6); ctx.lineTo(dx + Math.sin(s + k) * 0.8, y0 + len * (s + 1) / 6); ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(dx, y0 + len, 2.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      // край проталины снова прихватывает морозом: тонкий светлый ободок
      if (m.k >= 1) {
        ctx.save(); ctx.strokeStyle = ICE(0.32); ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(x, y, R * 0.97, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
    }
    curtainMask(ctx);
    this.tex.refresh();
  }

  setTint(c) { this.image.setTint(c); return this; }

  stopAnim() { if (this.anim) { this.anim.remove(false); this.anim = null; } }

  // Плавный процесс: fn(k) на каждом шаге (≈30 к/с), resolve по окончании. instant — сразу итог.
  animate(ms, fn, instant) {
    return new Promise((resolve) => {
      if (instant || ms <= 0) { fn(1); resolve(); return; }
      const t0 = this.scene.time.now;
      const ev = this.scene.time.addEvent({
        delay: 33, loop: true, callback: () => {
          const k = Math.min(1, (this.scene.time.now - t0) / ms);
          fn(k);
          if (k >= 1) { ev.remove(false); resolve(); }
        },
      });
    });
  }

  // Мороз крепчает: кромка подрастает до level.
  grow(level, ms = 4000, instant = false) {
    const from = this.level;
    return this.animate(ms, (k) => {
      this.level = from + (level - from) * (1 - (1 - k) * (1 - k));
      this.paintBase(); this.compose();
    }, instant);
  }

  // Паутинка инея на стекле pane (seed — для повторения узора в следующие дни).
  addWeb(pane, seed, ms = 2600, instant = false) {
    const w = { ...this.webGeom({ pane, seed }), k: 0 };
    this.webs.push(w);
    return this.animate(ms, (k) => { w.k = k; this.paintWebs(); this.compose(); }, instant);
  }

  // Проталина от удара Огнёвки.
  melt(x, y, r, seed, ms = 1800, instant = false) {
    const m = { x, y, r, seed, k: 0 };
    this.melts.push(m);
    return this.animate(ms, (k) => { m.k = k; this.compose(); }, instant);
  }
}
