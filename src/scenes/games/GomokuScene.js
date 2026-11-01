// «Вторая зима», день 1 — «Пять в ряд» (гомоку): крестики-нолики «для взрослых» на целом листе в клетку.
// Мальчик — крестики синей шариковой ручкой (ходит первым), Тихон — нолики серебряной ниткой.
// Пять и больше своих знаков в ряд по горизонтали, вертикали или диагонали — победа.
// Если лист заполнился, а пяти в ряд ни у кого нет, — ничья: берём новый лист и играем снова.
import * as Phaser from 'phaser';
import { COLORS } from '../../config/theme.js';
import { SPIDER_THINK_MS } from '../../config/game.js';
import { MiniGameBase, sleep } from './MiniGameBase.js';
import { GOMOKU_N, createGomoku, play, chooseGomokuMove, hintGomokuMove, threatsAt, cellValue, candidates } from '../../ai/gomoku.js';
import { Audio } from '../../systems/audio.js';
import { GameState } from '../../state.js';
import { makeCanvas, rng as seeded } from '../../systems/paint.js';

const N = GOMOKU_N;
const CELL = 58;
const GRID = CELL * N; // 754
const PAPER = 840;
const BOARD = { x: 940, y: 604 };
const LEFT = BOARD.x - GRID / 2; const TOP = BOARD.y - GRID / 2;
const PEN = 0x2a4a8a; // синяя шариковая ручка
const THREAD = 0x77819a; const THREAD_HI = 0xf4f7fb; // серебряная нитка: серая с белым бликом
const MARKER = 0xffe07a; // жёлтый маркер под последним ходом паука

export class GomokuScene extends MiniGameBase {
  constructor() { super('Gomoku'); }

  init(data) {
    super.init(data);
    this.sheet = 0;
    this.draws = 0;
    this.boyMoves = 0;
    this.blocks = 0;
    this.fours = 0;
    this.focusCell = -1;
    this.saidOpen3 = false;
  }

  create() {
    this.makeTextures();
    this.setupFrame({
      title: 'Пять в ряд',
      rules: [
        'Ты ставишь крестики синей ручкой и ходишь первым. Паук ставит нолики серебряной ниткой.',
        'Кто первым выстроит пять своих знаков подряд — по горизонтали, вертикали или диагонали, — тот и выиграл.',
        'Следи за ноликами: четыре в ряд закрывай сразу, а открытую тройку (с пустыми клетками по обе стороны) — лучше заранее.',
        'Последний ход паука подсвечен жёлтым маркером.',
        'Если лист заполнится, а пяти в ряд ни у кого нет, — ничья, берём новый лист.',
        'Мышь или палец: нажми на клетку. Клавиатура: стрелки и Enter. Мамин совет показывает хорошую клетку.',
      ],
      ambient: [{ key: 'clock', volume: 0.12 }],
      music: 'mus_game',
      spider: { x: 1660, y: 250, scale: 0.6 },
      subtitles: { x: 1660, bottom: 900, width: 420 }, // справа под пауком, лист свободен
      hint: { label: 'Мамин\nсовет' },
    });
    this.makeWorld();
    this.paper = this.add.image(BOARD.x, BOARD.y, 'gm_paper');
    this.markerG = this.add.graphics();
    this.hoverG = this.add.graphics();
    this.marks = this.add.graphics();
    this.lineG = this.add.graphics();
    this.fxG = this.add.graphics();
    this.root.add([this.paper, this.markerG, this.hoverG, this.marks, this.lineG, this.fxG]);

    this.zone = this.add.zone(BOARD.x, BOARD.y, GRID, GRID).setInteractive({ useHandCursor: true });
    this.zone.on('pointermove', (p) => { this.focusCell = -1; this.drawHover(this.cellAt(p)); });
    this.zone.on('pointerout', () => this.drawHover(-1));
    this.zone.on('pointerdown', (p) => { const i = this.cellAt(p); if (i >= 0) this.boyMove(i); });
    this.root.add(this.zone);

    const kb = this.input.keyboard;
    this.onKey = (e) => {
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.code];
      if (d) {
        e.preventDefault?.();
        if (this.focusCell < 0) this.focusCell = Math.floor((N * N) / 2);
        else {
          const c = (this.focusCell % N + d[0] + N) % N; const r = (Math.floor(this.focusCell / N) + d[1] + N) % N;
          this.focusCell = r * N + c;
        }
        this.drawHover(this.focusCell, true);
      } else if ((e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') && this.focusCell >= 0) {
        this.boyMove(this.focusCell);
      }
    };
    kb.on('keydown', this.onKey);
    this.events.once('shutdown', () => kb.off('keydown', this.onKey));

    this.newSheet(true);
    this.time.delayedCall(700, () => this.boyTurn());
  }

  // ---------- текстуры ----------

  makeTextures() {
    if (this.textures.exists('gm_bg')) return;
    const c = makeCanvas(1920, 1080); const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 1080);
    g.addColorStop(0, '#141e38'); g.addColorStop(1, '#1d2e55');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1920, 1080);
    // стёганое одеяло: «надутые» ромбы, ложбинки швов и пунктир стёжки
    const D = 150;
    for (let y = -D; y < 1080 + D; y += D) for (let x = -D; x < 1920 + D; x += D) {
      for (const [ox, oy] of [[0, 0], [D / 2, D / 2]]) {
        const cx = x + ox; const cy = y + oy;
        const rg = ctx.createRadialGradient(cx - 8, cy - 14, 4, cx, cy, D * 0.6);
        rg.addColorStop(0, 'rgba(150,178,240,0.16)'); rg.addColorStop(1, 'rgba(0,0,20,0.12)');
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.moveTo(cx, cy - D / 2); ctx.lineTo(cx + D / 2, cy); ctx.lineTo(cx, cy + D / 2); ctx.lineTo(cx - D / 2, cy); ctx.closePath(); ctx.fill();
      }
    }
    const seams = (dash) => {
      for (let j = -16; j < 30; j++) {
        const v = (j + 0.5) * D;
        ctx.beginPath(); ctx.moveTo(v, 0); ctx.lineTo(v + 1080, 1080); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(v, 0); ctx.lineTo(v - 1080, 1080); ctx.stroke();
      }
      ctx.setLineDash(dash);
    };
    ctx.strokeStyle = 'rgba(4,8,24,0.35)'; ctx.lineWidth = 5; seams([]);
    ctx.setLineDash([10, 8]); ctx.strokeStyle = 'rgba(205,220,255,0.24)'; ctx.lineWidth = 2; seams([]);
    // уголок подушки справа сверху
    ctx.save(); ctx.translate(1790, 40); ctx.rotate(-0.14);
    const pg = ctx.createLinearGradient(0, -150, 0, 150);
    pg.addColorStop(0, '#f1ebdf'); pg.addColorStop(1, '#cfc6b5');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.roundRect(-330, -150, 660, 300, 120); ctx.fill();
    ctx.strokeStyle = 'rgba(120,100,80,0.25)'; ctx.lineWidth = 3; ctx.setLineDash([8, 7]);
    ctx.beginPath(); ctx.roundRect(-300, -122, 600, 244, 100); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
    // тёплый свет ночника слева сверху
    const glow = ctx.createRadialGradient(240, 100, 20, 240, 100, 1300);
    glow.addColorStop(0, 'rgba(255,196,120,0.26)'); glow.addColorStop(1, 'rgba(255,196,120,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, 1920, 1080);
    // тень под листом
    ctx.save(); ctx.shadowColor = 'rgba(0,0,10,0.55)'; ctx.shadowBlur = 34; ctx.shadowOffsetY = 14; ctx.shadowOffsetX = 6;
    ctx.fillStyle = '#0d1428'; ctx.fillRect(BOARD.x - PAPER / 2 + 10, BOARD.y - PAPER / 2 + 10, PAPER - 20, PAPER - 20);
    ctx.restore();
    // шариковая ручка справа от листа
    ctx.save(); ctx.translate(1440, 860); ctx.rotate(-1.05);
    ctx.fillStyle = 'rgba(0,0,10,0.35)'; ctx.beginPath(); ctx.roundRect(-150, -6, 300, 26, 13); ctx.fill();
    ctx.fillStyle = '#2f4f8f'; ctx.beginPath(); ctx.roundRect(-150, -16, 270, 26, 12); ctx.fill();
    ctx.fillStyle = '#23396a'; ctx.fillRect(-150, -16, 70, 26);
    ctx.fillStyle = '#c9ccd4'; ctx.beginPath(); ctx.moveTo(120, -14); ctx.lineTo(160, -3); ctx.lineTo(120, 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#9aa1ae'; ctx.fillRect(-140, -22, 64, 6);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-150, -12, 268, 4);
    ctx.restore();
    // катушка серебряной нитки — для ноликов Тихона
    ctx.save(); ctx.translate(1470, 990);
    ctx.fillStyle = 'rgba(0,0,10,0.35)'; ctx.beginPath(); ctx.ellipse(8, 40, 70, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8c5a34'; ctx.beginPath(); ctx.ellipse(0, -34, 58, 16, 0, 0, Math.PI * 2); ctx.fill();
    const tg = ctx.createLinearGradient(-46, 0, 46, 0);
    tg.addColorStop(0, '#8d97aa'); tg.addColorStop(0.45, '#e6ebf3'); tg.addColorStop(1, '#7d879a');
    ctx.fillStyle = tg; ctx.fillRect(-46, -34, 92, 66);
    ctx.strokeStyle = 'rgba(90,100,120,0.35)'; ctx.lineWidth = 1.2;
    for (let y = -30; y < 32; y += 4) { ctx.beginPath(); ctx.moveTo(-46, y); ctx.lineTo(46, y + 2); ctx.stroke(); }
    ctx.fillStyle = '#7a4c2a'; ctx.beginPath(); ctx.ellipse(0, 34, 58, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5a361d'; ctx.beginPath(); ctx.ellipse(0, -34, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    this.textures.addImage('gm_bg', c);

    // лист в клетку: сетка на весь лист, игровое поле 13×13 обведено ручкой
    const p = makeCanvas(PAPER, PAPER); const pc = p.getContext('2d');
    const r = seeded(91);
    const m = (PAPER - GRID) / 2;
    pc.fillStyle = '#f6f1e6';
    pc.beginPath(); pc.moveTo(0, 10);
    for (let x = 0; x <= PAPER; x += 14) pc.lineTo(x, 4 + r() * 7); // верхний край оторван от тетради
    pc.lineTo(PAPER, PAPER - 8); pc.quadraticCurveTo(PAPER, PAPER, PAPER - 8, PAPER); pc.lineTo(8, PAPER); pc.quadraticCurveTo(0, PAPER, 0, PAPER - 8);
    pc.closePath(); pc.fill();
    pc.save(); pc.clip();
    for (let k = 0; k < 900; k++) { pc.fillStyle = `rgba(120,100,70,${0.015 + r() * 0.03})`; pc.fillRect(r() * PAPER, r() * PAPER, 1 + r() * 3, 1); }
    const off = m % CELL;
    pc.strokeStyle = 'rgba(80,130,200,0.16)'; pc.lineWidth = 1.2;
    for (let x = off; x < PAPER; x += CELL) { pc.beginPath(); pc.moveTo(x, 0); pc.lineTo(x, PAPER); pc.stroke(); pc.beginPath(); pc.moveTo(0, x); pc.lineTo(PAPER, x); pc.stroke(); }
    pc.strokeStyle = 'rgba(80,130,200,0.32)'; pc.lineWidth = 1.5;
    for (let k = 1; k < N; k++) {
      pc.beginPath(); pc.moveTo(m + k * CELL, m); pc.lineTo(m + k * CELL, m + GRID); pc.stroke();
      pc.beginPath(); pc.moveTo(m, m + k * CELL); pc.lineTo(m + GRID, m + k * CELL); pc.stroke();
    }
    // рамка поля — от руки, синей ручкой, в два прохода
    for (let pass = 0; pass < 2; pass++) {
      pc.strokeStyle = pass ? 'rgba(42,74,138,0.35)' : 'rgba(42,74,138,0.75)'; pc.lineWidth = pass ? 1.4 : 2.6;
      pc.beginPath();
      const j = () => (r() - 0.5) * 2.4;
      pc.moveTo(m + j(), m + j()); pc.lineTo(m + GRID + j(), m + j()); pc.lineTo(m + GRID + j(), m + GRID + j()); pc.lineTo(m + j(), m + GRID + j()); pc.closePath();
      pc.stroke();
    }
    // затёртые ластиком следы прошлой партии
    for (let k = 0; k < 5; k++) {
      const x = m + r() * GRID; const y = m + r() * GRID;
      pc.fillStyle = 'rgba(140,145,160,0.06)'; pc.beginPath(); pc.ellipse(x, y, 30 + r() * 30, 12 + r() * 10, r() * 3, 0, Math.PI * 2); pc.fill();
    }
    pc.restore();
    this.textures.addImage('gm_paper', p);
  }

  makeWorld() {
    this.world.add(this.add.image(960, 540, 'gm_bg'));
  }

  // ---------- геометрия ----------

  cellCenter(i) { return { x: LEFT + (i % N) * CELL + CELL / 2, y: TOP + Math.floor(i / N) * CELL + CELL / 2 }; }

  cellAt(p) {
    const c = Math.floor((p.worldX - LEFT) / CELL); const r = Math.floor((p.worldY - TOP) / CELL);
    return c >= 0 && r >= 0 && c < N && r < N ? r * N + c : -1;
  }

  // ---------- рисование ----------

  drawHover(i, keyboard = false) {
    const g = this.hoverG; g.clear();
    if (i < 0 || !this.st) return;
    const { x, y } = this.cellCenter(i);
    const free = !this.st.cells[i] && this.st.turn === 'X' && !this.busy && !this.finished;
    if (free) {
      g.fillStyle(PEN, 0.07).fillRect(x - CELL / 2 + 3, y - CELL / 2 + 3, CELL - 6, CELL - 6);
      const a = CELL * 0.27;
      g.lineStyle(3, PEN, 0.28).lineBetween(x - a, y - a, x + a, y + a).lineBetween(x + a, y - a, x - a, y + a);
    }
    if (keyboard) g.lineStyle(3, COLORS.focus, 0.95).strokeRoundedRect(x - CELL / 2 + 2, y - CELL / 2 + 2, CELL - 4, CELL - 4, 8);
  }

  markPoints(kind, i, seed) {
    const { x, y } = this.cellCenter(i);
    const r = seeded(seed);
    if (kind === 'X') {
      const a = CELL * 0.3; const j = () => (r() - 0.5) * 5;
      return [
        [{ x: x - a + j(), y: y - a + j() }, { x: x + j() * 0.3, y: y + j() * 0.3 }, { x: x + a + j(), y: y + a + j() }],
        [{ x: x + a + j(), y: y - a + j() }, { x: x + j() * 0.3, y: y + j() * 0.3 }, { x: x - a + j(), y: y + a + j() }],
      ];
    }
    // нолик ниткой: чуть больше полного витка, с узелком в начале
    const start = r() * Math.PI * 2; const pts = []; const R = CELL * 0.31;
    for (let k = 0; k <= 32; k++) {
      const t = start + (k / 32) * Math.PI * 2.15;
      const rr = R * (1 + (r() - 0.5) * 0.08);
      pts.push({ x: x + Math.cos(t) * rr, y: y + Math.sin(t) * rr * 0.95 });
    }
    return [pts];
  }

  partial(pts, p) {
    if (p >= 1) return pts;
    const n = pts.length - 1; const f = Math.max(0, p) * n; const k = Math.floor(f);
    const out = pts.slice(0, k + 1);
    if (k < n) { const a = pts[k]; const b = pts[k + 1]; const t = f - k; out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }); }
    return out;
  }

  penStroke(g, pts) {
    g.lineStyle(4.2, PEN, 0.95).strokePoints(pts, false);
    g.lineStyle(1.6, PEN, 0.45).strokePoints(pts.map((q) => ({ x: q.x + 1.2, y: q.y + 0.8 })), false);
  }

  threadStroke(g, pts) {
    g.lineStyle(4.6, THREAD, 1).strokePoints(pts, false);
    g.lineStyle(1.5, THREAD_HI, 0.75).strokePoints(pts.map((q) => ({ x: q.x - 0.8, y: q.y - 1 })), false);
  }

  redraw(anim = null) {
    const g = this.marks; g.clear();
    for (const i of this.st.moves) {
      const v = this.st.cells[i];
      const strokes = this.markPoints(v, i, i * 31 + (v === 'X' ? 3 : 11) + this.sheet * 101);
      const p = anim && anim.i === i ? anim.p : 1;
      strokes.forEach((pts, s) => {
        const sp = strokes.length === 2 ? Phaser.Math.Clamp(p * 2 - s, 0, 1) : p;
        if (sp <= 0) return;
        const part = this.partial(pts, sp);
        if (v === 'X') this.penStroke(g, part); else {
          this.threadStroke(g, part);
          g.fillStyle(THREAD, 1).fillCircle(pts[0].x, pts[0].y, 3.2); // узелок
        }
      });
    }
    // жёлтый маркер под последним ноликом
    const mg = this.markerG; mg.clear();
    if (this.lastO >= 0 && this.st.cells[this.lastO] === 'O') {
      const { x, y } = this.cellCenter(this.lastO);
      mg.fillStyle(MARKER, 0.42).fillRect(x - CELL / 2 + 4, y - CELL / 2 + 6, CELL - 8, CELL - 12);
    }
  }

  animateMark(i, who) {
    const holder = { p: 0 };
    if (who === 'X') Audio.play('pencil', { volume: 0.5 }); else Audio.play('web', { volume: 0.3 });
    if (who === 'O' && this.spider && !this.reduced) {
      // серебряная нитка тянется от Тихона к клетке и тает
      const { x, y } = this.cellCenter(i);
      const t = this.add.graphics().setDepth(80);
      t.lineStyle(1.6, THREAD_HI, 0.55).lineBetween(this.spider.x, this.spider.y + 30, x, y);
      this.tweens.add({ targets: t, alpha: 0, duration: 700, onComplete: () => t.destroy() });
    }
    return new Promise((res) => this.tweens.add({
      targets: holder, p: 1, duration: this.reduced ? 1 : who === 'X' ? 240 : 380, ease: 'Sine.easeOut',
      onUpdate: () => this.redraw({ i, p: holder.p }), onComplete: () => { this.redraw(); res(); },
    }));
  }

  drawWinLine(line, who) {
    const a = this.cellCenter(line[0]); const b = this.cellCenter(line[line.length - 1]);
    const dx = b.x - a.x; const dy = b.y - a.y; const len = Math.hypot(dx, dy) || 1;
    const ex = (dx / len) * CELL * 0.4; const ey = (dy / len) * CELL * 0.4;
    const from = { x: a.x - ex, y: a.y - ey }; const to = { x: b.x + ex, y: b.y + ey };
    const holder = { p: 0 };
    return new Promise((res) => this.tweens.add({
      targets: holder, p: 1, duration: this.reduced ? 1 : 520, ease: 'Sine.easeInOut',
      onUpdate: () => {
        const g = this.lineG; g.clear();
        const end = { x: from.x + (to.x - from.x) * holder.p, y: from.y + (to.y - from.y) * holder.p };
        if (who === 'X') { g.lineStyle(7, PEN, 0.9).lineBetween(from.x, from.y, end.x, end.y); g.lineStyle(2, PEN, 0.4).lineBetween(from.x + 2, from.y + 2, end.x + 2, end.y + 2); }
        else { g.lineStyle(7, THREAD, 1).lineBetween(from.x, from.y, end.x, end.y); g.lineStyle(2, THREAD_HI, 0.8).lineBetween(from.x - 1, from.y - 1.5, end.x - 1, end.y - 1.5); }
      },
      onComplete: res,
    }));
  }

  // ---------- ход игры ----------

  newSheet(first = false) {
    this.st = createGomoku(N);
    this.sheet += 1;
    this.lastO = -1;
    this.marks.clear(); this.lineG.clear(); this.markerG.clear(); this.hoverG.clear();
    if (!first) this.setScore(0, 0, `Лист ${this.sheet} · ничьих: ${this.draws}`);
    else this.setScore(0, 0, 'Пять в ряд · лист 13×13');
  }

  boyTurn() {
    if (this.finished) return;
    this.busy = false;
    this.setStatus(this.st.moves.length ? 'Твой ход: ставь крестик' : 'Твой ход: ставь первый крестик', 'boy');
    if (this.focusCell >= 0) this.drawHover(this.focusCell, true);
  }

  // Есть ли у паука клетка, которая сразу даёт ему пять в ряд (т. е. незакрытая четвёрка).
  spiderThreatens() { return candidates(this.st, 1).some((i) => cellValue(this.st, i, 'O').kinds.five); }

  async boyMove(i) {
    if (this.busy || this.finished || this.st.turn !== 'X' || this.st.cells[i] || this.rulesCard) return;
    this.busy = true;
    this.hoverG.clear(); this.hintG?.destroy(); this.hintG = null;
    const blocked = cellValue(this.st, i, 'O').kinds.five; // закрыл четвёрку паука
    const threatened = !blocked && this.spiderThreatens();
    const res = play(this.st, i, 'X');
    if (!res.ok) { this.busy = false; return; }
    GameState.stats.moves += 1; this.boyMoves += 1;
    await this.animateMark(i, 'X');
    if (res.win) { await this.endGame('win', res.line); return; }
    if (res.full) { await this.sheetFull(); return; }
    const t = threatsAt(this.st, i, 'X');
    const p = this.cellCenter(i);
    if (blocked) {
      this.blocks += 1;
      this.goodMove(p.x, p.y - 46, 18, 'Закрыл');
      this.quip('S230', { chance: 0.8, cooldown: 8000 });
    } else if (t.fours) {
      this.fours += 1;
      this.goodMove(p.x, p.y - 46, 16, 'Четвёрка');
    } else if (t.open3) {
      this.goodMove(p.x, p.y - 46, 10, 'Тройка');
      if (!this.saidOpen3) { this.saidOpen3 = true; this.quip('S232', { chance: 0.9 }); }
    } else if (threatened) this.badMove();
    this.drawCourage();
    this.spiderTurn();
  }

  async spiderTurn() {
    if (this.finished) return;
    this.setStatus('Паук думает…', 'spider');
    this.spiderThink(true);
    await sleep(this, Phaser.Math.Between(SPIDER_THINK_MS.min + 150, SPIDER_THINK_MS.max + 350));
    if (this.finished) return;
    this.spiderThink(false);
    const i = chooseGomokuMove(this.st, this.difficulty);
    const res = play(this.st, i, 'O');
    if (!res.ok) { this.boyTurn(); return; }
    this.lastO = i;
    await this.animateMark(i, 'O');
    if (res.win) { await this.endGame('loss', res.line); return; }
    if (res.full) { await this.sheetFull(); return; }
    const t = threatsAt(this.st, i, 'O');
    if (t.fours) { this.spider?.react('smug', 1200); this.quip('S231', { chance: 0.75, cooldown: 7000 }); }
    this.boyTurn();
  }

  async sheetFull() {
    this.busy = true;
    this.draws += 1;
    this.setStatus('Лист кончился, пяти в ряд нет. Ничья — новый лист', 'normal');
    Audio.play('page', { volume: 0.5 });
    await sleep(this, 1500);
    if (this.finished) return;
    await new Promise((r) => this.tweens.add({ targets: [this.marks, this.markerG], alpha: 0, duration: 400, onComplete: r }));
    this.newSheet();
    this.marks.setAlpha(1); this.markerG.setAlpha(1);
    this.boyTurn();
  }

  highlightData() { return { moves: this.boyMoves, blocks: this.blocks, fours: this.fours, draws: this.draws }; }

  async endGame(result, line) {
    this.busy = true;
    this.hoverG.clear();
    await this.drawWinLine(line, result === 'win' ? 'X' : 'O');
    if (result === 'win') {
      this.setStatus('Пять в ряд! Победа', 'good');
      Audio.play('win', { volume: 0.7 });
      this.spider?.react('impressed', 1600);
    } else {
      this.setStatus('Пять ноликов в ряд. Паук выиграл', 'bad');
      Audio.play('lose', { volume: 0.6 });
      this.spiderLaugh(1200);
    }
    await sleep(this, 2400);
    this.finish(result);
  }

  computeHint() {
    if (this.st.turn !== 'X' || this.st.winner) return null;
    const i = hintGomokuMove(this.st);
    return i >= 0 ? i : null;
  }

  showHint(i) {
    const { x, y } = this.cellCenter(i);
    this.hintG?.destroy();
    const g = this.add.graphics().setDepth(5);
    g.lineStyle(5, 0xf2a65a, 0.95).strokeCircle(x, y, CELL * 0.42);
    this.tweens.add({ targets: g, alpha: { from: 1, to: 0.35 }, duration: 450, yoyo: true, repeat: -1 });
    this.hintG = g;
    this.setStatus('Мамин совет: поставь крестик сюда', 'good');
  }
}
