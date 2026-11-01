// День 4 — «Точки и линии» (Dots and Boxes), поле 4×4 точки = 3×3 клетки.
// «Вторая зима»: большое поле 6×6 точек = 5×5 клеток (variant.dots = 6).
// Тёплый вечер: изразцовая печка, потрескивают дрова, лист в клетку на деревянном подносе.
// Ходы по очереди, мальчик начинает. Замкнул клетку — она твоя и ходишь ещё раз. Ничьей не бывает (9 клеток).
import * as Phaser from 'phaser';
import { COLORS, CSS } from '../../config/theme.js';
import { SPIDER_THINK_MS } from '../../config/game.js';
import { MiniGameBase, sleep } from './MiniGameBase.js';
import { makeDots } from '../../ai/dots.js';
import { Audio } from '../../systems/audio.js';
import { count } from '../../systems/plural.js';
import { GameState } from '../../state.js';
import { makeCanvas, rng as seeded } from '../../systems/paint.js';
import { Quality } from '../../systems/quality.js';

const BOY = 0x2a5ab0; const SPIDER = 0x8a3a8e;

export class DotsScene extends MiniGameBase {
  constructor() { super('Dots'); }

  init(data) {
    super.init(data);
    const n = (data && data.variant && data.variant.dots) || 4;
    this.G = makeDots(n);
    this.big = n > 4;
    this.STEP = this.big ? Math.round(680 / this.G.B) : 210;
    this.k = this.STEP / 210; // масштаб рисунков в клетках
    this.ORIGIN = { x: 960 - (this.STEP * this.G.B) / 2, y: 590 - (this.STEP * this.G.B) / 2 };
    this.st = this.G.createDots();
    this.lastSpiderChain = 0;
  }

  create() {
    this.makeTextures();
    this.setupFrame({
      title: this.big ? 'Точки и линии: большое поле' : 'Точки и линии',
      rules: [
        'По очереди соединяйте две соседние точки линией по горизонтали или вертикали.',
        'Кто проводит четвёртую сторону клетки, забирает её и ходит ещё раз (можно замкнуть две клетки сразу).',
        this.big
          ? 'Поле большое: 25 клеток. Когда линии закончатся, побеждает тот, у кого клеток больше.'
          : 'Всего 9 клеток. Когда линии закончатся, побеждает тот, у кого клеток больше.',
        'Осторожно с третьей стороной: она дарит клетку сопернику.',
        'Мамин совет подсвечивает хороший ход.',
      ],
      ambient: [{ key: 'stove', volume: 0.38 }, { key: 'clock', volume: 0.1 }],
      spider: { x: 1640, y: 230, scale: 0.55 },
      subtitles: { x: 1660, bottom: 690, width: 440 }, // справа между пауком и кружкой
      hint: { label: 'Мамин\nсовет' },
    });
    this.makeWorld();
    this.root.add(this.add.image(960, 590, 'dots_paper'));
    this.boxG = this.add.graphics();
    this.lineG = this.add.graphics();
    this.hoverG = this.add.graphics();
    this.dotG = this.add.graphics();
    this.root.add([this.boxG, this.hoverG, this.lineG, this.dotG]);
    this.drawDots();
    this.makeZones();
    this.updateScore();
    this.time.delayedCall(700, () => this.boyTurn());
  }

  makeTextures() {
    if (this.textures.exists('dots_bg')) return;
    const c = makeCanvas(1920, 1080); const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 1080);
    g.addColorStop(0, '#2a1a14'); g.addColorStop(1, '#3d2618');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1920, 1080);
    // обои в мелкий цветочек
    const r = seeded(44);
    for (let i = 0; i < 260; i++) { ctx.fillStyle = `rgba(242,180,120,${0.05 + r() * 0.06})`; const x = r() * 1920; const y = r() * 700; ctx.beginPath(); ctx.arc(x, y, 4 + r() * 4, 0, Math.PI * 2); ctx.fill(); }
    // изразцовая печь слева
    const px = 40; const py = 120; const pw = 300; const ph = 880;
    ctx.fillStyle = '#e9e1d2'; ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = 'rgba(60,90,150,0.55)'; ctx.lineWidth = 3;
    for (let y = py; y < py + ph; y += 75) for (let x = px; x < px + pw; x += 75) {
      ctx.strokeRect(x + 3, y + 3, 69, 69);
      ctx.beginPath(); ctx.arc(x + 37, y + 37, 18, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = '#1c120c'; ctx.fillRect(px + 70, py + 560, 160, 120);
    const fire = ctx.createRadialGradient(px + 150, py + 650, 5, px + 150, py + 650, 120);
    fire.addColorStop(0, 'rgba(255,200,90,1)'); fire.addColorStop(0.5, 'rgba(240,110,40,0.8)'); fire.addColorStop(1, 'rgba(120,30,10,0)');
    ctx.fillStyle = fire; ctx.fillRect(px + 70, py + 560, 160, 120);
    // общий тёплый свет от печки
    const glow = ctx.createRadialGradient(200, 760, 20, 200, 760, 1300);
    glow.addColorStop(0, 'rgba(255,150,70,0.35)'); glow.addColorStop(1, 'rgba(255,150,70,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, 1920, 1080);
    // поднос
    ctx.fillStyle = '#7a4e2c'; ctx.beginPath(); ctx.roundRect(520, 150, 880, 900, 40); ctx.fill();
    ctx.fillStyle = '#8f5d36'; ctx.beginPath(); ctx.roundRect(540, 170, 840, 860, 30); ctx.fill();
    ctx.strokeStyle = 'rgba(60,30,10,0.35)'; ctx.lineWidth = 3;
    for (let k = 0; k < 24; k++) { ctx.beginPath(); const y = 190 + k * 35; ctx.moveTo(550, y); ctx.bezierCurveTo(800, y + 10 * Math.sin(k), 1100, y - 10, 1370, y + 5); ctx.stroke(); }
    // кружка какао справа
    ctx.fillStyle = '#c9784a'; ctx.beginPath(); ctx.roundRect(1520, 720, 170, 190, 26); ctx.fill();
    ctx.strokeStyle = '#24170f'; ctx.lineWidth = 6; ctx.stroke();
    ctx.beginPath(); ctx.arc(1700, 810, 44, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    ctx.fillStyle = '#5a321c'; ctx.beginPath(); ctx.ellipse(1605, 728, 78, 16, 0, 0, Math.PI * 2); ctx.fill();
    this.textures.addImage('dots_bg', c);

    const p = makeCanvas(780, 780); const pc = p.getContext('2d');
    pc.fillStyle = '#f7f3ea'; pc.beginPath(); pc.roundRect(0, 0, 780, 780, 12); pc.fill();
    pc.strokeStyle = 'rgba(80,130,200,0.2)'; pc.lineWidth = 1.5;
    for (let x = 15; x < 780; x += 35) { pc.beginPath(); pc.moveTo(x, 0); pc.lineTo(x, 780); pc.stroke(); pc.beginPath(); pc.moveTo(0, x); pc.lineTo(780, x); pc.stroke(); }
    this.textures.addImage('dots_paper', p);
  }

  makeWorld() {
    this.world.add(this.add.image(960, 540, 'dots_bg'));
    // искры из печки и пар над кружкой
    const n = Quality.particles;
    this.sparks = this.add.particles(0, 0, 'fx_dust', {
      x: { min: 120, max: 260 }, y: 790, lifespan: 1800, speedY: { min: -90, max: -40 }, speedX: { min: -20, max: 20 },
      scale: { start: 0.9, end: 0 }, tint: 0xffa040, blendMode: 'ADD', frequency: Math.round(260 / n), quantity: 1,
    });
    this.steam = this.add.particles(0, 0, 'fx_glow', {
      x: { min: 1570, max: 1640 }, y: 720, lifespan: 2600, speedY: { min: -50, max: -30 }, speedX: { min: -8, max: 8 },
      scale: { start: 0.12, end: 0.5 }, alpha: { start: 0.22, end: 0 }, frequency: Math.round(320 / n), quantity: 1,
    });
    this.fireGlow = this.add.image(190, 770, 'fx_glow').setScale(4).setTint(0xff8a3a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.25);
    this.tweens.add({ targets: this.fireGlow, alpha: { from: 0.18, to: 0.32 }, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.world.add([this.fireGlow, this.sparks, this.steam]);
  }

  dotPos(c, r) { return { x: this.ORIGIN.x + c * this.STEP, y: this.ORIGIN.y + r * this.STEP }; }

  drawDots() {
    const g = this.dotG; g.clear();
    const R = this.big ? 10 : 13;
    for (let r = 0; r < this.G.DOTS; r++) for (let c = 0; c < this.G.DOTS; c++) {
      const { x, y } = this.dotPos(c, r);
      g.fillStyle(0x24170f, 1).fillCircle(x, y, R);
      g.fillStyle(0xffffff, 0.35).fillCircle(x - R * 0.3, y - R * 0.3, R * 0.3);
    }
  }

  makeZones() {
    this.zones = [];
    const along = this.STEP - 46; const thick = Math.min(96, Math.round(this.STEP * 0.56));
    for (let e = 0; e < this.G.EDGES; e++) {
      const gm = this.G.edgeGeom(e);
      const a = this.dotPos(...gm.a); const b = this.dotPos(...gm.b);
      const cx = (a.x + b.x) / 2; const cy = (a.y + b.y) / 2;
      const z = this.add.zone(cx, cy, gm.horiz ? along : thick, gm.horiz ? thick : along).setInteractive({ useHandCursor: true });
      z.on('pointerover', () => this.hover(e));
      z.on('pointerout', () => this.hover(-1));
      z.on('pointerdown', () => this.boyMove(e));
      this.root.add(z);
      this.zones.push(z);
    }
  }

  hover(e) {
    const g = this.hoverG; g.clear();
    if (e < 0 || this.busy || this.st.turn !== 'boy' || this.st.edges[e]) return;
    const gm = this.G.edgeGeom(e); const a = this.dotPos(...gm.a); const b = this.dotPos(...gm.b);
    const risky = this.G.isUnsafe(this.st, e);
    g.lineStyle(this.big ? 8 : 10, risky ? 0xe0574f : BOY, 0.3).lineBetween(a.x, a.y, b.x, b.y);
  }

  // Линия карандашом: основная + «дрожащая» вторая.
  pencilLine(g, a, b, color, p = 1) {
    const x2 = a.x + (b.x - a.x) * p; const y2 = a.y + (b.y - a.y) * p;
    g.lineStyle(this.big ? 9 : 11, color, 0.95).lineBetween(a.x, a.y, x2, y2);
    g.lineStyle(3, 0xffffff, 0.25).lineBetween(a.x + 2, a.y - 2, x2 + 2, y2 - 2);
  }

  redraw(anim = null) {
    const g = this.lineG; g.clear();
    this.st.edges.forEach((who, e) => {
      if (!who) return;
      const gm = this.G.edgeGeom(e); const a = this.dotPos(...gm.a); const b = this.dotPos(...gm.b);
      this.pencilLine(g, a, b, who === 'boy' ? BOY : SPIDER, anim && anim.e === e ? anim.p : 1);
    });
    const bg = this.boxG; bg.clear();
    const S = this.STEP; const k = this.k; const B = this.G.B;
    this.st.boxes.forEach((who, i) => {
      if (!who) return;
      const c = i % B; const r = Math.floor(i / B);
      const { x, y } = this.dotPos(c, r);
      const col = who === 'boy' ? BOY : SPIDER;
      const inset = Math.round(8 * k);
      bg.fillStyle(col, 0.14).fillRect(x + inset, y + inset, S - inset * 2, S - inset * 2);
      const cx = x + S / 2; const cy = y + S / 2;
      if (who === 'boy') { // солнышко
        bg.fillStyle(0xf2a65a, 1).fillCircle(cx, cy, 30 * k);
        bg.lineStyle(Math.max(4, 6 * k), 0xf2a65a, 1);
        for (let j = 0; j < 8; j++) { const ang = (j / 8) * Math.PI * 2; bg.lineBetween(cx + Math.cos(ang) * 42 * k, cy + Math.sin(ang) * 42 * k, cx + Math.cos(ang) * 60 * k, cy + Math.sin(ang) * 60 * k); }
      } else { // паутинка
        bg.lineStyle(Math.max(2, 3 * k), SPIDER, 0.85);
        for (let j = 0; j < 8; j++) { const ang = (j / 8) * Math.PI * 2; bg.lineBetween(cx, cy, cx + Math.cos(ang) * 62 * k, cy + Math.sin(ang) * 62 * k); }
        for (const rr of [22, 40, 58]) bg.strokeCircle(cx, cy, rr * k);
      }
    });
  }

  animateLine(e) {
    const holder = { p: 0 };
    Audio.play('pencil', { volume: 0.5 });
    return new Promise((res) => this.tweens.add({
      targets: holder, p: 1, duration: this.reduced ? 1 : 220, ease: 'Sine.easeOut',
      onUpdate: () => this.redraw({ e, p: holder.p }), onComplete: () => { this.redraw(); this.crumbs(e); res(); },
    }));
  }

  // Графитовые крошки у конца линии и смазанный след ладони — бумага «живёт», как настоящая тетрадь.
  crumbs(e) {
    if (!this.crumbG) {
      this.crumbG = this.add.graphics();
      this.root.addAt(this.crumbG, Math.max(0, this.root.getIndex(this.lineG)));
      // следы ластика от прошлых партий: серые затёртые пятна и скатанные «червячки» резинки
      const B = this.G.B;
      for (let k = 0; k < 4; k++) {
        const p = this.dotPos(Math.floor(Math.random() * (B + 1)), Math.floor(Math.random() * (B + 1)));
        const lo = this.dotPos(0, 0); const hi = this.dotPos(B, B);
        const x = Phaser.Math.Clamp(p.x + (Math.random() - 0.5) * this.STEP, lo.x + 30, hi.x - 30);
        const y = Phaser.Math.Clamp(p.y + (Math.random() - 0.5) * this.STEP, lo.y + 30, hi.y - 40);
        this.smudge(x, y, 0x8a90a0, 0.05, 46 + Math.random() * 30);
        for (let j = 0; j < 3; j++) {
          const ex = x + (Math.random() - 0.5) * 50; const ey = y + 14 + Math.random() * 22;
          this.crumbG.fillStyle(0xc9b6b0, 0.9).fillEllipse(ex, ey, 9 + Math.random() * 7, 3.2);
          this.crumbG.fillStyle(0x7a6a66, 0.35).fillEllipse(ex + 1, ey + 1.4, 9, 1.4);
        }
      }
    }
    const gm = this.G.edgeGeom(e); const a = this.dotPos(...gm.a); const b = this.dotPos(...gm.b);
    const g = this.crumbG;
    // графитовые крошки — у конца линии, куда карандаш «сходит» с бумаги
    const n = 4 + Math.floor(Math.random() * 4);
    for (let k = 0; k < n; k++) {
      const t = 0.8 + Math.random() * 0.3;
      const x = a.x + (b.x - a.x) * t + (Math.random() - 0.5) * 30; const y = a.y + (b.y - a.y) * t + (Math.random() - 0.5) * 30;
      const r = 1.4 + Math.random() * 2.2;
      g.fillStyle(0x2b2f3a, 0.45 + Math.random() * 0.4);
      if (Math.random() < 0.4) g.fillEllipse(x, y, r * 2.6, r * 1.1); else g.fillCircle(x, y, r);
    }
    // иногда — смазанный ладонью след вдоль линии
    if (Math.random() < 0.35) {
      const t = 0.3 + Math.random() * 0.4;
      this.smudge(a.x + (b.x - a.x) * t + 12, a.y + (b.y - a.y) * t + 14, 0x3a3f4c, 0.05, 38);
    }
  }

  smudge(x, y, color, alpha, r) {
    const g = this.crumbG;
    for (let k = 0; k < 7; k++) {
      g.fillStyle(color, alpha).fillEllipse(x + (Math.random() - 0.5) * r * 0.6, y + (Math.random() - 0.5) * r * 0.3, r * (0.8 + Math.random() * 0.6), r * (0.35 + Math.random() * 0.25));
    }
  }

  updateScore() { this.setScore(this.st.score.boy, this.st.score.spider); }

  boyTurn() {
    if (this.finished) return;
    this.busy = false;
    this.setStatus('Твой ход: проведи линию', 'boy');
  }

  boxCenter(b) { const B = this.G.B; const { x, y } = this.dotPos(b % B, Math.floor(b / B)); return { x: x + this.STEP / 2, y: y + this.STEP / 2 }; }

  async boyMove(e) {
    if (this.busy || this.finished || this.st.turn !== 'boy' || this.st.edges[e]) return;
    this.busy = true;
    this.hoverG.clear(); this.hintG?.destroy(); this.hintG = null;
    const risky = this.G.isUnsafe(this.st, e);
    GameState.stats.moves += 1;
    const res = this.G.play(this.st, e, 'boy');
    await this.animateLine(e);
    if (res.closed.length) {
      res.closed.forEach((b) => { const p = this.boxCenter(b); this.burst(p.x, p.y, 0xffd27a, 14); });
      Audio.play('chime', { volume: 0.4 });
      const p = this.boxCenter(res.closed[0]);
      this.maxChain = Math.max(this.maxChain || 0, res.closed.length);
      this.goodMove(p.x, p.y - 60, 14 * res.closed.length, res.closed.length > 1 ? `+${res.closed.length} клетки` : '+1 клетка');
      this.updateScore(); this.bumpScore();
      if (Math.random() < 0.35) this.quip('S37');
      if (this.G.isOver(this.st)) { await this.endGame(); return; }
      this.setStatus('Клетка твоя, ходи ещё', 'good');
      this.busy = false;
      return;
    }
    if (risky) { this.badMove(); this.quip('S39', { chance: 0.7 }); } else if (this.freeSafeCount() <= 3) GameState.addCourage(6);
    this.drawCourage();
    if (this.G.isOver(this.st)) { await this.endGame(); return; }
    this.spiderTurn();
  }

  freeSafeCount() { let n = 0; for (let e = 0; e < this.G.EDGES; e++) if (!this.st.edges[e] && !this.G.isUnsafe(this.st, e)) n++; return n; }

  async spiderTurn() {
    let chain = 0;
    while (!this.finished && this.st.turn === 'spider' && !this.G.isOver(this.st)) {
      this.setStatus('Паук думает…', 'spider');
      this.spiderThink(true);
      // в длинной цепочке на большом поле паук «тянет нитку» быстрее
      const extra = chain ? (this.big && chain >= 2 ? -380 : -250) : 150;
      await sleep(this, Phaser.Math.Between(SPIDER_THINK_MS.min, SPIDER_THINK_MS.max) + extra);
      if (this.finished) return;
      this.spiderThink(false);
      const e = this.G.chooseDotsMove(this.st, this.difficulty);
      const res = this.G.play(this.st, e, 'spider');
      await this.animateLine(e);
      if (res.closed.length) {
        chain += res.closed.length;
        res.closed.forEach((b) => { const p = this.boxCenter(b); this.burst(p.x, p.y, 0xc080ff, 10); });
        Audio.play('web', { volume: 0.35 });
        this.updateScore(); this.bumpScore();
        if (chain === 1) this.quip('S36', { chance: 0.6 });
      }
    }
    if (chain >= 3) { this.spiderLaugh(800); this.quip('S38', { force: true }); }
    if (this.finished) return;
    if (this.G.isOver(this.st)) { await this.endGame(); return; }
    this.boyTurn();
  }

  highlightData() { return { boy: this.st.score.boy, spider: this.st.score.spider, chain: this.maxChain || 0, big: this.big }; }

  async endGame() {
    this.busy = true;
    const w = this.G.winner(this.st);
    const result = w === 'boy' ? 'win' : 'loss';
    this.setStatus(result === 'win' ? `Победа: ${count(this.st.score.boy, 'клетка', 'клетки', 'клеток')} против ${this.st.score.spider}` : `Паук захватил больше: ${this.st.score.spider} против ${this.st.score.boy}`, result === 'win' ? 'good' : 'bad');
    Audio.play(result === 'win' ? 'win' : 'lose', { volume: 0.65 });
    if (result === 'win') this.burst(960, 590, 0xffd27a, 40); else this.spiderLaugh(1200);
    await sleep(this, 2200);
    this.finish(result);
  }

  computeHint() { return this.st.turn === 'boy' && !this.G.isOver(this.st) ? this.G.hintDotsMove(this.st) : null; }

  showHint(e) {
    const gm = this.G.edgeGeom(e); const a = this.dotPos(...gm.a); const b = this.dotPos(...gm.b);
    this.hintG?.destroy();
    const g = this.add.graphics().setDepth(5);
    g.lineStyle(this.big ? 13 : 16, 0xffd27a, 0.8).lineBetween(a.x, a.y, b.x, b.y);
    this.tweens.add({ targets: g, alpha: { from: 1, to: 0.3 }, duration: 450, yoyo: true, repeat: -1 });
    this.hintG = g;
    this.setStatus('Мамин совет: вот хорошая линия', 'good');
  }
}
