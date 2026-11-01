// День 5 — «Шашки». Финальная битва: лампа над доской, за окном метель, стучит сердце.
// Правила русских шашек как в проекте пользователя online-heckers-main: мальчик — светлые, ходит первым,
// бить обязательно, серия взятий одной шашкой, простая бьёт и назад, дамка ходит и бьёт на любое расстояние.
// Ничья (в исходнике её нет — добавлены стандартные правила, см. ai/checkersDraw.js) — партия переигрывается.
import * as Phaser from 'phaser';
import { COLORS, CSS } from '../../config/theme.js';
import { MiniGameBase, sleep } from './MiniGameBase.js';
import {
  SIZE, createInitialBoard, getLegalMovesState, applyMoveState, chooseMove, chooseFollowUpCapture, getBestMoveBasic, countPieces, cloneBoard,
} from '../../ai/checkers.js';
import { chooseGiveawayMove, hintGiveawayMove } from '../../ai/giveaway.js';
import { DrawTracker } from '../../ai/checkersDraw.js';
import { Audio } from '../../systems/audio.js';
import { GameState } from '../../state.js';
import { makeCanvas, rng as seeded } from '../../systems/paint.js';
import { Quality } from '../../systems/quality.js';

const CELL = 104;
const BOARD = { x: 960, y: 604 };
const LEFT = BOARD.x - (CELL * SIZE) / 2; const TOP = BOARD.y - (CELL * SIZE) / 2;
const sameSq = (a, r, c) => a && a.row === r && a.col === c;

export class CheckersScene extends MiniGameBase {
  constructor() { super('Checkers'); }

  init(data) {
    super.init(data);
    this.draws = 0;
    this.aiMoveCount = 0;
    this.reqId = 0;
    this.giveaway = !!(data.variant && data.variant.giveaway); // «Вторая зима»: поддавки
  }

  create() {
    this.makeTextures();
    this.setupFrame({
      title: this.giveaway ? 'Поддавки' : 'Шашки',
      rules: this.giveaway ? [
        'Ты играешь светлыми и ходишь первым. Шашки ходят как обычно: по диагонали вперёд на одну клетку.',
        'Бить обязательно, и серию взятий тоже. В поддавках это главное: подставляй свои шашки под удар.',
        'Выигрывает тот, кто первым отдаст все свои шашки или останется без ходов.',
        'Дамка в поддавках — обуза: она бьёт далеко, и отдать её трудно.',
        'Ничья (позиция повторилась 3 раза или 15 ходов подряд ходили только дамки без взятий): партия переигрывается.',
        'Мамин совет подсказывает ход, который поможет проиграть… то есть выиграть.',
      ] : [
        'Ты играешь светлыми и ходишь первым. Шашки ходят по диагонали вперёд на одну клетку.',
        'Бить обязательно. Если той же шашкой можно бить дальше, продолжай серию взятий. Простая шашка бьёт и назад.',
        'Шашка, которая дошла до последнего ряда, становится дамкой: ходит и бьёт на любое число клеток.',
        'Проигрывает тот, у кого не осталось шашек или ходов.',
        'Ничья (позиция повторилась 3 раза или 15 ходов подряд ходили только дамки без взятий): партия переигрывается.',
        'Мамин совет подсказывает хороший ход.',
      ],
      // ночной фон без ударов и шорохов (сердцебиение с пургой звучали как шаги по снегу)
      ambient: [{ key: 'clock', volume: 0.12 }],
      music: this.giveaway ? 'mus_game' : 'mus_game_tense', // последняя, решающая партия (поддавки — смешнее)
      spider: { x: 1640, y: 250, scale: 0.72 },
      subtitles: { x: 1650, bottom: 940, width: 440 }, // справа у окна, доска свободна
      hint: { label: 'Мамин\nсовет' },
    });
    this.courageBox.setPosition(68, 1000);
    this.makeWorld();
    this.root.add(this.add.image(BOARD.x, BOARD.y, 'ck_board'));
    this.hlG = this.add.graphics();
    this.piecesLayer = this.add.container(0, 0);
    this.fxG = this.add.graphics();
    this.root.add([this.hlG, this.piecesLayer, this.fxG]);
    this.zone = this.add.zone(BOARD.x, BOARD.y, CELL * SIZE, CELL * SIZE).setInteractive({ useHandCursor: true });
    this.zone.on('pointerdown', (p) => this.onTap(p));
    this.root.add(this.zone);
    this.makeWorker();
    this.newGame(true);
  }

  makeTextures() {
    if (this.textures.exists('ck_board')) return;
    const F = 34; const S = CELL * SIZE + F * 2;
    const c = makeCanvas(S, S); const ctx = c.getContext('2d');
    const r = seeded(12);
    ctx.fillStyle = '#4a2c18'; ctx.beginPath(); ctx.roundRect(0, 0, S, S, 22); ctx.fill();
    ctx.fillStyle = '#5e3a20'; ctx.beginPath(); ctx.roundRect(8, 8, S - 16, S - 16, 18); ctx.fill();
    for (let rr = 0; rr < SIZE; rr++) for (let cc = 0; cc < SIZE; cc++) {
      const dark = (rr + cc) % 2 === 1;
      ctx.fillStyle = dark ? '#6b4128' : '#e8cfa4';
      const x = F + cc * CELL; const y = F + rr * CELL;
      ctx.fillRect(x, y, CELL, CELL);
      ctx.strokeStyle = dark ? 'rgba(30,15,5,0.25)' : 'rgba(150,100,50,0.18)'; ctx.lineWidth = 2;
      for (let k = 0; k < 6; k++) { ctx.beginPath(); const yy = y + r() * CELL; ctx.moveTo(x, yy); ctx.bezierCurveTo(x + 30, yy + 6 * (r() - 0.5), x + 70, yy + 6 * (r() - 0.5), x + CELL, yy); ctx.stroke(); }
    }
    ctx.fillStyle = 'rgba(243,235,221,0.6)'; ctx.font = '600 22px Literata, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const L = 'abcdefgh';
    for (let k = 0; k < SIZE; k++) { ctx.fillText(L[k], F + k * CELL + CELL / 2, S - F / 2); ctx.fillText(String(SIZE - k), F / 2, F + k * CELL + CELL / 2); }
    this.textures.addImage('ck_board', c);

    // Шашки — пуговицы из маминой шкатулки: у мальчика перламутровые, пришиты красной ниткой крест-накрест,
    // у паука — тёмные, с серебряной ниткой. Дамка — корона, вышитая золотой ниткой.
    const piece = (key, base, edge, top, thread, sheen) => {
      const p = makeCanvas(110, 110); const pc = p.getContext('2d');
      const ell = (x, y, rx, ry) => { pc.beginPath(); pc.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); };
      pc.fillStyle = 'rgba(0,0,0,0.45)'; ell(55, 64, 44, 40); pc.fill();
      pc.fillStyle = edge; ell(55, 58, 44, 40); pc.fill();
      const g = pc.createRadialGradient(40, 36, 4, 55, 52, 48);
      g.addColorStop(0, top); g.addColorStop(1, base);
      pc.fillStyle = g; ell(55, 50, 44, 40); pc.fill();
      // выпуклый бортик и углубление в середине
      pc.strokeStyle = 'rgba(255,255,255,0.28)'; pc.lineWidth = 3; ell(55, 49, 38, 34); pc.stroke();
      const dish = pc.createRadialGradient(60, 56, 2, 55, 50, 30);
      dish.addColorStop(0, base); dish.addColorStop(1, 'rgba(0,0,0,0.22)');
      pc.fillStyle = dish; ell(55, 50, 29, 26); pc.fill();
      pc.strokeStyle = 'rgba(0,0,0,0.3)'; pc.lineWidth = 2; ell(55, 50, 29, 26); pc.stroke();
      // перламутровый отлив
      pc.save(); ell(55, 50, 44, 40); pc.clip();
      const sh = pc.createLinearGradient(18, 18, 92, 84);
      sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.42, sheen); sh.addColorStop(0.55, 'rgba(255,255,255,0)');
      pc.fillStyle = sh; pc.fillRect(0, 0, 110, 110); pc.restore();
      // четыре дырочки и нитка крест-накрест
      const H = [[45, 41], [65, 41], [45, 59], [65, 59]];
      pc.strokeStyle = 'rgba(0,0,0,0.35)'; pc.lineWidth = 6; pc.lineCap = 'round';
      pc.beginPath(); pc.moveTo(45, 42); pc.lineTo(65, 60); pc.moveTo(65, 42); pc.lineTo(45, 60); pc.stroke();
      pc.strokeStyle = thread; pc.lineWidth = 4.5;
      pc.beginPath(); pc.moveTo(45, 41); pc.lineTo(65, 59); pc.moveTo(65, 41); pc.lineTo(45, 59); pc.stroke();
      pc.strokeStyle = 'rgba(255,255,255,0.45)'; pc.lineWidth = 1.4;
      pc.beginPath(); pc.moveTo(46, 40); pc.lineTo(64, 56); pc.moveTo(64, 40); pc.lineTo(47, 56); pc.stroke();
      for (const [hx, hy] of H) {
        pc.fillStyle = 'rgba(0,0,0,0.55)'; ell(hx, hy, 5, 4.6); pc.fill();
        pc.fillStyle = 'rgba(255,255,255,0.25)'; ell(hx - 1, hy + 1.5, 3, 1.4); pc.fill();
      }
      this.textures.addImage(key, p);
    };
    piece('ck_light', '#e8dcc6', '#a8916f', '#fffdf6', '#c8402e', 'rgba(190,230,255,0.35)');
    piece('ck_dark', '#2a1f33', '#120c18', '#5d4a72', '#dfe6f0', 'rgba(200,170,255,0.25)');
    // корона дамки — вышивка золотой ниткой: стежки по контуру и узелки на зубцах
    const crown = makeCanvas(70, 50); const cc2 = crown.getContext('2d');
    const P = [[8, 42], [11, 13], [24, 28], [35, 6], [46, 28], [59, 13], [62, 42]];
    cc2.lineCap = 'round'; cc2.lineJoin = 'round';
    cc2.strokeStyle = 'rgba(60,35,5,0.55)'; cc2.lineWidth = 6;
    cc2.beginPath(); P.forEach(([x, y], k) => (k ? cc2.lineTo(x, y) : cc2.moveTo(x, y))); cc2.closePath(); cc2.stroke();
    cc2.strokeStyle = '#f2c35a'; cc2.lineWidth = 3.6; cc2.setLineDash([6, 3]);
    cc2.beginPath(); P.forEach(([x, y], k) => (k ? cc2.lineTo(x, y) : cc2.moveTo(x, y))); cc2.closePath(); cc2.stroke();
    cc2.setLineDash([]); cc2.strokeStyle = '#fff1c2'; cc2.lineWidth = 1.2;
    cc2.beginPath(); for (let x = 12; x < 60; x += 7) { cc2.moveTo(x, 40); cc2.lineTo(x + 4, 34); } cc2.stroke();
    for (const [x, y] of [[11, 13], [35, 6], [59, 13]]) { cc2.fillStyle = '#f2c35a'; cc2.beginPath(); cc2.arc(x, y, 4.2, 0, Math.PI * 2); cc2.fill(); cc2.fillStyle = '#fff6d8'; cc2.beginPath(); cc2.arc(x - 1, y - 1, 1.6, 0, Math.PI * 2); cc2.fill(); }
    this.textures.addImage('ck_crown', crown);

    const bg = makeCanvas(1920, 1080); const bctx = bg.getContext('2d');
    bctx.fillStyle = '#07090f'; bctx.fillRect(0, 0, 1920, 1080);
    // окно с метелью справа
    bctx.fillStyle = '#16223c'; bctx.fillRect(1430, 380, 420, 520);
    bctx.strokeStyle = '#3a2618'; bctx.lineWidth = 22; bctx.strokeRect(1430, 380, 420, 520);
    bctx.lineWidth = 12; bctx.beginPath(); bctx.moveTo(1640, 380); bctx.lineTo(1640, 900); bctx.moveTo(1430, 600); bctx.lineTo(1850, 600); bctx.stroke();
    const lamp = bctx.createRadialGradient(960, 520, 40, 960, 600, 760);
    lamp.addColorStop(0, 'rgba(255,214,150,0.30)'); lamp.addColorStop(0.6, 'rgba(255,170,90,0.10)'); lamp.addColorStop(1, 'rgba(0,0,0,0)');
    bctx.fillStyle = lamp; bctx.fillRect(0, 0, 1920, 1080);
    // абажур сверху
    bctx.fillStyle = '#3a2a22'; bctx.beginPath(); bctx.moveTo(880, 0); bctx.lineTo(1040, 0); bctx.lineTo(1090, 70); bctx.lineTo(830, 70); bctx.closePath(); bctx.fill();
    bctx.fillStyle = 'rgba(255,220,160,0.9)'; bctx.beginPath(); bctx.ellipse(960, 72, 130, 12, 0, 0, Math.PI * 2); bctx.fill();
    this.textures.addImage('ck_bg', bg);
  }

  makeWorld() {
    this.world.add(this.add.image(960, 540, 'ck_bg'));
    const n = Quality.particles;
    this.storm = this.add.particles(0, 0, 'fx_snow', {
      x: { min: 1300, max: 1850 }, y: { min: 380, max: 900 }, lifespan: 1400, speedX: { min: -420, max: -260 }, speedY: { min: 40, max: 140 },
      scale: { min: 0.15, max: 0.5 }, alpha: { start: 0.9, end: 0 }, frequency: Math.round(40 / n), quantity: 1,
    });
    this.beam = this.add.image(960, 70, 'fx_glow').setOrigin(0.5, 0.1).setScale(5, 7).setTint(0xffd6a0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.12);
    this.dread = this.add.image(960, 540, 'fx_vignette').setScale(2).setTint(0xb3261e).setAlpha(0);
    this.world.add([this.storm, this.beam, this.dread]);
    this.tweens.add({ targets: this.beam, alpha: { from: 0.1, to: 0.15 }, duration: 1500, yoyo: true, repeat: -1 });
  }

  makeWorker() {
    try {
      this.worker = new Worker(new URL('../../ai/checkers.worker.js', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e) => { const cb = this.pending; if (cb && e.data.id === this.reqId) { this.pending = null; cb(e.data.move); } };
      this.worker.onerror = () => { this.worker = null; };
      this.events.once('shutdown', () => { this.worker?.terminate(); this.worker = null; });
    } catch { this.worker = null; }
  }

  aiSync(payload) {
    return this.giveaway ? chooseGiveawayMove(payload, this.difficulty) : chooseMove({ ...payload, color: 'dark' }, this.difficulty);
  }

  askAI(state) {
    const payload = { board: state.board, moveCount: this.aiMoveCount, forcedPiece: state.forcedPiece, difficulty: this.difficulty, variant: this.giveaway ? 'giveaway' : null };
    if (!this.worker) return Promise.resolve(this.aiSync(payload));
    return new Promise((resolve) => {
      this.reqId += 1;
      this.pending = resolve;
      const id = this.reqId;
      this.worker.postMessage({ id, ...payload });
      // страховка: если воркер молчит 6 с — считаем в основном потоке
      this.time.delayedCall(6000, () => { if (this.pending === resolve && this.reqId === id) { this.pending = null; resolve(this.aiSync(payload)); } });
    });
  }

  // ---------- партия ----------

  newGame(first = false) {
    this.state = { board: createInitialBoard(), color: 'light', forcedPiece: null };
    this.tracker = new DrawTracker();
    this.tracker.push(this.state.board, 'light');
    this.sel = null; this.lastMove = null; this.turnCapture = false; this.turnManMoved = false;
    this.aiMoveCount = 0;
    this.rebuildPieces();
    this.drawHighlights();
    this.updateScore();
    this.time.delayedCall(first ? 700 : 400, () => this.boyTurn());
  }

  sqPos(r, c) { return { x: LEFT + c * CELL + CELL / 2, y: TOP + r * CELL + CELL / 2 }; }

  rebuildPieces() {
    this.piecesLayer.removeAll(true);
    this.sprites = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      const p = this.state.board[r][c]; if (p) this.sprites[r][c] = this.makePiece(p, r, c);
    }
  }

  makePiece(p, r, c) {
    const { x, y } = this.sqPos(r, c);
    const s = this.add.container(x, y);
    s.add(this.add.image(0, 0, p.color === 'light' ? 'ck_light' : 'ck_dark').setScale(0.92));
    if (p.king) s.add(this.add.image(0, -8, 'ck_crown').setScale(0.7));
    this.piecesLayer.add(s);
    return s;
  }

  updateScore() {
    const n = countPieces(this.state.board);
    this.setScore(0, 0, `Шашки: ты ${n.light} · паук ${n.dark}`);
    const mine = this.giveaway ? n.dark : n.light; // в поддавках тревожно, когда шашек мало у паука
    this.dread.setAlpha(mine <= 3 ? 0.35 : mine <= 6 ? 0.15 : 0);
  }

  legal() { return getLegalMovesState(this.state.board, this.state.color, this.state.forcedPiece); }

  drawHighlights() {
    const g = this.hlG; g.clear();
    if (this.lastMove) {
      for (const [r, c] of [[this.lastMove.fromRow, this.lastMove.fromCol], [this.lastMove.toRow, this.lastMove.toCol]]) {
        g.fillStyle(0xffd27a, 0.18).fillRect(LEFT + c * CELL, TOP + r * CELL, CELL, CELL);
      }
    }
    if (this.state.color !== 'light' || this.busy) return;
    const moves = this.legal();
    const mustCapture = moves.some((m) => m.capRow !== undefined);
    // какие шашки могут ходить
    const movers = new Set(moves.map((m) => `${m.fromRow},${m.fromCol}`));
    for (const k of movers) {
      const [r, c] = k.split(',').map(Number);
      const { x, y } = this.sqPos(r, c);
      g.lineStyle(4, mustCapture ? 0xe0574f : 0x7cc47f, sameSq(this.sel, r, c) ? 1 : 0.55).strokeCircle(x, y, 49);
    }
    if (this.sel) {
      const { x, y } = this.sqPos(this.sel.row, this.sel.col);
      g.fillStyle(0xffd27a, 0.25).fillCircle(x, y, 50);
      for (const m of moves.filter((mm) => sameSq(this.sel, mm.fromRow, mm.fromCol))) {
        const t = this.sqPos(m.toRow, m.toCol);
        g.fillStyle(m.capRow !== undefined ? 0xe0574f : 0x7cc47f, 0.75).fillCircle(t.x, t.y, 16);
        g.lineStyle(3, 0xffffff, 0.5).strokeCircle(t.x, t.y, 24);
      }
    }
  }

  boyTurn() {
    if (this.finished) return;
    const moves = this.legal();
    if (!moves.length) { this.endGame(this.giveaway ? 'win' : 'loss'); return; }
    this.busy = false;
    const must = moves.some((m) => m.capRow !== undefined);
    this.setStatus(this.state.forcedPiece ? 'Бей дальше той же шашкой' : must ? 'Твой ход: нужно бить' : 'Твой ход: светлые', must ? 'bad' : 'boy');
    if (this.state.forcedPiece) this.sel = { ...this.state.forcedPiece };
    this.drawHighlights();
  }

  onTap(p) {
    if (this.busy || this.finished || this.state.color !== 'light') return;
    const c = Math.floor((p.worldX - LEFT) / CELL); const r = Math.floor((p.worldY - TOP) / CELL);
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return;
    const moves = this.legal();
    const piece = this.state.board[r][c];
    if (piece && piece.color === 'light') {
      if (this.state.forcedPiece && !sameSq(this.state.forcedPiece, r, c)) { this.setStatus('Продолжай бить той же шашкой', 'bad'); return; }
      if (!moves.some((m) => m.fromRow === r && m.fromCol === c)) {
        const must = moves.some((m) => m.capRow !== undefined);
        this.setStatus(must ? 'Бить обязательно: выбери шашку, которая может бить' : 'Этой шашке некуда ходить', 'bad');
        if (must) this.quip('S47', { cooldown: 12000 });
        const s = this.sprites[r][c]; if (s) this.tweens.add({ targets: s, x: s.x + 8, duration: 50, yoyo: true, repeat: 3 });
        return;
      }
      this.sel = { row: r, col: c };
      Audio.play('tap');
      this.drawHighlights();
      return;
    }
    if (!this.sel) return;
    const mv = moves.find((m) => sameSq(this.sel, m.fromRow, m.fromCol) && m.toRow === r && m.toCol === c);
    if (!mv) { this.setStatus('Так ходить нельзя', 'bad'); return; }
    this.doBoyMove(mv);
  }

  // Анимация хода, взятие, превращение в дамку. → true, если стала дамкой.
  async animateMove(mv) {
    const s = this.sprites[mv.fromRow][mv.fromCol];
    const wasKing = this.state.board[mv.fromRow][mv.fromCol]?.king;
    const color = this.state.board[mv.fromRow][mv.fromCol]?.color;
    const to = this.sqPos(mv.toRow, mv.toCol);
    this.piecesLayer.bringToTop(s);
    await new Promise((res) => this.tweens.add({ targets: s, x: to.x, y: to.y, duration: this.reduced ? 1 : 260, ease: 'Cubic.easeInOut', onComplete: res }));
    Audio.play('wood', { volume: 0.8 });
    this.sprites[mv.toRow][mv.toCol] = s; this.sprites[mv.fromRow][mv.fromCol] = null;
    if (mv.capRow !== undefined) {
      const cap = this.sprites[mv.capRow][mv.capCol];
      this.sprites[mv.capRow][mv.capCol] = null;
      const cp = this.sqPos(mv.capRow, mv.capCol);
      this.burst(cp.x, cp.y, color === 'light' ? 0xffd27a : 0xc080ff, 16);
      if (cap) this.tweens.add({ targets: cap, scale: 0, alpha: 0, angle: 90, duration: 320, onComplete: () => cap.destroy() });
      this.shake(120, 0.003);
    }
    const prev = this.state;
    this.state = applyMoveState(this.state, mv);
    this.turnCapture = this.turnCapture || mv.capRow !== undefined;
    if (!wasKing) this.turnManMoved = true;
    this.lastMove = mv;
    const nowKing = this.state.board[mv.toRow][mv.toCol]?.king;
    if (nowKing && !wasKing) {
      s.add(this.add.image(0, -8, 'ck_crown').setScale(0.7));
      Audio.play('sparkle', { volume: 0.45 });
      this.burst(to.x, to.y, 0xffe08a, 24);
      this.tweens.add({ targets: s, scale: { from: 1.4, to: 1 }, duration: 500, ease: 'Back.easeOut' });
      return { king: true, prev };
    }
    return { king: false, prev };
  }

  async doBoyMove(mv) {
    this.busy = true;
    this.hintG?.destroy(); this.hintG = null;
    GameState.stats.moves += 1;
    const { king } = await this.animateMove(mv);
    this.updateScore();
    if (this.giveaway) {
      // в поддавках срубить — неудача (шашек у паука меньше), а дамка — обуза
      if (mv.capRow !== undefined) { this.badMove(); this.quip('S238', { chance: 0.45, cooldown: 9000 }); }
      if (king) this.setStatus('Дамка… В поддавках это обуза', 'bad');
    } else {
      if (mv.capRow !== undefined) this.goodMove(this.sqPos(mv.toRow, mv.toCol).x, this.sqPos(mv.toRow, mv.toCol).y - 60, 14, 'Срубил');
      if (king) { this.goodMove(960, 300, 20, 'Дамка'); this.quip('S42', { force: true }); }
    }
    if (this.state.color === 'light' && this.state.forcedPiece) { this.sel = { ...this.state.forcedPiece }; this.boyTurn(); return; }
    this.sel = null;
    if (await this.afterTurn('dark')) return;
    this.spiderTurn();
  }

  // Конец полного хода (с серией): проверка ничьей и проигрыша. true — партия закончилась.
  async afterTurn(next) {
    const draw = this.tracker.push(this.state.board, next, { capture: this.turnCapture, manMoved: this.turnManMoved });
    this.turnCapture = false; this.turnManMoved = false;
    const moves = getLegalMovesState(this.state.board, next, null);
    // без ходов (или без шашек): в обычных шашках — проигрыш, в поддавках — победа
    const stuckWins = this.giveaway;
    if (!moves.length) { await this.endGame((next === 'dark') !== stuckWins ? 'win' : 'loss'); return true; }
    if (draw) { await this.drawGame(draw); return true; }
    return false;
  }

  async spiderTurn() {
    if (this.finished) return;
    this.busy = true;
    this.drawHighlights();
    this.setStatus('Паук думает…', 'spider');
    this.spiderThink(true);
    const t0 = this.time.now;
    let mv = await this.askAI(this.state);
    if (this.finished) return;
    const waited = this.time.now - t0;
    if (waited > 2000) this.quip('S48', { chance: 0.5 });
    if (waited < 700) await sleep(this, 700 - waited);
    this.spiderThink(false);
    if (!mv) { await this.endGame(this.giveaway ? 'loss' : 'win'); return; }
    this.aiMoveCount += 1;
    let tookKing = false; let captures = 0;
    for (;;) {
      const { king } = await this.animateMove(mv);
      if (mv.capRow !== undefined) captures += 1;
      if (king) tookKing = true;
      if (this.state.color === 'dark' && this.state.forcedPiece) {
        await sleep(this, 280);
        mv = this.giveaway
          ? chooseGiveawayMove({ board: this.state.board, forcedPiece: this.state.forcedPiece }, this.difficulty)
          : chooseFollowUpCapture(this.state.board, this.state.forcedPiece.row, this.state.forcedPiece.col, 'dark', this.difficulty);
        if (!mv) break;
      } else break;
    }
    this.updateScore();
    if (this.giveaway) {
      // паук съел твою шашку — тебе в плюс; паук подставил свою — он доволен
      if (captures) { const lm = this.lastMove; const p = this.sqPos(lm.toRow, lm.toCol); this.goodMove(p.x, p.y - 60, 12 * captures, 'Отдал'); this.quip('S236', { chance: 0.5, cooldown: 8000 }); }
      else if (getLegalMovesState(this.state.board, 'light', null).some((m) => m.capRow !== undefined)) this.quip('S237', { chance: 0.4, cooldown: 9000 });
    } else if (tookKing) { this.spiderLaugh(700); this.quip('S46', { force: true }); } else if (captures) { this.quip('S41', { chance: 0.5 }); this.badMove(); }
    if (await this.afterTurn('light')) return;
    this.boyTurn();
  }

  async drawGame(kind) {
    this.busy = true;
    this.draws += 1;
    GameState.stats.draws += 1;
    const why = kind === 'repetition' ? 'позиция повторилась три раза' : kind === 'kings' ? '15 ходов только дамками без взятий' : 'слишком долгая партия';
    this.setStatus(`Ничья: ${why}. Переигрываем`, 'normal');
    await this.quip(this.draws === 1 ? 'S43' : 'S44', { force: true });
    if (this.finished) return;
    await sleep(this, 500);
    this.tweens.add({ targets: this.piecesLayer, alpha: 0, duration: 400, onComplete: () => { this.piecesLayer.setAlpha(1); this.newGame(); } });
  }

  highlightData() {
    const n = countPieces(this.state.board);
    return { draws: this.draws, giveaway: this.giveaway, left: n.light, spiderLeft: n.dark };
  }

  endText(result) {
    if (!this.giveaway) return result === 'win' ? 'Победа: у паука не осталось ходов' : 'Паук победил…';
    const n = countPieces(this.state.board);
    if (result === 'win') return n.light ? 'Победа: тебе некуда ходить, а в поддавках это хорошо' : 'Победа: ты отдал все шашки!';
    return n.dark ? 'Паук заперся без ходов — в поддавках это победа…' : 'Паук первым раздал все шашки…';
  }

  async endGame(result) {
    this.busy = true;
    this.drawHighlights();
    this.setStatus(this.endText(result), result === 'win' ? 'good' : 'bad');
    Audio.play(result === 'win' ? 'win' : 'lose', { volume: 0.7 });
    if (result === 'win') this.burst(960, 600, 0xffd27a, 40); else this.spiderLaugh(1200);
    await sleep(this, 2200);
    this.finish(result);
  }

  // Подсказка: зеркалим доску (светлые ↔ тёмные) и спрашиваем базовый поиск глубины 4.
  computeHint() {
    if (this.state.color !== 'light') return null;
    const moves = this.legal();
    if (!moves.length) return null;
    if (this.giveaway) {
      const g = hintGiveawayMove(this.state);
      return (g && moves.find((x) => x.fromRow === g.fromRow && x.fromCol === g.fromCol && x.toRow === g.toRow && x.toCol === g.toCol)) || moves[0];
    }
    if (this.state.forcedPiece) return moves[0];
    const mir = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      const p = this.state.board[r][c];
      if (p) mir[SIZE - 1 - r][SIZE - 1 - c] = { color: p.color === 'light' ? 'dark' : 'light', king: p.king };
    }
    const m = getBestMoveBasic(mir, 4);
    if (!m) return moves[0];
    const back = { fromRow: SIZE - 1 - m.fromRow, fromCol: SIZE - 1 - m.fromCol, toRow: SIZE - 1 - m.toRow, toCol: SIZE - 1 - m.toCol };
    return moves.find((x) => x.fromRow === back.fromRow && x.fromCol === back.fromCol && x.toRow === back.toRow && x.toCol === back.toCol) || moves[0];
  }

  showHint(mv) {
    this.hintG?.destroy();
    const g = this.add.graphics().setDepth(5);
    const a = this.sqPos(mv.fromRow, mv.fromCol); const b = this.sqPos(mv.toRow, mv.toCol);
    g.lineStyle(8, 0xffd27a, 0.9).strokeCircle(a.x, a.y, 50).strokeCircle(b.x, b.y, 30).lineBetween(a.x, a.y, b.x, b.y);
    this.tweens.add({ targets: g, alpha: { from: 1, to: 0.35 }, duration: 450, yoyo: true, repeat: -1 });
    this.hintG = g;
    this.sel = { row: mv.fromRow, col: mv.fromCol };
    this.drawHighlights();
    this.setStatus('Мамин совет: попробуй этот ход', 'good');
  }
}
