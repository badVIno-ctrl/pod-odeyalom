// Тайная глава «Аня» (открывается, когда собраны все 10 секретов). Тридцать зим назад, та же комната:
// маленькая Аня — мама мальчика — болеет, а Тихон играет с ней в крестики-нолики. Это та же игра,
// что в первый день (наследник TicTacToeScene), только Тихон играет безупречно: честно его не обыграть,
// можно лишь свести вничью. Но раз за партию Огнёвка стучит в окно, и Тихон уползает её прогнать.
// Пока он «не смотрит», можно поставить лишний крестик — «Мама жульничала» (секрет 'anya').
// Тихон делает вид, что не заметил. Потом — разговор, голос мамы Ани из кухни, рисунок «ТИХОН»
// (тот самый, что висит над кроватью в наши дни), тридцать зим спустя — и письмо Тихона.
import * as Phaser from 'phaser';
import { TicTacToeScene } from './TicTacToeScene.js';
import { bestMoves, evaluate } from '../ai/tictactoe.js';
import { Director } from '../systems/cutscene.js';
import { voice } from '../systems/voice.js';
import { Audio } from '../systems/audio.js';
import { Music } from '../systems/music.js';
import { Assets } from '../systems/assets.js';
import { Journal } from '../systems/journal.js';
import { PageTurn } from '../systems/pageTurn.js';
import { SpiderRig } from '../systems/spiderRig.js';
import { Haptics } from '../systems/haptics.js';
import { anyaLetter } from '../systems/letter.js';
import { paintDrawing, DRAW_W, DRAW_H } from '../systems/drawings.js';
import { makeCanvas, rng } from '../systems/paint.js';
import { showLetter } from '../ui/letterCard.js';
import { Button } from '../ui/button.js';
import { CSS, EASE, text } from '../config/theme.js';
import { ROOM } from '../config/layout.js';
import { prefersReducedMotion } from '../config/game.js';
import { Debug } from '../systems/debug.js';
import { I18n } from '../i18n/index.js';

const SPEC = { kind: 'anya', day: 0, seed: 7 };
// рисунок на стене (см. paintRoom): рамка 1240..1470 × 220..400, сам лист 202×152 с отступом 14
const WALL = { x: 1355, y: 310, scale: 202 / DRAW_W };
const WIN = { x: ROOM.window.x + ROOM.window.w / 2, y: ROOM.window.y + ROOM.window.h / 2 };
const SPIDER_X = 1585; const SPIDER_Y = 210;
const sleep = (scene, ms) => new Promise((r) => scene.time.delayedCall(ms, r));

export class AnyaScene extends TicTacToeScene {
  constructor() { super('Anya'); }

  init(data) {
    super.init({ difficulty: 'hard', onDone: () => {} });
    this.from = (data && data.from) || 'Menu';
    this.winsNeeded = 2;
    this.maxDraws = 3; // честно Тихона не обыграть: после трёх ничьих история идёт дальше
    this.T = {
      ...this.T,
      score: (x, o) => `Аня ${x} : ${o} Тихон`, round: (n) => `Партия ${n} · до двух побед`, think: 'Тихон думает…',
      matchWin: 'Аня победила', roundWin: 'Партия Ани', matchLoss: 'Тихон победил', roundLoss: 'Партия Тихона', draw: 'Ничья, ещё партию',
    };
    this.V = { quipGood: 'S160', quipOk: 'S161', quipBad: 'S162', roundWin: 'S163', roundLoss: 'S164', draw1: 'S165', draw2: 'S166' };
    this.cheats = 0; this.awayRound = -1; this.away = false; this.extraPlaced = false;
    this.hintShown = false; this.honestSaid = false; this.result = null; this.leaving = false; this.gameOn = false;
  }

  startMusic() { /* музыка главы уже играет: колыбельная-шкатулка «из прошлого» */ }

  // Тихон играет безупречно: из лучших ходов — любой.
  pickMove() {
    const best = bestMoves(this.board, 'O');
    return best.length ? best[Math.floor(Math.random() * best.length)] : null;
  }

  create() {
    this.reduced = prefersReducedMotion();
    this.d = new Director(this);
    voice.stop();
    this.makeTextures();
    // прошлое: комната в сепии, Аня в железной кровати
    this.pastLayer = this.add.container(0, 0).setDepth(0);
    this.pastLayer.add([
      this.add.image(960, 540, Assets.ensure(this, 'bedroom_past')),
      this.add.image(ROOM.bed.x, ROOM.bed.y, Assets.ensure(this, 'anya_bed')).setOrigin(0.5, 1),
    ]);
    // Огнёвка за стеклом — тёплый отсвет, вспыхивает, когда она стучит
    this.glow = this.add.image(WIN.x, WIN.y, 'anya_glow').setDepth(6).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    // плёнка: виньетка и зерно (это воспоминание)
    this.add.image(960, 540, 'anya_vignette').setDepth(38);
    this.grain = this.add.tileSprite(960, 540, 1920, 1080, 'anya_grain').setDepth(39).setAlpha(0.07);
    if (!this.reduced) this.time.addEvent({ delay: 90, loop: true, callback: () => { this.grain.tilePositionX = Math.random() * 256; this.grain.tilePositionY = Math.random() * 256; } });
    this.cameras.main.fadeIn(900, 0, 0, 0);

    Music.setFever(0.3, 1500); // старая кассета: мелодия чуть «плывёт»
    Music.play('mus_night', { fade: 2500, layers: 1 });
    Audio.loop('wind_soft', { volume: 0.12, fade: 2500 });
    Audio.loop('clock', { volume: 0.14, fade: 2500, pan: 0.25 });
    Audio.loop('radio', { volume: 0.12, pan: -0.9, fade: 4000 }); // на кухне у мамы Ани бормочет радио

    this.skipBtn = new Button(this, 1920 - 150, 1080 - 56, {
      label: 'Пропустить', width: 220, height: 52, variant: 'ghost', style: 'button-lg', onClick: () => this.d.skip(),
    }).setDepth(60);
    this.input.keyboard.on('keydown-ESC', () => this.leave());
    const offSkip = Debug.on('skip', () => this.d.skip());
    this.events.once('shutdown', () => {
      offSkip();
      Audio.stopLoop('radio', { fade: 600 }); Audio.stopLoop('clock', { fade: 600 }); Audio.stopLoop('wind_soft', { fade: 600 });
      Audio.stopLoop('pencil_scribble', { fade: 200 });
      Music.setFever(0, 800);
    });
    window.__anya = this;
    this.storyIntro();
  }

  makeTextures() {
    const tex = (key, w, h, draw) => { if (!this.textures.exists(key)) { const c = makeCanvas(w, h); draw(c.getContext('2d'), w, h); this.textures.addImage(key, c); } };
    tex('anya_glow', 520, 520, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,170,80,0.85)'); g.addColorStop(0.35, 'rgba(255,120,40,0.35)'); g.addColorStop(1, 'rgba(255,100,30,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    });
    tex('anya_vignette', 1920, 1080, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.42, w / 2, h / 2, h * 1.02);
      g.addColorStop(0, 'rgba(30,20,10,0)'); g.addColorStop(1, 'rgba(30,20,10,0.6)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    });
    tex('anya_grain', 256, 256, (ctx, w, h) => {
      const img = ctx.createImageData(w, h); const r = rng(5);
      for (let i = 0; i < img.data.length; i += 4) { const v = r() < 0.5 ? 0 : 255; img.data[i] = v; img.data[i + 1] = v * 0.92; img.data[i + 2] = v * 0.8; img.data[i + 3] = r() < 0.18 ? 120 + r() * 100 : 0; }
      ctx.putImageData(img, 0, 0);
    });
  }

  // Надпись поверх кадра: заголовок и подстрочник, появляются и тают.
  async titleCard(title, sub, { hold = 2600 } = {}) {
    const d = this.d;
    const t1 = this.add.text(960, 470, title, text('heading-7', { color: CSS.paper })).setOrigin(0.5).setDepth(50).setAlpha(0).setResolution(2);
    const t2 = this.add.text(960, 560, sub, text('hand-3', { color: CSS.fogHi })).setOrigin(0.5).setDepth(50).setAlpha(0).setResolution(2);
    const shade = this.add.rectangle(960, 540, 1920, 1080, 0x0b0805, 0).setDepth(49);
    d.tween({ targets: shade, fillAlpha: 0.5, duration: 700 });
    await d.tween({ targets: t1, alpha: 1, duration: 900, ease: EASE });
    await d.tween({ targets: t2, alpha: 1, duration: 700, ease: EASE });
    await d.wait(hold);
    d.tween({ targets: shade, fillAlpha: 0, duration: 900 });
    await d.tween({ targets: [t1, t2], alpha: 0, duration: 800 });
    t1.destroy(); t2.destroy(); shade.destroy();
  }

  // Огнёвка бьётся в стекло: n ударов — вспышка отсвета и стук.
  knock(n = 2) {
    for (let i = 0; i < n; i++) {
      this.time.delayedCall(i * 380, () => {
        if (!this.scene.isActive()) return;
        Audio.play('tap', { volume: 0.5, pan: -0.55, rate: 0.9 + Math.random() * 0.2 });
        this.tweens.add({ targets: this.glow, alpha: { from: 0.75, to: 0.12 }, duration: 340, ease: 'Sine.easeOut' });
      });
    }
    Audio.play('moth_flutter', { volume: 0.3, pan: -0.55 });
  }

  // ---------- вступление ----------

  async storyIntro() {
    const d = this.d;
    await d.wait(700);
    await this.titleCard('Тридцать зим назад', 'Та же комната. Тот же уголок под потолком.');
    await d.say('G01');
    await d.say('A01');
    this.spider = new SpiderRig(this, SPIDER_X, -140, { scale: 0.7, threadTop: 0 }).setRigDepth(20);
    d.sfx('web', { volume: 0.3, pan: 0.6 });
    await d.tween({ targets: this.spider, y: SPIDER_Y, duration: 1500, ease: 'Sine.easeOut' });
    await d.say('S150');
    await d.say('A02');
    if (!d.skipping) this.knock(2);
    await d.say('S151');
    await d.say('A03');
    await d.say('S152');
    if (!this.scene.isActive() || this.leaving) return;
    d.resume();
    this.skipBtn.setVisible(false);
    this.gameOn = true;
    super.create(); // доска, табло, клетки — как в первый день
    this.dim.setDepth(5); this.root.setDepth(10);
  }

  // ---------- партия: Тихон отворачивается ----------

  async spiderTurn() {
    if (this.finished) return;
    const os = this.board.filter((v) => v === 'O').length;
    const free = this.board.filter((v) => !v).length;
    if (this.awayRound !== this.roundId && os >= 1 && free >= 3) {
      this.turn = 'O'; this.busy = true;
      const r = await this.lookAway();
      if (r === 'ended' || this.finished) return;
    }
    return super.spiderTurn();
  }

  async lookAway() {
    this.awayRound = this.roundId;
    const rid = this.roundId;
    this.away = true; this.extraPlaced = false;
    this.setStatus('Огнёвка стучит в окно…', 'bad');
    this.knock(3);
    this.spider.react('puzzled', 900);
    voice.play('S153');
    await sleep(this, 700);
    Audio.play('web', { volume: 0.25, pan: 0.6 });
    await new Promise((res) => this.tweens.add({ targets: this.spider, y: -190, duration: this.reduced ? 1 : 650, ease: 'Sine.easeIn', onComplete: res }));
    if (this.finished || rid !== this.roundId) { this.away = false; return 'ended'; }
    this.setStatus('Тихон отвернулся…', 'boy');
    if (!this.hintShown) { this.hintShown = true; this.showHint('Пока он не смотрит, можно поставить ещё один крестик…'); }
    this.turn = 'X'; this.busy = false;
    if (this.focusCell >= 0) this.drawHover(this.focusCell, true);
    await new Promise((resolve) => {
      this.extraResolve = resolve;
      this.awayTimer = this.time.delayedCall(5200, resolve);
    });
    this.extraResolve = null;
    if (this.awayTimer) { this.awayTimer.remove(false); this.awayTimer = null; }
    this.turn = 'O'; this.busy = true; this.hover.clear();
    this.hideHint();
    if (this.finished || rid !== this.roundId) { this.away = false; return 'ended'; }
    // возвращается и пересчитывает клетки
    Audio.play('web', { volume: 0.25, pan: 0.6 });
    await new Promise((res) => this.tweens.add({ targets: this.spider, y: SPIDER_Y, duration: this.reduced ? 1 : 750, ease: 'Sine.easeOut', onComplete: res }));
    this.away = false;
    if (this.extraPlaced) {
      this.cheats += 1;
      this.spider.react('count', 2200);
      this.setStatus('Тихон пересчитывает клетки…', 'spider');
      await voice.play(this.cheats === 1 ? 'S154' : this.cheats === 2 ? 'S155' : 'S156');
    } else if (!this.honestSaid) {
      this.honestSaid = true;
      this.spider.react('impressed', 1200);
      await voice.play('S157');
    }
    if (this.finished || rid !== this.roundId) return 'ended';
    const { winner } = evaluate(this.board);
    if (winner || this.board.every(Boolean)) { await this.checkEnd(); return 'ended'; }
    return 'go';
  }

  async boyMove(i) {
    if (!this.away) return super.boyMove(i);
    if (this.busy || this.finished || this.turn !== 'X' || this.board[i] || this.extraPlaced) return;
    this.busy = true; this.extraPlaced = true; this.hover.clear();
    Haptics.tap();
    await this.placeMark(i, 'X');
    voice.play('A05');
    this.hideHint();
    if (this.extraResolve) this.extraResolve();
  }

  showHint(str) {
    this.hideHint();
    this.hint = this.add.text(960, 940, str, text('hand-3', { color: CSS.accent })).setOrigin(0.5).setDepth(30).setAlpha(0).setResolution(2).setStroke('#0b0805', 6);
    this.tweens.add({ targets: this.hint, alpha: 1, duration: 500 });
  }

  hideHint() {
    if (!this.hint) return;
    const h = this.hint; this.hint = null;
    this.tweens.add({ targets: h, alpha: 0, duration: 400, onComplete: () => h.destroy() });
  }

  // ---------- конец партии: разговор, рисунок, тридцать зим спустя ----------

  finish(result) {
    if (this.finished) return;
    this.finished = true; this.busy = true; this.away = false;
    if (this.extraResolve) this.extraResolve();
    this.result = result;
    this.hideHint();
    if (this.spider) { this.spider.setMode('idle'); this.tweens.killTweensOf(this.spider); }
    this.tweens.add({ targets: this.root, alpha: 0, duration: 600 });
    this.tweens.add({ targets: this.dim, fillAlpha: 0.15, duration: 900 });
    Music.setFever(0.3, 2000);
    this.storyOutro();
  }

  async storyOutro() {
    const d = this.d;
    d.resume();
    this.skipBtn.setVisible(true);
    await d.wait(800);
    await d.tween({ targets: this.spider, x: SPIDER_X - 40, y: 330, duration: 1000, ease: 'Sine.easeInOut' });
    if (this.cheats > 0) { await d.say('S167'); await d.say('A06'); await d.say('S168'); } else { await d.say('S169'); await d.say('A10'); await d.say('S170'); }
    await d.say('A07');
    await d.say('S171');
    await d.say('G02');
    await d.say('A08');
    await d.say('G03');
    await d.say('A09');
    await d.say('S172');
    if (!this.scene.isActive() || this.leaving) return;
    await this.drawPicture();
    await this.thirtyWinters();
    await this.presentDay();
    this.skipBtn.setVisible(false);
    d.resume();
    await this.letterAndLeave();
  }

  // Аня рисует Тихона восковыми мелками — тот самый рисунок, что потом тридцать зим висит над кроватью.
  async drawPicture() {
    const d = this.d;
    Music.setLayers(2);
    const key = 'anya_drawing_live';
    if (this.textures.exists(key)) this.textures.remove(key);
    const tex = this.textures.createCanvas(key, DRAW_W, DRAW_H);
    const ctx = tex.getContext(); const cache = {};
    paintDrawing(ctx, SPEC, 0, cache); tex.refresh();
    const shade = this.add.rectangle(960, 540, 1920, 1080, 0x0b0805, 0).setDepth(25);
    const card = this.add.container(900, 520).setDepth(26).setAngle(-2).setScale(0.9).setAlpha(0);
    card.add([this.add.rectangle(14, 16, DRAW_W, DRAW_H, 0x000000, 0.35), this.add.image(0, 0, key)]);
    d.tween({ targets: shade, fillAlpha: 0.55, duration: 600 });
    await d.tween({ targets: card, alpha: 1, scale: 1, angle: -1, duration: 600, ease: EASE });
    if (!d.skipping) Audio.loop('pencil_scribble', { volume: 0.22, fade: 300, pan: -0.1 });
    const prog = { k: 0 };
    await d.tween({ targets: prog, k: 1, duration: 6500, ease: 'Sine.easeInOut', onUpdate: () => { paintDrawing(ctx, SPEC, prog.k, cache); tex.refresh(); } });
    Audio.stopLoop('pencil_scribble', { fade: 250 });
    paintDrawing(ctx, SPEC, 1, cache); tex.refresh();
    await d.wait(800);
    d.sfx('paper_1', { volume: 0.45, pan: 0.4 });
    d.tween({ targets: shade, fillAlpha: 0, duration: 900 });
    await d.tween({ targets: card, x: WALL.x, y: WALL.y, scale: WALL.scale, angle: 0, duration: 1100, ease: 'Sine.easeInOut' });
    card.first.setVisible(false); // тень от листа на стене не нужна — он плоский
    d.sfx('tear', { volume: 0.2, pan: 0.4 });
    shade.destroy();
    this.pin = card;
    await d.wait(900);
  }

  // Тридцать зим спустя: та же стена, тот же рисунок; в кровати спит мальчик, у кровати — мама.
  async thirtyWinters() {
    const d = this.d;
    this.present = this.add.container(0, 0).setDepth(1).setAlpha(0);
    this.present.add([
      this.add.image(960, 540, 'bedroom_night'),
      this.add.image(ROOM.bed.x, ROOM.bed.y, Assets.ensure(this, 'boy_bed_sleep')).setOrigin(0.5, 1),
    ]);
    this.mom = this.add.image(1110, 1040, 'mom_stand').setOrigin(0.5, 1).setDepth(2).setAlpha(0).setScale(0.96);
    const t1 = this.add.text(960, 470, 'Тридцать зим спустя', text('heading-7', { color: CSS.paper })).setOrigin(0.5).setDepth(50).setAlpha(0).setResolution(2).setStroke('#0b0805', 8);
    const t2 = this.add.text(960, 560, 'Тот же рисунок. Тот же сторож.', text('hand-3', { color: CSS.fogHi })).setOrigin(0.5).setDepth(50).setAlpha(0).setResolution(2).setStroke('#0b0805', 6);
    const shade = this.add.rectangle(960, 540, 1920, 1080, 0x0b0805, 0).setDepth(49);
    await d.wait(1100); // рисунок уже на стене — дать на него посмотреть
    d.tween({ targets: shade, fillAlpha: 0.3, duration: 800 });
    await d.tween({ targets: t1, alpha: 1, duration: 900, ease: EASE });
    d.tween({ targets: t2, alpha: 1, duration: 700, ease: EASE });
    Audio.stopLoop('radio', { fade: 3000 });
    Music.setFever(0, 4000);
    Music.setLayers(3, 4000);
    d.sfx('whoosh', { volume: 0.15 });
    d.tween({ targets: this.pastLayer, alpha: 0, duration: 3200, ease: 'Sine.easeInOut' });
    d.tween({ targets: this.pin, alpha: 0, duration: 3200, ease: 'Sine.easeInOut' });
    d.tween({ targets: this.grain, alpha: 0.02, duration: 3200 });
    await d.tween({ targets: this.present, alpha: 1, duration: 3200, ease: 'Sine.easeInOut' });
    await d.wait(700);
    d.tween({ targets: shade, fillAlpha: 0, duration: 900 });
    await d.tween({ targets: [t1, t2], alpha: 0, duration: 800 });
    t1.destroy(); t2.destroy(); shade.destroy();
    await d.tween({ targets: this.mom, alpha: 1, duration: 900, ease: EASE });
    await d.wait(600);
  }

  async presentDay() {
    const d = this.d;
    d.sfx('creak_2', { volume: 0.3, pan: 0.1 });
    await d.say('M80');
    await d.say('M81');
    this.spider.react('pluck', 1600);
    await d.say('S173');
    await d.wait(700);
  }

  async letterAndLeave() {
    const letter = anyaLetter({ cheats: this.cheats });
    const firstTime = !Journal.data.anyaSeen;
    Journal.addLetter({ ...letter, alt: anyaLetter({ cheats: this.cheats }, I18n.lang === 'en' ? 'ru' : 'en') });
    if (firstTime) Journal.addDrawing({ ...SPEC });
    Journal.markAnya();
    window.__anya.letter = letter;
    if (!this.scene.isActive()) return;
    await showLetter(this, letter, { depth: 1500, button: 'В меню' });
    this.leave();
  }

  leave() {
    if (this.leaving) return;
    this.leaving = true;
    this.finished = true;
    this.d.skip();
    voice.stop();
    Audio.stopAllLoops(500);
    Music.stop({ fade: 900 });
    PageTurn.go(this, 'Menu', {}, { back: 'night', ms: 1400 });
  }
}
