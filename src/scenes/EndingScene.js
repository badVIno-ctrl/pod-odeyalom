// Финалы и итоговый экран.
// recovered (7А): рассветная спальня. Мальчик здоров, мама рядом, снегирь на подоконнике → «Ты выздоровел!».
// hospital (7Б): зимняя улица ночью. Скорая у подъезда, мама садится в машину вместе с сыном,
// Огнёвка летит следом, Тихон на крыше ловит её ледяной паутиной из пурги, машина уезжает в снег → «Ты проиграл».
// Итоговый экран: финал, итог по дням, счётчики финалов и секретов, «Играть снова» и «В меню».
import * as Phaser from 'phaser';
import { PageTurn } from '../systems/pageTurn.js';
import { COLORS, CSS, EASE, MOTION, S, text, heroGradient } from '../config/theme.js';
import { paperTexture, inkCheck, inkCross, inkCircle } from '../ui/paper.js';
import { ROOM } from '../config/layout.js';
import { daysFor } from '../config/days.js';
import { TOTAL_DAYS, prefersReducedMotion } from '../config/game.js';
import { GameState } from '../state.js';
import { Journal, ENDINGS } from '../systems/journal.js';
import { Audio } from '../systems/audio.js';
import { Music } from '../systems/music.js';
import { voice } from '../systems/voice.js';
import { Director } from '../systems/cutscene.js';
import { Debug } from '../systems/debug.js';
import { Quality } from '../systems/quality.js';
import { BoyRig } from '../systems/rig/BoyRig.js';
import { MomRig } from '../systems/rig/MomRig.js';
import { SpiderRig } from '../systems/spiderRig.js';
import { Button, FocusRing } from '../ui/button.js';
import { onUpdate } from '../systems/lifecycle.js';
import { composeLetter } from '../systems/letter.js';
import { showLetter } from '../ui/letterCard.js';
import { drawingTexture, specKey, DRAW_W, DRAW_H, captionFor } from '../systems/drawings.js';
import { savePostcard } from '../systems/postcard.js';
import { Save } from '../systems/save.js';
import { I18n } from '../i18n/index.js';

const PANEL_ARM_MS = 900;

const COPY = {
  recovered: { title: 'Ты выздоровел!', sub: 'Лекарство, отдых и мамина забота сделали своё дело. А Тихон помог не бояться.' },
  hospital: { title: 'Ты проиграл', sub: 'Мама рядом, а врачи помогут.' },
};
const AMB = { x: 720, y: 614 }; // левый верхний угол машины (смотрит вправо); земля на y = AMB.y + 346

// Пояснение к финалу. Во «Второй зиме» — своё: мама уже знает про Тихона, и всё это было и год назад.
const ENDING_NOTE_W2 = {
  dawn: 'Вторая зима позади. Огнёвка снова белая бабочка, а Тихон остался в своём уголке.',
  tikhon: 'Мама поблагодарила Тихона. Её детский рисунок висит над кроватью уже тридцать зим.',
  ambulance: 'Снова больница. Но Тихон теперь знает дорогу и посторожит кровать.',
  companion: 'Тихон снова поймал Огнёвку на крыше скорой и поехал следом.',
};
const endingNote = (end) => (GameState.mode === 'winter2' && ENDING_NOTE_W2[end.id]) || end.text;

export class EndingScene extends Phaser.Scene {
  constructor() { super('Ending'); }

  init(data) {
    this.outcome = (data && data.outcome) || GameState.outcome() || 'recovered';
    this.ending = (data && data.ending) || GameState.ending || GameState.endingVariant(this.outcome);
    this.leaving = false;
    this.panelShown = false;
  }

  create() {
    this.d = new Director(this);
    this.reduced = prefersReducedMotion();
    voice.stop();
    Music.setFever(0, 2500); // жар спал — музыка снова чистая
    this.cameras.main.setBackgroundColor('#000000');
    this.cameras.main.fadeIn(900, 0, 0, 0);
    this.skipBtn = new Button(this, 1920 - S[600] - 110, S[500] + 28, {
      label: 'Пропустить', width: 220, height: 56, variant: 'ghost', style: 'button-lg', onClick: () => this.d.skip(),
    }).setDepth(950);
    const offs = [Debug.on('skip', () => this.d.skip())];
    this.input.on('pointerdown', (p, over) => { if (!over.length) voice.skip(); });
    this.events.once('shutdown', () => { offs.forEach((f) => f()); Audio.stopAllLoops(500); voice.stop(); });
    window.__ending = { outcome: this.outcome, ending: this.ending, panel: false, results: GameState.dayResults.slice() };
    // письмо Тихона и последний рисунок мальчика — один раз за забег (сохраняются в альбом)
    this.letter = composeLetter(GameState, this.ending, GameState.wins * 7 + GameState.losses);
    this.finalSpec = { kind: this.outcome === 'recovered' ? 'final_recovered' : 'final_hospital', seed: 500 + GameState.wins * 11 + GameState.losses };
    if (!GameState.archived) {
      GameState.archived = true;
      // в альбом — письмо на обоих языках: его можно перечитать и после смены языка
      const alt = composeLetter(GameState, this.ending, GameState.wins * 7 + GameState.losses, I18n.lang === 'en' ? 'ru' : 'en');
      Journal.addLetter({ ...this.letter, alt, at: Date.now(), mode: GameState.mode });
      Journal.addDrawing(this.finalSpec);
      Save.clear();
    }
    const run = this.outcome === 'recovered' ? this.recovered() : this.hospital();
    run.then(() => this.afterStory());
  }

  async afterStory() {
    if (this.panelShown || this.leaving) return;
    this.skipBtn.setVisible(false);
    this.d.resume();
    await showLetter(this, this.letter, { depth: 1200 });
    this.showPanel();
  }

  // ---------- 7А: рассвет ----------

  async recovered() {
    const d = this.d;
    this.add.image(960, 540, 'bedroom_dawn');
    const W = ROOM.window;
    this.add.image(W.x - 280, W.y + 10, 'fx_beam_soft').setOrigin(0, 0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.1);
    this.add.particles(0, 0, 'fx_dust', {
      x: { min: W.x + 40, max: W.x + 520 }, y: { min: W.y + 200, max: 900 }, lifespan: 7000, speedY: { min: -8, max: 4 },
      scale: { min: 0.25, max: 0.7 }, alpha: { onEmit: () => 0, onUpdate: (p, k, t) => Math.sin(t * Math.PI) * 0.25 },
      frequency: Math.round(380 / Quality.particles), blendMode: 'ADD', tint: 0xffe6b0,
    });
    // три серебряные нити Тихона так и остались в углу
    const g = this.add.graphics();
    for (const [i, e] of [[0, { x: 888, y: 176 }], [1, { x: 980, y: 138 }], [2, { x: 892, y: 330 }]]) {
      const c = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(1758, 46), new Phaser.Math.Vector2((1758 + e.x) / 2, (46 + e.y) / 2 + 70 + i * 26), new Phaser.Math.Vector2(e.x, e.y));
      g.lineStyle(2, COLORS.thread, 0.5).strokePoints(c.getPoints(36));
    }
    this.add.image(1440, 948, 'armchair').setOrigin(0.5, 1);
    this.add.image(1446, 612, 'plaid').setOrigin(0.5, 0).setScale(0.78).setAngle(-6).setAlpha(0.95);
    this.add.image(600, 590, 'bullfinch').setOrigin(0.5, 1).setScale(0.8);
    const mom = new MomRig(this, 1530, 935);
    mom.setFace({ eyes: 'happy', mouth: 'smile' }).setLean(0.18).tiltHead(0.12);
    const boy = new BoyRig(this, ROOM.bed.x - ROOM.bed.w / 2, ROOM.bed.y - ROOM.bed.h, { health: 'healthy' });
    boy.attach('root', 'socks_peek', { ox: 75, oy: 60, dx: 122, dy: 300, z: 9.5, name: 'socks', scale: 0.9 });
    boy.setFace({ eyes: 'happy', mouth: 'smile' });
    mom.reach('near', 1640, 750);
    this.add.rectangle(960, 540, 1920, 1080, 0xffc58a, 0.05).setBlendMode(Phaser.BlendModes.ADD);
    Music.play('mus_dawn', { fade: 2500 }); // тема рассвета началась ещё в спальне — продолжается
    Audio.play('bullfinch', { volume: 0.35 });
    await d.wait(600);
    boy.cheer(1400);
    await d.wait(1800);
  }

  // ---------- 7Б: зимняя улица ----------

  snow() {
    const mk = (scale, speed, alpha, freq) => this.add.particles(0, 0, 'fx_dust', {
      x: { min: -100, max: 2020 }, y: -20, lifespan: 9000, speedY: speed, speedX: { min: 10, max: 60 },
      scale, alpha, frequency: Math.round(freq / Quality.particles), quantity: 1, tint: 0xffffff,
    });
    mk({ min: 0.2, max: 0.45 }, { min: 40, max: 80 }, { min: 0.35, max: 0.6 }, 40).setDepth(5);
    mk({ min: 0.6, max: 1.1 }, { min: 110, max: 170 }, { min: 0.6, max: 0.9 }, 90).setDepth(60);
  }

  async hospital() {
    const d = this.d;
    this.add.image(960, 540, 'street_night').setDepth(0);
    this.snow();
    Audio.loop('blizzard', { volume: 0.14, fade: 2000 });
    Music.play('mus_hospital', { fade: 2500, volume: 0.6 });
    // скорая у подъезда, задние двери открыты, мягкий синий отсвет маячка (без мигания)
    this.amb = this.add.container(AMB.x, AMB.y).setDepth(20);
    this.ambImg = this.add.image(0, 0, 'ambulance_open').setOrigin(0, 0);
    this.wheels = [150, 600].map((x) => this.add.image(x, 288, 'ambulance_wheel'));
    this.beacon = this.add.image(565, 80, 'fx_glow').setTint(0x5a8cff).setBlendMode(Phaser.BlendModes.ADD).setScale(1.4).setAlpha(0.25);
    this.amb.add([this.ambImg, ...this.wheels, this.beacon]);
    onUpdate(this, (time) => { if (this.beacon.active) this.beacon.setAlpha(0.18 + 0.14 * (0.5 + 0.5 * Math.sin(time / 520))); });
    // мама выходит из подъезда и садится в машину
    const mom = new MomRig(this, 440, 838).setScale(0.3).setDepth(15);
    mom.setFace({ eyes: 'open', mouth: 'closed' });
    this.d.sfx('snow_steps', { volume: 0.3 });
    const walk = mom.walkTo(770, { speed: 130 });
    d.tween({ targets: mom, y: AMB.y + 340, scale: 0.32, duration: 2600, ease: 'Sine.easeInOut' });
    const cap = this.add.text(960, S[900] + S[300], 'Мама едет вместе с ним', text('title-8', { color: CSS.paper })).setOrigin(0.5).setResolution(2)
      .setDepth(80).setAlpha(0);
    d.tween({ targets: cap, alpha: 1, duration: MOTION.base, ease: EASE });
    if (this.d.skipping) mom.finishWalk(); else await walk;
    mom.face(1);
    await d.tween({ targets: mom, x: AMB.x + 56, y: AMB.y + 300, alpha: 0, scale: 0.28, duration: 900, ease: 'Sine.easeInOut' });
    mom.setVisible(false);
    await d.wait(400);
    this.ambImg.setTexture('ambulance');
    this.d.sfx('door', { volume: 0.5 });
    await d.wait(500);
    this.d.sfx('engine', { volume: 0.35 });
    d.tween({ targets: cap, alpha: 0, duration: MOTION.base, ease: EASE });
    // Огнёвка вылетает из окна детской и летит следом
    const moth = this.add.container(250, 600).setDepth(40).setAlpha(0);
    const glow = this.add.image(0, 0, 'fx_glow').setTint(0xff7a2e).setBlendMode(Phaser.BlendModes.ADD).setScale(0.45).setAlpha(0.6);
    const fire = this.add.image(0, 0, 'moth_fire').setScale(0.16);
    const white = this.add.image(0, 0, 'moth_white').setScale(0.16).setAlpha(0);
    moth.add([glow, fire, white]);
    onUpdate(this, (time) => { const f = 0.3 + 0.7 * Math.abs(Math.sin(time / 60)); fire.scaleX = 0.16 * f; white.scaleX = 0.16 * f; });
    d.tween({ targets: moth, alpha: 1, duration: 600 });
    this.d.sfx('moth_flutter', { volume: 0.3 });
    const path = new Phaser.Curves.Spline([[250, 600], [520, 520], [760, 610], [980, 560], [1180, 600]].map(([x, y]) => new Phaser.Math.Vector2(x, y)));
    const fly = { t: 0 };
    const flight = d.tween({
      targets: fly, t: 1, duration: 3200, ease: 'Sine.easeInOut',
      onUpdate: () => { const p = path.getPoint(fly.t); moth.setPosition(p.x, p.y); },
      onComplete: () => moth.setPosition(1180, 600),
    });
    // Тихон на крыше скорой
    const spider = new SpiderRig(this, AMB.x + 300, AMB.y + 40, { scale: 0.2, threadTop: 0 }).setRigDepth(30);
    spider.thread.setVisible(false);
    spider.setAlpha(0);
    await d.wait(1200);
    await d.tween({ targets: spider, alpha: 1, duration: 600 });
    this.spider = spider;
    await d.say('S125');
    await flight;
    // ледяная паутина из пурги
    const web = this.add.image(1180, 600, 'ice_web').setDepth(35).setScale(0.1).setAlpha(0);
    this.d.sfx('web', { volume: 0.5 });
    this.d.sfx('sparkle', { volume: 0.45 });
    d.tween({ targets: web, alpha: 0.9, scale: 0.42, angle: 20, duration: 1200, ease: 'Sine.easeOut' });
    await d.say('S126');
    d.tween({ targets: [glow, fire], alpha: 0, duration: 1400 });
    await d.tween({ targets: white, alpha: 1, duration: 1400 });
    d.tween({ targets: web, alpha: 0, scale: 0.5, duration: 1200 });
    d.tween({ targets: moth, x: 1500, y: 260, alpha: 0, duration: 3000, ease: 'Sine.easeInOut' });
    if (this.ending === 'companion') {
      spider.setFace('idle');
      await d.say('S127');
    } else {
      // Тихон перебирается на фонарь и провожает машину
      const jump = { t: 0 };
      const from = { x: spider.x, y: spider.y };
      await d.tween({
        targets: jump, t: 1, duration: 1400, ease: 'Sine.easeInOut',
        onUpdate: () => { spider.setPosition(from.x + (1656 - from.x) * jump.t, from.y + (520 - from.y) * jump.t - Math.sin(jump.t * Math.PI) * 220); },
        onComplete: () => spider.setPosition(1656, 520),
      });
      spider.threadTop = 486; spider.thread.setVisible(true);
      await d.say('S128');
    }
    // машина уезжает в снег
    this.d.sfx('engine', { volume: 0.3 });
    const riders = this.ending === 'companion' ? [this.amb, spider] : [this.amb];
    d.tween({ targets: this.wheels, angle: 720, duration: 5200, ease: 'Sine.easeIn' });
    await d.tween({ targets: riders, x: '+=1500', duration: 5200, ease: 'Sine.easeIn' });
    await d.wait(600);
  }

  // ---------- итоговый экран ----------

  showPanel() {
    if (this.panelShown) return;
    this.panelShown = true;
    this.d.resume();
    this.skipBtn.setVisible(false);
    voice.stop();
    const win = this.outcome === 'recovered';
    const copy = COPY[this.outcome] || COPY.recovered;
    const end = ENDINGS.find((e) => e.id === this.ending);
    const counts = Journal.counts();
    if (win) Music.stinger('win', { volume: 0.6 }); // поверх музыки рассвета (она на это время притихнет)

    this.add.rectangle(960, 540, 1920, 1080, 0x000000, win ? 0.35 : 0.5).setDepth(800);
    const PW = 872; const PAD = S[600];
    const c = this.add.container(1920 - S[600] - PW / 2, 540).setDepth(810).setAlpha(0);
    const items = [];
    let y = 0;
    const put = (obj, h, gap = 0) => { obj.setY(y); items.push(obj); y += h + gap; return obj; };
    const left = -PW / 2 + PAD;
    const tx = (str, style, color, extra = {}) => this.add.text(left, 0, str, text(style, { color, wordWrap: { width: PW - PAD * 2, useAdvancedWrap: true }, ...extra })).setResolution(2);
    put(tx(end ? `Финал: ${end.title}` : 'Финал', 'hand-2', CSS.accent), 28, S[75]);
    const head = put(heroGradient(tx(copy.title, 'heading-8', CSS.paper)), 72, S[200]);
    const sub = tx(copy.sub, 'body-9', CSS.fogHi);
    put(sub, sub.height, S[200]);
    if (end) { const et = tx(endingNote(end), 'title-1', CSS.fog); put(et, et.height, S[400]); } else y += S[400];
    // итог по дням: отметки карандашом — галочка за победу, крестик за поражение
    const rowsTop = y;
    const marks = [];
    for (let i = 0; i < TOTAL_DAYS; i++) {
      const res = GameState.dayResults[i];
      const ry = rowsTop + i * 48 + 24;
      const mark = this.add.graphics({ x: left + 14, y: ry });
      if (res === 'win') inkCheck(mark, 0, 0, 24, { color: 0x8fd694, seed: 3 + i });
      else if (res === 'loss') inkCross(mark, 0, 0, 20, { color: 0xf07c6c, seed: 5 + i });
      else inkCircle(mark, 0, 0, 8, { color: COLORS.fog, alpha: 0.7, width: 1.6, passes: 1, seed: 7 + i });
      const label = this.add.text(left + 44, ry, `День ${i + 1} · ${daysFor()[i].gameTitle}`, text('title-1', { color: res ? CSS.paper : CSS.fog })).setOrigin(0, 0.5).setResolution(2);
      const r = this.add.text(PW / 2 - PAD, ry, res === 'win' ? 'Победа' : res === 'loss' ? 'Поражение' : 'Не понадобился', text('hand-2', {
        color: res === 'win' ? CSS.win : res === 'loss' ? CSS.loss : CSS.fog,
      })).setOrigin(1, 0.5).setResolution(2);
      items.push(mark, label, r);
      marks.push({ mark, res });
    }
    y = rowsTop + TOTAL_DAYS * 48 + S[300];
    put(tx(`Финалы: ${counts.endings} из ${counts.endingsTotal}   ·   Секреты: ${counts.secrets} из ${counts.secretsTotal}`, 'hand-2', CSS.fogHi), 28, S[75]);
    put(tx(counts.endings < counts.endingsTotal ? 'Есть и другие финалы. Ответы Тихону меняют историю.' : 'Ты увидел все финалы. Спасибо, что играл.', 'title-2', CSS.fog), 28, S[400]);
    const btnY = y + 32;
    y += 64 + S[300] + 56;
    const h = y + PAD * 2;
    const top = -h / 2;
    items.forEach((o) => { o.y += top + PAD; });
    const bg = this.add.image(0, 0, paperTexture(this, PW, Math.round(h), { kind: 'night', seed: 14, border: true }));
    c.add([bg, ...items]);
    // отметки дней появляются по одной, как будто их ставят карандашом
    if (!this.reduced) {
      marks.forEach(({ mark, res }, i) => {
        mark.setAlpha(0).setScale(0.6);
        this.tweens.add({
          targets: mark, alpha: 1, scale: 1, duration: 260, ease: 'Back.easeOut', delay: 650 + i * 230,
          onStart: () => { if (res) Audio.play('pencil', { volume: 0.35 }); },
        });
      });
    }
    const again = new Button(this, left + 150, top + PAD + btnY, {
      label: 'Играть снова', width: 300, height: 64, variant: 'primary', style: 'button-xl', onClick: () => this.again(),
    });
    const menu = new Button(this, left + 150 + 300 + S[300], top + PAD + btnY, {
      label: 'В меню', width: 300, height: 64, variant: 'secondary', style: 'button-xl', onClick: () => this.toMenu(),
    });
    const y2 = top + PAD + btnY + 32 + S[300] + 28;
    // второй ряд — три тихие кнопки: письмо, открытка, титры (ширина ряда та же, что у первого)
    const rowW = 600 + S[300]; const gap3 = S[200]; const w3 = Math.floor((rowW - gap3 * 2) / 3);
    const x3 = (i) => left + w3 / 2 + i * (w3 + gap3);
    const letterBtn = new Button(this, x3(0), y2, {
      label: 'Письмо Тихона', width: w3, height: 56, variant: 'ghost', style: 'button-lg', onClick: () => this.rereadLetter(),
    });
    const cardBtn = new Button(this, x3(1), y2, {
      label: 'Открытка', width: w3, height: 56, variant: 'ghost', style: 'button-lg', onClick: () => this.postcard(),
    });
    const creditsBtn = new Button(this, x3(2), y2, {
      label: 'Титры', width: w3, height: 56, variant: 'ghost', style: 'button-lg', onClick: () => this.toCredits(),
    });
    c.add([again, menu, letterBtn, cardBtn, creditsBtn]);
    // Пока панель выезжает, кнопки не нажимаются: пробел, которым пропускали финал, не начнёт игру заново.
    [again, menu, letterBtn, cardBtn, creditsBtn].forEach((b) => b.lock(PANEL_ARM_MS));
    this.focus = new FocusRing(this, [again, menu, letterBtn, cardBtn, creditsBtn], { autofocus: true });
    this.pinFinalDrawing();
    if (this.reduced) this.tweens.add({ targets: c, alpha: 1, duration: MOTION.fade, ease: EASE });
    else { c.y += S[300]; this.tweens.add({ targets: c, alpha: 1, y: c.y - S[300], duration: MOTION.base, ease: EASE }); }
    window.__ending = { ...window.__ending, panel: true, title: head.text, counts, again, menu, creditsBtn };
  }

  // Последний рисунок мальчика — на скотче слева от итога.
  pinFinalDrawing() {
    const key = drawingTexture(this, specKey(this.finalSpec), this.finalSpec);
    const c = this.add.container(500, 560).setDepth(805).setAngle(-3).setAlpha(0);
    const sh = this.add.rectangle(14, 18, DRAW_W, DRAW_H, 0x000000, 0.4);
    const img = this.add.image(0, 0, key);
    const tape = this.add.rectangle(0, -DRAW_H / 2 + 6, 170, 50, 0xf3e6c0, 0.75).setAngle(3);
    c.add([sh, img, tape]);
    c.setScale(0.86);
    this.tweens.add({ targets: c, alpha: 1, angle: -2, duration: 700, delay: 300, ease: EASE });
    Audio.play('tear', { volume: 0.25 });
    this.finalCard = c;
    window.__ending.drawing = captionFor(this.finalSpec);
  }

  async rereadLetter() {
    if (this.reading) return;
    this.reading = true;
    await showLetter(this, this.letter, { instant: true, depth: 1200, button: 'Закрыть' });
    this.reading = false;
  }

  async postcard() {
    if (this.sharing) return;
    this.sharing = true;
    try {
      const res = await savePostcard({ spec: this.finalSpec, letter: this.letter, ending: ENDINGS.find((e) => e.id === this.ending) });
      this.toast(res === 'shared' ? 'Открытка отправлена' : res === 'saved' ? 'Открытка сохранена' : 'Не получилось сохранить открытку');
    } finally { this.sharing = false; }
  }

  toast(str) {
    const t = this.add.text(500, 980, str, text('hand-3', { color: CSS.paper })).setOrigin(0.5).setDepth(1300).setResolution(2).setStroke('#0b1124', 6);
    this.tweens.add({ targets: t, alpha: { from: 1, to: 0 }, delay: 1800, duration: 600, onComplete: () => t.destroy() });
  }

  leave(fn) {
    if (this.leaving) return;
    this.leaving = true;
    voice.stop();
    Audio.stopAllLoops(400);
    Music.stop({ fade: 600 });
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', fn);
  }

  // Новая игра с той же сложностью: прошлый забег не продолжается.
  // «Играть снова» — в той же зиме: после «Второй зимы» снова вторая зима
  again() { this.leave(() => { GameState.reset(GameState.difficulty, GameState.mode); this.scene.start('Bedroom', { day: 1 }); }); }

  // Титры — та же книжка, только последняя её часть; из титров «В меню» ведёт на обложку.
  toCredits() {
    if (this.leaving) return;
    this.leaving = true;
    voice.stop();
    Audio.stopAllLoops(400);
    Music.stop({ fade: 600 });
    GameState.reset(GameState.difficulty);
    Audio.play('page', { volume: 0.5 });
    PageTurn.go(this, 'Credits', { from: 'Ending' }, { back: 'night', ms: 1300 });
  }

  // В меню — книжка закрывается: лист переворачивается, под ним снова обложка-меню.
  toMenu() {
    if (this.leaving) return;
    this.leaving = true;
    voice.stop();
    Audio.stopAllLoops(400);
    Music.stop({ fade: 600 });
    GameState.reset(GameState.difficulty);
    PageTurn.go(this, 'Menu', {}, { back: 'night', ms: 1400 });
  }
}
