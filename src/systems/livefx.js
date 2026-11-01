// Живой кадр (только WebGL): одна карта смещения на всю игру и фильтр на мировой камере сцены.
// • Живая линия — контуры чуть «дрожат», как в рисованном мультфильме: карта шума сменяется 8 раз в секунду
//   (три заранее нарисованных варианта), смещение около 1 px. Рисунок не плывёт, а «перерисовывается».
// • Марево жара — у окна, где сидит Огнёвка, воздух дрожит тем сильнее, чем выше температура:
//   в прямоугольник марева на карте рисуется поднимающийся вверх шум.
// • Цвет — тёплый при жаре, прохладнее и чётче с каждой нитью (ColorMatrix).
// Уровень качества low и «меньше движения» в системе: без дрожания и марева, только цвет.
// Canvas-рендер фильтров не умеет — там остаются обычные полупрозрачные заливки сцен.
import * as Phaser from 'phaser';
import { Quality } from './quality.js';
import { prefersReducedMotion } from '../config/game.js';

const MAP_W = 480; const MAP_H = 270; const SCALE = 1920 / MAP_W;
const TILE = 128;
const BOIL_MS = 125;
// Смещение в долях кадра: px = (значение карты − 0.5) × AMOUNT × 1920.
const AMOUNT = 0.0042;

// Периодический сглаженный шум (тайл без швов) для каналов R и G.
function noiseTile(seed, cellsX, cellsY, contrast) {
  let s = seed >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const grid = (n, m) => Array.from({ length: m }, () => Array.from({ length: n }, () => rnd() * 2 - 1));
  const gr = grid(cellsX, cellsY); const gg = grid(cellsX, cellsY);
  const c = document.createElement('canvas'); c.width = TILE; c.height = TILE;
  const ctx = c.getContext('2d'); const img = ctx.createImageData(TILE, TILE);
  const smooth = (t) => t * t * (3 - 2 * t);
  const sample = (g, x, y) => {
    const fx = x / TILE * cellsX; const fy = y / TILE * cellsY;
    const x0 = Math.floor(fx); const y0 = Math.floor(fy);
    const tx = smooth(fx - x0); const ty = smooth(fy - y0);
    const a = g[y0 % cellsY][x0 % cellsX]; const b = g[y0 % cellsY][(x0 + 1) % cellsX];
    const cc = g[(y0 + 1) % cellsY][x0 % cellsX]; const d = g[(y0 + 1) % cellsY][(x0 + 1) % cellsX];
    return (a + (b - a) * tx) * (1 - ty) + (cc + (d - cc) * tx) * ty;
  };
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const i = (y * TILE + x) * 4;
      img.data[i] = Math.round(128 + sample(gr, x, y) * contrast);
      img.data[i + 1] = Math.round(128 + sample(gg, x, y) * contrast);
      img.data[i + 2] = 128; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// Серая рамка с мягким краем: прозрачная середина. Возвращает края марева к нейтральному серому.
function softFrame() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const ctx = c.getContext('2d'); const img = ctx.createImageData(64, 64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const dx = Math.min(x, 63 - x) / 18; const dy = Math.min(y, 63 - y) / 18;
      const k = Math.min(1, Math.min(dx, dy));
      const i = (y * 64 + x) * 4;
      img.data[i] = 128; img.data[i + 1] = 128; img.data[i + 2] = 128;
      img.data[i + 3] = Math.round(255 * (1 - k * k * (3 - 2 * k)));
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export const LiveFX = {
  ready: false,
  dt: null,
  users: 0,
  boilIdx: 0,
  boilAt: 0,
  haze: null, // { x, y, w, h, k }
  hazeT: 0,
  dirty: true,

  // Вызывается один раз из BootScene после создания текстур.
  init(scene) {
    if (this.ready || scene.renderer.type !== Phaser.WEBGL) return;
    const tm = scene.textures;
    for (let i = 0; i < 3; i++) if (!tm.exists(`fx_boil_${i}`)) tm.addImage(`fx_boil_${i}`, noiseTile(101 + i * 977, 14, 14, 44));
    if (!tm.exists('fx_haze')) tm.addImage('fx_haze', noiseTile(4242, 6, 3, 120));
    if (!tm.exists('fx_haze_frame')) tm.addImage('fx_haze_frame', softFrame());
    this.dt = tm.addDynamicTexture('fx_dispmap', MAP_W, MAP_H);
    this.dt.fill(0x808080, 1).render();
    this.ready = true;
  },

  get boilOn() { return Quality.level !== 'low' && !prefersReducedMotion(); },

  // Подключить к камере. Возвращает { disp, grade } (или null без WebGL). Отключается при остановке сцены.
  attach(scene, camera, { boil = true, grade = true, haze = false } = {}) {
    if (!this.ready || !camera.filters || Quality.level === 'low') return null;
    const out = { disp: null, grade: null, boil };
    try {
      if ((boil && this.boilOn) || (haze && !prefersReducedMotion())) {
        out.disp = camera.filters.internal.addDisplacement('fx_dispmap', AMOUNT, AMOUNT);
        this.users += 1; out.counted = true;
      }
      if (grade) out.grade = camera.filters.internal.addColorMatrix();
    } catch (e) {
      console.info('[livefx] фильтры недоступны', e && e.message);
      return null;
    }
    out.wantBoil = boil;
    scene.events.once('shutdown', () => {
      if (out.counted) this.users = Math.max(0, this.users - 1);
      if (haze) this.setHaze(null);
    });
    this.dirty = true;
    return out;
  },

  // Марево в мировых координатах (1920×1080); k — сила 0..1. null — убрать.
  setHaze(rect, k = 0) {
    this.haze = rect && k > 0.01 ? { ...rect, k: Math.min(1, k) } : null;
    this.dirty = true;
  },

  // Цвет кадра: heat 0..1 — жар (теплее и насыщеннее), cool 0..1 — нити (прохладнее, чуть контрастнее).
  grade(fx, heat = 0, cool = 0) {
    if (!fx || !fx.grade) return;
    const w = Math.max(0, heat - cool * 0.5);
    const r = 1 + 0.07 * w - 0.015 * cool; const g = 1 + 0.012 * w; const b = 1 - 0.1 * w + 0.03 * cool;
    const cm = fx.grade.colorMatrix;
    cm.set([r, 0, 0, 0, 0, 0, g, 0, 0, 0, 0, 0, b, 0, 0, 0, 0, 0, 1, 0]);
    cm.saturate(0.12 * w - 0.04 * cool, true);
    if (cool > 0) cm.contrast(0.05 * cool, true);
  },

  // Каждый кадр из Overlay (одна карта на все сцены).
  update(time, delta) {
    if (!this.ready || this.users <= 0) return;
    const boil = this.boilOn;
    if (boil && time - this.boilAt >= BOIL_MS) { this.boilAt = time; this.boilIdx = (this.boilIdx + 1) % 3; this.dirty = true; }
    if (this.haze) { this.hazeT += delta / 1000; this.dirty = true; }
    if (!this.dirty) return;
    this.dirty = false;
    const dt = this.dt;
    dt.clear();
    dt.fill(0x808080, 1);
    if (boil) dt.repeat(`fx_boil_${this.boilIdx}`, null, 0, 0, MAP_W, MAP_H, { alpha: 1 });
    const h = this.haze;
    if (h && !prefersReducedMotion()) {
      const x = h.x / SCALE; const y = h.y / SCALE; const w = h.w / SCALE; const hh = h.h / SCALE;
      dt.repeat('fx_haze', null, x, y, w, hh, {
        alpha: 0.35 + 0.65 * h.k, tilePositionY: this.hazeT * 9, tilePositionX: Math.sin(this.hazeT * 0.7) * 6, tileScaleX: 0.7, tileScaleY: 1.4,
      });
      dt.stamp('fx_haze_frame', null, x + w / 2, y + hh / 2, { scaleX: w / 64, scaleY: hh / 64 });
    }
    dt.render();
  },
};
