// Мама — перекладная кукла в рост (~640 px), смотрит вправо (для взгляда влево — scaleX = −1).
// Процедурная ходьба: фаза шага привязана к пройденному пути. Опорная ступня стоит на полу неподвижно
// (едет назад ровно со скоростью тела), переносимая — дугой с подъёмом колена; перекат с пятки на носок,
// таз ниже всего в момент постановки ноги и выше всего над опорной ногой, руки идут в противофазе ногам
// и сгибаются в локте при махе вперёд. Руки можно «привязать» к точкам (ложка, чашка, лоб мальчика):
// переход к цели и обратно — с плавным разгоном и торможением (minimum jerk), без рывка в начале.
// Наклон идёт «от бёдер»: таз берёт треть наклона и уходит назад, корпус — остальное, голова лишь
// немного компенсирует. Наклон, присед и посадка — на критически задемпфированных пружинах.
// setSit — сидит в кресле (вставая и садясь, корпус подаётся вперёд), setSleep — дремлет.
// В стойке — дыхание и лёгкий перенос веса с ноги на ногу.
import { Rig, approach } from './Rig.js';
import { voice } from '../voice.js';

const HIP_Y = -280;
const THIGH = 132; const SHIN = 134;
const UP = 96; const FO = 90;
const STRIDE = 130; // путь тела за один шаг, px (полный цикл = 2 шага)
const STANCE = 0.62; // доля цикла, когда нога стоит на полу
const STEP_LEN = STANCE * 2 * STRIDE; // насколько опорная ступня «уезжает» назад за время опоры

// Критически задемпфированная пружина: плавный разгон и торможение без перелёта.
function spring(o, key, target, omega, dt) {
  const n = Math.max(1, Math.ceil(dt / 0.02)); const h = dt / n;
  let x = o[key]; let v = o[`${key}V`] || 0;
  for (let i = 0; i < n; i++) { v += (omega * omega * (target - x) - 2 * omega * v) * h; x += v * h; }
  o[key] = x; o[`${key}V`] = v;
}
const smoother = (k) => k * k * k * (k * (k * 6 - 15) + 10);
const frac = (v) => v - Math.floor(v);

export class MomRig extends Rig {
  constructor(scene, x, y = 935) {
    super(scene, x, y);
    this.t = 0;
    this.phase = 0;
    this.walking = 0; // 0..1 — смешивание ходьбы и стойки
    this.lean = 0; this.leanTarget = 0;
    this.headTiltTarget = 0; this.headTilt = 0;
    this.faceOverride = null;
    this.blinkT = 1.5 + Math.random() * 3;
    this.blinking = 0;
    this.armTargets = { near: null, far: null }; // null — свободные руки (качаются)
    this.hands = { near: { x: 30, y: -330 }, far: { x: -20, y: -330 } };
    // переходы рук: откуда (позиция и поворот кисти) и насколько пройдено (0..1)
    this.armMove = { near: { k: 1, dur: 0.4, fx: 30, fy: -330, fr: 0.1, key: null, rot: 0.1 }, far: { k: 1, dur: 0.4, fx: -20, fy: -330, fr: 0.1, key: null, rot: 0.1 } };
    this.crouch = 0; this.crouchTarget = 0;
    this.sit = 0; this.sitTarget = 0;
    this.asleep = false; this.sleepK = 0;

    this.addBone('root', null, 0, 0);
    this.addBone('pelvis', 'root', 0, HIP_Y);
    this.addBone('fThigh', 'pelvis', -8, 0, 0, THIGH);
    this.addBone('fShin', 'fThigh', 0, THIGH, 0, SHIN);
    this.addBone('fFoot', 'fShin', 0, SHIN);
    this.addBone('nThigh', 'pelvis', 8, 0, 0, THIGH);
    this.addBone('nShin', 'nThigh', 0, THIGH, 0, SHIN);
    this.addBone('nFoot', 'nShin', 0, SHIN);
    this.addBone('torso', 'pelvis', 0, -26);
    this.addBone('head', 'torso', 6, -150);
    this.addBone('fUp', 'torso', -16, -142, 0, UP);
    this.addBone('fFo', 'fUp', 0, UP, 0, FO);
    this.addBone('fHand', 'fFo', 0, FO);
    this.addBone('nUp', 'torso', 14, -142, 0, UP);
    this.addBone('nFo', 'nUp', 0, UP, 0, FO);
    this.addBone('nHand', 'nFo', 0, FO);

    const shade = 0xcdc4cf;
    this.attach('fUp', 'mom_upper', { ox: 25, oy: 22, z: 0, name: 'fUp', tint: shade });
    this.attach('fFo', 'mom_fore', { ox: 22, oy: 19, z: 1, name: 'fFo', tint: shade });
    this.attach('fHand', 'mom_hand', { ox: 23, oy: 10, z: 2, name: 'fHand', tint: shade });
    this.attach('fThigh', 'mom_thigh', { ox: 23, oy: 20, z: 3, tint: shade, name: 'fThigh' });
    this.attach('fShin', 'mom_shin', { ox: 19, oy: 16, z: 3.1, tint: shade, name: 'fShin' });
    this.attach('fFoot', 'mom_shoe', { ox: 22, oy: 14, z: 3.2, tint: shade, name: 'fShoe' });
    this.attach('nThigh', 'mom_thigh', { ox: 23, oy: 20, z: 4, name: 'nThigh' });
    this.attach('nShin', 'mom_shin', { ox: 19, oy: 16, z: 4.1, name: 'nShin' });
    this.attach('nFoot', 'mom_shoe', { ox: 22, oy: 14, z: 4.2, name: 'nShoe' });
    this.attach('pelvis', 'mom_skirt', { ox: 95, oy: 12, dy: -30, z: 5, name: 'skirt' });
    this.attach('head', 'mom_head', { ox: 72, oy: 160, z: 6, name: 'head' });
    this.attach('head', 'mom_eyes_open', { ox: 40, oy: 20, dx: 24, dy: -80, z: 6.5, name: 'eyes' });
    this.attach('head', 'mom_mouth_smile', { ox: 20, oy: 15, dx: 36, dy: -44, z: 6.5, name: 'mouth' });
    this.attach('torso', 'mom_torso', { ox: 85, oy: 180, dy: 0, z: 7, name: 'torso' });
    this.attach('nUp', 'mom_upper', { ox: 25, oy: 22, z: 10, name: 'nUp' });
    this.attach('nFo', 'mom_fore', { ox: 22, oy: 19, z: 11, name: 'nFo' });
    this.attach('nHand', 'mom_hand', { ox: 23, oy: 10, z: 12, name: 'nHand' });
    this.props = {};

    this.onUpdate = (time, delta) => this.tick(Math.min(0.05, delta / 1000));
    scene.events.on('update', this.onUpdate);
    this.once('destroy', () => scene.events.off('update', this.onUpdate));
    this.tick(0);
  }

  get facing() { return this.scaleX < 0 ? -1 : 1; }

  // Поворот: на виду — коротко «через ребро» (фигура сужается и раскрывается зеркально), без мгновенного
  // переворота; невидимая — сразу.
  face(dir, instant = false) {
    const want = dir < 0 ? -1 : 1;
    const cur = this.turn ? this.turn.to : this.facing;
    const mag = this.turn ? this.turn.mag : Math.abs(this.scaleX);
    if (instant || this.t < 0.05 || !this.visible || this.alpha < 0.05) {
      this.turn = null; this.scaleX = mag * want; return this;
    }
    if (want === cur) return this;
    // разворот посреди поворота — доигрываем назад с того же места, без скачка
    this.turn = { to: want, mag, k: this.turn ? 1 - this.turn.k : 0 };
    return this;
  }

  // Во время поворота координаты целей считаются по полному масштабу (иначе руки «улетают»).
  sceneToLocal(x, y) {
    const sx = this.turn ? (this.turn.k < 0.5 ? -this.turn.to : this.turn.to) * this.turn.mag : this.scaleX;
    return { x: (x - this.x) / sx, y: (y - this.y) / this.scaleY };
  }

  setFace(face, ms = 0) {
    this.faceOverride = face;
    if (this.faceTimer) { this.faceTimer.remove(false); this.faceTimer = null; }
    if (face && ms > 0) this.faceTimer = this.scene.time.delayedCall(ms, () => { this.faceOverride = null; });
    return this;
  }

  // Рука тянется к точке сцены; null — отпустить.
  reach(which, sceneX, sceneY) {
    if (sceneX === null || sceneX === undefined) { this.armTargets[which] = null; return this; }
    this.armTargets[which] = { sx: sceneX, sy: sceneY };
    return this;
  }

  // Локальная цель руки (в системе куклы), удобна для «держать поднос перед собой».
  reachLocal(which, x, y) { this.armTargets[which] = x === null ? null : { lx: x, ly: y }; return this; }

  setLean(r) { this.leanTarget = r; return this; }

  setCrouch(k) { this.crouchTarget = k; return this; }

  // 0 — стоит, 1 — сидит (таз опускается, ступни уходят вперёд).
  setSit(k, instant = false) { this.sitTarget = k; if (instant) { this.sit = k; this.sitV = 0; } return this; }

  setSleep(on, instant = false) { this.asleep = !!on; if (instant) this.sleepK = on ? 1 : 0; return this; }

  tiltHead(r) { this.headTiltTarget = r; return this; }

  // Реквизит в руке ('near' | 'far' | 'torso'): поднос, ложка, носки, тарелка.
  hold(which, key, { ox, oy, dx = 0, dy = 8, r = 0, scale = 1, z } = {}) {
    this.drop(which);
    if (!key) return null;
    const fr = this.scene.textures.getFrame(key);
    const bone = which === 'far' ? 'fHand' : which === 'torso' ? 'torso' : 'nHand';
    const part = this.attach(bone, key, {
      ox: ox ?? fr.width / 2, oy: oy ?? fr.height / 2, dx, dy, r, scale, z: z ?? (which === 'far' ? 2.5 : 11.5), name: `prop_${which}`,
    });
    this.props[which] = part;
    this.pose();
    return part;
  }

  drop(which) {
    const p = this.props[which];
    if (!p) return;
    this.parts.splice(this.parts.indexOf(p), 1); p.img.destroy();
    delete this.props[which];
  }

  // Мировая точка кисти (куда «приклеить» вынутый предмет).
  handPoint(which = 'near') {
    this.solve();
    const b = this.bone(which === 'far' ? 'fHand' : 'nHand');
    const p = this.boneToLocal(which === 'far' ? 'fHand' : 'nHand', 0, 22);
    return this.localToScene(p.x, p.y);
  }

  // Пройти к x (Promise). speed — px/с.
  walkTo(x, { speed = 260 } = {}) {
    const dist = Math.abs(x - this.x);
    if (dist < 2) return Promise.resolve();
    this.face(x > this.x ? 1 : -1);
    return new Promise((resolve) => {
      this.walking = this.walking || 0.01;
      this.walkGoal = x;
      this.walkResolve = () => { this.walkResolve = null; resolve(); };
      this.walkTween = this.scene.tweens.add({
        targets: this, x, duration: (dist / speed) * 1000, ease: (k) => (k < 0.12 ? (k / 0.12) ** 2 * 0.06 : k > 0.88 ? 1 - ((1 - k) / 0.12) ** 2 * 0.06 : 0.06 + (k - 0.12) / 0.76 * 0.88),
        onComplete: () => { this.walkGoal = null; this.walkTween = null; if (this.walkResolve) this.walkResolve(); },
      });
    });
  }

  // Мгновенно дойти (пропуск катсцены).
  finishWalk() {
    if (!this.walkTween) return;
    const goal = this.walkGoal;
    this.walkTween.stop(); this.walkTween = null;
    if (goal !== null && goal !== undefined) this.x = goal;
    this.walkGoal = null; this.walking = 0; this.lastX = this.x;
    if (this.walkResolve) this.walkResolve();
  }

  wait(ms) { return new Promise((r) => this.scene.time.delayedCall(ms, r)); }

  currentFace() {
    const f = { eyes: 'open', mouth: 'smile', ...(this.faceOverride || {}) };
    if (this.asleep) { f.eyes = 'closed'; f.mouth = 'closed'; }
    if (this.blinking > 0 && f.eyes === 'open') f.eyes = 'closed';
    const m = voice.mouth('Мама');
    if (m > 0.06) f.mouth = m > 0.55 ? 'open' : 'half';
    return f;
  }

  tick(dt) {
    this.t += dt;
    if (this.turn) {
      const tr = this.turn; tr.k = Math.min(1, tr.k + dt / 0.2);
      const sign = tr.k < 0.5 ? -tr.to : tr.to;
      this.scaleX = sign * tr.mag * Math.max(0.1, Math.abs(Math.cos(Math.PI * tr.k)));
      if (tr.k >= 1) { this.scaleX = tr.to * tr.mag; this.turn = null; }
    }
    const moving = this.walkGoal !== null && this.walkGoal !== undefined;
    this.walking = approach(this.walking, moving ? 1 : 0, moving ? 8 : 6, dt);
    if (this.lastX === undefined) this.lastX = this.x;
    const dx = Math.abs(this.x - this.lastX); this.lastX = this.x;
    this.phase += (dx / (this.turn ? this.turn.mag : Math.abs(this.scaleX || 1))) / STRIDE * Math.PI;
    if (!moving && this.walking < 0.05) this.phase = approach(this.phase, Math.round(this.phase / Math.PI) * Math.PI, 6, dt);
    const ph = this.phase; const w = this.walking;
    spring(this, 'lean', this.leanTarget + w * 0.05, 6, dt);
    spring(this, 'headTilt', this.headTiltTarget, 6, dt);
    spring(this, 'crouch', this.crouchTarget, 6, dt);
    spring(this, 'sit', this.sitTarget, 4.2, dt);
    this.sit = Math.min(1.02, Math.max(-0.02, this.sit));
    this.sleepK = approach(this.sleepK, this.asleep ? 1 : 0, 2.5, dt);
    const sl = this.sleepK; const sit = Math.min(1, Math.max(0, this.sit));
    const t = this.t;
    const breath = Math.sin(t * (1.9 - sl * 0.9));
    // вставая и садясь, человек подаётся корпусом вперёд
    const rise = Math.min(0.32, Math.abs(this.sitV || 0) * 0.3);
    // в стойке вес плавно переходит с ноги на ногу
    const idle = (1 - w) * (1 - sit);
    const sway = Math.sin(t * 0.85) * idle;

    // таз: ниже всего при постановке ноги, выше всего над опорной ногой; при наклоне уходит назад
    const lean = this.lean + rise;
    const hipLean = lean * 0.35;
    const bob = (0.5 - 0.5 * Math.cos(2 * (ph - 0.12 * Math.PI))) * 9 * w;
    const pelvis = this.bone('pelvis');
    pelvis.y = HIP_Y - bob + 4 * w + this.crouch * 34 + sit * 128 + Math.abs(sway) * 1.5;
    pelvis.x = sway * 3 - Math.max(0, lean) * 40 * (1 - sit) - sit * 8;
    pelvis.rotation = hipLean * (1 - sit * 0.6) + Math.sin(2 * ph) * 0.02 * w;
    const torso = this.bone('torso');
    const torsoSway = Math.sin(2 * ph + 0.5) * 0.018 * w + Math.sin(t * 0.85 + 0.7) * 0.012 * idle;
    torso.rotation = (lean - hipLean) + hipLean * sit * 0.6 + torsoSway - sit * 0.05 * (1 - Math.min(1, Math.abs(lean) * 4)) - sl * 0.06;
    torso.y = -26 + breath * (0.8 + sl * 0.6) - bob * 0.15;
    // сидя юбка ложится на колени: поворачивается вперёд и укорачивается
    const skirt = this.part('skirt');
    skirt.r = -sit * 0.95 + Math.sin(2 * ph) * 0.015 * w;
    skirt.img.setScale(1, 1 - sit * 0.32);
    const head = this.bone('head');
    // голова гасит покачивание корпуса (взгляд остаётся ровным)
    head.rotation = this.headTilt - lean * 0.22 - torsoSway * 0.7 + Math.sin(t * 0.8) * 0.02 * (1 - sl) - sl * 0.2;
    this.solve();

    // ноги: опорная ступня неподвижна на полу, переносимая идёт дугой; перекат с пятки на носок
    const legs = [['nThigh', 'nShin', 'nFoot', 0, 6, 124], ['fThigh', 'fShin', 'fFoot', Math.PI, -4, 112]];
    for (const [th, sh, ft, off, baseX, sitX] of legs) {
      const u = frac((ph + off) / (2 * Math.PI));
      let fx; let lift = 0; let pitch = 0;
      if (u < STANCE) {
        const k = u / STANCE;
        fx = STEP_LEN * (0.5 - k);
        if (k < 0.15) pitch = -0.22 * (1 - k / 0.15); // пятка встала, носок ещё поднят
        else if (k > 0.7) pitch = 0.5 * ((k - 0.7) / 0.3) ** 1.5; // пятка отрывается, опора на носке
      } else {
        const v = (u - STANCE) / (1 - STANCE);
        fx = STEP_LEN * (-0.5 + smoother(v));
        lift = Math.sin(Math.PI * Math.min(1, v * 1.08)) * 24;
        pitch = 0.5 * (1 - v) ** 2 - 0.22 * Math.max(0, (v - 0.6) / 0.4); // носок тянется вниз, к постановке — вверх
      }
      // садясь и вставая, ступни не скользят: сначала шаг (с подъёмом ноги), потом таз идёт вниз/вверх
      const a0 = off ? 0.04 : 0.16;
      const fk = Math.min(1, Math.max(0, (sit - a0) / 0.3)); const fs = fk * fk * (3 - 2 * fk);
      fx = baseX + fx * w + fs * sitX + sway * (off ? -1.5 : 1.5);
      pitch *= w;
      const heelUp = pitch > 0 ? Math.sin(pitch) * 30 : 0; // перекат на носок поднимает лодыжку
      const sitStep = Math.sin(Math.PI * fs) * 16;
      this.ik(th, sh, fx, -20 - lift * w - heelUp - sitStep, -1); // −1: колено смотрит вперёд
      this.solve();
      this.bone(ft).rotation = pitch - this.bone(sh).wr; // ступня параллельна полу при любом наклоне таза
    }

    // руки: мах в противофазе ногам с отставанием, сгиб локтя при махе вперёд; переходы к целям — плавные
    this.solve();
    for (const [wName, up, fo, hd, off] of [['near', 'nUp', 'nFo', 'nHand', Math.PI], ['far', 'fUp', 'fFo', 'fHand', 0]]) {
      let tgt = this.armTargets[wName];
      // сидя и во сне руки лежат на коленях
      if (!tgt && sit > 0.5) tgt = { lx: wName === 'near' ? 92 : 64, ly: HIP_Y + 128 - 24, lap: true };
      const sh = this.bone(up);
      let tx; let ty; let tr;
      if (tgt) {
        const p = tgt.lx !== undefined ? { x: tgt.lx, y: tgt.ly } : this.sceneToLocal(tgt.sx, tgt.sy);
        tx = p.x; ty = p.y; tr = tgt.lap ? 0.25 : -0.6;
      } else {
        const u = frac((ph + off) / (2 * Math.PI) - 0.06);
        const fwd = -Math.cos(2 * Math.PI * u) * w; // −1 — рука сзади, +1 — впереди
        const a = -0.36 * fwd + Math.sin(t * 0.85 + (off ? 0 : 1)) * 0.015 * idle; // угол плеча от вертикали
        const bend = 0.12 + 0.3 * Math.max(0, fwd) + 0.04 * (1 - w); // сгиб локтя
        const ex = sh.wx - Math.sin(a) * UP; const ey = sh.wy + Math.cos(a) * UP;
        tx = ex - Math.sin(a - bend) * FO; ty = ey + Math.cos(a - bend) * FO + breath * 0.8;
        tr = 0.1 + 0.15 * Math.max(0, fwd);
      }
      // смена цели (или отпустить) — новый переход из текущего положения кисти
      const mv = this.armMove[wName]; const cur = this.hands[wName];
      const key = tgt ? (tgt.lap ? 'lap' : tgt) : null;
      if (key !== mv.key) {
        const dist = Math.hypot(tx - cur.x, ty - cur.y);
        mv.key = key; mv.k = 0; mv.fx = cur.x; mv.fy = cur.y; mv.fr = mv.rot;
        mv.dur = Math.min(0.85, Math.max(0.3, 0.22 + dist / 700));
      }
      mv.k = Math.min(1, mv.k + dt / mv.dur);
      const e = smoother(mv.k);
      cur.x = mv.fx + (tx - mv.fx) * e; cur.y = mv.fy + (ty - mv.fy) * e;
      mv.rot = mv.fr + (tr - mv.fr) * e;
      this.ik(up, fo, cur.x, cur.y, 1); // +1: локоть ниже линии плечо–кисть и смотрит назад, как у человека
      this.bone(hd).rotation = mv.rot;
    }

    // лицо
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blinking = 0.12; this.blinkT = 2 + Math.random() * 4; }
    if (this.blinking > 0) this.blinking -= dt;
    const f = this.currentFace();
    this.setPartTexture('eyes', `mom_eyes_${f.eyes}`);
    this.setPartTexture('mouth', `mom_mouth_${f.mouth}`);
    this.pose();
  }
}
