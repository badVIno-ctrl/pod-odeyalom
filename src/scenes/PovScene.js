// Сцены «глазами мальчика» (от первого лица), запуск поверх спальни:
//   scene.launch('Pov', { mode: 'medicine' | 'compress' | 'socks' | 'doctor' | 'medics', health, onDone })
// medicine — мама даёт ложку сиропа, потом мальчик сам пьёт чай из чашки обеими руками;
// compress — прохладное полотенце на лоб, мама садится рядом; socks — мама надевает носки на ноги;
// doctor — доктор смотрит горло; medics — фельдшеры бережно укутывают и несут на носилках, мама рядом.
// Каждая сцена — сценарий на Director: «Пропустить», S (debug) и клики работают как везде.
// Без тряски камеры и резких вспышек.
import * as Phaser from 'phaser';
import { Director } from '../systems/cutscene.js';
import { Audio } from '../systems/audio.js';
import { voice } from '../systems/voice.js';
import { Debug } from '../systems/debug.js';
import { Quality } from '../systems/quality.js';
import { MomRig } from '../systems/rig/MomRig.js';
import { prefersReducedMotion } from '../config/game.js';
import { S } from '../config/theme.js';
import { Button } from '../ui/button.js';
import { onUpdate } from '../systems/lifecycle.js';

const D = { bg: 0, far: 5, mom: 10, prop: 20, feet: 22, warm: 25, blanket: 30, hands: 32, near: 40, fx: 50, cool: 52, lids: 90, ui: 95 };
const MODES = ['medicine', 'compress', 'socks', 'doctor', 'medics'];

export class PovScene extends Phaser.Scene {
  constructor() { super('Pov'); }

  init(data) {
    this.mode = MODES.includes(data.mode) ? data.mode : 'medicine';
    this.health = data.health || 'sick';
    this.onDone = data.onDone || (() => {});
    this.done = false;
  }

  create() {
    this.d = new Director(this);
    this.reduced = prefersReducedMotion();
    this.t = 0;
    this.bg = this.add.image(960, 540, 'pov_room').setDepth(D.bg).setScale(1.04);
    // тёплый «жар» по краям и мягкая виньетка
    this.vig = this.add.image(960, 540, 'fx_vignette').setScale(2).setTint(0x1a0c08).setAlpha(0.6).setDepth(D.fx);
    this.warm = this.add.image(960, 1080, 'fx_glow').setScale(9, 3.2).setTint(0xffa040)
      .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(D.warm);
    this.blanket = this.add.image(960, 1080, 'pov_blanket').setOrigin(0.5, 1).setDepth(D.blanket);
    this.hands = [
      this.add.image(700, 930, `pov_hand_${this.health}`).setDepth(D.hands).setAngle(14),
      this.add.image(1220, 930, `pov_hand_${this.health}`).setDepth(D.hands).setAngle(-14).setFlipX(true),
    ];
    this.handHome = this.hands.map((h) => ({ x: h.x, y: h.y, a: h.angle }));
    this.lidTop = this.add.image(960, 600, 'pov_lid_top').setOrigin(0.5, 1).setDepth(D.lids);
    this.lidBot = this.add.image(960, 480, 'pov_lid_bot').setOrigin(0.5, 0).setDepth(D.lids);
    this.skipBtn = new Button(this, 1920 - S[600] - 110, S[500] + 28, {
      label: 'Пропустить', width: 220, height: 56, variant: 'ghost', style: 'button-lg', onClick: () => this.d.skip(),
    }).setDepth(D.ui).setScrollFactor(0);

    this.offs = [Debug.on('skip', () => this.d.skip())];
    this.input.on('pointerdown', (p, over) => { if (!over.length) voice.skip(); });
    this.events.once('shutdown', () => { this.offs.forEach((f) => f()); Audio.stopLoop('siren', { fade: 600 }); });
    onUpdate(this, (time, delta) => this.tick(delta / 1000));

    this[this.mode]().then(() => this.finish());
  }

  // Дыхание: кадр чуть покачивается; при жаре — сильнее. Без тряски.
  tick(dt) {
    this.t += dt;
    if (this.reduced) return;
    const amp = this.health === 'critical' ? 5 : this.health === 'very_sick' ? 4 : 2.5;
    const cam = this.cameras.main;
    cam.scrollY = (this.baseScrollY || 0) + Math.sin(this.t * 1.4) * amp;
    cam.scrollX = Math.sin(this.t * 0.6) * amp * 0.6;
    if (this.follow && this.mom) {
      const f = this.follow;
      this.mom.reach('near', f.target.x + (f.dx || 0), f.target.y + (f.dy || 0));
    }
  }

  finish() {
    if (this.done) return;
    this.done = true;
    voice.stop();
    const cb = this.onDone;
    this.scene.stop();
    cb();
  }

  // ---------- общие кусочки ----------

  async openEyes(ms = 900) {
    this.d.sfx('blink', { volume: 0.35 });
    this.d.tween({ targets: this.lidTop, y: -40, duration: ms, ease: 'Sine.easeOut' });
    await this.d.tween({ targets: this.lidBot, y: 1120, duration: ms, ease: 'Sine.easeOut' });
  }

  async closeEyes(ms = 900) {
    this.d.tween({ targets: this.lidTop, y: 600, duration: ms, ease: 'Sine.easeIn' });
    await this.d.tween({ targets: this.lidBot, y: 480, duration: ms, ease: 'Sine.easeIn' });
  }

  async blink() {
    await this.d.tween({ targets: [this.lidTop], y: 420, duration: 140 });
    this.d.tween({ targets: this.lidBot, y: 1120, duration: 140 });
    await this.d.tween({ targets: this.lidTop, y: -40, duration: 180 });
  }

  // Мама крупно. dir −1 — стоит справа и смотрит влево (на мальчика).
  makeMom(x = 1480, y = 1500, dir = -1, scale = 2) {
    const m = new MomRig(this, x, y).setScale(scale).setDepth(D.mom).face(dir);
    m.setFace({ eyes: 'happy', mouth: 'smile' });
    this.mom = m;
    return m;
  }

  sparkles(x, y, n = 18, tint = 0xffd27a) {
    if (this.d.skipping) return;
    const count = Math.max(6, Math.round(n * Quality.particles));
    const e = this.add.particles(x, y, 'fx_dust', {
      speed: { min: 60, max: 220 }, angle: { min: 210, max: 330 }, lifespan: { min: 700, max: 1400 },
      scale: { start: 1.8, end: 0 }, alpha: { start: 0.8, end: 0 }, gravityY: -30, tint, blendMode: 'ADD', emitting: false,
    }).setDepth(D.fx);
    e.explode(count);
    this.time.delayedCall(1600, () => e.destroy());
  }

  steam(target, dy = -120) {
    return this.add.particles(0, 0, 'fx_dust', {
      follow: target, followOffset: { x: 0, y: dy }, x: { min: -40, max: 40 }, speedY: { min: -70, max: -40 }, speedX: { min: -10, max: 10 },
      lifespan: 1600, scale: { start: 1.4, end: 4 }, alpha: { start: 0.22, end: 0 }, frequency: Math.round(180 / Quality.particles), tint: 0xffffff,
    }).setDepth(D.prop + 1);
  }

  warmth(on, alpha = 0.5) { return this.d.tween({ targets: this.warm, alpha: on ? alpha : 0, duration: on ? 1400 : 900 }); }

  handsTo(dx, dy, ms = 500, spread = 0) {
    return Promise.all(this.hands.map((h, i) => this.d.tween({
      targets: h, x: this.handHome[i].x + (i ? -spread : spread) + dx, y: this.handHome[i].y + dy, duration: ms, ease: 'Sine.easeInOut',
    })));
  }

  handsHome(ms = 600) {
    return Promise.all(this.hands.map((h, i) => this.d.tween({
      targets: h, x: this.handHome[i].x, y: this.handHome[i].y, angle: this.handHome[i].a, duration: ms, ease: 'Sine.easeInOut',
    })));
  }

  // ---------- лекарство и чай ----------

  async medicine() {
    const d = this.d;
    const m = this.makeMom(1500, 1500, -1, 2);
    m.setLean(0.12);
    m.hold('far', 'prop_bottle', { scale: 0.5, dy: 16 });
    m.hold('near', 'prop_spoon', { scale: 0.62, dy: 8 });
    m.reachLocal('far', 120, -380).reachLocal('near', 150, -330);
    await this.openEyes();
    // сироп из флакона в ложку
    const say = d.say('M13');
    const bottle = m.props.far;
    await d.tween({ targets: bottle, r: -1.6, duration: 600, ease: 'Sine.easeInOut' });
    const drop = this.add.circle(0, 0, 9, 0xa8441f).setDepth(D.prop);
    const from = m.handPoint('far'); const to = m.handPoint('near');
    drop.setPosition(from.x - 30, from.y - 10);
    await d.tween({ targets: drop, x: to.x - 40, y: to.y - 10, duration: 420, ease: 'Sine.easeIn' });
    drop.destroy();
    await d.tween({ targets: bottle, r: 0, duration: 400, ease: 'Sine.easeInOut' });
    // ложка ко рту
    m.drop('near');
    const start = m.handPoint('near');
    const spoon = this.add.image(start.x - 40, start.y, 'pov_spoon').setDepth(D.prop).setAngle(8).setScale(0.9).setFlipX(true);
    this.follow = { target: spoon, dx: 90, dy: 6 };
    m.setLean(0.24);
    await d.tween({ targets: spoon, x: 1020, y: 780, scale: 1.25, angle: 18, duration: 1100, ease: 'Sine.easeInOut' });
    this.handsTo(0, 40, 400, -20);
    await d.wait(200);
    // у самого рта ложка ближе к глазам, чем одеяло
    spoon.setDepth(D.blanket + 1);
    await d.tween({ targets: spoon, x: 1120, y: 1010, scale: 2, angle: 30, duration: 520, ease: 'Cubic.easeIn' });
    d.sfx('spoon', { volume: 0.45 });
    d.sfx('gulp', { volume: 0.7 });
    spoon.setTexture('pov_spoon_empty');
    await d.wait(300);
    await d.tween({ targets: spoon, x: start.x - 60, y: start.y, scale: 0.9, angle: 8, duration: 900, ease: 'Sine.easeInOut' });
    this.follow = null;
    spoon.destroy();
    await say;
    m.setLean(0.12).drop('far');
    m.reachLocal('far', null);
    this.handsHome(400);
    // чашка: мама протягивает, мальчик берёт обеими руками и пьёт сам
    // чашка появляется у мамы перед грудью (плечо примерно на x 1440): рука держит её спереди, а не за спиной
    const cup = this.add.image(1320, 780, 'pov_cup').setDepth(D.prop).setScale(0.55).setAlpha(0);
    const steam = this.steam(cup, -170);
    d.tween({ targets: cup, alpha: 1, duration: 300 });
    this.follow = { target: cup, dx: 110, dy: 40 };
    await d.tween({ targets: cup, x: 1190, y: 640, duration: 900, ease: 'Sine.easeInOut' });
    const tea = d.say('M14');
    d.sfx('cup', { volume: 0.5 });
    // ладошки обхватывают чашку с боков
    // (ладонь в текстуре на 66 px выше центра; ладони на нижней половине чашки, середина и край чашки видны)
    const grip = (i) => ({ x: cup.x + (i ? 1 : -1) * (180 * cup.scaleX + 20), y: cup.y + 90 * cup.scaleX + 66 });
    await Promise.all(this.hands.map((h, i) => d.tween({ targets: h, ...grip(i), angle: i ? -14 : 14, duration: 800, ease: 'Sine.easeInOut' })));
    this.follow = null;
    m.reach('near', null).setLean(0.06);
    // чашка у мальчика: она ближе к глазам, чем одеяло, и не прячется за ним
    cup.setDepth(D.blanket + 1);
    const hold = () => this.hands.forEach((h, i) => { const p = grip(i); h.setPosition(p.x, p.y); });
    await d.tween({ targets: cup, x: 960, y: 690, scale: 0.75, duration: 1000, ease: 'Sine.easeInOut', onUpdate: hold });
    await tea;
    await d.tween({ targets: cup, y: 820, scale: 1.15, duration: 700, ease: 'Sine.easeIn', onUpdate: hold });
    for (let i = 0; i < 2; i++) {
      d.sfx('sip', { volume: 0.6 });
      await d.tween({ targets: cup, angle: -14, duration: 450, yoyo: true, ease: 'Sine.easeInOut' });
      await d.wait(220);
    }
    this.warmth(true, 0.4);
    await d.tween({ targets: cup, x: 1100, y: 680, scale: 0.62, angle: 0, duration: 900, ease: 'Sine.easeInOut', onUpdate: hold });
    // мама забирает чашку
    this.follow = { target: cup, dx: 110, dy: 40 };
    this.handsHome(600);
    await d.tween({ targets: cup, x: 1320, y: 780, alpha: 0, duration: 900, ease: 'Sine.easeInOut' });
    this.follow = null;
    m.reach('near', null);
    steam.stop();
    cup.destroy();
    m.setFace({ eyes: 'happy', mouth: 'smile' });
    await d.say('B15');
    await d.say('M15');
    await d.wait(300);
    await this.closeEyes(1100);
  }

  // ---------- прохладный компресс ----------

  async compress() {
    const d = this.d;
    const m = this.makeMom(1500, 1500, -1, 2);
    m.setFace({ eyes: 'worry', mouth: 'smile' }).setLean(0.1);
    this.warmth(true, 0.6);
    const towel = this.add.image(1420, 620, 'pov_towel').setOrigin(0.5, 0).setScale(0.28).setDepth(D.prop).setAngle(-8);
    this.follow = { target: towel, dx: 70, dy: 60 };
    await this.openEyes();
    const say = d.say('M49');
    m.setLean(0.3);
    await d.tween({ targets: towel, x: 1120, y: 120, scale: 0.7, angle: -3, duration: 1300, ease: 'Sine.easeInOut' });
    await d.tween({ targets: towel, x: 960, y: -150, scale: 2.3, angle: 0, duration: 800, ease: 'Sine.easeIn' });
    this.follow = null;
    m.reach('near', null).setLean(0.12);
    d.sfx('splash', { volume: 0.18 });
    // прохлада: тёплое свечение уходит, сверху мягкий голубой отсвет
    const cool = this.add.image(960, 0, 'fx_glow').setScale(10, 3).setTint(0x9fd0ff).setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0).setDepth(D.cool);
    d.tween({ targets: cool, alpha: 0.22, duration: 1600 });
    this.warmth(false);
    await say;
    this.handsTo(0, 26, 600);
    await d.say('B44');
    // мама садится рядом и кладёт ладонь на одеяло
    m.setFace({ eyes: 'happy', mouth: 'smile' });
    await d.tween({ targets: m, y: m.y + 140, duration: 900, ease: 'Sine.easeInOut' });
    m.reach('near', 1240, 960);
    await d.say('M50');
    await d.wait(500);
    await this.closeEyes(1500);
  }

  // ---------- носки: мама надевает их на ноги ----------

  async socks() {
    const d = this.d;
    this.bg.setTexture('pov_feet_bg').setScale(1.02);
    this.blanket.setVisible(false);
    this.hands.forEach((h) => h.setVisible(false));
    const feet = [{ x: 850 }, { x: 1070 }].map((f, i) => {
      const foot = this.add.image(f.x, 452, `pov_foot_${this.health}`).setOrigin(0.5, 0).setDepth(D.feet).setAngle(i ? 6 : -6);
      const sock = this.add.image(f.x, 452, 'pov_foot_sock').setOrigin(0.5, 0).setDepth(D.feet + 0.1).setAngle(i ? 6 : -6);
      sock.setCrop(0, 0, sock.width, 0);
      return { foot, sock, k: 0 };
    });
    const fg = this.add.image(960, 650, 'pov_blanket_feet').setOrigin(0.5, 0).setDepth(D.blanket);
    // мама сидит на кровати у самых ног, лицом к мальчику: видно лицо, плечи и обе руки
    const m = this.makeMom(1050, 1220, -1, 1.7);
    m.setLean(0.18);
    m.hold('near', 'prop_socks', { scale: 0.62, dy: 30 });
    m.reachLocal('near', 150, -480); // носки в руке над левой ножкой: их видно, лицо мамы открыто
    // мальчик приподнимает голову и смотрит на ноги
    this.baseScrollY = -60;
    await this.openEyes();
    d.tween({ targets: this, baseScrollY: 0, duration: 1200, ease: 'Sine.easeOut' });
    const say = d.say('M11');
    m.setFace({ eyes: 'happy', mouth: 'smile' });
    await d.wait(900);
    m.drop('near');
    m.setLean(0.3);
    // мама подсаживается к каждой ножке: обе ладони всегда перед ней, а не за спиной
    for (const [f, mx] of [[feet[0], 1050], [feet[1], 1270]]) {
      if (Math.abs(m.x - mx) > 1) {
        m.reach('near', null).reach('far', null);
        await d.tween({ targets: m, x: mx, duration: 650, ease: 'Sine.easeInOut' });
      }
      const top = f.foot.y; const hgt = f.foot.height;
      const put = (k) => {
        f.k = k;
        f.sock.setCrop(0, 0, f.sock.width, hgt * k);
        // ладони держат край носка по бокам стопы; ниже края одеяла руки не уходят
        const y = Math.min(top + hgt * k + 4, 700);
        m.reach('near', f.foot.x - 100, y).reach('far', f.foot.x + 100, y - 6);
      };
      put(0);
      await d.wait(260);
      d.sfx('paper', { volume: 0.25 });
      const h = { k: 0 };
      await d.tween({ targets: h, k: 1, duration: 1500, ease: 'Sine.easeInOut', onUpdate: () => put(h.k), onComplete: () => put(1) });
      await d.wait(200);
    }
    m.reach('near', null).reach('far', null).setLean(0.18);
    await say;
    this.warmth(true, 0.55);
    this.sparkles(960, 560, 14, 0xffb36b);
    await d.say('B11');
    await d.say('M47');
    // ноги снова под одеялом
    d.sfx('whoosh', { volume: 0.25 });
    await d.tween({ targets: fg, y: 360, duration: 1200, ease: 'Sine.easeInOut' });
    await d.wait(300);
    await this.closeEyes(1100);
  }

  // ---------- доктор ----------

  async doctor() {
    const d = this.d;
    const doc = this.add.container(1020, 1500).setDepth(D.mom);
    const body = this.add.image(0, 0, 'pov_doctor').setOrigin(0.5, 1);
    const eyes = this.add.image(0, -1000 + 290, 'pov_doctor_eyes_open');
    const mouth = this.add.image(0, -1000 + 455, 'pov_doctor_mouth_closed');
    const glint = this.add.image(-18, -1000 + 92, 'fx_glow').setScale(0.6).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5);
    doc.add([body, mouth, eyes, glint]);
    this.animateFace(doc, eyes, mouth, 'Врач', 'pov_doctor');
    this.bg.setTint(0xd8d8e8);
    await this.openEyes();
    await d.tween({ targets: doc, y: 1090, duration: 900, ease: 'Sine.easeOut' });
    await d.say('D01');
    // шпатель, мягко и аккуратно
    const sp = this.add.image(1300, 720, 'pov_spatula').setDepth(D.prop).setAngle(-20).setScale(0.8);
    d.tween({ targets: glint, scale: 1.4, alpha: 0.65, duration: 600 });
    await d.tween({ targets: sp, x: 920, y: 990, scale: 1.6, angle: -36, duration: 1100, ease: 'Sine.easeInOut' });
    await d.say('B23');
    d.tween({ targets: glint, scale: 0.6, alpha: 0.5, duration: 500 });
    await d.tween({ targets: sp, x: 1500, y: 700, scale: 0.8, duration: 800, ease: 'Sine.easeInOut' });
    sp.destroy();
    await d.say('D02');
    // доктор поворачивается к маме: мама слева, встревожена
    const m = this.makeMom(240, 1560, 1, 2.2);
    m.setFace({ eyes: 'worry', mouth: 'worry' }).setDepth(D.far);
    m.alpha = 0;
    d.tween({ targets: m, alpha: 1, x: 330, duration: 700 });
    await d.tween({ targets: doc, x: 1240, angle: 3, duration: 700, ease: 'Sine.easeInOut' });
    await d.say('D03');
    await this.blink();
    await d.say('B21');
    await d.tween({ targets: doc, x: 1020, angle: 0, duration: 600, ease: 'Sine.easeInOut' });
    this.docSmile = true;
    m.setFace({ eyes: 'open', mouth: 'smile' });
    await d.say('D04');
    await d.wait(300);
    await this.closeEyes();
  }

  // ---------- фельдшеры: бережно, без мигалок ----------

  async medics() {
    const d = this.d;
    this.bg.setTint(0x9aa3bb);
    this.vig.setAlpha(0.7);
    const medic = this.add.container(1180, 1600).setDepth(D.mom);
    const body = this.add.image(0, 0, 'pov_medic').setOrigin(0.5, 1);
    const eyes = this.add.image(0, -1000 + 290, 'pov_medic_eyes_open');
    const mouth = this.add.image(0, -1000 + 430, 'pov_medic_mouth_closed');
    medic.add([body, eyes, mouth]);
    this.animateFace(medic, eyes, mouth, 'Фельдшер', 'pov_medic');
    await this.openEyes(1100);
    await d.tween({ targets: medic, y: 1160, duration: 1000, ease: 'Sine.easeOut' });
    await d.say('P03');
    // тёплое одеяло укрывает до подбородка
    const wrap = this.add.image(960, 1400, 'pov_blanket').setOrigin(0.5, 1).setTint(0xf1dcc0).setDepth(D.blanket + 0.5);
    d.sfx('whoosh', { volume: 0.25 });
    await d.tween({ targets: wrap, y: 1090, duration: 1100, ease: 'Sine.easeOut' });
    this.warmth(true, 0.35);
    this.hands.forEach((h) => h.setDepth(D.blanket + 0.6));
    // мама слева
    const m = this.makeMom(140, 1580, 1, 2.1);
    m.setFace({ eyes: 'worry', mouth: 'smile' }).setAlpha(0);
    d.tween({ targets: m, alpha: 1, x: 330, duration: 800, ease: 'Sine.easeOut' });
    await d.say('M24');
    await this.blink();
    await d.say('B22');
    // мамина ладонь накрывает руку мальчика
    const hand = this.add.image(560, 1180, 'pov_mom_hand').setDepth(D.hands + 1).setAngle(-12).setScale(1.2);
    d.tween({ targets: this.hands[0], x: 640, y: 900, duration: 700, ease: 'Sine.easeInOut' });
    await d.tween({ targets: hand, x: 660, y: 930, duration: 900, ease: 'Sine.easeInOut' });
    m.setFace({ eyes: 'open', mouth: 'smile' });
    await d.say('M72');
    await d.say('P02');
    // носилки: потолок медленно плывёт, мама держит за руку
    await this.closeEyes(500);
    this.bg.setVisible(false); this.blanket.setVisible(false); wrap.setY(1180);
    medic.setVisible(false); m.setVisible(false);
    this.hands[1].setVisible(false);
    const ceil = this.add.tileSprite(960, 540, 1920, 1080, 'pov_ceiling').setDepth(D.bg);
    const momTop = this.makeMom(250, 1700, 1, 2.2);
    momTop.setFace({ eyes: 'open', mouth: 'smile' }).setDepth(D.far).setLean(0.15);
    Audio.loop('siren', { volume: 0.14, fade: 3000 });
    d.sfx('whoosh', { volume: 0.2 });
    await this.openEyes(700);
    const scroll = { x: 0 };
    await d.tween({
      targets: scroll, x: 1900, duration: 6500, ease: 'Sine.easeInOut',
      onUpdate: () => { ceil.tilePositionX = scroll.x; },
      onComplete: () => { ceil.tilePositionX = 1900; },
    });
    await d.wait(400);
    await this.closeEyes(1400);
  }

  // Моргание и рот по голосу для доктора/фельдшера (картинки *_eyes_*, *_mouth_*).
  animateFace(container, eyes, mouth, speaker, prefix) {
    let blinkT = 1.5;
    onUpdate(this, (time, delta) => {
      const dt = delta / 1000;
      blinkT -= dt;
      const closed = blinkT < 0 && blinkT > -0.14;
      if (blinkT < -0.14) blinkT = 2 + Math.random() * 3;
      eyes.setTexture(`${prefix}_eyes_${closed ? 'closed' : (this.docSmile && prefix === 'pov_doctor' ? 'smile' : 'open')}`);
      const mo = voice.mouth(speaker);
      mouth.setTexture(`${prefix}_mouth_${mo > 0.3 ? 'open' : 'closed'}`);
      mouth.scaleY = mo > 0.3 ? 0.7 + mo * 0.5 : 1;
      if (!this.reduced) container.y += Math.sin(time / 600) * 0.15;
    });
  }
}
