// «Сцена-диорама»: мир и интерфейс рисуют две камеры.
// Мировая камера (main) чуть смещается за мышью или наклоном телефона — слои комнаты сдвигаются
// по-разному (стена дальше, кровать ближе), и на неё же вешаются фильтры кадра (живая линия, марево).
// Камера интерфейса неподвижна и без фильтров: HUD, кнопки, листки и субтитры не дрожат и не плывут.
// Объект с depth ≥ uiDepth рисует только камера интерфейса, остальные — только мировая.
import { prefersReducedMotion } from '../config/game.js';

const FX_METHODS = ['fadeIn', 'fadeOut', 'fade', 'resetFX', 'flash'];

export function splitStage(scene, { uiDepth = 880 } = {}) {
  const world = scene.cameras.main;
  const ui = scene.cameras.add(0, 0, world.width, world.height, false, 'ui');
  // затемнения и вспышки мировой камеры повторяются на камере интерфейса (иначе HUD висел бы в чёрном кадре)
  for (const fn of FX_METHODS) {
    const orig = world[fn].bind(world);
    world[fn] = (...args) => {
      try { ui[fn](...args.slice(0, 4)); } catch { /* камера уже уничтожена */ }
      return orig(...args);
    };
  }
  const assign = () => {
    const w = world.id; const u = ui.id;
    const list = scene.children.list;
    for (let i = 0; i < list.length; i++) {
      const go = list[i];
      go.cameraFilter = go.depth >= uiDepth ? w : u;
    }
  };
  scene.events.on('prerender', assign);
  scene.events.once('shutdown', () => scene.events.off('prerender', assign));
  assign();
  return { world, ui };
}

// Параллакс: смещение мировой камеры (px) за указателем мыши; на телефоне — за наклоном, если он доступен.
// Слои двигаются на scrollFactor × смещение: 0 — неподвижно, 1 — как ближний план.
export class Parallax {
  constructor(scene, camera, { ampX = 14, ampY = 7 } = {}) {
    this.scene = scene; this.cam = camera; this.ampX = ampX; this.ampY = ampY;
    this.x = 0; this.y = 0; this.tx = 0; this.ty = 0; this.t = Math.random() * 10;
    this.enabled = !prefersReducedMotion();
    this.tilt = null;
    this.lastMove = -1e9;
    this.onMove = (p) => { this.lastMove = scene.time.now; this.pointer = p; };
    scene.input.on('pointermove', this.onMove);
    this.onTilt = (e) => {
      if (e.gamma == null || e.beta == null) return;
      // наклон влево-вправо ±25° и вперёд-назад вокруг удобных 40°
      this.tilt = { x: Math.max(-1, Math.min(1, e.gamma / 25)), y: Math.max(-1, Math.min(1, (e.beta - 40) / 25)) };
    };
    if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window && !DeviceOrientationEvent.requestPermission) {
      window.addEventListener('deviceorientation', this.onTilt);
    }
    this.tick = (time, delta) => this.update(delta);
    scene.events.on('update', this.tick);
    scene.events.once('shutdown', () => this.destroy());
  }

  update(delta) {
    if (!this.enabled) { this.cam.setScroll(0, 0); return; }
    const dt = Math.min(0.05, delta / 1000);
    this.t += dt;
    let nx = 0; let ny = 0;
    if (this.tilt) { nx = this.tilt.x; ny = this.tilt.y; }
    else if (this.pointer && this.scene.time.now - this.lastMove < 6000) {
      nx = (this.pointer.x - 960) / 960; ny = (this.pointer.y - 540) / 540;
    }
    // дыхание кадра: очень медленное покачивание, чтобы диорама жила и без мыши
    nx += Math.sin(this.t * 0.23) * 0.12; ny += Math.sin(this.t * 0.17 + 1.3) * 0.1;
    this.tx = Math.max(-1, Math.min(1, nx)) * this.ampX;
    this.ty = Math.max(-1, Math.min(1, ny)) * this.ampY;
    const k = 1 - Math.exp(-dt * 2.6);
    this.x += (this.tx - this.x) * k; this.y += (this.ty - this.y) * k;
    this.cam.setScroll(this.x, this.y);
  }

  destroy() {
    this.scene.input.off('pointermove', this.onMove);
    this.scene.events.off('update', this.tick);
    if (typeof window !== 'undefined') window.removeEventListener('deviceorientation', this.onTilt);
  }
}
