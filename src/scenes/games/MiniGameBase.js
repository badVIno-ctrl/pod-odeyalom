// Общая основа мини-игр дней 2–5: своё окружение (каждая игра — отдельный «мир» из фантазии мальчика),
// фоновые звуки, табло «Ты : Паук», строка статуса, шкала «Смелость» и мамина подсказка,
// карточка правил, всплывающие надписи, серии удачных ходов, отладочные W/L, finish() — ровно один раз.
import * as Phaser from 'phaser';
import { COLORS, CSS, INK, EASE, MOTION, RADIUS, S, text } from '../../config/theme.js';
import { paperTexture, inkRect, inkCircle, inkLine } from '../../ui/paper.js';
import { Button } from '../../ui/button.js';
import { Scoreboard } from '../../ui/scoreboard.js';
import { prefersReducedMotion } from '../../config/game.js';
import { GameState } from '../../state.js';
import { voice } from '../../systems/voice.js';
import { Audio } from '../../systems/audio.js';
import { Music } from '../../systems/music.js';
import { Debug } from '../../systems/debug.js';
import { SpiderRig } from '../../systems/spiderRig.js';
import { Quality } from '../../systems/quality.js';
import { Haptics } from '../../systems/haptics.js';

export const sleep = (scene, ms) => new Promise((r) => scene.time.delayedCall(ms, r));
const hexCss = (n) => `#${n.toString(16).padStart(6, '0')}`;

export class MiniGameBase extends Phaser.Scene {
  init(data) {
    this.onDone = data.onDone || (() => {});
    this.difficulty = data.difficulty || GameState.difficulty || 'medium';
    this.day = data.day || GameState.day;
    this.finished = false;
    this.busy = true;
    this.lastQuipAt = -99999;
    this.streak = 0;
    this.hl = { good: 0, best: 0, labels: {} }; // памятные моменты партии → GameState.highlights (письмо Тихона)
    this.loops = [];
    this.reduced = prefersReducedMotion();
  }

  // opts: { title, rules: [строки], ambient: [{ key, volume }], music: 'mus_game' | false, spider: { x, y, scale }, hint: { label },
  //         subtitles: { x, bottom, width } — где стоит компактная плашка субтитров (свободное место у паука) }
  setupFrame(opts) {
    this.opts = opts;
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    this.dim = this.add.rectangle(960, 540, 1920, 1080, 0x000000, 0).setDepth(-100);
    this.tweens.add({ targets: this.dim, fillAlpha: 0.55, duration: MOTION.base, ease: EASE });
    this.world = this.add.container(0, 0).setDepth(-50).setAlpha(0); // окружение
    this.root = this.add.container(0, 0).setDepth(0).setAlpha(0); // доска/поля
    this.ui = this.add.container(0, 0).setDepth(100).setAlpha(0); // табло, кнопки

    // табло: счёт и строка статуса
    this.scoreboard = new Scoreboard(this, { reduced: this.reduced });
    this.scoreText = this.scoreboard.score;
    this.status = this.scoreboard.status;
    this.ui.add(this.scoreboard.items);

    // смелость и подсказка (левый нижний угол)
    this.makeCourage(opts.hint);
    // правила «?»
    this.makeRulesButton(opts.rules || []);

    const sp = opts.spider || { x: 1700, y: 200, scale: 0.62 };
    const power = GameState.spiderPower();
    this.spider = new SpiderRig(this, sp.x, sp.y - 120, { scale: sp.scale * (1 + power * 0.08), threadTop: 0 });
    this.spider.setAlpha(0).setDepth(90);
    this.spiderHome = { x: sp.x, y: sp.y };
    this.tweens.add({ targets: this.spider, alpha: 1, y: sp.y, duration: 800, ease: 'Sine.easeOut' });

    for (const a of opts.ambient || []) { Audio.loop(a.key, { volume: a.volume, fade: 1400 }); this.loops.push(a.key); }
    // у каждой партии своя музыка (opts.music), по умолчанию — лёгкая тема мини-игр
    // за игрой жар слышен слабее — музыка не должна мешать думать
    this.prevFever = Music.feverK; Music.setFever(this.prevFever * 0.35, 1500);
    if (opts.music !== false) Music.play(opts.music || 'mus_game', { fade: 1500, volume: opts.musicVolume ?? 1 });

    this.setSubtitleLayout(opts.subtitles || null);
    this.events.on('update', (time) => this.tickManners(time));
    this.input.on('pointerdown', () => { this.idleSince = this.time.now; });
    this.input.keyboard?.on('keydown', () => { this.idleSince = this.time.now; });

    const offs = [Debug.on('win', () => this.finish('win')), Debug.on('loss', () => this.finish('loss'))];
    this.events.once('shutdown', () => {
      offs.forEach((f) => f());
      voice.presenter?.setLayout?.(null); // в комнате — снова широкая плашка внизу
      this.loops.forEach((k) => Audio.stopLoop(k, { fade: 700 }));
    });
    this.tweens.add({ targets: [this.world], alpha: 1, duration: 700, ease: EASE });
    this.tweens.add({ targets: [this.root, this.ui], alpha: 1, duration: MOTION.base, delay: 250, ease: EASE });
  }

  // Компактные субтитры на свободном месте: широкая плашка внизу закрывала нижние ряды поля и кнопки,
  // а клик по ней пропускал реплику вместо хода. layout: { x, bottom, width } (центр нижнего края).
  setSubtitleLayout(layout) {
    voice.presenter?.setLayout?.(layout ? { compact: true, ...layout } : null);
  }

  // ---------- табло и статус ----------

  setScore(boy, spider, label = null) {
    this.scoreboard.setScore(label ?? `Ты ${boy} : ${spider} Паук`);
  }

  bumpScore() { this.scoreboard.bump(); }

  setStatus(str, tone = 'normal') { this.scoreboard.setStatus(str, tone); }

  // ---------- смелость и подсказка ----------
  // Плашка 424×112, точка привязки контейнера: (20, 80) от её левого верхнего угла.

  makeCourage(hint = {}) {
    this.courageBox = this.add.container(68, 1000);
    const px = -20; const py = -80; const w = 424; const h = 112;
    // тёмный картон, как в меню; шкала — полоска, закрашенная цветным карандашом
    const bg = this.add.image(px + w / 2, py + h / 2, paperTexture(this, w, h, { kind: 'night', seed: 8 }));
    const cap = this.add.text(px + S[300], py + S[300] - 2, 'Смелость', text('heading-6', { color: CSS.paper })).setResolution(2);
    this.courageBar = this.add.graphics();
    this.courageBar.setPosition(px + S[300], py + S[300] + 24 + S[100] + 4);
    const bx = px + w - S[200] - 88; const by = py + h / 2;
    this.hintRing = this.add.graphics().setPosition(bx, by).setAlpha(0);
    inkCircle(this.hintRing, 0, 0, 104, { squash: 0.5, seed: 31, color: COLORS.accentHi, width: 2.6, alpha: 1 });
    this.hintBtn = new Button(this, bx, by, {
      label: hint.label || 'Подсказка', width: 176, height: 80, variant: 'secondary', style: 'button-md', radius: RADIUS.xl,
      onClick: () => this.useHint(),
    });
    this.courageBox.add([bg, cap, this.courageBar, this.hintRing, this.hintBtn]);
    this.ui.add(this.courageBox);
    this.drawCourage();
    if (hint.key !== false) this.input.keyboard.on('keydown-H', () => this.useHint());
  }

  drawCourage() {
    const g = this.courageBar; const v = GameState.courage / 100;
    const W = 200; const H = 18;
    g.clear();
    g.fillStyle(0x0b1124, 0.85).fillRoundedRect(0, 0, W, H, H / 2);
    if (v > 0) {
      const fw = Math.max(H, W * v);
      g.fillStyle(v >= 1 ? COLORS.accentHi : COLORS.accent, 1).fillRoundedRect(0, 0, fw, H, H / 2);
      // штрихи цветного карандаша
      g.lineStyle(2, 0xfff1d6, 0.32);
      for (let x = 7; x < fw - 5; x += 8) g.lineBetween(x - 3, H - 3, x + 3, 3);
    }
    inkRect(g, -1, -1, W + 2, H + 2, { color: 0xe9d9b8, alpha: 0.5, width: 1.6, passes: 1, seed: 21, amp: 0.5 });
    for (let k = 1; k < 4; k++) inkLine(g, k * (W / 4), H + 3, k * (W / 4), H + 8, { color: 0xe9d9b8, alpha: 0.5, width: 1.4, passes: 1, seed: 40 + k, amp: 0.3 });
    const ready = GameState.canHint() && !this.finished;
    this.hintBtn.setVariant(ready ? 'primary' : 'secondary');
    if (ready && !this.hintPulse && !this.reduced) {
      this.hintPulse = this.tweens.add({ targets: this.hintRing, alpha: { from: 0.25, to: 1 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else if (ready && this.reduced) {
      this.hintRing.setAlpha(1);
    } else if (!ready) {
      if (this.hintPulse) { this.hintPulse.stop(); this.hintPulse = null; }
      this.hintRing.setAlpha(0);
    }
  }

  // Всплывающие сообщения у плашки смелости.
  courageNote(str, color, size) {
    const b = this.courageBox;
    return this.floatText(b.x + 192, b.y - 80 - S[500], str, color, size);
  }

  // Удачный ход: +смелость, серия, всплывашка.
  goodMove(x, y, amount = 14, label = null) {
    GameState.stats.goodMoves += 1;
    const before = GameState.canHint();
    GameState.addCourage(amount);
    this.streak += 1;
    this.hl.good += 1; this.hl.best = Math.max(this.hl.best, this.streak);
    if (label) { const k = label.startsWith('+') ? 'cells' : label; this.hl.labels[k] = (this.hl.labels[k] || 0) + 1; }
    if (label) this.floatText(x, y, label, COLORS.win);
    if (this.streak >= 3 && this.streak % 3 === 0) {
      Audio.play('combo', { volume: 0.5 });
      this.floatText(960, 260, `Серия ×${this.streak}`, COLORS.accentHi, 48);
    }
    if (!before && GameState.canHint()) {
      Audio.play('chime', { volume: 0.45 });
      this.courageNote('Подсказка готова', COLORS.accentHi, 30);
    }
    this.drawCourage();
    Haptics.good();
    // Тихон реагирует на сильный ход: удивляется, хлопает лапами; на серию — ещё и говорит
    if (amount >= 20 || this.streak >= 2) {
      this.spider?.react(Math.random() < 0.7 ? 'impressed' : 'puzzled', 1500);
      if (this.streak >= 3 || amount >= 28) this.laterQuip(['S140', 'S141', 'S142', 'S143'], 0.6);
    }
  }

  // Неудачный ход: серия сбрасывается, Тихон хитро щурится (и изредка подначивает).
  badMove() {
    this.streak = 0;
    this.spider?.react('smug', 1300);
    this.laterQuip(['S144', 'S145', 'S146'], 0.22);
  }

  // Общая реплика-реакция — только если сама игра сейчас ничего не сказала (её реплики точнее).
  laterQuip(ids, chance) {
    const at = this.lastQuipAt;
    this.time.delayedCall(80, () => {
      if (this.finished || voice.isPlaying || this.lastQuipAt !== at) return;
      this.quip(ids[Math.floor(Math.random() * ids.length)], { chance, cooldown: 12000 });
    });
  }

  // Привычки Тихона, пока мальчик думает: барабанит лапами, потягивается, считает на лапах.
  tickManners(time) {
    if (!this.spider || this.finished) return;
    if (this.busy) { this.idleSince = time; return; }
    if (this.idleSince === undefined) this.idleSince = time;
    const idle = time - this.idleSince;
    if (this.spider.reacting || this.spider.mode !== 'idle') return;
    if (idle > 12000 && time - (this.lastManner || 0) > 9000) {
      this.lastManner = time;
      this.spider.react('impatient', 2000);
      this.quip('S23', { chance: 0.5, cooldown: 20000 });
    } else if (idle > 4500 && time - (this.lastManner || 0) > 15000) {
      this.lastManner = time;
      this.spider.react(Math.random() < 0.5 ? 'stretch' : 'count', 2200);
    }
  }

  async useHint() {
    if (this.finished || this.busy || !GameState.canHint()) {
      if (!GameState.canHint() && !this.finished) this.courageNote('Набери смелости: делай удачные ходы', COLORS.fog, 24);
      return;
    }
    const target = this.computeHint ? this.computeHint() : null;
    if (!target) return;
    GameState.spendHint();
    this.drawCourage();
    Audio.play('sparkle', { volume: 0.45 });
    this.showHint(target);
  }

  // ---------- правила ----------

  makeRulesButton(lines) {
    const b = new Button(this, 1920 - S[600] - 40, 1080 - S[600] - 40, {
      label: '?', width: 80, height: 80, variant: 'ghost', style: 'button-2xl', radius: 40,
      onClick: () => this.toggleRules(lines),
    });
    this.rulesBtn = b;
    this.ui.add(b);
  }

  // Правила — листок из тетради поверх затемнённой сцены (как записка, которую дал Тихон).
  toggleRules(lines) {
    if (this.rulesCard) {
      const old = this.rulesCard; this.rulesCard = null; this.rulesClosedAt = this.time.now;
      this.tweens.add({ targets: old, alpha: 0, duration: MOTION.fadeMin, ease: EASE, onComplete: () => old.destroy() });
      return;
    }
    Audio.play('page', { volume: 0.5 });
    const c = this.add.container(960, 540).setDepth(500).setAlpha(0);
    const w = 1000; const pad = S[600];
    const body = lines.map((l) => `•  ${l}`).join('\n');
    const t = this.add.text(-w / 2 + pad, 0, body, text('body-9', { color: INK.ink, wordWrap: { width: w - pad * 2 } })).setResolution(2);
    const h = pad + 40 + S[300] + Math.ceil(t.height) + S[300] + 28 + pad;
    const top = -h / 2;
    const dim = this.add.rectangle(0, 0, 1920, 1080, 0x05070f, 0.62);
    const sheet = this.add.container(0, 0);
    const paper = this.add.image(0, 0, paperTexture(this, w, h, { kind: 'light', seed: 12, edge: 'torn', tornSides: 'tb', tape: 'corners' }));
    const title = this.add.text(-w / 2 + pad, top + pad, `Правила: ${this.opts.title}`, text('heading-4', { color: INK.red })).setResolution(2);
    t.setY(top + pad + 40 + S[300]);
    const close = this.add.text(-w / 2 + pad, top + h - pad - 28, 'Нажми в любом месте, чтобы закрыть', text('hand-2', { color: INK.faded })).setResolution(2);
    const z = this.add.zone(0, 0, 1920, 1080).setInteractive();
    z.on('pointerdown', () => this.toggleRules());
    sheet.add([paper, title, t, close]);
    c.add([dim, sheet, z]);
    this.tweens.add({ targets: c, alpha: 1, duration: MOTION.fade, ease: EASE });
    if (!this.reduced) {
      sheet.setAngle(-2.2).setY(24);
      this.tweens.add({ targets: sheet, angle: -0.6, y: 0, duration: 520, ease: 'Back.easeOut' });
    }
    this.rulesCard = c;
  }

  // ---------- эффекты ----------

  floatText(x, y, str, color = COLORS.paper, size = 36) {
    const style = size >= 48 ? 'heading-2' : size >= 36 ? 'heading-3' : size >= 30 ? 'heading-4' : size >= 24 ? 'heading-5' : 'heading-6';
    const t = this.add.text(x, y, str, text(style, { color: hexCss(color) }))
      .setOrigin(0.5).setResolution(2).setDepth(400).setStroke('#1a1222', 8);
    if (!this.reduced) this.tweens.add({ targets: t, y: y - 64, duration: MOTION.base * 2, ease: EASE });
    this.tweens.add({ targets: t, alpha: { from: 1, to: 0 }, duration: MOTION.fade, delay: 900, ease: EASE, onComplete: () => t.destroy() });
    return t;
  }

  burst(x, y, color = 0xffd27a, n = 14) {
    const count = Math.round(n * Quality.particles);
    if (!count) return;
    const e = this.add.particles(x, y, 'fx_dust', {
      speed: { min: 120, max: 420 }, angle: { min: 0, max: 360 }, scale: { start: 1.6, end: 0 }, lifespan: 700,
      tint: color, blendMode: 'ADD', emitting: false,
    }).setDepth(300);
    e.explode(count);
    this.time.delayedCall(900, () => e.destroy());
  }

  shake(ms = 220, k = 0.006) { if (!this.reduced) this.cameras.main.shake(ms, k); }

  // Реплика паука во время партии — не чаще, чем раз в cooldown мс и не поверх другой реплики.
  quip(id, { cooldown = 9000, chance = 1, force = false } = {}) {
    if (this.finished) return Promise.resolve();
    const now = this.time.now;
    if (!force && (now - this.lastQuipAt < cooldown || voice.isPlaying || Math.random() > chance)) return Promise.resolve();
    this.lastQuipAt = now;
    this.lastQuipId = id;
    return voice.play(id);
  }

  spiderThink(on) { if (this.spider) this.spider.setMode(on ? 'think' : 'idle'); }

  spiderLaugh(ms = 900) { if (this.spider) { Audio.play('spider_laugh', { volume: 0.5 }); this.spider.laugh(ms); } }

  // ---------- конец ----------

  finish(result) {
    if (this.finished) return;
    this.finished = true;
    this.busy = true;
    // реплика партии («Осталась последняя ниточка…») не должна договариваться уже в комнате
    if (voice.current && voice.current.id === this.lastQuipId) voice.skip();
    Music.setFever(this.prevFever || 0, 2500);
    try {
      GameState.addHighlight({ day: this.day, game: this.scene.key, result, ...this.hl, ...(this.highlightData ? this.highlightData(result) : {}) });
    } catch (e) { console.warn('highlight', e); }
    this.spiderThink(false);
    if (this.rulesCard) { this.rulesCard.destroy(); this.rulesCard = null; }
    this.tweens.add({ targets: [this.root, this.ui, this.spider, this.world], alpha: 0, duration: MOTION.base, ease: EASE });
    this.tweens.add({
      targets: this.dim, fillAlpha: 0, duration: 600,
      onComplete: () => {
        const done = this.onDone;
        this.scene.stop();
        done(result);
      },
    });
  }
}
