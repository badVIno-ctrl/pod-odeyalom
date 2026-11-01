// Театр теней.
// • WallShadow — тень Тихона на стене от ночника на тумбочке: силуэт той же куклы (лапы шевелятся так же),
//   увеличен и сдвинут от лампы; растёт, пока паук спускается ближе к свету. Видна, когда ночник горит.
// • DoorLight — свет из коридора: полоска под закрытой дверью (по ней проходят тени маминых шагов перед тем,
//   как она войдёт) и тёплое пятно на полу, пока дверь открыта.
import * as Phaser from 'phaser';
import { SpiderRig } from './spiderRig.js';
import { makeCanvas } from './paint.js';

export const LAMP = { x: 980, y: 548 };

export function tintDeep(obj, color) {
  if (obj.list) obj.list.forEach((c) => tintDeep(c, color));
  else if (obj.setTint) obj.setTint(color);
}

export class WallShadow {
  constructor(scene, spider, { depth = 5.5, top = 44, hangY = 400, strength = 0.3 } = {}) {
    this.scene = scene; this.spider = spider; this.top = top; this.hangY = hangY; this.strength = strength;
    // ядро тени и мягкий полутеневой ореол (контейнерам фильтры недоступны — ореол даёт второй силуэт крупнее)
    this.core = new SpiderRig(scene, 0, 0, { scale: 1, silhouette: true, follow: spider }).setDepth(depth);
    this.halo = new SpiderRig(scene, 0, 0, { scale: 1, silhouette: true, follow: spider }).setDepth(depth - 0.01);
    this.lit = 0;
  }

  setScrollFactor(f) { this.core.setScrollFactor(f, f); this.halo.setScrollFactor(f, f); return this; }

  // lit 0..1 — насколько горит ночник (и темно вокруг, чтобы тень читалась)
  update(lit) {
    this.lit = lit;
    const s = this.spider;
    const a = s.visible ? s.alpha * lit * this.strength : 0;
    for (const r of [this.core, this.halo]) r.setVisible(a > 0.01);
    if (a <= 0.01) return;
    const k = Phaser.Math.Clamp((s.y - this.top) / (this.hangY - this.top), 0, 1);
    // свет снизу слева: тень выше и правее паука; чем он ближе к ночнику, тем она крупнее
    const m = 1.03;
    const x = LAMP.x + (s.x - LAMP.x) * m + 14; const y = LAMP.y + (s.y - LAMP.y) * m - 30 - 120 * k;
    const sc = s.scaleX * (1.3 + 0.5 * k);
    this.core.setPosition(x, y).setScale(sc).setAlpha(a).setAngle(s.angle - 4);
    this.halo.setPosition(x + 3, y + 2).setScale(sc * 1.05).setAlpha(a * 0.45).setAngle(s.angle - 4);
  }

  destroy() { this.core.destroy(); this.halo.destroy(); }
}

function stripTexture(scene, key, w, h) {
  if (scene.textures.exists(key)) return;
  const c = makeCanvas(w, h); const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(255,196,120,0)'); g.addColorStop(0.12, 'rgba(255,200,130,0.9)');
  g.addColorStop(0.88, 'rgba(255,200,130,0.9)'); g.addColorStop(1, 'rgba(255,196,120,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const v = ctx.createLinearGradient(0, 0, 0, h);
  v.addColorStop(0, 'rgba(0,0,0,0.85)'); v.addColorStop(0.35, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.9)');
  ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  scene.textures.addImage(key, c);
}

function footTexture(scene, key) {
  if (scene.textures.exists(key)) return;
  const c = makeCanvas(56, 16); const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(28, 8, 2, 28, 8, 28);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.6, 'rgba(0,0,0,0.85)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 56, 16);
  scene.textures.addImage(key, c);
}

function poolTexture(scene, key, w, h) {
  if (scene.textures.exists(key)) return;
  const c = makeCanvas(w, h); const ctx = c.getContext('2d');
  // трапеция света: от порога расширяется к зрителю
  ctx.beginPath(); ctx.moveTo(w * 0.3, 0); ctx.lineTo(w * 0.7, 0); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,200,130,0.5)'); g.addColorStop(1, 'rgba(255,200,130,0)');
  ctx.fillStyle = g; ctx.fill();
  ctx.globalCompositeOperation = 'destination-in';
  const s = ctx.createLinearGradient(0, 0, w, 0);
  s.addColorStop(0, 'rgba(0,0,0,0)'); s.addColorStop(0.25, 'rgba(0,0,0,1)'); s.addColorStop(0.75, 'rgba(0,0,0,1)'); s.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = s; ctx.fillRect(0, 0, w, h);
  scene.textures.addImage(key, c);
}

export class DoorLight {
  // door — ROOM.door, leaf — створка (scaleX 1 закрыта … 0.16 настежь)
  constructor(scene, door, leaf, { depth = 3.5, warm = 1 } = {}) {
    this.scene = scene; this.door = door; this.leaf = leaf; this.warm = warm;
    const SW = door.w - 24; const SH = 12;
    stripTexture(scene, 'door_strip', SW, SH); footTexture(scene, 'door_foot'); poolTexture(scene, 'door_pool', 520, 200);
    this.dt = scene.textures.exists('door_strip_dt') ? scene.textures.get('door_strip_dt') : scene.textures.addDynamicTexture('door_strip_dt', SW, SH);
    this.SW = SW; this.SH = SH;
    this.strip = scene.add.image(door.x + 12, door.y + door.h - SH + 2, 'door_strip_dt').setOrigin(0, 0)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(depth);
    this.pool = scene.add.image(door.x + door.w * 0.5 + 40, door.y + door.h - 4, 'door_pool').setOrigin(0.5, 0)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(1.5).setAlpha(0);
    this.feet = null; // { x, phase }
    this.level = 1;
    this.redraw();
    this.tick = () => this.update();
    scene.events.on('update', this.tick);
    scene.events.once('shutdown', () => scene.events.off('update', this.tick));
  }

  setScrollFactor(f) { this.strip.setScrollFactor(f, f); this.pool.setScrollFactor(f, f); return this; }

  // level — яркость света в коридоре (ночью тусклее)
  setLevel(v) { this.level = v; return this; }

  redraw() {
    const dt = this.dt; dt.clear();
    dt.stamp('door_strip', null, this.SW / 2, this.SH / 2, { alpha: 1 });
    if (this.feet) {
      const f = this.feet; const step = Math.sin(f.phase);
      // две ступни: пока одна стоит, другая переносится (тень то шире, то уже)
      dt.erase('door_foot', f.x - 18 + step * 12, this.SH / 2 + 2);
      dt.erase('door_foot', f.x + 18 - step * 12, this.SH / 2 + 2);
    }
    dt.render();
  }

  update() {
    const open = Phaser.Math.Clamp((1 - this.leaf.scaleX) / 0.84, 0, 1);
    this.strip.setAlpha(0.6 * this.level * (1 - open * 0.8));
    this.pool.setAlpha(0.55 * this.level * open);
    if (this.feet) this.redraw();
  }

  // Шаги за дверью: тень ног проходит по полоске света и останавливается у ручки.
  steps(ms = 1300, { from = -40, to = null, stop = true } = {}) {
    const end = to ?? this.SW * 0.72;
    this.feet = { x: from, phase: 0 };
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this.feet, x: end, phase: Math.PI * 2 * (ms / 520), duration: ms, ease: stop ? 'Sine.easeOut' : 'Linear',
        onComplete: () => { if (!stop) this.feet = null; this.redraw(); resolve(); },
      });
    });
  }

  clearFeet() { this.feet = null; this.redraw(); }
}
