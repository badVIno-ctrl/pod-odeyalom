// Мальчик в кровати — перекладная кукла (cutout rig). Координаты контейнера = координаты текстуры
// кровати 860×540, контейнер стоит в левом верхнем углу кровати (1040, 460).
//
// Z-порядок (снизу вверх): рама кровати → дальняя рука → голова (глаза, рот) → одеяло →
// ближняя рука → отворот пододеяльника → реквизит в руке. Поэтому ближняя рука «выходит» из-под
// отворота, а дальняя — из-за головы и одеяла: нет эффекта «две руки из одной точки».
import { Rig, approach, dirAngle } from './Rig.js';
import { voice } from '../voice.js';

// Плечи спрятаны под отворотом (он закрывает полосу y ≈ 255…300 у груди): рука выходит из-под его края
// целиком, без «ломаного» плеча на одеяле.
const SH_NEAR = { x: 580, y: 282 };
const SH_FAR = { x: 604, y: 276 };
const HEAD = { x: 636, y: 222 };
const UP = 70; const FO = 64; // длины плеча и предплечья (по текстурам boy_upper / boy_fore)

// Позы рук. x, y — куда тянется запястье (координаты контейнера); fold: [x, y] — точка на отвороте
// (в его системе координат: кисть держится за край и едет вместе с ним).
// s — «поворот локтя» от −1 до +1 (swivel): ±1 — рука в плоскости экрана, локоть по одну или другую
// сторону линии плечо→кисть; 0 — локоть смотрит на зрителя (рука укорочена перспективой).
// Плавный переход s между позами даёт поворот руки в объёме вместо скачка локтя.
// wrist — сгиб кисти; over — кисть поверх отворота (держится за край).
const POSES = {
  rest: { near: { x: 476, y: 336, s: 0.62 }, far: { x: 545, y: 330, s: 1 } }, // рука расслаблена, локоть чуть согнут
  // вцепился в край одеяла: ближний локоть смотрит на зрителя и спрятан под отворотом, дальний уходит за голову
  blanket: { near: { fold: [38, -13], s: 0.15, wrist: -1.2, over: true }, far: { fold: [80, -8], s: -0.3, wrist: -2.6, over: true } },
  cheer: { near: { x: 520, y: 132, s: -1 }, far: { x: 724, y: 112, s: 1 } },
  cough: { near: { x: 630, y: 272, s: 0.4, wrist: 0.1 }, far: { x: 545, y: 330, s: 1 } },        // кулак у рта, локоть под отворотом
  mouth: { near: { x: 642, y: 266, s: 0.4, wrist: -0.5 }, far: { x: 545, y: 330, s: 1 } },       // рука с чашкой/ложкой у рта
  hold: { near: { x: 540, y: 230, s: -1, wrist: -0.5 }, far: { x: 545, y: 330, s: 1 } },         // держит предмет перед собой
  hug: { near: { x: 546, y: 196, s: -1, wrist: 0.3 }, far: { x: 545, y: 330, s: 1 } },           // тянется обнять маму
  reach: { near: { x: 430, y: 200, s: -1 }, far: { x: 545, y: 330, s: 1 } },
  forehead: { near: { x: 604, y: 198, s: -1, wrist: 0.4 }, far: { x: 545, y: 330, s: 1 } },
  wave: { near: { x: 470, y: 160, s: -1 }, far: { x: 545, y: 330, s: 1 } },
};
const DEF_WRIST = 0.15;

const FACE_BY_HEALTH = {
  healthy: { eyes: 'open', mouth: 'smile' },
  sick: { eyes: 'sad', mouth: 'closed' },
  very_sick: { eyes: 'half', mouth: 'wavy' },
  critical: { eyes: 'closed', mouth: 'wavy' },
};

export class BoyRig extends Rig {
  constructor(scene, x = 1040, y = 460, { health = 'sick' } = {}) {
    super(scene, x, y);
    this.health = health;
    this.t = 0;
    this.faceOverride = null;
    this.blinkT = 2 + Math.random() * 3;
    this.blinking = 0;
    this.hideK = 0; this.hideTarget = 0; this.gripK = 0;
    this.tremble = 0;
    this.gaze = 0; this.gazeTarget = 0;
    this.headTilt = 0; this.headTiltTarget = 0;
    this.breathRate = 1;
    this.poseName = 'rest';
    this.hands = { near: { ...POSES.rest.near }, far: { ...POSES.rest.far } };
    this.handTargets = { near: { ...POSES.rest.near }, far: { ...POSES.rest.far } };
    this.swivel = { near: POSES.rest.near.s, far: POSES.rest.far.s };
    this.wrist = { near: DEF_WRIST, far: DEF_WRIST };
    this.handZ = { near: 14, far: 3 };
    this.armSpeed = 7;

    this.addBone('root', null, 0, 0);
    this.addBone('head', 'root', HEAD.x, HEAD.y);
    this.addBone('nUp', 'root', SH_NEAR.x, SH_NEAR.y, 0, UP);
    this.addBone('nFo', 'nUp', 0, UP, 0, FO);
    this.addBone('nHand', 'nFo', 0, FO);
    this.addBone('fUp', 'root', SH_FAR.x, SH_FAR.y, 0, UP);
    this.addBone('fFo', 'fUp', 0, UP, 0, FO);
    this.addBone('fHand', 'fFo', 0, FO);
    this.addBone('blanket', 'root', 0, 444);
    this.addBone('fold', 'root', 552, 280, 0.12);

    this.attach('root', 'bed_frame', { z: 0, name: 'bed' });
    // дальняя рука чуть темнее — она в тени
    const shade = 0xc9c3d6;
    this.attach('fUp', 'boy_upper', { ox: 22, oy: 16, z: 1, name: 'fUp', tint: shade });
    this.attach('fFo', 'boy_fore', { ox: 20, oy: 16, z: 2, name: 'fFo', tint: shade });
    this.attach('fHand', `boy_hand_${health}`, { ox: 20, oy: 10, z: 3, name: 'fHand', tint: shade });
    this.attach('head', `boy_head_${health}`, { ox: 85, oy: 85, z: 5, name: 'head' });
    this.attach('head', 'boy_eyes_half', { ox: 54, oy: 25, dx: 0, dy: -8, z: 6, name: 'eyes' });
    this.attach('head', 'boy_mouth_closed', { ox: 30, oy: 18, dx: 0, dy: 32, z: 6, name: 'mouth' });
    this.attach('blanket', 'blanket_body', { ox: 0, oy: 444, z: 10, name: 'blanket' });
    this.attach('nUp', 'boy_upper', { ox: 22, oy: 16, z: 12, name: 'nUp' });
    this.attach('nFo', 'boy_fore', { ox: 20, oy: 16, z: 13, name: 'nFo' });
    this.attach('nHand', `boy_hand_${health}`, { ox: 20, oy: 10, z: 14, name: 'nHand' });
    this.attach('fold', 'blanket_fold', { ox: 110, oy: 40, z: 16, name: 'fold' });
    this.prop = null;

    this.setHealth(health);
    this.onUpdate = (time, delta) => this.tick(Math.min(0.05, delta / 1000));
    scene.events.on('update', this.onUpdate);
    this.once('destroy', () => scene.events.off('update', this.onUpdate));
    this.tick(0);
  }

  // ---------- состояние ----------

  setHealth(state) {
    this.health = state;
    this.setPartTexture('head', `boy_head_${state}`);
    this.setPartTexture('nHand', `boy_hand_${state}`);
    this.setPartTexture('fHand', `boy_hand_${state}`);
    this.breathRate = state === 'critical' ? 1.9 : state === 'very_sick' ? 1.5 : state === 'healthy' ? 0.8 : 1.1;
    return this;
  }

  // Временное выражение лица: { eyes, mouth } (null — по самочувствию).
  setFace(face, ms = 0) {
    this.faceOverride = face;
    if (this.faceTimer) { this.faceTimer.remove(false); this.faceTimer = null; }
    if (face && ms > 0) this.faceTimer = this.scene.time.delayedCall(ms, () => { this.faceOverride = null; });
    return this;
  }

  // Поза рук: 'rest' | 'blanket' | 'cheer' | 'cough' | 'mouth' | 'hold' | 'hug' | 'reach' | 'forehead' | 'wave'.
  setPose(name, speed = 7) {
    const p = POSES[name] || POSES.rest;
    this.poseName = name;
    this.armSpeed = speed;
    this.handTargets.near = { ...p.near };
    this.handTargets.far = { ...p.far };
    return this;
  }

  // Кисть тянется к точке сцены (например, к ложке в маминой руке). Локоть — в сторону от головы.
  reachTo(sceneX, sceneY, which = 'near', speed = 6) {
    const p = this.sceneToLocal(sceneX, sceneY);
    this.handTargets[which] = { x: p.x, y: p.y, s: -0.6 };
    this.armSpeed = speed;
    this.poseName = 'custom';
    return this;
  }

  // Спрятаться под одеяло: 0 — лежит, 1 — по глаза.
  hide(k = 1) { this.hideTarget = k; return this; }

  setTremble(v) { this.tremble = v; return this; }

  look(dir) { this.gazeTarget = dir; return this; } // −1 влево … +1 вправо

  // Предмет в ближней руке (чашка, ложка). key = null — убрать.
  holdProp(key, { ox, oy, r = 0, scale = 0.62 } = {}) {
    if (this.prop) { this.parts.splice(this.parts.indexOf(this.prop), 1); this.prop.img.destroy(); this.prop = null; }
    if (!key) return this;
    const fr = this.scene.textures.getFrame(key);
    this.prop = this.attach('nHand', key, { ox: ox ?? fr.width / 2, oy: oy ?? fr.height * 0.55, dy: 14, r, z: 18, scale, name: 'prop' });
    this.pose();
    return this;
  }

  // ---------- действия (Promise) ----------

  wait(ms) { return new Promise((r) => this.scene.time.delayedCall(ms, r)); }

  async cough(hard = false) {
    const prev = this.poseName === 'custom' ? 'rest' : this.poseName;
    this.setPose('cough', 11);
    this.headTiltTarget = 0.08;
    this.setFace({ eyes: 'squint', mouth: 'O' });
    const n = hard ? 4 : 2;
    for (let i = 0; i < n; i++) {
      await this.wait(150);
      this.jolt = hard ? 7 : 4;
      await this.wait(hard ? 260 : 220);
    }
    await this.wait(200);
    this.headTiltTarget = 0;
    this.setFace(null);
    this.setPose(prev, 5);
  }

  async cheer(ms = 1600) {
    this.setPose('cheer', 9);
    this.setFace({ eyes: 'happy', mouth: 'grin' });
    this.bounce = 1;
    await this.wait(ms);
    this.bounce = 0;
    this.setPose('rest', 5);
    this.setFace({ eyes: 'happy', mouth: 'smile' }, 1800);
  }

  async sip(times = 2) {
    this.setPose('mouth', 5);
    await this.wait(700);
    for (let i = 0; i < times; i++) {
      this.setFace({ eyes: 'closed', mouth: 'closed' });
      this.headTiltTarget = -0.08;
      await this.wait(500);
      this.headTiltTarget = 0;
      await this.wait(250);
    }
    this.setFace({ eyes: 'happy', mouth: 'smile' }, 1500);
    this.setPose('hold', 4);
    await this.wait(500);
  }

  // ---------- кадр ----------

  currentFace() {
    const base = FACE_BY_HEALTH[this.health] || FACE_BY_HEALTH.sick;
    const f = { ...base, ...(this.faceOverride || {}) };
    if (this.hideTarget > 0.5 && !this.faceOverride) f.eyes = 'wide';
    // моргание
    if (this.blinking > 0 && f.eyes !== 'closed' && f.eyes !== 'happy') f.eyes = 'closed';
    // липсинк
    const m = voice.mouth('Мальчик');
    if (m > 0.05) f.mouth = m > 0.62 ? 'open' : m > 0.3 ? 'half' : (f.mouth === 'smile' ? 'smile' : 'half');
    return f;
  }

  tick(dt) {
    this.t += dt;
    const t = this.t;
    // дыхание: грудь (одеяло и отворот) поднимается, голова чуть кивает
    const br = Math.sin(t * 2.1 * this.breathRate);
    this.hideK = approach(this.hideK, this.hideTarget, 5, dt);
    this.gaze = approach(this.gaze, this.gazeTarget, 6, dt);
    this.headTilt = approach(this.headTilt, this.headTiltTarget, 8, dt);
    this.jolt = (this.jolt || 0) * Math.exp(-dt * 9);
    // дрожь: две несоизмеримые частоты (3–6 Гц) вместо ровной «вибрации» 10 Гц
    // дрожь и подпрыгивание включаются и гаснут плавно, без рывка
    this.trembleK = approach(this.trembleK || 0, this.tremble, 3, dt);
    this.bounceK = approach(this.bounceK || 0, this.bounce ? 1 : 0, 6, dt);
    const shiver = this.trembleK > 0.002 ? (Math.sin(t * 37) * 1.1 + Math.sin(t * 23.3) * 0.7) * this.trembleK : 0;
    const bounceY = -Math.abs(Math.sin(t * 9)) * 10 * this.bounceK;

    const head = this.bone('head');
    // пряталки: голова чуть вдавливается в подушку, отворот поднимается до глаз и становится толще
    // (одеяло собрано у лица), поэтому лицо не выглядывает из-под него снизу
    head.x = HEAD.x + shiver - this.jolt * 0.5 - this.hideK * 6;
    head.y = HEAD.y + br * 1.6 + this.hideK * 14 + this.jolt + bounceY;
    head.rotation = this.headTilt + Math.sin(t * 0.7) * 0.015 + Math.sin(t * 9) * 0.05 * this.bounceK;
    const bl = this.bone('blanket');
    bl.y = 444;
    const blP = this.part('blanket');
    blP.img.setScale(1, 1 + br * 0.006 + this.jolt * 0.002);
    const fold = this.bone('fold');
    fold.y = 280 - br * 2.2 - this.hideK * 28 + this.jolt * 0.6;
    fold.x = 552 + this.hideK * 30;
    fold.rotation = 0.12 - this.hideK * 0.08;
    this.part('fold').img.setScale(1.05 + this.hideK * 0.2, 1 + this.hideK * 0.45);

    // плечи дышат вместе с грудью
    // при пряталках отворот поднимается — плечи остаются под ним (иначе рука вылезает из-под края)
    const sn = this.bone('nUp'); sn.x = SH_NEAR.x + bounceY * 0.2 + this.hideK * 6; sn.y = SH_NEAR.y - br * 1.8 - this.hideK * 18 + this.jolt * 0.8 + bounceY;
    const sf = this.bone('fUp'); sf.x = SH_FAR.x + this.hideK * 6; sf.y = SH_FAR.y - br * 1.5 - this.hideK * 16 + this.jolt * 0.8 + bounceY;

    // кисти плавно идут к целям; при пряталках — держатся за край отворота и тянут его к подбородку
    this.solve();
    const hk = this.hideK;
    // при пряталках обе кисти сразу берутся за край отворота и дальше едут вместе с ним
    this.gripK = approach(this.gripK, this.hideTarget > 0.05 && this.poseName !== 'custom' ? 1 : 0, Math.max(5, this.armSpeed), dt);
    const gk = this.gripK;
    for (const w of ['near', 'far']) {
      const tg = this.handTargets[w];
      const tp = tg.fold ? this.foldPoint(tg.fold) : tg;
      let tx = tp.x; let ty = tp.y;
      let ts = tg.fold ? this.gripSwivel(w, hk) : (tg.s ?? 1); let tw = tg.wrist ?? DEF_WRIST; let over = !!tg.over;
      if (gk > 0.002) {
        const b = POSES.blanket[w]; const g = this.foldPoint(b.fold);
        tx += (g.x - tx) * gk; ty += (g.y - ty) * gk; ts += (this.gripSwivel(w, hk) - ts) * gk; tw += (b.wrist - tw) * gk;
        if (gk > 0.5) over = true;
      }
      if (this.poseName === 'cheer') { tx += Math.sin(t * 10 + (w === 'far' ? 1.5 : 0)) * 14; ty += Math.cos(t * 10) * 8; }
      if (this.poseName === 'wave' && w === 'near') tx += Math.sin(t * 11) * 26;
      const h = this.hands[w];
      h.x = approach(h.x, tx, this.armSpeed, dt);
      h.y = approach(h.y, ty + (this.poseName === 'rest' ? br * 1.5 : 0), this.armSpeed, dt);
      this.swivel[w] = approach(this.swivel[w], ts, this.armSpeed * 0.8, dt);
      this.wrist[w] = approach(this.wrist[w], tw, this.armSpeed, dt);
      this.updateHandLayer(w, over);
    }
    this.armIK('n', this.hands.near, this.swivel.near, shiver * 0.4);
    this.armIK('f', this.hands.far, this.swivel.far, 0);
    this.bone('nHand').rotation = this.wrist.near;
    this.bone('fHand').rotation = this.wrist.far;
    // предмет в руке не переворачивается вместе с кистью: чашка всегда донышком вниз
    if (this.prop) { this.solve(); this.prop.r = (this.poseName === 'mouth' ? -0.25 : 0) - this.bone('nHand').wr; }

    // лицо
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blinking = 0.13; this.blinkT = 2.2 + Math.random() * 3.8; }
    if (this.blinking > 0) this.blinking -= dt;
    const f = this.currentFace();
    this.setPartTexture('eyes', `boy_eyes_${f.eyes}`);
    this.setPartTexture('mouth', `boy_mouth_${f.mouth}`);
    const eyes = this.part('eyes'); eyes.dx = this.gaze * 5;
    this.pose();
  }

  // Двухзвенная рука с «поворотом локтя» s ∈ [−1, 1]. Локоть лежит на окружности возможных положений
  // (плоскость, перпендикулярная линии плечо→кисть); на экран она проецируется в отрезок, s — точка на нём.
  // При |s| < 1 кости короче (рука повёрнута к зрителю) — рукава укорачиваются по длине.
  armIK(p, hand, s, jx = 0) {
    const up = this.bone(`${p}Up`); const fo = this.bone(`${p}Fo`); const hb = this.bone(`${p}Hand`);
    const sx = up.wx; const sy = up.wy;
    let dx = hand.x + jx - sx; let dy = hand.y - sy; let d = Math.hypot(dx, dy);
    if (d < 1e-3) { dx = 0; dy = 1; d = 1; }
    const ux = dx / d; const uy = dy / d;
    const dc = Math.min(UP + FO - 0.5, Math.max(Math.abs(UP - FO) + 8, d));
    const a = (UP * UP - FO * FO + dc * dc) / (2 * dc);
    const h = Math.sqrt(Math.max(0, UP * UP - a * a));
    const ex = sx + ux * a - uy * h * s; const ey = sy + uy * a + ux * h * s;
    const hx = sx + ux * dc; const hy = sy + uy * dc;
    const lu = Math.hypot(ex - sx, ey - sy); const lf = Math.hypot(hx - ex, hy - ey);
    up.rotation = dirAngle(ex - sx, ey - sy);
    fo.y = lu;
    if (lf > 2) fo.rotation = dirAngle(hx - ex, hy - ey) - up.rotation;
    hb.y = lf;
    const k = (v) => Math.min(1.05, Math.max(0.3, v));
    this.part(`${p}Up`).img.setScale(1, k(lu / UP));
    this.part(`${p}Fo`).img.setScale(1, k(lf / FO));
  }

  // Поворот локтя, когда кисть держит край отворота: ближний локоть смотрит на зрителя и прячется под
  // тканью (чем выше отворот, тем сильнее), дальний уходит за голову.
  gripSwivel(w, hk) { return w === 'near' ? Math.max(0.1, 0.4 - 0.6 * hk) : POSES.blanket.far.s; }

  // Точка на отвороте (в его системе координат, с учётом растяжения по ширине) → координаты контейнера.
  foldPoint([lx, ly]) { return this.boneToLocal('fold', lx * (1.05 + this.hideK * 0.2), ly * (1 + this.hideK * 0.45)); }

  // Точка контейнера → координаты в текстуре отворота (без растяжения), центр отворота = (0, 0).
  foldLocal(pt) {
    const fb = this.bone('fold');
    const dx = pt.x - fb.wx; const dy = pt.y - fb.wy; const c = Math.cos(fb.wr); const sn = Math.sin(fb.wr);
    return { lx: (dx * c + dy * sn) / (1.05 + this.hideK * 0.2), ly: (-dx * sn + dy * c) / (1 + this.hideK * 0.45) };
  }

  // Слой кисти: 17 — поверх отворота (держится за край); иначе ближняя лежит на одеяле под отворотом (14),
  // дальняя — под одеялом и за головой (3); 15 — дальняя соскальзывает за кромку отворота.
  // Слой меняется только там, где кисть закрыта тканью или ничего не перекрывает: без «оторванных»
  // кистей на одеяле и без исчезновения рывком.
  updateHandLayer(w, wantOver) {
    const base = w === 'near' ? 14 : 3;
    const hand = this.hands[w];
    const { lx, ly } = this.foldLocal(hand);
    const onFold = Math.abs(lx) < 125 && ly > -48 && ly < 40;
    const head = this.bone('head');
    const nearHead = Math.hypot(hand.x - head.wx, hand.y - head.wy) < 95;
    let z = this.handZ[w];
    if (wantOver) {
      // за край кисть берётся у верхней кромки; ближняя, пришедшая сверху, — сразу (она и так над головой)
      const atEdge = Math.abs(lx) < 125 && ly < (w === 'near' ? -5 : 2) && ly > -40;
      if (z !== 17 && (atEdge || (w === 'near' ? ly < -5 : (ly < -40 || Math.abs(lx) > 140) && !nearHead))) z = 17;
    } else if (z === 17) {
      if (w === 'far') z = 15;
      else if (!onFold) z = base; // ближняя сначала съезжает с отворота
    } else if (z === 15) {
      if ((ly > 0 && Math.abs(lx) < 125) || (!onFold && !nearHead)) z = base; // спряталась под тканью или ушла от головы
    }
    if (z !== this.handZ[w]) { this.handZ[w] = z; this.setPartZ(w === 'near' ? 'nHand' : 'fHand', z); }
  }

  // Мировая точка рта/лба (для маминых рук, ложки, градусника).
  mouthPoint() { this.solve(); const p = this.boneToLocal('head', 0, 34); return this.localToScene(p.x, p.y); }

  foreheadPoint() { this.solve(); const p = this.boneToLocal('head', 4, -30); return this.localToScene(p.x, p.y); }

  handPoint(which = 'near') { this.solve(); const b = this.bone(which === 'near' ? 'nHand' : 'fHand'); return this.localToScene(b.wx, b.wy); }
}
