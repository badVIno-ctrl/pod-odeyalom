// Мини-движок «перекладной» анимации (cutout rig, как в Spine/Moho, но процедурный):
// дерево костей с опорными точками, к костям прикреплены картинки-детали с собственными пивотами,
// аналитическая IK для двух костей (рука/нога тянется к точке), z-порядок деталей.
//
// Соглашение: кость с rotation = 0 «смотрит вниз» (+y). Дочерние кости и детали задаются смещением
// (x, y) в системе координат родителя. Направление кости при повороте r: (−sin r, cos r).
import * as Phaser from 'phaser';

export const dirAngle = (dx, dy) => Math.atan2(-dx, dy); // угол кости, направленной по вектору (dx, dy)
const rot = (x, y, r) => { const c = Math.cos(r); const s = Math.sin(r); return { x: x * c - y * s, y: x * s + y * c }; };

// Двухзвенная IK. Возвращает мировые углы плеча и предплечья (в соглашении «вниз = 0»).
// bend = +1 / −1 — в какую сторону сгибается локоть/колено.
export function solveTwoBone(sx, sy, l1, l2, tx, ty, bend = 1) {
  let dx = tx - sx; let dy = ty - sy;
  let d = Math.hypot(dx, dy);
  const min = Math.abs(l1 - l2) + 0.001; const max = l1 + l2 - 0.001;
  if (d < 1e-6) { dx = 0; dy = 1; d = min; }
  const dc = Phaser.Math.Clamp(d, min, max);
  const base = dirAngle(dx, dy);
  const a = Math.acos(Phaser.Math.Clamp((l1 * l1 + dc * dc - l2 * l2) / (2 * l1 * dc), -1, 1));
  const b = Math.acos(Phaser.Math.Clamp((l1 * l1 + l2 * l2 - dc * dc) / (2 * l1 * l2), -1, 1));
  const upper = base + bend * a;
  const lower = upper - bend * (Math.PI - b);
  return { upper, lower, reach: d <= max };
}

export class Rig extends Phaser.GameObjects.Container {
  constructor(scene, x, y) {
    super(scene, x, y);
    this.bones = new Map();
    this.order = [];
    this.parts = [];
    scene.add.existing(this);
  }

  addBone(name, parent, x, y, rotation = 0, len = 0) {
    const b = { name, parent: parent ? this.bones.get(parent) : null, x, y, rotation, len, wx: 0, wy: 0, wr: 0, bx: x, by: y };
    this.bones.set(name, b);
    this.order.push(b);
    return b;
  }

  bone(name) { return this.bones.get(name); }

  // Деталь: картинка на кости. ox/oy — пивот внутри картинки (в пикселях), dx/dy — смещение пивота от кости.
  attach(boneName, key, { ox = 0, oy = 0, dx = 0, dy = 0, r = 0, z = 0, scale = 1, flipX = false, name = null, tint = null, alpha = 1 } = {}) {
    const img = this.scene.add.image(0, 0, key);
    const tex = img.frame;
    img.setOrigin(ox / tex.width, oy / tex.height).setScale(flipX ? -scale : scale, scale).setAlpha(alpha);
    if (tint !== null) img.setTint(tint);
    const part = { bone: this.bones.get(boneName), img, dx, dy, r, z, name: name || key, visible: true };
    this.parts.push(part);
    this.add(img);
    this.sortParts();
    return part;
  }

  part(name) { return this.parts.find((p) => p.name === name); }

  setPartTexture(name, key) {
    const p = this.part(name);
    if (p && p.img.texture.key !== key && this.scene.textures.exists(key)) p.img.setTexture(key);
  }

  setPartZ(name, z) { const p = this.part(name); if (p) { p.z = z; this.sortParts(); } }

  sortParts() {
    this.parts.sort((a, b) => a.z - b.z);
    this.parts.forEach((p) => this.bringToTop(p.img));
  }

  // Мировые (в системе контейнера) координаты точки (x, y), заданной в системе кости.
  boneToLocal(name, x = 0, y = 0) {
    const b = this.bones.get(name);
    const p = rot(x, y, b.wr);
    return { x: b.wx + p.x, y: b.wy + p.y };
  }

  // Мировые координаты сцены → система контейнера (учитывает масштаб и зеркалирование, без поворота).
  sceneToLocal(x, y) { return { x: (x - this.x) / this.scaleX, y: (y - this.y) / this.scaleY }; }

  localToScene(x, y) { return { x: this.x + x * this.scaleX, y: this.y + y * this.scaleY }; }

  // Поставить двухзвенную цепочку (upper → lower) так, чтобы конец lower тянулся к точке (контейнерные координаты).
  ik(upperName, lowerName, tx, ty, bend = 1, endLen = null) {
    this.solve();
    const u = this.bones.get(upperName); const l = this.bones.get(lowerName);
    const parentWr = u.parent ? u.parent.wr : 0;
    const l1 = u.len; const l2 = endLen ?? l.len;
    const res = solveTwoBone(u.wx, u.wy, l1, l2, tx, ty, bend);
    u.rotation = res.upper - parentWr;
    l.rotation = res.lower - res.upper;
    return res;
  }

  solve() {
    for (const b of this.order) {
      if (b.parent) {
        const p = rot(b.x, b.y, b.parent.wr);
        b.wx = b.parent.wx + p.x; b.wy = b.parent.wy + p.y; b.wr = b.parent.wr + b.rotation;
      } else { b.wx = b.x; b.wy = b.y; b.wr = b.rotation; }
    }
  }

  // Применить кости к картинкам (вызывать каждый кадр после изменения поз).
  pose() {
    this.solve();
    for (const p of this.parts) {
      const b = p.bone;
      const o = rot(p.dx, p.dy, b.wr);
      p.img.x = b.wx + o.x; p.img.y = b.wy + o.y; p.img.rotation = b.wr + p.r;
    }
  }
}

// Плавное приближение к цели (не зависит от FPS).
export const approach = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
