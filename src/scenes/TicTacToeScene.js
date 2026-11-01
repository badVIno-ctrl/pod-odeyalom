// День 1 — крестики-нолики поверх размытой и затемнённой спальни.
// Мальчик — крестики, паук — нолики. Матч до трёх выигранных раундов. В первом раунде первым ходит
// мальчик, дальше по очереди. Ничья — раунд переигрывается (S43 в первый раз, потом S44).
import * as Phaser from 'phaser';
import { COLORS, EASE } from '../config/theme.js';
import { Scoreboard } from '../ui/scoreboard.js';
import { SPIDER_THINK_MS, QUIP, prefersReducedMotion } from '../config/game.js';
import { chooseMove, evaluate, isBestMove } from '../ai/tictactoe.js';
import { voice } from '../systems/voice.js';
import { Audio } from '../systems/audio.js';
import { Music } from '../systems/music.js';
import { Debug } from '../systems/debug.js';
import { SpiderRig } from '../systems/spiderRig.js';
import { GameState } from '../state.js';
import { Haptics } from '../systems/haptics.js';
import { makeCanvas, rng as seeded } from '../systems/paint.js';

const WINS_NEEDED = 3;
const BOARD = { x: 960, y: 548, size: 600, frame: 40 };
const CELL = BOARD.size / 3;
const CHALK = 0xf1eee6;
const CHALK_WARM = 0xf0a56a;
const sleep = (scene, ms) => new Promise((r) => scene.time.delayedCall(ms, r));

export class TicTacToeScene extends Phaser.Scene {
  // key — для наследников (тайная глава «Аня» — те же крестики-нолики тридцать зим назад)
  constructor(key = 'TicTacToe') { super(key); }

  init(data) {
    this.onDone = data.onDone || (() => {});
    this.difficulty = data.difficulty || 'medium';
    this.score = { X: 0, O: 0 };
    this.roundsPlayed = 0;
    this.draws = 0;
    this.board = Array(9).fill(null);
    this.turn = null;
    this.busy = true;
    this.finished = false;
    this.boyMovesSinceQuip = QUIP.minMovesBetween;
    this.focusCell = -1;
    this.spider = null; // сцена переиспользуется Phaser — старая кукла уже уничтожена
    this.roundId = 0;
    this.winsNeeded = WINS_NEEDED;
    this.maxDraws = 0; // > 0 — после стольких ничьих матч кончается ничьей (у наследников)
    // тексты табло и реплики — наследник может подменить
    this.T = {
      score: (x, o) => `Ты ${x} : ${o} Паук`, round: (n) => `Раунд ${n} · до трёх побед`, yourTurn: 'Твой ход: крестики',
      think: 'Паук думает…', matchWin: 'Победа в матче', roundWin: 'Раунд твой', matchLoss: 'Паук выиграл матч',
      roundLoss: 'Раунд паука', draw: 'Ничья, переигрываем',
    };
    this.V = { quipGood: 'S20', quipOk: 'S141', quipBad: 'S23', roundWin: 'S50', roundLoss: 'S51', draw1: 'S43', draw2: 'S44' };
  }

  startMusic() { Music.play('mus_game', { fade: 1500 }); }

  pickMove() { return chooseMove({ board: this.board, player: 'O' }, this.difficulty); }

  create() {
    this.reduced = prefersReducedMotion();
    this.dim = this.add.rectangle(960, 540, 1920, 1080, 0x000000, 0);
    this.tweens.add({ targets: this.dim, fillAlpha: 0.58, duration: 450 });
    this.prevFever = Music.feverK; Music.setFever(this.prevFever * 0.35, 1500);
    this.startMusic();

    this.root = this.add.container(0, 0).setAlpha(0);
    this.makeBoardTexture();
    this.boardImg = this.add.image(BOARD.x, BOARD.y, 'ttt_board');
    this.marks = this.add.graphics();
    this.hover = this.add.graphics();
    this.strike = this.add.graphics();
    this.root.add([this.boardImg, this.hover, this.marks, this.strike]);

    this.scoreboard = new Scoreboard(this, { reduced: this.reduced });
    this.root.add(this.scoreboard.items);
    this.updateScore();

    if (!this.spider) {
      this.spider = new SpiderRig(this, 1585, 150, { scale: 0.7, threadTop: 0 });
      this.spider.setAlpha(0);
      this.tweens.add({ targets: this.spider, alpha: 1, y: 210, duration: 700, ease: 'Sine.easeOut' });
    }

    // Клетки: клик мышью или стрелки + Enter.
    this.cells = [];
    for (let i = 0; i < 9; i++) {
      const { x, y } = this.cellCenter(i);
      const z = this.add.zone(x, y, CELL - 8, CELL - 8).setInteractive({ useHandCursor: true });
      z.on('pointerover', () => this.drawHover(i));
      z.on('pointerout', () => this.drawHover(-1));
      z.on('pointerdown', () => this.boyMove(i));
      this.cells.push(z);
      this.root.add(z);
    }
    const kb = this.input.keyboard;
    this.onKey = (e) => {
      const dir = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }[e.code];
      if (dir !== undefined) {
        e.preventDefault?.();
        if (this.focusCell < 0) this.focusCell = 4;
        else {
          const c = this.focusCell % 3; const r = Math.floor(this.focusCell / 3);
          const nc = dir === -1 ? (c + 2) % 3 : dir === 1 ? (c + 1) % 3 : c;
          const nr = dir === -3 ? (r + 2) % 3 : dir === 3 ? (r + 1) % 3 : r;
          this.focusCell = nr * 3 + nc;
        }
        this.drawHover(this.focusCell, true);
      } else if ((e.code === 'Enter' || e.code === 'NumpadEnter') && this.focusCell >= 0) {
        this.boyMove(this.focusCell);
      }
    };
    kb.on('keydown', this.onKey);
    const offs = [Debug.on('win', () => this.finish('win')), Debug.on('loss', () => this.finish('loss'))];
    this.events.once('shutdown', () => { kb.off('keydown', this.onKey); offs.forEach((f) => f()); });

    this.tweens.add({ targets: this.root, alpha: 1, duration: 500, delay: 150 });
    this.time.delayedCall(700, () => this.startRound());
  }

  // ---------- рисование ----------

  makeBoardTexture() {
    if (this.textures.exists('ttt_board')) return;
    const F = BOARD.frame; const S = BOARD.size + F * 2;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    const rnd = seeded(7);
    // деревянная рамка
    ctx.fillStyle = '#5a3d27';
    ctx.beginPath(); ctx.roundRect(0, 0, S, S, 30); ctx.fill();
    ctx.fillStyle = '#6e4b31';
    ctx.beginPath(); ctx.roundRect(6, 6, S - 12, S - 12, 26); ctx.fill();
    // доска
    const g = ctx.createLinearGradient(0, F, 0, S - F);
    g.addColorStop(0, '#22333a'); g.addColorStop(1, '#1a272e');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(F - 12, F - 12, BOARD.size + 24, BOARD.size + 24, 14); ctx.fill();
    // меловая пыль и разводы
    for (let k = 0; k < 140; k++) {
      ctx.strokeStyle = `rgba(241,238,230,${0.015 + rnd() * 0.03})`;
      ctx.lineWidth = 6 + rnd() * 26;
      const x = F + rnd() * BOARD.size; const y = F + rnd() * BOARD.size;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 40 * rnd(), y - 30 * rnd(), x + 60 + 80 * rnd(), y + 10 * rnd()); ctx.stroke();
    }
    // сетка от руки: каждая линия — несколько неровных штрихов
    const stroke = (x1, y1, x2, y2) => {
      for (let pass = 0; pass < 3; pass++) {
        ctx.strokeStyle = `rgba(241,238,230,${pass === 0 ? 0.75 : 0.28})`;
        ctx.lineWidth = pass === 0 ? 9 : 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        const steps = 8;
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const jx = (rnd() - 0.5) * 5; const jy = (rnd() - 0.5) * 5;
          const x = x1 + (x2 - x1) * t + jx + pass; const y = y1 + (y2 - y1) * t + jy - pass;
          if (s) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
    };
    for (const k of [1, 2]) {
      stroke(F + CELL * k + (rnd() - 0.5) * 8, F + 18, F + CELL * k + (rnd() - 0.5) * 8, F + BOARD.size - 14);
      stroke(F + 16, F + CELL * k + (rnd() - 0.5) * 8, F + BOARD.size - 18, F + CELL * k + (rnd() - 0.5) * 8);
    }
    this.textures.addImage('ttt_board', c);
  }

  cellCenter(i) {
    const left = BOARD.x - BOARD.size / 2; const top = BOARD.y - BOARD.size / 2;
    return { x: left + CELL * (i % 3) + CELL / 2, y: top + CELL * Math.floor(i / 3) + CELL / 2 };
  }

  drawHover(i, keyboard = false) {
    this.hover.clear();
    if (i < 0) return;
    const free = !this.board[i] && this.turn === 'X' && !this.busy;
    const { x, y } = this.cellCenter(i);
    if (free) {
      this.hover.fillStyle(CHALK, 0.07).fillRoundedRect(x - CELL / 2 + 10, y - CELL / 2 + 10, CELL - 20, CELL - 20, 16);
    }
    if (keyboard) {
      this.hover.lineStyle(3, COLORS.focus, 0.9).strokeRoundedRect(x - CELL / 2 + 8, y - CELL / 2 + 8, CELL - 16, CELL - 16, 18);
    }
  }

  // Меловая линия: основной штрих + светлая «крошка» сбоку.
  chalkLine(g, pts, color, width = 13) {
    g.lineStyle(width, color, 0.88).strokePoints(pts, false);
    g.lineStyle(Math.max(3, width * 0.35), 0xffffff, 0.22).strokePoints(pts.map((p) => ({ x: p.x + 2, y: p.y - 2 })), false);
  }

  // Анимированный знак: p от 0 до 1.
  markPoints(kind, i, seed) {
    const { x, y } = this.cellCenter(i);
    const r = seeded(seed);
    if (kind === 'X') {
      const a = 56; const j = () => (r() - 0.5) * 10;
      return [
        [{ x: x - a + j(), y: y - a + j() }, { x: x + j() * 0.3, y: y + j() * 0.3 }, { x: x + a + j(), y: y + a + j() }],
        [{ x: x + a + j(), y: y - a + j() }, { x: x + j() * 0.3, y: y + j() * 0.3 }, { x: x - a + j(), y: y + a + j() }],
      ];
    }
    const start = r() * Math.PI * 2; const pts = []; const R = 60;
    for (let k = 0; k <= 40; k++) {
      const t = start + (k / 40) * Math.PI * 2.12;
      const rr = R * (1 + (r() - 0.5) * 0.06);
      pts.push({ x: x + Math.cos(t) * rr, y: y + Math.sin(t) * rr * 0.94 });
    }
    return [pts];
  }

  partial(pts, p) {
    if (p >= 1) return pts;
    const n = pts.length - 1; const f = p * n; const k = Math.floor(f);
    const out = pts.slice(0, k + 1);
    if (k < n) {
      const a = pts[k]; const b = pts[k + 1]; const t = f - k;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
    return out;
  }

  redrawMarks(anim = null) {
    const g = this.marks;
    g.clear();
    this.board.forEach((v, i) => {
      if (!v) return;
      const strokes = this.markPoints(v, i, i * 31 + (v === 'X' ? 3 : 11) + this.roundsPlayed * 101);
      const color = v === 'X' ? CHALK : CHALK_WARM;
      let p = 1;
      if (anim && anim.i === i) p = anim.p;
      strokes.forEach((pts, s) => {
        const sp = strokes.length === 2 ? Phaser.Math.Clamp(p * 2 - s, 0, 1) : p;
        if (sp > 0) this.chalkLine(g, this.partial(pts, sp), color);
      });
    });
  }

  placeMark(i, who) {
    this.board[i] = who;
    Audio.play('move', { volume: 0.8, rate: who === 'X' ? 1 : 0.92 });
    const holder = { p: 0 };
    return new Promise((resolve) => {
      this.tweens.add({
        targets: holder, p: 1, duration: this.reduced ? 1 : 300, ease: 'Sine.easeOut',
        onUpdate: () => this.redrawMarks({ i, p: holder.p }),
        onComplete: () => { this.redrawMarks(); resolve(); },
      });
    });
  }

  drawStrike(line, who) {
    const a = this.cellCenter(line[0]); const b = this.cellCenter(line[2]);
    const dx = b.x - a.x; const dy = b.y - a.y; const len = Math.hypot(dx, dy); const ux = dx / len; const uy = dy / len;
    const p0 = { x: a.x - ux * 70, y: a.y - uy * 70 }; const p1 = { x: b.x + ux * 70, y: b.y + uy * 70 };
    const holder = { p: 0 };
    const color = who === 'X' ? CHALK : CHALK_WARM;
    return new Promise((resolve) => {
      this.tweens.add({
        targets: holder, p: 1, duration: this.reduced ? 1 : 380, ease: 'Sine.easeInOut',
        onUpdate: () => {
          this.strike.clear();
          this.chalkLine(this.strike, [p0, { x: p0.x + (p1.x - p0.x) * holder.p, y: p0.y + (p1.y - p0.y) * holder.p }], color, 15);
        },
        onComplete: resolve,
      });
    });
  }

  updateScore() {
    this.scoreboard.setScore(this.T.score(this.score.X, this.score.O));
  }

  setStatus(str, tone = 'normal') { this.scoreboard.setStatus(str, tone); }

  // ---------- ход партии ----------

  startRound() {
    if (this.finished) return;
    this.board.fill(null);
    this.marks.clear(); this.strike.clear(); this.hover.clear();
    const starter = this.roundsPlayed % 2 === 0 ? 'X' : 'O';
    const n = this.score.X + this.score.O + 1;
    this.roundId += 1;
    const id = this.roundId;
    this.setStatus(this.T.round(n));
    this.time.delayedCall(700, () => {
      if (this.finished || id !== this.roundId) return;
      if (starter === 'X') this.boyTurn(); else this.spiderTurn();
    });
  }

  boyTurn() {
    this.turn = 'X';
    this.busy = false;
    this.turnStarted = this.time.now;
    this.setStatus(this.T.yourTurn, 'boy');
    if (this.focusCell >= 0) this.drawHover(this.focusCell, true);
  }

  async boyMove(i) {
    if (this.busy || this.finished || this.turn !== 'X' || this.board[i]) return;
    this.busy = true;
    const before = this.board.slice();
    const thinkMs = this.time.now - this.turnStarted;
    this.hover.clear();
    await this.placeMark(i, 'X');
    if (this.finished) return;
    if (await this.checkEnd()) return;
    this.boyMovesSinceQuip += 1;
    // Тихон реагирует на качество хода: сильный ход — «ого», слабый — хитрый прищур
    const best = isBestMove(before, i, 'X');
    this.spider.react(best ? (thinkMs < 2500 ? 'impressed' : 'puzzled') : 'smug', 1300);
    Haptics.tap();
    if (this.boyMovesSinceQuip >= QUIP.minMovesBetween && Math.random() < QUIP.chance) {
      this.boyMovesSinceQuip = 0;
      voice.play(best && thinkMs < 6000 ? this.V.quipGood : best ? this.V.quipOk : this.V.quipBad);
    }
    this.spiderTurn();
  }

  async spiderTurn() {
    if (this.finished) return;
    this.turn = 'O';
    this.busy = true;
    this.setStatus(this.T.think, 'spider');
    this.spider.setMode('think');
    const wait = Phaser.Math.Between(SPIDER_THINK_MS.min, SPIDER_THINK_MS.max);
    await sleep(this, wait);
    if (this.finished) return;
    this.spider.setMode('idle');
    const i = this.pickMove();
    if (i === null || i === undefined) { await this.checkEnd(); return; }
    await this.placeMark(i, 'O');
    if (this.finished) return;
    if (await this.checkEnd()) return;
    this.boyTurn();
  }

  // true — раунд закончился (дальше управляет сама функция).
  async checkEnd() {
    const { winner, line } = evaluate(this.board);
    const full = this.board.every(Boolean);
    if (!winner && !full) return false;
    this.busy = true;
    this.turn = null;
    this.roundsPlayed += 1;
    if (winner && winner !== 'draw') {
      await this.drawStrike(line, winner);
      this.score[winner] += 1;
      this.updateScore();
      this.scoreboard.bump();
      const matchOver = this.score[winner] >= this.winsNeeded;
      if (winner === 'X') {
        Audio.play(matchOver ? 'win' : 'chime', { volume: matchOver ? 0.7 : 0.45 });
        this.setStatus(matchOver ? this.T.matchWin : this.T.roundWin, 'good');
        if (!matchOver) await voice.play(this.V.roundWin);
      } else {
        this.setStatus(matchOver ? this.T.matchLoss : this.T.roundLoss, 'bad');
        if (matchOver) Audio.play('lose', { volume: 0.7 });
        Audio.play('spider_laugh', { volume: 0.5 });
        this.spider.laugh(900);
        if (!matchOver) await voice.play(this.V.roundLoss);
      }
      if (this.finished) return true;
      if (matchOver) { await sleep(this, 900); this.finish(winner === 'X' ? 'win' : 'loss'); return true; }
    } else {
      this.draws += 1;
      this.setStatus(this.T.draw);
      await voice.play(this.draws === 1 ? this.V.draw1 : this.V.draw2);
      if (this.finished) return true;
      if (this.maxDraws && this.draws >= this.maxDraws) { await sleep(this, 600); this.finish('draw'); return true; }
    }
    await sleep(this, 350);
    this.wipeBoard().then(() => this.startRound());
    return true;
  }

  wipeBoard() {
    return new Promise((resolve) => {
      this.tweens.add({
        targets: [this.marks, this.strike], alpha: 0, duration: this.reduced ? 1 : 380, ease: 'Sine.easeIn',
        onComplete: () => {
          this.marks.clear(); this.strike.clear();
          this.marks.setAlpha(1); this.strike.setAlpha(1);
          resolve();
        },
      });
    });
  }

  finish(result) {
    if (this.finished) return;
    this.finished = true;
    this.busy = true;
    Music.setFever(this.prevFever || 0, 2500);
    GameState.addHighlight({ day: 1, game: 'TicTacToe', result, score: { ...this.score }, draws: this.draws || 0, rounds: this.roundsPlayed || 0 });
    this.spider.setMode('idle');
    this.tweens.add({ targets: [this.root, this.spider], alpha: 0, duration: 450 });
    this.tweens.add({
      targets: this.dim, fillAlpha: 0, duration: 500,
      onComplete: () => {
        const done = this.onDone;
        this.scene.stop();
        done(result);
      },
    });
  }
}
