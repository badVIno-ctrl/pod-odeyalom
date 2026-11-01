// Спальня: пять дней болезни. Утро → мама уходит по делу (у каждой отлучки есть причина) →
// Тихон спускается, разговор и выбор реплики → мини-игра → событие по ОБЩЕМУ счёту → ночь → титр дня.
// Три победы (не подряд) → финал 7А «Ты выздоровел!», три поражения → финал 7Б «Ты проиграл».
// Огнёвка — огненная бабочка-жар за окном. Победы — серебряные нити Тихона, поражения — её искры.
import * as Phaser from 'phaser';
import { Save } from '../systems/save.js';
import { Haptics } from '../systems/haptics.js';
import { PageTurn } from '../systems/pageTurn.js';
import { COLORS, CSS, INK, INKN, EASE, MOTION, RADIUS, S, text } from '../config/theme.js';
import { ROOM } from '../config/layout.js';
import { getDay, GAME_SCENES } from '../config/days.js';
import { prefersReducedMotion } from '../config/game.js';
import { getDifficulty } from '../config/difficulty.js';
import { GameState } from '../state.js';
import { Journal, secretById } from '../systems/journal.js';
import { Director } from '../systems/cutscene.js';
import { Audio } from '../systems/audio.js';
import { Music } from '../systems/music.js';
import { calendarCard } from '../ui/calendar.js';
import { voice } from '../systems/voice.js';
import { Debug } from '../systems/debug.js';
import { Quality } from '../systems/quality.js';
import { SpiderRig } from '../systems/spiderRig.js';
import { BoyRig } from '../systems/rig/BoyRig.js';
import { MomRig } from '../systems/rig/MomRig.js';
import { makeCanvas, vgrad, ellipse } from '../systems/paint.js';
import { Hud } from '../ui/hud.js';
import { paperTexture, inkCheck } from '../ui/paper.js';
import { Button } from '../ui/button.js';
import { ChoicePanel } from '../ui/choice.js';
import { onUpdate } from '../systems/lifecycle.js';
import { splitStage, Parallax } from '../systems/stage.js';
import { LiveFX } from '../systems/livefx.js';
import { FrostGlass, WEB_PANES, PANES } from '../systems/frost.js';
import { WallShadow, DoorLight, LAMP } from '../systems/shadowPlay.js';
import { Bullfinch } from '../systems/bird.js';
import { paintDrawing, drawingTexture, specKey, DRAW_W, DRAW_H } from '../systems/drawings.js';
import WEBHARP from '../../data/webharp.json';
import { lineText } from '../i18n/index.js';

const DEPTH = {
  bg: 0, bird: 1, doorway: 2, door: 3, light: 5, web: 6, threads: 7, items: 10, chair: 15, mom: 20, plaid: 21, boy: 30,
  cold: 40, warm: 41, dark: 45, moth: 46, net: 47, shadow: 54, spider: 55, vignette: 60, fx: 70, card: 880, hud: 900, ui: 950, toast: 960,
};
const MOM_Y = 935;
const MOM_X = { door: 200, stand: 905, bed: 1530, chair: 1470 };
const CHAIR = { x: 1440, y: 948 };
const PANE = { x: 778, y: 262, rx: 74, ry: 62 };          // верхнее правое стекло: здесь кружит Огнёвка
const WEB = { x: 1758, y: 46 };                            // паутина Тихона в углу (нарисована на фоне)
const THREAD_ENDS = [{ x: 888, y: 176 }, { x: 980, y: 138 }, { x: 892, y: 330 }];
const NET = { x: 1290, y: 214 };
const SILL_REST = { x: 812, y: 560 };
const CATCH = { x: 1290, y: 250 };   // где мечется Огнёвка, пока мальчик плетёт сеть
const CATCH_PINS = [[-100, 205], [18, 200], [142, 200]]; // гвоздики вокруг неё: угол°, радиус
// рисунки мальчика на стене вокруг маминого (рамка на фоне ≈ 1242…1467 × 222…398)
const WALL_ART = [
  { x: 1112, y: 300, a: -4 }, { x: 1566, y: 330, a: 3 }, { x: 1128, y: 432, a: 5 }, { x: 1548, y: 196, a: -3 },
];
const ART_SCALE = 0.2;                      // белая бабочка на внешнем отливе (нижнее правое стекло)
const ITEMS = {
  thermo: { key: 'thermometer_item', x: 962, y: 706, scale: 0.36, angle: -3 },
  bottle: { key: 'prop_bottle', x: 1012, y: 704, scale: 0.44, angle: 0 },
  cup: { key: 'prop_cup_still', x: 1050, y: 706, scale: 0.4, angle: 0 },
};

const healthOf = (key) => key.replace('boy_bed_', '');
// глубина инея на стекле к утру дня n (ночью мороз крепчает ещё на шаг)
const frostLevel = (day) => clamp(0.12 + 0.16 * (day - 1), 0, 0.85);
// куда бьётся Огнёвка: у кромки инея верхнего правого стекла
const HITS = [{ x: 712, y: 206 }, { x: 852, y: 312 }, { x: 846, y: 204 }, { x: 716, y: 318 }, { x: 780, y: 198 }];
const clamp = Phaser.Math.Clamp;

export class BedroomScene extends Phaser.Scene {
  constructor() { super('Bedroom'); }

  init(data) {
    this.day = (data && data.day) || GameState.day;
    GameState.day = this.day;
    this.dayDef = getDay(this.day);
    this.forcedResult = null;
    this.inMinigame = false;
    this.resultTaken = false;
    this.leaving = false;
    this.momSitting = false;
    this.choice = null;
    this.phase = 'boot';
  }

  create() {
    this.d = new Director(this);
    this.reduced = prefersReducedMotion();
    this.cameras.main.setBackgroundColor('#000000');
    this.roomState = GameState.roomState();
    // мир и интерфейс — разные камеры: комната «дышит» (параллакс, живая линия, марево), HUD неподвижен
    const { world } = splitStage(this, { uiDepth: DEPTH.card });
    this.worldCam = world;

    // фон чуть крупнее кадра: при параллаксе края не открываются
    this.bg = this.add.image(960, 540, 'bedroom_day').setDepth(DEPTH.bg).setScale(1.008);
    this.bgNight = this.add.image(960, 540, 'bedroom_night').setDepth(DEPTH.bg + 0.5).setAlpha(0).setScale(1.008);
    this.bgDawn = this.add.image(960, 540, 'bedroom_dawn').setDepth(DEPTH.bg + 0.6).setAlpha(0).setScale(1.008);
    this.makeDoor();
    this.doorLight = new DoorLight(this, ROOM.door, this.doorLeaf, { depth: DEPTH.door + 0.5 });
    // ночник на тумбочке: горит, когда в комнате темнеет (время Тихона и ночь) — от него тень паука на стене
    this.lamp = { k: 0 };
    this.lampPool = this.add.image(LAMP.x, LAMP.y + 30, 'fx_glow').setTint(0xffb46a).setBlendMode(Phaser.BlendModes.ADD)
      .setScale(3.2).setAlpha(0).setDepth(DEPTH.dark + 0.3);
    this.lampGlow = this.add.image(LAMP.x, LAMP.y + 4, 'fx_glow').setTint(0xffd79a).setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.7).setAlpha(0).setDepth(DEPTH.dark + 0.4);
    this.makeWindowLight();
    this.web = this.add.image(ROOM.window.x + ROOM.window.w / 2, ROOM.window.y + ROOM.window.h / 2, 'web_window')
      .setDepth(DEPTH.web).setAlpha(GameState.losses >= 2 ? 0.85 : 0);
    this.makeThreads();
    this.makeWall();
    this.makeItems();
    this.chair = this.add.image(CHAIR.x, CHAIR.y, 'armchair').setOrigin(0.5, 1).setDepth(DEPTH.chair);
    this.plaid = this.add.image(MOM_X.chair + 6, 612, 'plaid').setOrigin(0.5, 0).setScale(0.78).setDepth(DEPTH.plaid).setAlpha(0);
    this.bird = new Bullfinch(this, { depth: DEPTH.bird });

    this.mom = new MomRig(this, MOM_X.door, MOM_Y).setDepth(DEPTH.mom).setVisible(false);
    this.boy = new BoyRig(this, ROOM.bed.x - ROOM.bed.w / 2, ROOM.bed.y - ROOM.bed.h, { health: healthOf(GameState.boyKey()) })
      .setDepth(DEPTH.boy);
    // шерстяные носки выглядывают из-под одеяла (после второй победы)
    this.socks = this.boy.attach('root', 'socks_peek', { ox: 75, oy: 60, dx: 122, dy: 300, z: 9.5, name: 'socks', scale: 0.9 });
    this.socks.img.setVisible(GameState.wins >= 2);

    this.cold = this.add.rectangle(960, 540, 1920, 1080, 0x0c1a36, 0).setDepth(DEPTH.cold);
    this.warm = this.add.rectangle(960, 540, 1920, 1080, 0xffc58a, 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.warm);
    this.dark = this.add.rectangle(960, 540, 1920, 1080, 0x03060d, 0).setDepth(DEPTH.dark);
    this.vignette = this.add.image(960, 540, 'fx_vignette').setScale(2).setTint(0x2a0b08).setAlpha(0).setDepth(DEPTH.vignette);
    this.makeMoth();
    this.frost = new FrostGlass(this, {
      depth: DEPTH.moth + 0.5, state: { level: frostLevel(this.day), webs: GameState.frost.webs, melts: GameState.frost.melts },
    });
    this.net = this.add.image(NET.x, NET.y, 'silver_net').setScale(0.5).setDepth(DEPTH.net).setAlpha(0);
    this.shadow = this.add.image(1920, 0, 'corner_shadow').setOrigin(1, 0).setDepth(DEPTH.shadow).setAlpha(0);

    const T = ROOM.spiderThread;
    this.spider = new SpiderRig(this, T.x, 44, { scale: 0.35, threadTop: 44 }).setRigDepth(DEPTH.spider);
    this.spider.setAlpha(0).setVisible(false);
    this.wallShadow = new WallShadow(this, this.spider, { depth: DEPTH.light + 0.5, hangY: T.hangY });
    // глаза Тихона в темноте угла (ночью)
    this.eyes = this.add.container(WEB.x - 34, WEB.y + 66).setDepth(DEPTH.spider + 1).setAlpha(0);
    for (const dx of [-12, 12]) {
      this.eyes.add(this.add.image(dx, 0, 'fx_glow').setScale(0.12).setTint(0xffb36b).setBlendMode(Phaser.BlendModes.ADD));
    }

    this.hud = new Hud(this, {
      day: this.day, results: GameState.dayResults, temp: GameState.temp, wins: GameState.wins, losses: GameState.losses,
    });
    this.hud.setDepth(DEPTH.hud);

    this.skipBtn = new Button(this, 1920 - S[600] - 110, S[500] + 28, {
      label: 'Пропустить', width: 220, height: 56, variant: 'ghost', style: 'button-lg',
      onClick: () => this.skipCutscene(),
    }).setDepth(DEPTH.ui);

    this.applyRoomState(this.roomState, { instant: true });
    if (this.day >= 2) { this.setItem('bottle', true, true); this.setItem('cup', true, true); } else this.setItem('bottle', true, true);
    if (GameState.losses >= 1) this.setItem('thermo', true, true);
    if (this.dayDef.away === 'asleep') this.momInChair({ asleep: true });

    this.input.on('pointerdown', (p, over) => { if (!over.length && !this.inMinigame) voice.skip(); });
    const offs = [
      Debug.on('skip', () => { if (!this.inMinigame) this.skipCutscene(); }),
      Debug.on('win', () => this.forceResult('win')),
      Debug.on('loss', () => this.forceResult('loss')),
    ];
    this.events.once('shutdown', () => {
      offs.forEach((f) => f());
      Audio.stopAllLoops(400);
      if (this.vignetteTween) this.vignetteTween.stop();
    });

    this.layers();
    this.parallax = new Parallax(this, world, { ampX: 10, ampY: 5 });
    this.fx = LiveFX.attach(this, world, { boil: true, grade: true, haze: true });
    this.regrade();
    this.events.once('shutdown', () => LiveFX.setHaze(null));

    // Прозрачные полноэкранные заливки не рисуем вовсе (экономия заполнения на слабых GPU).
    onUpdate(this, (time, delta) => {
      for (const r of [this.cold, this.dark, this.warm]) r.visible = r.fillAlpha > 0.003;
      this.tickMoth(Math.min(0.05, delta / 1000));
      this.tickLight();
    });

    Audio.loop('clock', { volume: 0.18, fade: 1500, pan: 0.15 });
    Audio.loop('wind_soft', { volume: 0.12 + 0.05 * GameState.losses, fade: 2000 });
    if (this.roomState === 'C') Audio.loop('heartbeat', { volume: 0.25, fade: 2500 });
    window.__bedroom = this;
    this.run();
  }

  skipCutscene() {
    if (this.inMinigame) return;
    this.mom.finishWalk();
    if (this.scene.isActive('Pov')) { const pov = this.scene.get('Pov'); if (pov && pov.d) pov.d.skip(); }
    if (this.choice && this.forcedResult) this.choice.resolveDefault();
    this.d.skip();
  }

  // Слои диорамы: насколько каждый план сдвигается за параллаксом (0 — приклеен к экрану, 1 — ближний план).
  layers() {
    const L = (f, list) => list.forEach((o) => o && o.setScrollFactor && o.setScrollFactor(f, f));
    const WALL = 0.36;
    L(WALL, [this.bg, this.bgNight, this.bgDawn, this.doorway, this.doorLeaf, this.light, this.web, this.threadG, ...this.glints,
      ...Object.values(this.items), this.net, this.shadow, this.eyes, this.frost.image, this.lampGlow, this.lampPool, ...this.wallArt]);
    this.doorLight.setScrollFactor(WALL); this.wallShadow.setScrollFactor(WALL);
    L(0.3, [this.mothC, this.embers, this.flakes]);
    L(0.78, [this.chair, this.plaid, this.mom]);
    L(0.92, [this.boy]);
    L(0.7, [this.spider, this.spider.thread]);
    L(0, [this.cold, this.warm, this.dark, this.vignette]);
  }

  // ---------- рисунки на стене ----------

  // Спецификация рисунка за прошедший день n (по итогам этого забега).
  daySpec(n) {
    const res = GameState.dayResults.slice(0, n);
    return {
      kind: 'day', day: n, game: getDay(n).game, result: GameState.dayResults[n - 1],
      wins: res.filter((r) => r === 'win').length, losses: res.filter((r) => r === 'loss').length, seed: 1000 + n * 37,
    };
  }

  // Прикреплённый скотчем листок: тень, сам рисунок и полоска скотча.
  pinned(spec, slot, { scale = ART_SCALE } = {}) {
    const key = drawingTexture(this, specKey(spec), spec);
    const c = this.add.container(slot.x, slot.y).setDepth(DEPTH.light + 0.3).setAngle(slot.a).setScale(scale);
    const sh = this.add.rectangle(10, 12, DRAW_W, DRAW_H, 0x000000, 0.28);
    const img = this.add.image(0, 0, key);
    const tape = this.add.rectangle(0, -DRAW_H / 2 + 6, 150, 46, 0xf3e6c0, 0.72).setAngle(-slot.a * 0.6 + 2);
    c.add([sh, img, tape]);
    return c;
  }

  makeWall() {
    this.wallArt = [];
    for (let n = 1; n < this.day && n <= WALL_ART.length; n++) {
      if (!GameState.dayResults[n - 1]) continue;
      this.wallArt.push(this.pinned(this.daySpec(n), WALL_ART[n - 1]));
    }
  }

  // Перед сном мальчик рисует, что было днём: листок в клетку, мелки штрих за штрихом, потом — на стену.
  async drawTonight() {
    const d = this.d; const n = this.day;
    const slot = WALL_ART[n - 1];
    if (!slot || !GameState.dayResults[n - 1]) return;
    const spec = this.daySpec(n);
    Journal.addDrawing(spec);
    const finish = () => {
      const c = this.pinned(spec, slot).setScrollFactor(0.36, 0.36);
      this.wallArt.push(c);
      return c;
    };
    if (d.skipping) { finish(); return; }
    const key = 'drawing_live';
    if (this.textures.exists(key)) this.textures.remove(key);
    const tex = this.textures.createCanvas(key, DRAW_W, DRAW_H);
    const ctx = tex.getContext(); const cache = {};
    paintDrawing(ctx, spec, 0, cache); tex.refresh();
    const shade = this.add.rectangle(960, 540, 1920, 1080, 0x05070d, 0).setDepth(DEPTH.card);
    const card = this.add.container(960, 520).setDepth(DEPTH.card + 1).setAngle(-2).setScale(0.9).setAlpha(0);
    card.add([this.add.rectangle(14, 16, DRAW_W, DRAW_H, 0x000000, 0.35), this.add.image(0, 0, key)]);
    d.tween({ targets: shade, fillAlpha: 0.62, duration: 600 });
    await d.tween({ targets: card, alpha: 1, scale: 1, angle: -1, duration: 600, ease: EASE });
    Audio.loop('pencil_scribble', { volume: 0.22, fade: 300, pan: -0.1 });
    const prog = { k: 0 };
    await d.tween({
      targets: prog, k: 1, duration: 5200, ease: 'Sine.easeInOut',
      onUpdate: () => { paintDrawing(ctx, spec, prog.k, cache); tex.refresh(); },
    });
    Audio.stopLoop('pencil_scribble', { fade: 250 });
    paintDrawing(ctx, spec, 1, cache); tex.refresh();
    await d.wait(700);
    // листок летит на стену, к маминому рисунку
    d.sfx('paper', { volume: 0.45, x: slot.x });
    d.tween({ targets: shade, fillAlpha: 0, duration: 900 });
    await d.tween({ targets: card, x: slot.x, y: slot.y, scale: ART_SCALE, angle: slot.a, duration: 1000, ease: 'Sine.easeInOut' });
    finish();
    d.sfx('tear', { volume: 0.2, x: slot.x });
    card.destroy(); shade.destroy();
  }

  // Цвет кадра: жар делает комнату теплее и гуще, нити — прохладнее и чётче.
  regrade() {
    LiveFX.grade(this.fx, GameState.heat(), GameState.wins / 3);
    // жар слышно: чем горячее, тем сильнее «плывёт» музыка и глуше звучит комната
    Music.setFever(Math.max(0, Math.min(1, (GameState.heat() - 0.3) / 0.6)) * 0.85);
  }

  // Ночник, тень Тихона, тон инея — каждый кадр.
  tickLight() {
    const k = this.lamp.k;
    this.lampGlow.setAlpha(0.75 * k);
    this.lampPool.setAlpha(0.2 * k);
    this.wallShadow.update(Math.max(k, this.bgNight.alpha * 0.9));
    // иней в темноте не светится сам: тон вслед за светом комнаты
    const dark = clamp(this.dark.fillAlpha * 1.6 + this.bgNight.alpha * 0.45, 0, 0.75);
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(0xffffff), Phaser.Display.Color.ValueToColor(0x5a6a90), 100, Math.round(dark * 100),
    );
    this.frost.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
  }

  setLamp(on, ms = 1200) {
    if (this.d.skipping || ms <= 0) { this.lamp.k = on ? 1 : 0; return Promise.resolve(); }
    if (on && this.lamp.k < 0.5) this.d.sfx('switch', { volume: 0.3, x: LAMP.x });
    return this.d.tween({ targets: this.lamp, k: on ? 1 : 0, duration: ms, ease: 'Sine.easeInOut' });
  }

  // ---------- дверь, свет, состояния комнаты ----------

  makeDoor() {
    const Dd = ROOM.door;
    if (!this.textures.exists('door_leaf')) {
      const c = makeCanvas(Dd.w, Dd.h); const ctx = c.getContext('2d');
      vgrad(ctx, 0, 0, Dd.w, Dd.h, [[0, '#6a4c38'], [1, '#563d2d']]);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 4;
      ctx.strokeRect(30, 40, Dd.w - 60, 250); ctx.strokeRect(30, 340, Dd.w - 60, 260);
      ellipse(ctx, Dd.w - 34, 350, 11, 11, '#d9b36a', '#5a4022', 3);
      ctx.strokeStyle = '#24170f'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, Dd.w - 4, Dd.h - 4);
      this.textures.addImage('door_leaf', c);
      const c2 = makeCanvas(Dd.w, Dd.h); const x2 = c2.getContext('2d');
      vgrad(x2, 0, 0, Dd.w, Dd.h, [[0, '#2a2622'], [0.7, '#1a1614'], [1, '#3a2c22']]);
      const g = x2.createRadialGradient(Dd.w / 2, 120, 10, Dd.w / 2, 120, 260);
      g.addColorStop(0, 'rgba(255,210,140,0.45)'); g.addColorStop(1, 'rgba(255,210,140,0)');
      x2.fillStyle = g; x2.fillRect(0, 0, Dd.w, Dd.h);
      this.textures.addImage('doorway', c2);
    }
    this.doorway = this.add.image(Dd.x, Dd.y, 'doorway').setOrigin(0, 0).setDepth(DEPTH.doorway);
    this.doorLeaf = this.add.image(Dd.x, Dd.y, 'door_leaf').setOrigin(0, 0).setDepth(DEPTH.door);
  }

  // open: true — настежь, 'ajar' — приоткрыта (мама рядом, за дверью), false — закрыта.
  doorOpen(open, ms = 600) {
    const k = open === 'ajar' ? 0.62 : open ? 0.16 : 1;
    if (Math.abs(this.doorLeaf.scaleX - k) < 0.01) return Promise.resolve();
    if (k < this.doorLeaf.scaleX) this.d.sfx('door', { volume: 0.45 });
    return this.d.tween({ targets: this.doorLeaf, scaleX: k, duration: ms, ease: 'Sine.easeInOut' })
      .then(() => { if (k === 1) this.d.sfx('door', { volume: 0.3 }); });
  }

  makeWindowLight() {
    const W = ROOM.window;
    this.light = this.add.container(0, 0).setDepth(DEPTH.light);
    // мягкий растушёванный луч от окна к полу, без засветки стекла
    this.beam = this.add.image(W.x - 280, W.y + 10, 'fx_beam_soft').setOrigin(0, 0)
      .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.1);
    this.dust = this.add.particles(0, 0, 'fx_dust', {
      x: { min: W.x + 40, max: W.x + 520 }, y: { min: W.y + 200, max: 900 }, lifespan: 7000,
      speedX: { min: -5, max: 8 }, speedY: { min: -6, max: 5 }, scale: { min: 0.25, max: 0.7 },
      alpha: { onEmit: () => 0, onUpdate: (p, k, t) => Math.sin(t * Math.PI) * 0.22 },
      frequency: Math.round(420 / Quality.particles), quantity: 1, blendMode: 'ADD',
    });
    this.light.add([this.beam, this.dust]);
  }

  lightLevel(state) { return { A: 1, B: 0.7, C: 0.5, D: 1 }[state] ?? 1; }

  applyRoomState(state, { instant = false, ms = 1600 } = {}) {
    this.roomState = state;
    const cold = { A: 0, B: 0.14, C: 0.24, D: 0 }[state] ?? 0;
    const props = [
      [this.cold, { fillAlpha: cold }],
      [this.light, { alpha: this.lightLevel(state) }],
    ];
    for (const [t, p] of props) {
      if (instant || this.d.skipping) Object.assign(t, p);
      else this.tweens.add({ targets: t, ...p, duration: ms, ease: 'Sine.easeInOut' });
    }
    this.setVignette(state === 'C', instant);
    if (state === 'C') Audio.loop('heartbeat', { volume: 0.25, fade: 2500 });
  }

  // Мягкая виньетка в состоянии C: медленно «дышит», без тряски камеры и вспышек.
  setVignette(on, instant) {
    if (this.vignetteTween) { this.vignetteTween.stop(); this.vignetteTween = null; }
    if (!on) {
      if (instant) this.vignette.setAlpha(0); else this.tweens.add({ targets: this.vignette, alpha: 0, duration: 1200 });
      return;
    }
    if (instant) this.vignette.setAlpha(0.3);
    if (this.reduced) { this.tweens.add({ targets: this.vignette, alpha: 0.3, duration: 1200 }); return; }
    this.vignetteTween = this.tweens.add({
      targets: this.vignette, alpha: { from: 0.26, to: 0.36 }, duration: 3200, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
    });
  }

  // «Время Тихона»: мама вышла, свет приглушается, Огнёвка за окном разгорается.
  darken(on, ms = 1500) {
    const light = on ? 0.3 : this.lightLevel(this.roomState);
    this.d.tween({ targets: this.light, alpha: light, duration: ms, ease: 'Sine.easeInOut' });
    this.setLamp(on, ms);
    this.mothShow(on);
    if (on) Audio.loop('drone', { volume: 0.35, fade: 2500 }); else Audio.stopLoop('drone', { fade: 2000 });
    return this.d.tween({ targets: this.dark, fillAlpha: on ? 0.4 : 0, duration: ms, ease: 'Sine.easeInOut' });
  }

  // ---------- предметы на тумбочке ----------

  makeItems() {
    this.items = {};
    for (const [name, it] of Object.entries(ITEMS)) {
      this.items[name] = this.add.image(it.x, it.y, it.key).setOrigin(0.5, 1).setScale(it.scale).setAngle(it.angle)
        .setDepth(DEPTH.items).setAlpha(0);
    }
  }

  setItem(name, on, instant = false) {
    const img = this.items[name]; const it = ITEMS[name];
    if (!img) return Promise.resolve();
    if (instant || this.d.skipping) { img.setAlpha(on ? 1 : 0).setY(it.y); return Promise.resolve(); }
    if (on && img.alpha > 0.9) return Promise.resolve();
    if (on) { this.d.sfx('pop', { volume: 0.3 }); img.setY(it.y - 24); }
    return this.d.tween({ targets: img, alpha: on ? 1 : 0, y: it.y, duration: on ? 450 : 300, ease: EASE });
  }

  // ---------- серебряные нити и сеть ----------

  makeThreads() {
    this.threadG = this.add.graphics().setDepth(DEPTH.threads);
    this.threadK = THREAD_ENDS.map((_, i) => (i < GameState.wins ? 1 : 0));
    this.glints = THREAD_ENDS.map(() => this.add.image(0, 0, 'fx_glow').setScale(0.1).setTint(0xeaf4ff)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.threads + 0.1).setAlpha(0));
    this.drawThreads();
    // редкий блик бежит по готовым нитям
    this.time.addEvent({
      delay: 2600, loop: true, callback: () => {
        const ready = this.threadK.map((k, i) => (k >= 1 ? i : -1)).filter((i) => i >= 0);
        if (ready.length && !this.inMinigame) this.glint(ready[Math.floor(Math.random() * ready.length)], 1600);
      },
    });
  }

  threadCurve(i) {
    const e = THREAD_ENDS[i];
    const mid = { x: (WEB.x + e.x) / 2, y: (WEB.y + e.y) / 2 + 70 + i * 26 };
    return new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(WEB.x, WEB.y), new Phaser.Math.Vector2(mid.x, mid.y), new Phaser.Math.Vector2(e.x, e.y));
  }

  drawThreads() {
    const g = this.threadG; g.clear();
    const vib = this.threadVib || [0, 0, 0];
    const now = this.time.now / 1000;
    this.threadK.forEach((k, i) => {
      if (k <= 0) return;
      let pts = this.threadCurve(i).getPoints(36).slice(0, Math.max(2, Math.round(37 * k)));
      if (vib[i] > 0.15) {
        // щипок: стоячая волна по всей длине нити (основной тон + немного второго обертона)
        const a = pts[0]; const b = pts[pts.length - 1];
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const nx = -(b.y - a.y) / len; const ny = (b.x - a.x) / len;
        const w = Math.sin(now * 2 * Math.PI * 9 + i);
        pts = pts.map((p, j) => {
          const u = j / (pts.length - 1);
          const off = vib[i] * (Math.sin(Math.PI * u) * w + 0.3 * Math.sin(2 * Math.PI * u) * Math.sin(now * 2 * Math.PI * 17));
          return { x: p.x + nx * off, y: p.y + ny * off };
        });
        g.lineStyle(5, COLORS.thread, 0.05 * Math.min(1, vib[i] / 4)); g.strokePoints(pts);
      }
      g.lineStyle(6, COLORS.thread, 0.08); g.strokePoints(pts);
      g.lineStyle(2, COLORS.thread, 0.62 + Math.min(0.3, vib[i] * 0.04)); g.strokePoints(pts);
    });
  }

  // Щипок нити i: она дрожит и затихает; блик бежит от точки щипка.
  pluckThread(i, strength = 1) {
    if (!this.threadK[i] || this.threadK[i] <= 0) return;
    this.threadVib = this.threadVib || [0, 0, 0];
    this.threadVib[i] = Math.max(this.threadVib[i], 10 * strength);
    if (!this.threadTick) {
      this.threadTick = () => {
        let any = false;
        for (let k = 0; k < 3; k++) { this.threadVib[k] *= 0.95; if (this.threadVib[k] > 0.15) any = true; else this.threadVib[k] = 0; }
        this.drawThreads();
        if (!any) { this.events.off('update', this.threadTick); this.threadTick = null; }
      };
      this.events.on('update', this.threadTick);
    }
    if (Math.random() < 0.5) this.glint(i, 700);
  }

  // Колыбельная на паутинке: Тихон играет на своих нитях; сколько нитей — столько голосов.
  async webLullaby(n = Math.min(2, GameState.wins), { volume = 0.8, music = 0.3 } = {}) {
    const d = this.d;
    const key = `webharp_${n}`;
    const spec = WEBHARP[key];
    if (!spec || d.skipping || n < 1) return;
    Music.setLevel(music, 1500);
    const snd = Audio.play(key, { volume, x: WEB.x - 300 });
    if (this.spider.visible && this.spider.react) this.spider.react('pluck', spec.dur * 1000 - 2500);
    const calls = spec.notes.map(([t, th]) => this.time.delayedCall(t * 1000 + 30, () => this.pluckThread(th, th === 0 ? 1 : 0.7)));
    window.__lullaby = { key, notes: spec.notes.length, playing: true };
    await d.wait(spec.dur * 1000 - 1200);
    calls.forEach((c) => c.remove(false));
    if (d.skipping && snd) snd.howl.fade(snd.howl.volume(undefined, snd.id), 0, 400, snd.id);
    window.__lullaby.playing = false;
    Music.setLevel(1, 2500);
  }

  glint(i, ms = 1400) {
    const img = this.glints[i]; const curve = this.threadCurve(i);
    const h = { t: 0 };
    this.tweens.killTweensOf(h);
    img.setAlpha(0);
    this.tweens.add({
      targets: h, t: 1, duration: ms, ease: 'Sine.easeInOut',
      onUpdate: () => { const p = curve.getPoint(h.t); img.setPosition(p.x, p.y).setAlpha(Math.sin(h.t * Math.PI) * 0.9); },
      onComplete: () => img.setAlpha(0),
    });
  }

  // Паутинка инея на стекле — к каждой нити (узор остаётся до конца забега).
  frostWeb(i) {
    const pane = WEB_PANES[i % WEB_PANES.length]; const seed = 300 + i * 41 + this.day;
    if (!GameState.frost.webs.some((w) => w.pane === pane)) GameState.frost.webs.push({ pane, seed });
    if (!this.d.skipping) this.d.sfx('sparkle', { volume: 0.22, x: 680 });
    return this.frost.addWeb(pane, seed, 2600, this.d.skipping);
  }

  // Новая нить: тянется из угла к окну и вспыхивает бликом.
  async addThread(i) {
    this.d.sfx('web', { volume: 0.5 });
    const h = { k: this.threadK[i] };
    await this.d.tween({
      targets: h, k: 1, duration: 1400, ease: 'Sine.easeInOut',
      onUpdate: () => { this.threadK[i] = h.k; this.drawThreads(); },
      onComplete: () => { this.threadK[i] = 1; this.drawThreads(); },
    });
    if (!this.d.skipping) { this.d.sfx('sparkle', { volume: 0.35 }); this.glint(i, 1100); }
    this.frostWeb(i);
    this.regrade();
  }

  // ---------- Огнёвка ----------

  makeMoth() {
    this.mothC = this.add.container(PANE.x, PANE.y).setDepth(DEPTH.moth).setAlpha(0);
    this.mothGlow = this.add.image(0, 0, 'fx_glow').setTint(0xff7a2e).setBlendMode(Phaser.BlendModes.ADD).setScale(0.8);
    this.mothImg = this.add.image(0, 0, 'moth_fire_0');
    this.mothC.add([this.mothGlow, this.mothImg]);
    this.moth = { t: Math.random() * 10, mode: 'calm', free: false, base: 0.28, glow: 0.5, flare: 0, dir: 1, px: PANE.x, bank: 0 };
    this.mothWhite = null;
    // угольки: срываются с крыльев и гаснут, не вылетая за стекло; чем сильнее жар, тем их больше
    const pane = PANES[1];
    this.embers = this.add.particles(0, 0, 'fx_ember', {
      lifespan: { min: 700, max: 1500 }, speedX: { min: -16, max: 16 }, speedY: { min: -48, max: -14 },
      scale: { start: 0.62, end: 0 }, alpha: { start: 0.95, end: 0 }, frequency: 200, quantity: 1, blendMode: 'ADD',
      emitting: false, deathZone: { type: 'onLeave', source: new Phaser.Geom.Rectangle(pane.x, pane.y, pane.w, pane.h) },
    }).setDepth(DEPTH.moth - 0.05);
    this.embers.startFollow(this.mothC);
    // снежинки: в финале угольки остывают и падают снегом
    this.flakes = this.add.particles(0, 0, 'fx_flake', {
      lifespan: { min: 2600, max: 4200 }, speedX: { min: -18, max: 18 }, speedY: { min: 12, max: 40 }, gravityY: 6,
      rotate: { min: -40, max: 40 }, scale: { start: 0.9, end: 0.5 }, alpha: { start: 0.95, end: 0 }, emitting: false,
    }).setDepth(DEPTH.moth + 0.6);
  }

  tickMoth(dt) {
    const m = this.moth;
    const vis = this.mothC.alpha > 0.01;
    const fire = !this.mothWhite || this.mothWhite.alpha < 0.5;
    this.embers.emitting = vis && fire && this.mothC.alpha > 0.4 && Quality.particles > 0;
    if (this.embers.emitting) this.embers.frequency = Math.round((230 - 150 * GameState.heat() - 80 * m.flare) / Math.max(0.3, Quality.particles));
    if (!vis) { LiveFX.setHaze(null); return; }
    m.t += dt * (this.reduced ? 0.5 : 1);
    const fr = m.mode === 'frantic' ? 2.2 : 1;
    if (!m.free) {
      const ax = m.mode === 'frantic' ? 70 : 44; const ay = m.mode === 'frantic' ? 56 : 30;
      const x = PANE.x + Math.sin(m.t * 0.8 * fr) * ax + Math.sin(m.t * 2.3 * fr) * 10;
      const y = PANE.y + Math.sin(m.t * 1.3 * fr + 1) * ay + Math.cos(m.t * 3.1 * fr) * 6;
      const nx = clamp(x, PANE.x - PANE.rx, PANE.x + PANE.rx);
      this.mothC.setPosition(nx, clamp(y, PANE.y - PANE.ry, PANE.y + PANE.ry));
    }
    // крен по скорости: бабочка закладывает вираж
    const vx = dt > 0 ? (this.mothC.x - m.px) / dt : 0; m.px = this.mothC.x;
    m.bank += (clamp(vx * 0.05, -16, 16) - m.bank) * Math.min(1, dt * 8);
    // взмахи кадрами: 0 — крылья раскрыты … 3 — почти сложены (крылья вращаются вокруг тела)
    let idx;
    if (m.mode === 'rest') {
      // сидит: крылья сложены, изредка медленно приоткрываются
      const o = Math.max(0, Math.sin(m.t * 0.9)) ** 3;
      idx = 3 - Math.round(o * 2);
    } else {
      const ph = m.t * (m.mode === 'frantic' ? 26 : 13) * (this.reduced ? 0.6 : 1);
      idx = Math.min(3, Math.round((1 - (Math.cos(ph) + 1) / 2) * 3));
    }
    const key = `moth_fire_${idx}`;
    if (this.mothImg.texture.key !== key) this.mothImg.setTexture(key);
    this.mothImg.setScale(m.base).setAngle(m.bank);
    if (this.mothWhite) {
      this.mothWhite.setTexture(`moth_white_${idx}`).setScale(m.base).setAngle(m.bank);
    }
    const pulse = 0.85 + 0.15 * Math.sin(m.t * 3);
    this.mothGlow.setAlpha(m.glow * pulse).setScale(0.8 * (1 + m.flare));
    // марево над бабочкой: воздух дрожит тем сильнее, чем выше жар
    const heat = GameState.heat();
    const k = fire ? this.mothC.alpha * (0.3 + 0.7 * heat) * (0.55 + m.glow * 0.5 + m.flare * 0.8) : 0;
    LiveFX.setHaze(k > 0.03 ? { x: this.mothC.x - 170, y: this.mothC.y - 210, w: 340, h: 330 } : null, k);
  }

  // Огнёвка бьётся о стекло: рывок к стеклу (крупнее), стук, сноп угольков, иней тает кругом.
  // big — удар-искра (проталина остаётся на стекле до конца забега), иначе — лёгкий стук.
  async mothHitGlass({ big = true, index = null } = {}) {
    const d = this.d; const m = this.moth;
    const hits = GameState.frost.melts.length;
    const at = HITS[(index ?? hits) % HITS.length];
    const r = big ? 30 + 4 * Math.min(3, GameState.losses) : 11;
    if (big) GameState.frost.melts.push({ x: at.x, y: at.y, r, seed: 50 + hits * 13 });
    if (d.skipping) { this.frost.melt(at.x, at.y, r, 50 + hits * 13, 0, true); return; }
    this.mothShow(true, 250);
    m.free = true;
    const from = { x: this.mothC.x, y: this.mothC.y };
    await d.tween({ targets: this.mothC, x: at.x, y: at.y, duration: big ? 320 : 220, ease: 'Quad.easeIn' });
    d.tween({ targets: m, base: big ? 0.42 : 0.34, duration: 120, yoyo: true, ease: 'Sine.easeOut' });
    Audio.play('tap', { volume: big ? 0.5 : 0.22, rate: big ? 0.9 : 1.3, x: at.x });
    if (big) Audio.play('whoosh', { volume: 0.18, x: at.x });
    this.embers.explode(big ? 22 : 7, at.x, at.y);
    this.frost.melt(at.x, at.y, r, 50 + hits * 13, big ? 1800 : 900);
    if (big && this.bird.present) this.bird.flyAway();
    await d.wait(big ? 260 : 120);
    await d.tween({ targets: this.mothC, x: (from.x + PANE.x) / 2, y: (from.y + PANE.y) / 2, duration: 520, ease: 'Sine.easeOut' });
    m.free = false;
  }

  mothShow(on, ms = 1400) {
    if (this.d.skipping) { this.mothC.setAlpha(on ? 1 : 0); return Promise.resolve(); }
    if (on && this.mothC.alpha < 0.05) this.d.sfx('moth_flutter', { volume: 0.25 });
    return this.d.tween({ targets: this.mothC, alpha: on ? 1 : 0, duration: ms, ease: 'Sine.easeInOut' });
  }

  // Вспышка Огнёвки (поражение): свечение мягко разрастается и опадает, без резких вспышек.
  async mothFlare(k = 0.9) {
    this.mothShow(true, 400);
    const m = this.moth;
    this.d.sfx('whoosh', { volume: 0.3 });
    await this.d.tween({ targets: m, flare: k, glow: 0.8, duration: 900, ease: 'Sine.easeOut' });
    await this.d.tween({ targets: m, flare: 0.25, glow: 0.62, duration: 1400, ease: 'Sine.easeInOut' });
  }

  mothFrantic(on) {
    this.moth.mode = on ? 'frantic' : 'calm';
    if (on && !this.d.skipping) {
      for (let i = 0; i < 3; i++) {
        this.time.delayedCall(300 + i * 520, () => {
          Audio.play('tap', { volume: 0.18, rate: 1.4, x: this.mothC.x });
          if (this.mothC.alpha > 0.3) this.embers.explode(5, this.mothC.x, this.mothC.y);
        });
      }
    }
  }

  // ---------- мальчик ----------

  updateBoyHealth() { this.boy.setHealth(healthOf(GameState.boyKey())); }

  cough(hard = false) {
    if (this.d.skipping) return Promise.resolve();
    this.d.sfx(hard ? 'cough_hard' : 'cough_soft');
    return this.boy.cough(hard);
  }

  // ---------- мама ----------

  async momWalk(x, speed = 280) {
    if (this.d.skipping) { this.mom.x = x; this.mom.face(1, true); return; }
    // старый пол: на середине пути одна половица отзывается скрипом — там, где сейчас мама
    const dist = Math.abs(x - this.mom.x);
    if (dist > 260 && Math.random() < 0.55) {
      const mid = (x + this.mom.x) / 2;
      this.time.delayedCall((dist / speed) * 500, () => Audio.play('creak', { volume: 0.1 + Math.random() * 0.08, x: mid }));
    }
    await this.mom.walkTo(x, { speed });
  }

  async momEnter(to = MOM_X.bed, { face = null, hurry = false } = {}) {
    const m = this.mom;
    Audio.stopLoop('stove', { fade: 1200 });
    if (m.visible && !this.momSitting) { await this.momWalk(to, hurry ? 430 : 280); return; }
    m.setSit(0, true).setSleep(false, true);
    m.setPosition(MOM_X.door, MOM_Y).face(1, true).setVisible(true).setAlpha(0);
    m.setFace(face);
    // сначала шаги: тень ног проходит по полоске света под дверью, скрипят половицы
    if (!this.d.skipping) {
      this.creaks(hurry ? 2 : 3, hurry ? 240 : 380);
      await this.doorLight.steps(hurry ? 650 : 1250);
    }
    await this.doorOpen(true, hurry ? 380 : 600);
    this.doorLight.clearFeet();
    this.d.tween({ targets: m, alpha: 1, duration: 300 });
    await this.momWalk(to, hurry ? 430 : 280);
    if (!hurry) this.doorOpen(false, 500);
  }

  // Скрип половиц под мамиными шагами (слева, у двери).
  creaks(n = 3, gap = 380) {
    for (let i = 0; i < n; i++) this.time.delayedCall(i * gap + Math.random() * 90, () => Audio.play('creak', { volume: 0.16 + Math.random() * 0.1, x: 230 }));
  }

  // door: 'close' — мама уходит из дома (аптека, соседка), 'ajar' — она за дверью (кухня, коридор).
  async momLeave({ door = 'close' } = {}) {
    const m = this.mom;
    if (!m.visible) return;
    if (this.momSitting) { m.setSit(0); this.momSitting = false; await this.d.wait(500); }
    m.reach('near', null).reach('far', null).setLean(0).setCrouch(0).tiltHead(0);
    await this.doorOpen(true, 420);
    if (!this.d.skipping) this.creaks(2, 420);
    await this.momWalk(MOM_X.door);
    await this.d.tween({ targets: m, alpha: 0, duration: 260 });
    m.setVisible(false);
    m.drop('near'); m.drop('far');
    await this.doorOpen(door === 'ajar' ? 'ajar' : false, 500);
    // шаги удаляются: тень уходит по полоске света
    if (!this.d.skipping) this.doorLight.steps(900, { from: this.doorLight.SW * 0.6, to: this.doorLight.SW + 60, stop: false });
  }

  // Наклониться к мальчику и потрогать лоб.
  async momTouchForehead(ms = 1200) {
    const m = this.mom;
    m.face(1).setLean(0.34).setCrouch(0.4).tiltHead(0.18);
    await this.d.wait(260);
    const p = this.boy.foreheadPoint();
    m.reach('near', p.x - 6, p.y + 4);
    await this.d.wait(ms);
    m.reach('near', null).setLean(0).setCrouch(0).tiltHead(0);
    await this.d.wait(300);
  }

  // Подоткнуть одеяло (мама поправляет отворот у плеча).
  async momTuck() {
    const m = this.mom;
    m.face(1).setLean(0.36).setCrouch(0.45).tiltHead(0.16);
    await this.d.wait(240);
    m.reach('near', 1600, 742).reach('far', 1560, 760);
    this.boy.hide(0.22);
    await this.d.wait(700);
    m.reach('near', 1630, 736);
    await this.d.wait(500);
    m.reach('near', null).reach('far', null).setLean(0).setCrouch(0).tiltHead(0);
    await this.d.wait(300);
  }

  // Ложка сиропа прямо в спальне (утро второго дня).
  async momSpoon(line) {
    const m = this.mom; const d = this.d;
    m.hold('far', 'prop_bottle', { scale: 0.42, dy: 18 });
    m.hold('near', 'prop_spoon', { scale: 0.55, dy: 10 });
    m.face(1).setLean(0.32).setCrouch(0.35).tiltHead(0.14);
    m.reachLocal('far', 40, -360);
    await d.wait(300);
    const p = this.boy.mouthPoint();
    m.reach('near', p.x - 30, p.y + 4);
    this.boy.setFace({ eyes: 'closed', mouth: 'O' });
    d.sfx('spoon', { volume: 0.4 });
    const say = d.say(line);
    await d.wait(1300);
    d.sfx('gulp', { volume: 0.4 });
    this.boy.setFace({ eyes: 'half', mouth: 'closed' }, 1500);
    m.reach('near', null).setLean(0).setCrouch(0).tiltHead(0);
    await say;
    m.drop('near');
    m.reachLocal('far', null);
    m.drop('far');
  }

  momInChair({ asleep = false } = {}) {
    const m = this.mom;
    m.setPosition(MOM_X.chair, MOM_Y).face(1, true).setVisible(true).setAlpha(1);
    m.reach('near', null).reach('far', null).setLean(0).setCrouch(0).tiltHead(0);
    m.setSit(1, true).setSleep(asleep, true);
    this.momSitting = true;
  }

  // Мама садится в кресло рядом с кроватью («посижу с тобой»).
  async momSit() {
    const m = this.mom; const d = this.d;
    if (this.momSitting) return;
    await this.momWalk(MOM_X.chair);
    m.face(1).reach('near', null).reach('far', null).setLean(0).setCrouch(0).tiltHead(0);
    m.setSit(1, d.skipping);
    this.momSitting = true;
    await d.wait(700);
    // рука на краю одеяла
    m.reach('near', 1590, 760);
  }

  // Мама возвращается к кровати после партии (у каждого дня своя фраза).
  async momReturn({ line = true, face = null } = {}) {
    const d = this.d; const m = this.mom;
    if (this.momSitting && m.visible) {
      // день 4: задремала в кресле
      m.setSleep(false);
      await d.wait(600);
      m.setFace({ eyes: 'open', mouth: 'half' });
      if (line) await d.say('M43');
      m.setSit(0, d.skipping); this.momSitting = false;
      await d.wait(600);
      await this.momWalk(MOM_X.bed);
      m.setFace(face);
      return;
    }
    await this.momEnter(MOM_X.bed, { face });
    if (line) await d.say(this.dayDef.back);
  }

  async momHug(ms = 1800) {
    const m = this.mom;
    m.face(1).setLean(0.42).setCrouch(0.5).tiltHead(0.22);
    await this.d.wait(300);
    m.reach('near', 1650, 742).reach('far', 1700, 690);
    this.boy.setPose('hug', 5);
    await this.d.wait(ms);
    m.reach('near', null).reach('far', null).setLean(0).setCrouch(0).tiltHead(0);
    this.boy.setPose('rest', 5);
    await this.d.wait(300);
  }

  // ---------- паук ----------

  spiderScale() {
    const p = GameState.spiderPower();
    return clamp(0.76 * (1 + 0.1 * p), 0.56, 1);
  }

  async spiderDescend() {
    const s = this.spider;
    s.setVisible(true).setFace('idle').setMode('idle');
    s.setPosition(ROOM.spiderThread.x, 44).setScale(0.35).setAlpha(0);
    this.d.sfx('web', { volume: 0.45 });
    this.boy.hide(GameState.trust >= 1 ? 0.15 : 0.5).look(1);
    this.d.tween({ targets: s, alpha: 1, duration: 500 });
    await this.d.tween({ targets: s, y: ROOM.spiderThread.hangY, scale: this.spiderScale(), duration: 2600, ease: 'Sine.easeInOut' });
  }

  async spiderAscend() {
    const s = this.spider;
    s.setMode('idle');
    this.boy.look(0);
    await this.d.tween({ targets: s, y: 44, scale: 0.35, alpha: 0, duration: 1900, ease: 'Sine.easeIn' });
    s.setVisible(false).setFace('idle');
    this.boy.hide(0);
  }

  spiderLaugh(ms = 1400) {
    this.d.sfx('spider_laugh', { volume: 0.7 });
    if (this.d.skipping) { this.spider.setFace('grin'); return Promise.resolve(); }
    return this.spider.laugh(ms);
  }

  // ---------- мини-игра и вид глазами мальчика ----------

  forceResult(result) {
    if (this.inMinigame) return;
    if (this.forcedResult || this.resultTaken) return;
    this.forcedResult = result;
    this.skipCutscene();
  }

  setBlur(on) {
    const cam = this.cameras.main;
    if (on && !Quality.blur) { this.tweens.add({ targets: this.dark, fillAlpha: 0.55, duration: 400 }); return; }
    try {
      if (on && !this.blur && cam.filters) {
        this.blur = cam.filters.internal.addBlur(1, 2, 2, 0);
        this.tweens.add({ targets: this.blur, strength: 1.3, duration: 500, ease: 'Sine.easeOut' });
      } else if (!on && this.blur) {
        const b = this.blur; this.blur = null;
        this.tweens.add({
          targets: b, strength: 0, duration: 350, onComplete: () => { try { cam.filters.internal.remove(b); } catch { /* */ } },
        });
      }
    } catch (e) {
      this.blur = null;
    }
  }

  playMinigame() {
    if (this.forcedResult) return Promise.resolve(this.forcedResult);
    const sceneKey = GAME_SCENES[this.dayDef.game];
    if (!sceneKey || !this.scene.get(sceneKey)) return Promise.resolve('win');
    return new Promise((resolve) => {
      this.inMinigame = true;
      this.skipBtn.setVisible(false);
      this.hud.setVisible(false);
      this.hideToast(this.activeToast, 150);
      this.setBlur(true);
      const wasVisible = this.spider.visible;
      this.tweens.add({ targets: this.spider, alpha: 0, duration: 300 });
      let done = false;
      this.scene.launch(sceneKey, {
        day: this.day,
        difficulty: GameState.difficulty,
        variant: this.dayDef.variant || null,
        onDone: (result) => {
          if (done) return;
          done = true;
          this.inMinigame = false;
          this.skipBtn.setVisible(true);
          this.hud.setVisible(true);
          this.setBlur(false);
          if (!Quality.blur) this.tweens.add({ targets: this.dark, fillAlpha: 0.4, duration: 300 });
          if (wasVisible) this.tweens.add({ targets: this.spider, alpha: 1, duration: 300 });
          resolve(result);
        },
      });
    });
  }

  // Сцена глазами мальчика поверх спальни.
  pov(mode) {
    if (this.d.skipping) return Promise.resolve();
    return new Promise((resolve) => {
      this.hud.setVisible(false);
      this.skipBtn.setVisible(false);
      this.cameras.main.fadeOut(350, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        let done = false;
        this.scene.launch('Pov', {
          mode, health: healthOf(GameState.boyKey()), day: this.day,
          onDone: () => {
            if (done) return;
            done = true;
            this.hud.setVisible(true);
            this.skipBtn.setVisible(true);
            this.cameras.main.fadeIn(500, 0, 0, 0);
            resolve();
          },
        });
      });
    });
  }

  // Итог партии засчитывается ровно один раз.
  takeResult(result) {
    if (this.resultTaken) return false;
    this.resultTaken = true;
    this.lastResult = result;
    GameState.recordDay(result, this.day);
    return true;
  }

  showResultOnHud() {
    this.regrade();
    this.hud.setScore(GameState.wins, GameState.losses, !this.d.skipping);
    const p = this.hud.applyDay(this.day - 1, this.lastResult, GameState.temp, { instant: this.d.skipping });
    this.updateBoyHealth();
    return p;
  }

  // ---------- выбор реплики ----------

  async ask(def) {
    const d = this.d;
    d.resume();
    this.skipBtn.setVisible(false);
    this.phase = 'choice';
    const options = def.choice.map((c) => ({ label: lineText(voice.get(c.line)) || c.line }));
    const panel = new ChoicePanel(this, { prompt: 'Что ответить Тихону?', options });
    this.choice = panel;
    if (this.forcedResult) panel.resolveDefault();
    const i = await panel.choose();
    this.choice = null;
    d.resume();
    this.phase = 'talk';
    this.skipBtn.setVisible(true);
    const c = def.choice[i];
    GameState.choose(this.day, i, { kind: c.kind, secret: c.secret });
    if (c.kind) this.boy.hide(0).setFace({ eyes: 'open', mouth: 'smile' }, 2400);
    else this.boy.setFace({ eyes: 'sad', mouth: 'frown' }, 2400);
    await d.say(c.line);
    this.spider.setFace(c.kind ? 'idle' : 'grin');
    await d.say(c.reply);
    this.spider.setFace('idle');
    if (Journal.unlock(c.secret)) {
      const s = secretById(c.secret);
      this.toast(`Новый секрет в дневнике: ${s.title}`);
    }
    return i;
  }

  // Записка-стикер сверху: «Новый секрет в дневнике» с карандашной галочкой.
  toast(message) {
    const c = this.add.container(960, S[500] + 40).setDepth(DEPTH.toast).setAlpha(0);
    const t = this.add.text(0, 2, message, text('hand-3', { color: INK.ink })).setOrigin(0.5).setResolution(2);
    const w = Math.ceil((t.width + 48 + S[400] * 2) / 16) * 16; const h = 72;
    const bg = this.add.image(0, 0, paperTexture(this, w, h, { kind: 'note', seed: 9, tape: 'top' }));
    const g = this.add.graphics();
    inkCheck(g, -w / 2 + S[400] + 10, 2, 22, { color: INKN.amber, seed: 5 });
    t.setX(24);
    c.add([bg, g, t]);
    this.d.sfx('chime', { volume: 0.35 });
    this.tweens.add({ targets: c, alpha: 1, duration: MOTION.fade, ease: EASE });
    if (!this.reduced) {
      c.setAngle(-3).setY(c.y - 24);
      this.tweens.add({ targets: c, angle: -0.8, y: c.y + 24, duration: 560, ease: 'Back.easeOut' });
    }
    this.hideToast(this.activeToast, 150);
    this.activeToast = c;
    this.time.delayedCall(3200, () => this.hideToast(c));
  }

  // Плашка уходит сама через 3 с или сразу, когда начинается мини-игра (иначе она торчит из-под табло игры).
  hideToast(c = this.activeToast, ms = MOTION.fade) {
    if (!c || !c.active || c.hiding) return;
    c.hiding = true;
    if (this.activeToast === c) this.activeToast = null;
    this.tweens.killTweensOf(c);
    this.tweens.add({ targets: c, alpha: 0, duration: ms, ease: EASE, onComplete: () => c.destroy() });
  }

  // ---------- ход дня ----------

  async run() {
    const d = this.d;
    this.phase = 'intro';
    Save.write(GameState); // «Продолжить» в меню начнёт этот день с утра
    console.info(`[day] день ${this.day}: ${this.dayDef.gameTitle} (побед ${GameState.wins}, поражений ${GameState.losses})`);
    if (!PageTurn.active) this.cameras.main.fadeIn(900, 0, 0, 0);
    this.morningMusic();
    await this.morning();
    d.resume();
    this.phase = 'talk';
    await this.talk();
    d.resume();
    this.phase = 'game';
    this.skipBtn.setVisible(false);
    const result = await this.playMinigame();
    if (!this.takeResult(result)) return;
    d.resume();
    this.phase = 'event';
    this.skipBtn.setVisible(true);
    const ev = GameState.lastEvent;
    console.info(`[day] день ${this.day}: ${result} → ${ev} (побед ${GameState.wins}, поражений ${GameState.losses})`);
    await this[`event_${ev}`]();
    d.resume();
    const outcome = GameState.outcome();
    if (outcome) {
      this.phase = 'final';
      console.info(`[day] финал: ${outcome} на день ${this.day}`);
      await (outcome === 'recovered' ? this.finalRecovered() : this.finalHospital());
      return;
    }
    this.phase = 'night';
    await this.night();
  }

  // ---------- утро ----------

  // Утренняя тема; после тяжёлой ночи (два поражения) — тише, будто комната ещё не проснулась.
  morningMusic() {
    const heavy = GameState.losses >= 2 && GameState.dayResults[this.day - 2] === 'loss';
    Music.play('mus_morning', { fade: 3000, volume: heavy ? 0.55 : this.day === 1 ? 0.8 : 1 });
  }

  // После партии: победа — утро светлеет, поражение — тревожный вальс.
  eventMusic(won) {
    if (won) Music.play('mus_morning', { fade: 2500, volume: 0.9 });
    else Music.play('mus_hospital', { fade: 2500, volume: 0.7 });
  }

  // Снегирь: утром после победы уже сидит у окна, после искры — прилетает позже, осторожно.
  birdMorning() {
    const last = GameState.dayResults[this.day - 2];
    if (this.day === 1 || last === 'win') { this.bird.sit(GameState.wins); return; }
    this.time.delayedCall(4200, () => { if (!this.inMinigame && this.mothC.alpha < 0.1) this.bird.arrive(GameState.wins); });
  }

  async morning() {
    this.birdMorning();
    if (this.day === 1) { await this.morning1(); return; }
    const d = this.d; const m = this.mom; const day = this.day;
    const last = GameState.dayResults[day - 2];
    this.boy.setFace({ eyes: 'closed', mouth: 'closed' });
    await d.wait(600);
    await this.hud.show(d.skipping);
    await d.wait(400);
    if (last === 'win') {
      this.boy.setFace({ eyes: 'open', mouth: 'smile' }, 2600).setPose('wave', 6);
      await d.say('B08');
      this.boy.setPose('rest', 5);
    } else {
      await this.cough(true);
      this.boy.setFace({ eyes: 'half', mouth: 'wavy' }, 2600);
      await d.say('B09');
    }
    if (this.dayDef.away === 'asleep') return; // день 4: мама спит в кресле, будить её не будем
    await this.momEnter(MOM_X.bed, { face: last === 'win' ? { eyes: 'happy', mouth: 'smile' } : { eyes: 'worry', mouth: 'worry' } });
    await this.momTouchForehead(800);
    await d.say(last === 'win' ? 'M33' : 'M34');
    m.setFace(null);
    if (this.dayDef.away === 'kitchen') {
      await this.momSpoon('M35');
      await d.say('M36');
      await this.momTuck();
      await this.momLeave({ door: 'ajar' });
      Audio.loop('stove', { volume: 0.3, fade: 2500 });
    } else if (this.dayDef.away === 'phone') {
      m.hold('near', 'prop_phone', { scale: 0.9, dy: 6 });
      await d.say('M37');
      await this.momLeave({ door: 'ajar' });
    } else {
      await d.say('M38');
      await this.momTuck();
      await this.momLeave();
    }
    // за стенкой у бабы Вали бормочет радио: вальс, диктор, сигналы точного времени
    if (day === 2 || day === 3) {
      Audio.loop('radio', { volume: 0.55, pan: -0.85, fade: 3500 });
      if (day === 2 && !d.skipping) { await d.wait(1400); this.boy.look(-1); await d.say('B60'); this.boy.look(0); }
    }
  }

  async morning1() {
    const d = this.d; const m = this.mom;
    this.boy.setFace({ eyes: 'closed', mouth: 'wavy' });
    await d.wait(700);
    await this.hud.show(d.skipping);
    await d.wait(300);
    await this.cough(false);
    this.boy.setFace(null);
    await d.say('B04');
    await this.momEnter(MOM_X.bed, { face: { eyes: 'worry', mouth: 'worry' }, hurry: true });
    await this.momTouchForehead(900);
    m.setFace({ eyes: 'worry', mouth: 'worry' });
    await d.say('M05');
    this.boy.setFace({ eyes: 'sad', mouth: 'frown' });
    await d.say('B05');
    m.setFace({ eyes: 'open', mouth: 'smile' });
    await d.say('M06');
    // флакон на тумбочке пустой
    await this.momWalk(MOM_X.stand);
    m.face(1).setLean(0.28).setCrouch(0.42);
    m.reach('near', ITEMS.bottle.x, ITEMS.bottle.y - 40);
    await d.wait(450);
    this.setItem('bottle', false, true);
    m.hold('near', 'prop_bottle', { scale: 0.44, dy: 18 });
    m.setLean(0).setCrouch(0).reachLocal('near', 120, -420);
    await d.wait(500);
    m.setFace({ eyes: 'worry', mouth: 'open' });
    if (!d.skipping) this.tweens.add({ targets: m.props.near, r: { from: -0.25, to: 0.25 }, duration: 160, yoyo: true, repeat: 3 });
    await d.say('M30');
    m.reachLocal('near', null);
    m.setFace({ eyes: 'open', mouth: 'smile' });
    await d.say('M31');
    this.boy.setFace({ eyes: 'sad', mouth: 'closed' });
    await d.say('B30');
    m.setFace({ eyes: 'happy', mouth: 'smile' });
    await this.momWalk(MOM_X.bed);
    await d.say('M32');
    await this.momTuck();
    m.setFace(null);
    await this.momLeave();
    this.boy.setFace(null);
  }

  // ---------- разговор с Тихоном ----------

  async talk() {
    if (GameState.mode === 'winter2') { await this.talkWinter2(); return; }
    const d = this.d; const def = this.dayDef; const day = this.day;
    Audio.stopLoop('radio', { fade: 2500 });
    await d.wait(300);
    await this.darken(true);
    Music.play('mus_tikhon', { fade: 2500 });
    this.boy.look(-1);
    await d.wait(900);
    if (day === 4) {
      this.boy.look(0).setFace({ eyes: 'open', mouth: 'closed' });
      await d.say('B33');
    }
    await this.spiderDescend();
    await d.wait(250);
    if (day === 1) {
      await d.say('S01');
      this.boy.setFace({ eyes: 'wide', mouth: 'O' });
      await d.say('B06');
      await d.say('S70');
      if (Journal.data.runs > 0) {
        await d.say('S100');
        await d.say(Journal.lastGroup() === 'hospital' ? 'S101' : 'S102');
      }
      this.boy.setFace(null);
      await this.ask(def);
      await d.say('S73');
      await d.say('S74');
      await d.say('S75');
      this.boy.hide(0.15).setFace({ eyes: 'open', mouth: 'closed' });
      await d.say('B07');
      await d.say(getDifficulty(GameState.difficulty).introLine);
    } else if (day === 2) {
      await d.say('S16');
      await d.say(GameState.trust >= 1 ? 'B34' : 'B16');
      await d.say('S76');
      await this.ask(def);
    } else if (day === 3) {
      await d.say('S15');
      await d.say(GameState.trust >= 1 ? 'B34' : 'B16');
      this.boy.look(-1);
      this.d.tween({ targets: this.moth, flare: 0.6, glow: 0.75, duration: 900, ease: 'Sine.easeOut' });
      await d.say('S79');
      await d.say('S81');
      this.d.tween({ targets: this.moth, flare: 0.1, glow: 0.55, duration: 900, ease: 'Sine.easeInOut' });
      this.boy.look(1);
      await d.say('S82');
      await d.say('S83');
      await this.ask(def);
      if (GameState.wins > GameState.losses) await d.say('S64');
    } else if (day === 4) {
      await d.say('S80');
      this.boy.setFace({ eyes: 'sad', mouth: 'closed' }, 2500);
      await d.say('B39');
      await d.say('S86');
      await this.ask(def);
      if (GameState.wins > GameState.losses) await d.say('S64');
    } else {
      await d.say('S89');
      await d.say('S90');
      await this.ask(def);
    }
    this.boy.setFace(null);
    await d.say(def.intro);
  }

  // «Вторая зима»: год спустя. Мальчик теперь сам помнит Тихона, а Тихон помнит всё: прошлый финал,
  // тайную главу (если её прочли). Игры «подросли» — у каждой взрослый вариант (config/days.js, DAYS_W2).
  async talkWinter2() {
    const d = this.d; const def = this.dayDef; const day = this.day;
    Audio.stopLoop('radio', { fade: 2500 });
    await d.wait(300);
    await this.darken(true);
    Music.play('mus_tikhon', { fade: 2500 });
    this.boy.look(-1);
    await d.wait(900);
    if (day === 4) {
      this.boy.look(0).setFace({ eyes: 'open', mouth: 'closed' });
      await d.say('B33');
    }
    await this.spiderDescend();
    await d.wait(250);
    if (day === 1) {
      await d.say('S200');
      this.boy.setFace({ eyes: 'wide', mouth: 'smile' }, 2400);
      await d.say('B91');
      await d.say(Journal.lastGroup() === 'hospital' ? 'S202' : 'S201');
      if (Journal.data.anyaSeen) { this.spider.setFace('grin'); await d.say('S203'); this.spider.setFace('idle'); }
      await d.say('S204');
      this.boy.setFace(null);
      await this.ask(def);
      await d.say(getDifficulty(GameState.difficulty).introLine);
    } else if (day === 2) {
      await d.say('S205');
      await this.ask(def);
    } else if (day === 3) {
      await d.say('S206');
      await this.ask(def);
      if (GameState.wins > GameState.losses) await d.say('S64');
    } else if (day === 4) {
      await d.say('S207');
      await this.ask(def);
    } else {
      await d.say('S208');
      this.boy.setFace({ eyes: 'wide', mouth: 'O' }, 2000);
      await d.say('B100');
      this.spider.setFace('grin');
      await d.say('S209');
      this.spider.setFace('idle');
      await this.ask(def);
    }
    this.boy.setFace(null);
    await d.say(def.intro);
  }

  // ---------- события по общему счёту ----------

  momFace(kind) {
    return kind === 'happy' ? { eyes: 'happy', mouth: 'smile' } : { eyes: 'worry', mouth: 'worry' };
  }

  async event_win1() {
    const d = this.d;
    this.spider.setAlpha(1).setVisible(true).setFace('idle');
    await d.say('S30');
    await this.addThread(0);
    await this.showResultOnHud();
    await this.spiderAscend();
    await this.darken(false);
    this.eventMusic(true);
    this.boy.cheer(1400);
    await d.say('B26');
    await this.momReturn({ face: this.momFace('happy') });
    await this.momTouchForehead(900);
    if (this.day > 1) await d.say('M45');
    await this.pov('medicine');
    this.boy.setFace({ eyes: 'happy', mouth: 'smile' }, 3000);
    await this.setItem('bottle', true);
    await this.setItem('cup', true);
    await d.wait(300);
    await this.momLeave({ door: this.dayDef.away === 'kitchen' || this.dayDef.away === 'phone' ? 'ajar' : 'close' });
  }

  async event_win2() {
    const d = this.d;
    this.spider.setAlpha(1).setVisible(true).setFace('idle');
    this.mothFrantic(true);
    await d.say('S52');
    await this.addThread(1);
    await this.showResultOnHud();
    await this.spiderAscend();
    this.mothFrantic(false);
    await this.darken(false);
    this.eventMusic(true);
    this.boy.cheer(1200);
    await this.momReturn({ face: this.momFace('happy') });
    await this.momTouchForehead(800);
    this.mom.setFace({ eyes: 'happy', mouth: 'smile' });
    await d.say('M46');
    await this.pov('socks');
    this.socks.img.setVisible(true);
    this.boy.setFace({ eyes: 'happy', mouth: 'smile' }, 3000);
    this.setItem('bottle', true); this.setItem('cup', true);
    await d.wait(400);
    await this.momLeave({ door: 'ajar' });
  }

  async event_win3() {
    const d = this.d;
    this.spider.setAlpha(1).setVisible(true).setFace('idle');
    await d.say('S53');
    await this.addThread(2);
    await this.showResultOnHud();
    this.hud.focusMark(this.day - 1);
    await d.wait(900);
  }

  async event_loss1() {
    const d = this.d;
    this.spider.setAlpha(1).setVisible(true);
    await this.spiderLaugh(1200);
    await this.mothHitGlass();
    this.mothFlare(0.9);
    await d.say('S40');
    await this.showResultOnHud();
    await this.spiderAscend();
    this.applyRoomState(GameState.roomState(), { ms: 1800 });
    await this.darken(false);
    this.eventMusic(false);
    await this.cough(true);
    await d.say('B20');
    await this.momReturn({ face: this.momFace('worry') });
    await this.momTouchForehead(900);
    await this.setItem('thermo', true);
    this.mom.setFace({ eyes: 'worry', mouth: 'worry' });
    await d.say(Math.abs(GameState.temp - 39.2) < 0.05 ? 'M20' : 'M22');
    await d.say('M48');
    await this.pov('compress');
    this.setItem('bottle', true); this.setItem('cup', true);
    this.boy.setFace({ eyes: 'half', mouth: 'closed' }, 2500);
    await this.momSit();
  }

  async event_loss2() {
    const d = this.d; const m = this.mom;
    this.spider.setAlpha(1).setVisible(true);
    await this.spiderLaugh(1100);
    await this.mothHitGlass();
    this.mothFlare(1);
    await d.say('S54');
    await this.showResultOnHud();
    this.boy.hide(0.8);
    await this.spiderAscend();
    this.applyRoomState(GameState.roomState(), { ms: 1800 });
    await this.darken(false);
    this.eventMusic(false);
    await this.cough(true);
    await this.momReturn({ line: this.dayDef.away !== 'phone', face: this.momFace('worry') });
    await this.momTouchForehead(900);
    this.setItem('thermo', true);
    m.setFace({ eyes: 'worry', mouth: 'worry' });
    m.hold('near', 'prop_phone', { scale: 0.9, dy: 6 }).img.setAngle(0);
    m.reachLocal('near', 60, -520);
    await d.say('M23');
    await d.wait(900);
    m.reachLocal('near', null); m.drop('near');
    m.setFace(null);
    await d.wait(600);
    d.sfx('doorbell', { volume: 0.6 });
    await d.wait(900);
    await this.momWalk(MOM_X.door + 160);
    m.face(-1);
    await this.doorOpen(true);
    await d.say('M28');
    await this.pov('doctor');
    await this.doorOpen(false);
    m.setPosition(MOM_X.bed, MOM_Y).face(1, true).setAlpha(1).setVisible(true);
    m.setFace({ eyes: 'open', mouth: 'smile' });
    this.boy.setFace({ eyes: 'sad', mouth: 'closed' }, 2500);
    await d.say('M51');
    this.setItem('bottle', true); this.setItem('cup', true);
    await this.momSit();
  }

  async event_loss3() {
    const d = this.d;
    this.spider.setAlpha(1).setVisible(true).setFace('grin');
    this.mothHitGlass();
    this.mothFlare(1.1);
    await this.spiderLaugh(900);
    await this.showResultOnHud();
    this.hud.focusMark(this.day - 1);
    await d.wait(900);
  }

  // ---------- ночь ----------

  async night() {
    const d = this.d;
    const won = this.lastResult === 'win';
    this.skipBtn.setVisible(true);
    // ночью в тишине часы слышнее
    Audio.setLoop('clock', { volume: 0.3, ms: 2500 }); Audio.stopLoop('stove', { fade: 1500 }); Audio.stopLoop('drone', { fade: 1500 });
    if (this.bird.present) this.bird.flyAway(1300);
    Audio.loop('blizzard', { volume: 0.07 + 0.025 * GameState.losses, fade: 2500 });
    // ночная тема слоями: на каждую серебряную нить — свой инструмент (шкатулка, челеста, струнные)
    Music.play('mus_night', { fade: 3000, volume: won ? 1 : 0.85, layers: Math.min(3, GameState.wins) });
    if (!d.skipping) {
      // часы в коридоре бьют, дом остывает и поскрипывает
      this.time.delayedCall(2600, () => this.d.sfx('clock_strike', { volume: 0.32, x: 1500 }));
      this.time.delayedCall(9000 + Math.random() * 5000, () => this.d.sfx('creak', { volume: 0.07, x: 300 + Math.random() * 1300 }));
    }
    d.tween({ targets: this.light, alpha: 0, duration: 1600 });
    d.tween({ targets: this.dark, fillAlpha: 0.22, duration: 1600 });
    if (this.mom.visible && this.momSitting) this.mom.setSleep(true);
    else if (this.mom.visible) await this.momLeave();
    this.setLamp(true, 1600);
    await d.tween({ targets: this.bgNight, alpha: 1, duration: 1600, ease: 'Sine.easeInOut' });
    this.doorLight.setLevel(0.45);
    this.mothShow(true);
    // мороз к ночи крепчает: иней подрастает от рам на глазах
    this.frost.grow(frostLevel(this.day) + 0.1, 5200, d.skipping);
    this.boy.setFace({ eyes: 'open', mouth: 'closed' });
    await d.tween({ targets: this.eyes, alpha: 1, duration: 900 });
    let line;
    if (won) line = GameState.wins === 1 ? 'S110' : 'S111';
    else line = GameState.losses === 2 ? 'S113' : 'S114';
    if (line === 'S111') this.mothFrantic(true);
    if (line === 'S113') { this.d.sfx('web', { volume: 0.4 }); d.tween({ targets: this.web, alpha: 0.85, duration: 2200, ease: 'Sine.easeInOut' }); }
    this.boy.look(1).hide(won ? 0.3 : 0.7);
    await d.say(line);
    this.mothFrantic(false);
    if (won && GameState.wins <= 2) {
      // Тихон играет колыбельную на нитях: одна нить — мелодия, две — мелодия с басом
      await d.say(GameState.wins === 1 ? 'S132' : 'S133');
      this.boy.setFace({ eyes: 'half', mouth: 'smile' });
      await this.webLullaby(GameState.wins);
    }
    await d.tween({ targets: this.eyes, alpha: 0, duration: 600 });
    await this.drawTonight();
    this.boy.setFace({ eyes: 'closed', mouth: 'closed' }).look(0);
    await d.wait(800);
    await this.fadeOut(1200);
    const next = GameState.nextDay();
    await this.titleCard(next, { keep: true });
    // утро наступает перелистыванием: календарный листок переворачивается, под ним — новый день
    await PageTurn.go(this, 'Bedroom', { day: next }, { back: 'paper', ms: this.d.skipping ? 500 : 1300 });
  }

  fadeOut(ms) {
    if (this.d.skipping) { this.cameras.main.fadeOut(1, 0, 0, 0); return Promise.resolve(); }
    return new Promise((resolve) => {
      this.cameras.main.fadeOut(ms, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', resolve);
    });
  }

  // Титр дня — отрывной календарь: вчерашний листок с отметкой отрывают, под ним новый день.
  async titleCard(n, { keep = false } = {}) {
    const d = this.d; d.resume();
    const def = getDay(n);
    const prev = n > 1 ? getDay(n - 1) : null;
    this.hud.setVisible(false);
    this.skipBtn.setVisible(false);
    // чёрный кадр до сброса затемнения камеры, чтобы комната не мелькнула
    const black = this.add.rectangle(960, 540, 1920, 1080, 0x000000, 1).setDepth(1999);
    this.cameras.main.resetFX();
    await calendarCard(this, d, {
      day: n, title: def.gameTitle, subtitle: def.subtitle,
      prev: prev ? { day: n - 1, title: prev.gameTitle, subtitle: prev.subtitle, result: GameState.dayResults[n - 2] } : null,
      keep,
    });
    black.destroy();
  }

  // ---------- «Поймай Огнёвку»: финал с участием игрока ----------
  // Три гвоздика вокруг мечущейся Огнёвки. Тянешь нить из угла Тихона (перетаскиванием или просто
  // нажав на гвоздик) — нить цепляется. Три нити — сеть захлопывается. Проиграть нельзя: через 5 с
  // гвоздик подсказывает себя, через 16 с Тихон доплетает сам. Пробел/Enter — следующая нить.
  catchByHand() {
    const d = this.d; const mo = this.moth;
    const SRC = { x: WEB.x - 8, y: WEB.y + 6 };
    const pins = CATCH_PINS.map(([deg, r], i) => {
      const a = Phaser.Math.DegToRad(deg);
      return { i, x: CATCH.x + Math.cos(a) * r, y: CATCH.y + Math.sin(a) * r * 0.85, done: false, k: 0 };
    });
    const z = DEPTH.net + 0.2;
    const g = this.add.graphics().setDepth(z).setScrollFactor(0.3);
    const live = this.add.graphics().setDepth(z + 0.1).setScrollFactor(0.3);
    const ui = [g, live];
    const hand = this.add.text(0, 0, 'Тяни нитку к гвоздику', text('hand-3', { color: CSS.paper })).setOrigin(0.5, 0)
      .setResolution(2).setStroke('#0b1124', 6).setDepth(z + 0.2).setScrollFactor(0.3).setAlpha(0);
    ui.push(hand);
    const sag = (a, b, k = 1) => {
      const mx = (a.x + b.x) / 2; const my = (a.y + b.y) / 2 + Math.min(90, Math.hypot(b.x - a.x, b.y - a.y) * 0.12) * k;
      return new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(a.x, a.y), new Phaser.Math.Vector2(mx, my), new Phaser.Math.Vector2(b.x, b.y));
    };
    let drag = null; let hintAt = this.time.now + 5000; let autoAt = this.time.now + 16000; let finished = false;
    const left = () => pins.filter((p) => !p.done);
    const draw = (time) => {
      g.clear();
      for (const p of pins) {
        if (p.done) {
          const tremble = Math.sin(time / 70 + p.i) * 2.2 * (finished ? 0 : 1);
          const c = sag(SRC, p, 0.6 + tremble / 40);
          g.lineStyle(3, COLORS.thread, 0.95).strokePoints(c.getPoints(28));
          g.lineStyle(1.4, 0xffffff, 0.7).strokePoints(c.getPoints(28));
        }
        // гвоздик: латунная шляпка с тенью; свободный — с карандашным кольцом, подсказка — кольцо крупнее
        const hint = !p.done && time > hintAt && p === left()[0];
        const pulse = 0.5 + 0.5 * Math.sin(time / (hint ? 160 : 420) + p.i);
        if (!p.done) g.lineStyle(hint ? 4 : 2.5, hint ? COLORS.accentHi : 0xe9eef6, 0.35 + 0.5 * pulse).strokeCircle(p.x, p.y, (hint ? 30 : 22) + pulse * (hint ? 10 : 4));
        g.fillStyle(0x000000, 0.35).fillCircle(p.x + 3, p.y + 4, 9);
        g.fillStyle(0x8a6a2a, 1).fillCircle(p.x, p.y, 9);
        g.fillStyle(0xe2c27a, 1).fillCircle(p.x - 2, p.y - 2, 6);
      }
      // нить, которую тянут сейчас
      live.clear();
      if (drag) {
        const c = sag(SRC, drag, 0.4);
        live.lineStyle(3, COLORS.thread, 0.85).strokePoints(c.getPoints(24));
      }
      // Огнёвка мечется внутри — чем больше нитей, тем теснее ей
      if (!finished) {
        const r = 1 - 0.26 * pins.filter((p) => p.done).length;
        const t = time / 1000;
        const x = CATCH.x + (Math.sin(t * 1.9) * 70 + Math.sin(t * 5.3) * 22) * r;
        const y = CATCH.y + (Math.sin(t * 2.6 + 1) * 46 + Math.cos(t * 6.1) * 14) * r;
        mo.dir = x >= this.mothC.x ? 1 : -1;
        this.mothC.setPosition(x, y);
      }
      const nx = left()[0];
      if (nx && time > hintAt) hand.setPosition(nx.x, nx.y + 40).setAlpha(Math.min(1, (time - hintAt) / 400));
      else hand.setAlpha(Math.max(0, hand.alpha - 0.08));
    };
    return new Promise((resolve) => {
      const attach = (p, { auto = false } = {}) => {
        if (!p || p.done || finished) return;
        p.done = true;
        hintAt = this.time.now + 5000;
        autoAt = this.time.now + (auto ? 1800 : 12000);
        this.d.sfx('web', { volume: 0.55, x: p.x });
        Audio.play('pencil_1', { volume: 0.25, x: p.x });
        Haptics.good();
        mo.flare = 1;
        const n = pins.filter((q) => q.done).length;
        if (!auto && n < 3) voice.play(n === 1 ? 'S130' : 'S131');
        if (n === 3) close();
      };
      const nearest = (x, y, max) => {
        let best = null; let bd = max;
        for (const p of left()) { const dd = Math.hypot(p.x - x, p.y - y); if (dd < bd) { bd = dd; best = p; } }
        return best;
      };
      const coarse = this.sys.game.device.input.touch;
      const onDown = (ptr) => {
        if (finished) return;
        const p = nearest(ptr.x, ptr.y, coarse ? 110 : 80);
        if (p) { attach(p); return; } // нажатие прямо на гвоздик
        drag = { x: ptr.x, y: ptr.y };
      };
      const onMove = (ptr) => { if (drag) { drag.x = ptr.x; drag.y = ptr.y; } };
      const onUp = (ptr) => {
        if (!drag) return;
        const p = nearest(ptr.x, ptr.y, coarse ? 200 : 160);
        drag = null;
        if (p) attach(p);
      };
      const onKey = () => attach(left()[0]);
      const tick = (time) => {
        draw(time);
        if (finished) return;
        if (d.skipping) { pins.forEach((p) => { p.done = true; }); close(); return; }
        // Тихон помогает: если долго ничего не происходит, нить цепляется сама
        if (time > autoAt) attach(left()[0], { auto: true });
      };
      const cleanup = () => {
        this.events.off('update', tick);
        this.input.off('pointerdown', onDown); this.input.off('pointermove', onMove); this.input.off('pointerup', onUp);
        this.input.keyboard?.off('keydown-SPACE', onKey); this.input.keyboard?.off('keydown-ENTER', onKey);
      };
      const close = async () => {
        if (finished) return;
        finished = true;
        cleanup();
        drag = null; live.clear(); hand.setVisible(false);
        window.__catch = { done: true };
        // сеть захлопывается: Огнёвка в центре, вокруг серебряная сеть
        this.d.sfx('web', { volume: 0.7 });
        Haptics.win();
        d.tween({ targets: this.mothC, x: NET.x, y: NET.y, duration: 500, ease: 'Back.easeOut' });
        this.net.setPosition(NET.x, NET.y).setScale(0.3).setAlpha(0);
        await d.tween({ targets: this.net, alpha: 0.92, scale: 0.62, duration: 700, ease: 'Back.easeOut' });
        draw(this.time.now);
        d.tween({ targets: g, alpha: 0, duration: 1600, delay: 600, onComplete: () => ui.forEach((o) => o.destroy()) });
        resolve();
      };
      this.input.on('pointerdown', onDown); this.input.on('pointermove', onMove); this.input.on('pointerup', onUp);
      this.input.keyboard?.on('keydown-SPACE', onKey); this.input.keyboard?.on('keydown-ENTER', onKey);
      this.events.on('update', tick);
      window.__catch = { pins, attach: (i) => attach(pins[i]), done: false };
      voice.play('S129');
      if (d.skipping) { pins.forEach((p) => { p.done = true; }); close(); }
    });
  }

  // ---------- финал 7А: «Ты выздоровел!» ----------

  async finalRecovered() {
    if (this.finishing) return;
    this.finishing = true;
    Music.play('mus_dawn', { fade: 3500 });
    const d = this.d; const m = this.mom; const mo = this.moth;
    // Огнёвка влетает в комнату, а сеть мальчик плетёт сам: тянет три нити Тихона к гвоздикам вокруг неё
    this.mothShow(true, 300);
    mo.free = true;
    const curve = new Phaser.Curves.Spline([
      [this.mothC.x, this.mothC.y], [930, 330], [1080, 200], [1200, 280], [CATCH.x, CATCH.y],
    ].map(([x, y]) => new Phaser.Math.Vector2(x, y)));
    const fly = { t: 0 };
    this.d.sfx('moth_flutter', { volume: 0.4, x: this.mothC.x });
    const flight = d.tween({
      targets: fly, t: 1, duration: 2200, ease: 'Sine.easeInOut',
      onUpdate: () => { const p = curve.getPoint(fly.t); mo.dir = p.x >= this.mothC.x ? 1 : -1; this.mothC.setPosition(p.x, p.y); },
      onComplete: () => this.mothC.setPosition(CATCH.x, CATCH.y),
    });
    await d.say('S120');
    await flight;
    await this.catchByHand();
    this.d.sfx('web', { volume: 0.6 });
    if (!d.skipping) this.tweens.add({ targets: this.net, scale: { from: 0.66, to: 0.62 }, duration: 160, yoyo: true, repeat: 2 });
    await d.say('S121');
    // остывает: огонь гаснет, бабочка становится белой
    this.d.sfx('sparkle', { volume: 0.5 });
    const white = this.add.image(0, 0, 'moth_white_0').setAlpha(0);
    this.mothC.add(white);
    this.mothWhite = white;
    // угольки остывают: вместо искр с крыльев сыплется снег
    if (!d.skipping && Quality.particles > 0) {
      this.flakes.explode(Math.round(26 * Quality.particles), this.mothC.x, this.mothC.y);
      this.flakes.startFollow(this.mothC); this.flakes.frequency = 140; this.flakes.emitting = true;
      this.time.delayedCall(3800, () => { this.flakes.emitting = false; });
    }
    d.tween({ targets: this.mothGlow, alpha: 0, duration: 1600 });
    d.tween({ targets: mo, glow: 0, flare: 0, duration: 1600 });
    d.tween({ targets: this.mothImg, alpha: 0, duration: 1600 });
    await d.tween({ targets: white, alpha: 1, duration: 1600 });
    await d.tween({ targets: this.net, alpha: 0, duration: 900 });
    // белая бабочка вылетает обратно и садится на внешний отлив окна — там её и застанет утро
    const out = { t: 0 };
    const back = new Phaser.Curves.Spline([[NET.x, NET.y], [1060, 300], [880, 330], [800, 470], [SILL_REST.x, SILL_REST.y]]
      .map(([x, y]) => new Phaser.Math.Vector2(x, y)));
    await d.tween({
      targets: out, t: 1, duration: 2600, ease: 'Sine.easeInOut',
      onUpdate: () => { const p = back.getPoint(out.t); this.mothC.setPosition(p.x, p.y); mo.base = 0.28 - 0.1 * out.t; },
      onComplete: () => { this.mothC.setPosition(SILL_REST.x, SILL_REST.y); mo.base = 0.18; mo.mode = 'rest'; },
    });
    // прощание Тихона
    this.spider.setFace('idle');
    await d.say('S122');
    this.boy.hide(0).setFace({ eyes: 'sad', mouth: 'open' }).reachTo(1630, 560, 'near', 4);
    await d.say('B50');
    await d.say('S123');
    if (GameState.mode === 'winter2') await d.say('S239');
    this.boy.setPose('rest', 4);
    d.tween({ targets: this.shadow, alpha: 0.9, duration: 1400 });
    await d.tween({ targets: this.spider, y: 70, x: WEB.x - 30, scale: 0.3, duration: 2200, ease: 'Sine.easeInOut' });
    await d.tween({ targets: this.spider, alpha: 0, duration: 1200 });
    this.spider.setVisible(false);
    // тревожные звуки стихают, свет теплеет
    for (const k of ['drone', 'heartbeat', 'blizzard', 'wind_soft', 'clock', 'stove']) Audio.stopLoop(k, { fade: 2500 });
    await this.fadeOut(1600);
    const cap = this.add.text(960, 540, 'Утро', text('title-8', { color: CSS.fog })).setOrigin(0.5).setResolution(2).setDepth(2001).setScrollFactor(0);
    this.cameras.main.resetFX();
    const black = this.add.rectangle(960, 540, 1920, 1080, 0x000000, 1).setDepth(2000);
    // новое утро: рассвет, мама спит в кресле, Огнёвки нет
    this.bgNight.setAlpha(0); this.bgDawn.setAlpha(1);
    this.dark.fillAlpha = 0; this.cold.fillAlpha = 0; this.warm.fillAlpha = 0.05;
    this.setVignette(false, true);
    this.shadow.setAlpha(0); this.web.setAlpha(0); this.net.setAlpha(0);
    this.light.setAlpha(1);
    this.threadK = [1, 1, 1]; this.drawThreads();
    // белая бабочка сидит на отливе за стеклом, рядом прилетит снегирь
    this.mothC.setPosition(SILL_REST.x, SILL_REST.y).setAlpha(1); mo.free = true; mo.mode = 'rest'; mo.base = 0.18;
    this.mothImg.setAlpha(0); this.mothGlow.setAlpha(0);
    if (this.mothWhite) this.mothWhite.setAlpha(1);
    this.momInChair({ asleep: true });
    this.boy.setHealth('healthy').setTremble(0).hide(0).setFace({ eyes: 'closed', mouth: 'closed' });
    this.hud.setVisible(false);
    await d.wait(1300);
    await d.tween({ targets: cap, alpha: 0, duration: 500 });
    cap.destroy();
    await d.tween({ targets: black, alpha: 0, duration: 1600 });
    black.destroy();
    this.d.sfx('musicbox', { volume: 0.25 });
    // снегирь на подоконнике
    if (!d.skipping) this.bird.arrive(3, 1400); else this.bird.sit(3);
    await d.wait(1900);
    // мальчик просыпается: ему лучше
    this.boy.setFace({ eyes: 'open', mouth: 'smile' });
    this.boy.look(-1);
    await d.wait(700);
    await d.say('B51');
    // плед — маме на плечи
    this.boy.reachTo(1540, 700, 'near', 4);
    this.plaid.setPosition(1600, 690).setAngle(14).setAlpha(0);
    d.tween({ targets: this.plaid, alpha: 1, duration: 300 });
    await d.tween({ targets: this.plaid, x: MOM_X.chair + 8, y: 612, angle: 0, duration: 1200, ease: 'Sine.easeInOut' });
    this.boy.setPose('rest', 4).look(0);
    await d.wait(800);
    // мама просыпается
    m.setSleep(false);
    await d.wait(700);
    m.setFace({ eyes: 'open', mouth: 'half' });
    d.tween({ targets: this.plaid, alpha: 0, duration: 500 });
    m.setSit(0, d.skipping); this.momSitting = false;
    await d.wait(600);
    await this.momWalk(MOM_X.bed);
    await this.momTouchForehead(900);
    m.setFace({ eyes: 'happy', mouth: 'open' });
    await d.say('M60');
    this.boy.setFace({ eyes: 'happy', mouth: 'smile' });
    await d.say('B13');
    m.setFace({ eyes: 'happy', mouth: 'smile' });
    await d.say('M61');
    this.momHug(1600);
    await d.say('M62');
    // «Вторая зима»: мама уже знает про Тихона (это было год назад) — без «мне снился паук»,
    // она просто смотрит на свой детский рисунок и благодарит его
    const w2 = GameState.mode === 'winter2';
    if (!w2) {
      m.setFace({ eyes: 'open', mouth: 'half' });
      await d.say('M63');
      this.boy.setFace({ eyes: 'wide', mouth: 'O' });
      await d.say('B52');
      m.setFace({ eyes: 'worry', mouth: 'open' });
      await d.say('M64');
    }
    // мамин детский рисунок на стене: девочка, паук на нитке и подпись «ТИХОН»
    const shade = this.add.rectangle(960, 540, 1920, 1080, 0x000000, 0).setDepth(DEPTH.card);
    const pic = this.add.container(1355, 310).setDepth(DEPTH.card + 1).setScale(0.22).setAlpha(0);
    const frame = this.add.graphics();
    frame.fillStyle(0x8a6a44, 1).fillRoundedRect(-470, -370, 940, 740, RADIUS.lg);
    frame.lineStyle(4, 0x24170f, 1).strokeRoundedRect(-470, -370, 940, 740, RADIUS.lg);
    pic.add([frame, this.add.image(0, 0, 'drawing_tikhon')]);
    d.tween({ targets: shade, fillAlpha: 0.6, duration: 900 });
    await d.tween({ targets: pic, x: 960, y: 470, scale: 1, alpha: 1, duration: 1400, ease: EASE });
    if (w2) {
      m.setFace({ eyes: 'happy', mouth: 'smile' });
      await d.say('M80');
      if (GameState.endingVariant('recovered') === 'tikhon') {
        const harp = WEBHARP.webharp_3;
        const tune = this.webLullaby(3, { volume: 0.5, music: 0.15 });
        await d.wait(1800);
        m.tiltHead(0.15);
        await d.say('M81');
        await d.say('S173');
        if (harp) await tune;
      }
    } else if (GameState.endingVariant('recovered') === 'tikhon') {
      await d.wait(500);
      await d.say('S124');
      // из угла тихо звучит колыбельная на трёх нитях — и мама её узнаёт
      const harp = WEBHARP.webharp_3;
      const tune = this.webLullaby(3, { volume: 0.55, music: 0.15 });
      await d.wait(2600);
      m.setFace({ eyes: 'happy', mouth: 'open' }).tiltHead(0.15);
      await d.say('M67');
      await d.say('M65');
      if (harp) await tune;
    } else {
      await d.say('B53');
      await d.say('M66');
    }
    await d.wait(1200);
    await this.goEnding('recovered');
  }

  // ---------- финал 7Б: «Ты проиграл» ----------

  async finalHospital() {
    if (this.finishing) return;
    this.finishing = true;
    const d = this.d; const m = this.mom;
    this.spider.setFace('grin');
    await d.say('S55');
    this.spider.setFace('idle');
    await this.spiderAscend();
    Music.play('mus_hospital', { fade: 3000, volume: 0.8 });
    this.boy.hide(0).setFace({ eyes: 'half', mouth: 'open' }).reachTo(1630, 560, 'near', 4);
    await d.say('B54');
    // мальчику хуже: холоднее и темнее, дрожь
    this.boy.setPose('blanket', 4);
    this.boy.setHealth('critical').setTremble(0.6).setFace({ eyes: 'closed', mouth: 'wavy' });
    d.tween({ targets: this.cold, fillAlpha: 0.3, duration: 1600 });
    d.tween({ targets: this.dark, fillAlpha: 0.28, duration: 1600 });
    await this.cough(true);
    // мама вбегает, звонит в скорую и не отходит
    await this.momEnter(MOM_X.bed, { face: { eyes: 'worry', mouth: 'worry' }, hurry: true });
    await this.momTouchForehead(700);
    m.hold('near', 'prop_phone', { scale: 0.9, dy: 6 });
    m.reachLocal('near', 60, -520);
    await d.say('M70');
    m.reachLocal('near', null); m.drop('near');
    await d.wait(300);
    const hand = this.boy.handPoint('near');
    m.setLean(0.3).setCrouch(0.5).tiltHead(0.2).reach('near', hand.x - 6, hand.y - 4);
    m.setFace({ eyes: 'open', mouth: 'smile' });
    await d.say('M71');
    Audio.loop('siren', { volume: 0.2, fade: 4000 });
    await d.wait(2200);
    d.sfx('doorbell', { volume: 0.55 });
    m.reach('near', null).setLean(0).setCrouch(0).tiltHead(0);
    await d.wait(700);
    await this.momWalk(MOM_X.door + 160);
    m.face(-1);
    await this.doorOpen(true);
    await d.say('P01');
    Audio.stopLoop('siren', { fade: 1500 });
    await this.pov('medics');
    await this.goEnding('hospital');
  }

  async goEnding(outcome) {
    if (this.leaving) return;
    this.leaving = true;
    this.d.resume();
    if (GameState.finish()) Journal.recordEnding(GameState.ending, GameState.mode);
    await this.fadeOut(1200);
    this.scene.start('Ending', { outcome, ending: GameState.ending });
  }
}
