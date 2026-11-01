// День 2 — «Морской бой». Одеяло превращается в море: волны из стёганой ткани, бумажные кораблики,
// чайки, шум прибоя. Поля — тетрадные листы в клетку (буквы А–К, цифры 1–10).
// Правила как в проекте пользователя seabattle-main: корабли не касаются даже углами, попал — ходишь ещё,
// вокруг потопленного корабля ставятся точки, первый ход — жребий. Расстановка вручную или «Случайно».
import * as Phaser from 'phaser';
import { COLORS, CSS, text, heroGradient } from '../../config/theme.js';
import { paperTexture, inkRect } from '../../ui/paper.js';
import { SPIDER_THINK_MS } from '../../config/game.js';
import { MiniGameBase, sleep } from './MiniGameBase.js';
import { N, FLEET, SHOT, idx, chooseMove, probabilityMap, remainingSizes } from '../../ai/battleship.js';
import { LETTERS, autoPlace, canPlace, createBoard, fire, fireMined, placeMines, shipCells, gridOf, allSunk, shipsLeft, cellName } from '../../ai/seaRules.js';
import { Audio } from '../../systems/audio.js';
import { voice } from '../../systems/voice.js';
import { makeCanvas, rng as seeded } from '../../systems/paint.js';
import { Quality } from '../../systems/quality.js';
import { Button } from '../../ui/button.js';
import { GameState } from '../../state.js';

const CELL = 72;
const GRID = CELL * N;
const INK = 0x2a4a8a; // синяя ручка
const PENCIL = 0x3b3f4a;
const RED = 0xc8402e;
const LAYOUT = {
  place: { boy: { x: 150, y: 236, s: 1.04 } },
  battle: { boy: { x: 110, y: 336, s: 0.62 }, spider: { x: 860, y: 300, s: 0.9 } }, // подпись «Море паука» не должна уходить под строку статуса
};

export class SeaBattleScene extends MiniGameBase {
  constructor() { super('SeaBattle'); }

  init(data) {
    super.init(data);
    this.phase = 'place';
    this.ships = []; // расстановка мальчика: { size, c, r, horiz }
    this.holding = null; // корабль «в руке»: { size, horiz, from? }
    this.horiz = true;
    this.aim = null;
    this.spiderMoves = 0;
    this.boyHitsInRow = 0;
    // «Вторая зима»: в каждом море по две бумажные мины. Попал в мину — ход переходит, а свой следующий ход пропускаешь.
    this.mines = (data && data.variant && data.variant.mines) || 0;
    this.skips = { boy: 0, spider: 0 };
    this.mineHits = { boy: 0, spider: 0 }; // кто сколько раз наступил на чужую мину
  }

  create() {
    this.makeTextures();
    this.setupFrame({
      title: this.mines ? 'Морской бой с минами' : 'Морской бой',
      rules: [
        'Расставь 10 кораблей: один 4-палубный, два 3-палубных, три 2-палубных и четыре 1-палубных.',
        'Корабли не должны касаться друг друга, даже уголками.',
        'Кто ходит первым, решает жребий. Попал: стреляй ещё раз. Промахнулся: ход паука.',
        ...(this.mines ? [`Мины: в каждом море по ${this.mines === 2 ? 'две' : this.mines} бумажные мины, свои ты видишь. Попал в чужую мину: ход переходит, а свой следующий ход ты пропускаешь.`] : []),
        'Вокруг потопленного корабля сами ставятся точки: там кораблей точно нет.',
        'Мышь: клик по клетке, и выстрел. Телефон: нажми клетку, чтобы прицелиться, и нажми ещё раз, чтобы выстрелить.',
        'Подзорная труба (подсказка) показывает клетку, где корабль паука вероятнее всего, по твоим же выстрелам.',
      ],
      ambient: [{ key: 'sea', volume: 0.42 }],
      spider: { x: 1800, y: 190, scale: 0.5 },
      subtitles: { x: 1420, bottom: 1062, width: 700 }, // под панелью «Твой флот»
      hint: { label: 'Подзорная\nтруба' },
    });
    this.makeWorld();
    this.boyBoard = this.makeBoardView('Твоё море', true);
    this.spiderBoardView = this.makeBoardView('Море паука', false);
    this.spiderBoardView.c.setVisible(false);
    this.placeBoard(this.boyBoard, LAYOUT.place.boy, true);
    this.courageBox.setVisible(false);
    this.makePalette();
    this.setScore(0, 0, 'Расставь корабли');
    this.setStatus('Выбери корабль справа и поставь его на поле', 'boy');
    this.input.on('pointermove', (p) => this.onMove(p));
    this.input.on('pointerup', (p) => this.onUp(p));
    this.input.mouse?.disableContextMenu();
    this.input.keyboard.on('keydown-R', () => this.rotate());
    this.gullTimer = this.time.addEvent({ delay: 9000, loop: true, callback: () => this.gull() });
    this.time.delayedCall(600, () => { this.busy = false; this.pickNextShip(); });
  }

  // ---------- окружение ----------

  makeTextures() {
    if (this.textures.exists('sea_bg')) return;
    // море из одеяла: синяя стёжка, звёздочки-заплатки
    let c = makeCanvas(1920, 1080); let ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 1080);
    g.addColorStop(0, '#0d1a33'); g.addColorStop(0.35, '#18325c'); g.addColorStop(1, '#244b86');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1920, 1080);
    const r = seeded(21);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 3; ctx.setLineDash([14, 10]);
    for (let k = -20; k < 40; k++) {
      ctx.beginPath(); ctx.moveTo(k * 90, 300); ctx.lineTo(k * 90 + 780, 1080); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(k * 90 + 780, 300); ctx.lineTo(k * 90, 1080); ctx.stroke();
    }
    ctx.setLineDash([]);
    for (let i = 0; i < 26; i++) {
      const x = r() * 1920; const y = 320 + r() * 760; const s = 6 + r() * 6;
      ctx.fillStyle = `rgba(242,166,90,${0.25 + r() * 0.3})`;
      ctx.beginPath();
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; const rr = k % 2 ? s * 0.4 : s; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      ctx.fill();
    }
    // лунная дорожка
    const m = ctx.createRadialGradient(260, 120, 10, 260, 120, 520);
    m.addColorStop(0, 'rgba(255,240,210,0.35)'); m.addColorStop(1, 'rgba(255,240,210,0)');
    ctx.fillStyle = m; ctx.fillRect(0, 0, 1920, 1080);
    ctx.fillStyle = '#f6ecd6'; ctx.beginPath(); ctx.arc(260, 120, 46, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e5d6b8'; ctx.beginPath(); ctx.arc(246, 108, 9, 0, Math.PI * 2); ctx.arc(276, 134, 6, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 60; i++) { ctx.fillStyle = `rgba(255,255,255,${r() * 0.6})`; ctx.fillRect(r() * 1920, r() * 280, 2, 2); }
    this.textures.addImage('sea_bg', c);

    // полоса волн (тайлится по горизонтали)
    c = makeCanvas(512, 120); ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(0, 120);
    for (let x = 0; x <= 512; x += 4) ctx.lineTo(x, 46 + Math.sin((x / 512) * Math.PI * 4) * 16 + Math.sin((x / 512) * Math.PI * 12) * 4);
    ctx.lineTo(512, 120); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(0, 70, 512, 50);
    this.textures.addImage('sea_wave', c);
    c = makeCanvas(512, 40); ctx = c.getContext('2d');
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let x = 0; x <= 512; x += 4) ctx.lineTo(x, 20 + Math.sin((x / 512) * Math.PI * 4) * 16 + Math.sin((x / 512) * Math.PI * 12) * 4 - 26 + 20);
    ctx.stroke();
    this.textures.addImage('sea_foam', c);

    // бумажный кораблик
    c = makeCanvas(170, 120); ctx = c.getContext('2d');
    ctx.lineJoin = 'round'; ctx.strokeStyle = '#24170f'; ctx.lineWidth = 4;
    ctx.fillStyle = '#f3ebdd';
    ctx.beginPath(); ctx.moveTo(10, 70); ctx.lineTo(160, 70); ctx.lineTo(132, 108); ctx.lineTo(38, 108); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e7dcc8';
    ctx.beginPath(); ctx.moveTo(85, 6); ctx.lineTo(128, 70); ctx.lineTo(42, 70); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(60,90,150,0.5)'; ctx.lineWidth = 2;
    for (let y = 80; y < 106; y += 8) { ctx.beginPath(); ctx.moveTo(30, y); ctx.lineTo(140, y); ctx.stroke(); }
    this.textures.addImage('paper_boat', c);

    // тетрадный лист в клетку под поле
    const M = 64; const S = GRID + M + 24;
    c = makeCanvas(S, S); ctx = c.getContext('2d');
    ctx.fillStyle = '#f7f3ea'; ctx.beginPath(); ctx.roundRect(0, 0, S, S, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(80,130,200,0.22)'; ctx.lineWidth = 1.5;
    const sub = CELL / 2;
    for (let x = M % sub; x < S; x += sub) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, S); ctx.stroke(); }
    for (let y = M % sub; y < S; y += sub) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(200,64,46,0.55)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(M - 14, 0); ctx.lineTo(M - 14, S); ctx.stroke();
    // клетки поля — ручкой
    ctx.strokeStyle = 'rgba(42,74,138,0.75)'; ctx.lineWidth = 2.5;
    const rr = seeded(5);
    for (let k = 0; k <= N; k++) {
      const p = M + k * CELL;
      ctx.beginPath(); ctx.moveTo(p + (rr() - 0.5) * 2, M); ctx.lineTo(p + (rr() - 0.5) * 2, M + GRID); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(M, p + (rr() - 0.5) * 2); ctx.lineTo(M + GRID, p + (rr() - 0.5) * 2); ctx.stroke();
    }
    ctx.lineWidth = 4; ctx.strokeRect(M, M, GRID, GRID);
    ctx.fillStyle = '#2a4a8a'; ctx.font = '700 40px Caveat, cursive'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let k = 0; k < N; k++) {
      ctx.fillText(LETTERS[k], M + k * CELL + CELL / 2, M / 2 + 4);
      ctx.fillText(String(k + 1), M / 2 - 6, M + k * CELL + CELL / 2 + 2);
    }
    // скотч в углах
    ctx.fillStyle = 'rgba(240,226,180,0.75)';
    ctx.save(); ctx.translate(30, 18); ctx.rotate(-0.5); ctx.fillRect(-40, -14, 80, 28); ctx.restore();
    ctx.save(); ctx.translate(S - 30, 18); ctx.rotate(0.5); ctx.fillRect(-40, -14, 80, 28); ctx.restore();
    this.textures.addImage('sea_paper', c);
  }

  makeWorld() {
    const w = this.world;
    w.add(this.add.image(960, 540, 'sea_bg'));
    // кораблики у горизонта
    this.boats = [];
    // На волнах, в просветах между полями: раньше кораблики стояли за полями и из-за листа торчал только парус.
    for (const [x, y, s] of [[1712, 846, 0.5], [688, 852, 0.38], [1634, 944, 0.3]]) {
      const b = this.add.image(x, y, 'paper_boat').setScale(s).setAlpha(0.85);
      w.add(b); this.boats.push({ b, x, y, ph: Math.random() * 6 });
    }
    // волны
    this.waves = [];
    const tints = [0x2d5a99, 0x3a6db0, 0x4a80c4];
    tints.forEach((t, i) => {
      const y = 880 + i * 70;
      const ws = this.add.tileSprite(960, y, 1920, 120, 'sea_wave').setTint(t).setAlpha(0.92);
      const fs = this.add.tileSprite(960, y - 34, 1920, 40, 'sea_foam').setAlpha(0.35 + i * 0.12);
      w.add([ws, fs]);
      this.waves.push({ ws, fs, y, sp: 18 + i * 14, ph: i * 1.7 });
    });
    this.events.on('update', this.animateWorld, this);
    this.events.once('shutdown', () => { this.events.off('update', this.animateWorld, this); });
  }

  animateWorld(time) {
    const t = time / 1000;
    for (const v of this.waves) {
      v.ws.tilePositionX = t * v.sp; v.fs.tilePositionX = t * v.sp;
      const dy = Math.sin(t * 0.9 + v.ph) * 8;
      v.ws.y = v.y + dy; v.fs.y = v.y - 34 + dy;
    }
    for (const o of this.boats) {
      o.b.y = o.y + Math.sin(t * 1.1 + o.ph) * 6;
      o.b.rotation = Math.sin(t * 0.9 + o.ph) * 0.07;
      o.b.x = o.x + Math.sin(t * 0.13 + o.ph) * 24;
    }
  }

  gull() {
    if (this.finished || Math.random() < 0.3) return;
    const g = this.add.graphics().setDepth(-40);
    const fromLeft = Math.random() < 0.5;
    const y = 120 + Math.random() * 180;
    const holder = { x: fromLeft ? -60 : 1980, t: 0 };
    Audio.play('gull', { volume: 0.25 });
    this.tweens.add({
      targets: holder, x: fromLeft ? 1980 : -60, t: 30, duration: 9000,
      onUpdate: () => {
        const flap = Math.sin(holder.t) * 10;
        g.clear().lineStyle(4, 0xf3ebdd, 0.85);
        g.beginPath(); g.moveTo(holder.x - 26, y + flap); g.lineTo(holder.x, y + 6); g.lineTo(holder.x + 26, y + flap); g.strokePath();
      },
      onComplete: () => g.destroy(),
    });
  }

  // ---------- поля ----------

  makeBoardView(title, mine) {
    const c = this.add.container(0, 0);
    const paper = this.add.image(-64, -64, 'sea_paper').setOrigin(0, 0);
    const ships = this.add.graphics();
    const marks = this.add.graphics();
    const over = this.add.graphics();
    const label = this.add.text(GRID / 2, -100, title, text('heading-3')).setOrigin(0.5).setResolution(2).setStroke('#131209', 8);
    const fleet = this.add.graphics();
    c.add([paper, ships, marks, over, label, fleet]);
    this.root.add(c);
    return { c, ships, marks, over, label, fleet, mine, board: null };
  }

  placeBoard(view, L, instant = false) {
    if (instant) { view.c.setPosition(L.x, L.y).setScale(L.s); return Promise.resolve(); }
    return new Promise((res) => this.tweens.add({ targets: view.c, x: L.x, y: L.y, scale: L.s, duration: 700, ease: 'Cubic.easeInOut', onComplete: res }));
  }

  cellAt(view, p) {
    const s = view.c.scale;
    const lx = (p.worldX - view.c.x) / s; const ly = (p.worldY - view.c.y) / s;
    const c = Math.floor(lx / CELL); const r = Math.floor(ly / CELL);
    return c >= 0 && c < N && r >= 0 && r < N ? { c, r } : null;
  }

  // Корабль — бумажный кораблик, сложенный из тетрадного листа: корпус-трапеция, «шапка» посередине,
  // боковые уголки и линии сгибов. Потопленный — серый, размокший, с волной поверх.
  drawShip(g, ship, opts = {}) {
    this.boatAt(g, ship.c * CELL + 6, ship.r * CELL + 6, ship.size * CELL - 12, CELL - 12, ship.horiz, opts);
  }

  // Бумажный кораблик в прямоугольнике L×H (u — вдоль, v — поперёк). Используется и на поле,
  // и в панели «Твой флот», и в маленькой строке состояния флота под полем.
  boatAt(g, ox, oy, L, H, horiz, { color = INK, alpha = 1, fill = 0x9db8e8, sunk = false, dim = false } = {}) {
    const P = (u, v) => (horiz ? { x: ox + u, y: oy + v } : { x: ox + (H - v), y: oy + u });
    const poly = (pts) => pts.map(([u, v]) => P(u, v));
    const deck = H * 0.5; const tip = Math.min(H * 0.36, L * 0.18);
    const paper = sunk ? 0xa49a90 : dim ? 0x4a5a78 : 0xf6f1e6;
    const shade = sunk ? 0x8b8178 : dim ? 0x34405a : fill;
    const ink = sunk ? 0x5a5048 : dim ? 0x2c3a55 : color;
    const lw = Math.max(1.3, H * 0.075);
    const hull = poly([[0, deck], [L, deck], [L - tip, H], [tip, H]]);
    const hw = L >= H * 1.6 ? Math.min(L * 0.34, H * 0.95) : L * 0.36;
    const hat = poly([[L / 2 - hw, deck], [L / 2, -H * 0.02], [L / 2 + hw, deck]]);
    const wingL = poly([[0, deck], [Math.min(L * 0.2, H * 0.5), H * 0.12], [Math.min(L * 0.34, H * 0.8), deck]]);
    const wingR = poly([[L, deck], [L - Math.min(L * 0.2, H * 0.5), H * 0.12], [L - Math.min(L * 0.34, H * 0.8), deck]]);
    // тень под корабликом — бумага чуть приподнята над клеткой
    if (!sunk && H > 30) {
      const sh = poly([[tip * 0.6 + 3, H + 2], [L - tip * 0.6 + 3, H + 2], [L - tip + 3, H - 6], [tip + 3, H - 6]]);
      g.fillStyle(0x000000, 0.12 * alpha).fillPoints(sh, true);
    }
    const wings = L >= H * 1.6; // у однопалубного кораблика боковых уголков нет — иначе он похож на корону
    if (wings) g.fillStyle(shade, 0.85 * alpha).fillPoints(wingL, true).fillPoints(wingR, true);
    g.fillStyle(paper, 0.95 * alpha).fillPoints(hat, true);
    // правая половина «шапки» — в тени сгиба
    g.fillStyle(shade, 0.35 * alpha).fillPoints(poly([[L / 2, -H * 0.02], [L / 2 + hw, deck], [L / 2, deck]]), true);
    g.fillStyle(paper, 0.95 * alpha).fillPoints(hull, true);
    g.fillStyle(shade, 0.55 * alpha).fillPoints(poly([[tip, H], [L - tip, H], [L - tip * 1.4, H * 0.8], [tip * 1.4, H * 0.8]]), true);
    // клетки тетрадного листа просвечивают на бумаге
    if (!dim && H > 30) {
      g.lineStyle(1, 0x6f8fc8, 0.18 * alpha);
      for (let u = 10; u < L - 6; u += 14) { const a = P(u, deck + 2); const b = P(u, H - 3); g.lineBetween(a.x, a.y, b.x, b.y); }
    }
    g.lineStyle(lw, ink, alpha);
    for (const p of wings ? [hull, hat, wingL, wingR] : [hull, hat]) g.strokePoints(p, true);
    // линии сгибов
    g.lineStyle(Math.max(1, lw * 0.45), ink, 0.45 * alpha);
    const a = P(L / 2, -H * 0.02); const b = P(L / 2, deck); g.lineBetween(a.x, a.y, b.x, b.y);
    const c1 = P(tip * 0.6, deck + (H - deck) * 0.5); const c2 = P(L - tip * 0.6, deck + (H - deck) * 0.5); g.lineBetween(c1.x, c1.y, c2.x, c2.y);
    if (sunk) {
      // волна поверх утонувшего кораблика
      g.lineStyle(Math.max(1.4, lw * 0.85), 0x3a6aa8, 0.8 * alpha);
      const pts = [];
      const n = Math.max(6, Math.round(L / 10));
      for (let k = 0; k <= n; k++) { const u = (L * k) / n; pts.push(P(u, H * 0.66 + Math.sin(k * 1.4) * H * 0.09)); }
      g.strokePoints(pts);
    }
  }

  redrawShips(view) {
    const g = view.ships; g.clear();
    if (view.mine) {
      const list = view.board ? view.board.ships : this.ships;
      list.forEach((s) => this.drawShip(g, s, { sunk: s.sunk }));
    } else if (view.board) {
      view.board.ships.forEach((s) => { if (s.sunk || this.reveal) this.drawShip(g, s, { color: s.sunk ? RED : 0x8a5a9e, fill: 0xd6b0e0, sunk: s.sunk, alpha: s.sunk ? 1 : 0.8 }); });
    }
  }

  // Отметки выстрелов: промах — точка с кругами, попадание — крест, ореол — мелкие точки.
  redrawMarks(view) {
    const g = view.marks; g.clear();
    if (!view.board) return;
    const sh = view.board.shots;
    const mines = view.board.mines || []; const boom = view.board.minesHit || [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const v = sh[idx(c, r)]; const x = c * CELL + CELL / 2; const y = r * CELL + CELL / 2;
      if (boom.includes(idx(c, r))) continue; // взорванная мина рисуется ниже
      if (v === SHOT.MISS) { g.fillStyle(INK, 0.9).fillCircle(x, y, 7); g.lineStyle(2, INK, 0.25).strokeCircle(x, y, 18); }
      else if (v === SHOT.HALO) g.fillStyle(INK, 0.45).fillCircle(x, y, 5);
      else if (v === SHOT.HIT || v === SHOT.SUNK) {
        const a = 22;
        g.lineStyle(9, RED, 1).lineBetween(x - a, y - a, x + a, y + a).lineBetween(x + a, y - a, x - a, y + a);
        g.lineStyle(3, 0xffffff, 0.3).lineBetween(x - a + 3, y - a, x + a, y + a - 3);
      }
    }
    // мины: свои видны всегда, чужие — когда на них наступили (или в конце проигранной партии)
    for (const i of mines) {
      const hit = boom.includes(i);
      if (!(view.mine || hit || this.reveal)) continue;
      this.drawMine(g, (i % N) * CELL + CELL / 2, Math.floor(i / N) * CELL + CELL / 2, hit);
    }
  }

  // Бумажная мина карандашом: шарик с шипами. Взорванная — тёмная, с пятном копоти.
  drawMine(g, x, y, hit) {
    const R = 15; const line = hit ? 0x24170f : PENCIL;
    if (hit) g.fillStyle(0x3b3f4a, 0.16).fillCircle(x, y, 31);
    g.lineStyle(4, line, hit ? 0.95 : 0.75);
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4 + 0.2;
      g.lineBetween(x + Math.cos(a) * (R - 2), y + Math.sin(a) * (R - 2), x + Math.cos(a) * (R + 9), y + Math.sin(a) * (R + 9));
    }
    g.fillStyle(hit ? 0x3b3f4a : 0xc9ccd4, hit ? 1 : 0.9).fillCircle(x, y, R);
    g.lineStyle(3, line, 0.9).strokeCircle(x, y, R);
    g.fillStyle(0xffffff, hit ? 0.22 : 0.65).fillCircle(x - 5, y - 5, 4);
  }

  drawFleetStatus(view) {
    const g = view.fleet; g.clear();
    const list = view.board ? view.board.ships : [];
    const sorted = list.slice().sort((a, b) => b.size - a.size);
    let x = 0; const y = GRID + 34;
    for (const s of sorted) {
      const L = s.size * 22 - 3;
      this.boatAt(g, x, y - 2, L, 22, true, { sunk: s.sunk, fill: view.mine ? 0x9db8e8 : 0xd6b0e0, color: view.mine ? INK : 0x8a5a9e });
      if (s.sunk) g.lineStyle(3, RED, 0.9).lineBetween(x, y + 20, x + L, y - 2);
      x += s.size * 22 + 18;
    }
  }

  // ---------- расстановка ----------

  makePalette() {
    const px = 1080; const py = 250;
    this.palette = this.add.container(px, py);
    // тёмный картон с вышитой рамкой, как в меню
    const bg = this.add.image(-40 + 380, -50 + 360, paperTexture(this, 760, 720, { kind: 'night', seed: 16, border: true }));
    const head = heroGradient(this.add.text(0, -14, 'Твой флот', text('heading-3')).setResolution(2));
    this.palette.add([bg, head]);
    // Панель — в ui раньше кнопок: иначе её фон рисуется поверх «Повернуть», «Случайно», «Очистить» и «В бой»
    // (кнопки нажимались, но их не было видно).
    this.ui.add(this.palette);
    this.paletteItems = [];
    const groups = [[4, 1], [3, 2], [2, 3], [1, 4]];
    groups.forEach(([size, count], gi) => {
      const y = 70 + gi * 92;
      const g = this.add.graphics();
      const t = this.add.text(560, y + 2, '', text('heading-4', { color: CSS.accent })).setOrigin(0, 0.5).setResolution(2);
      const z = this.add.zone(250, y, 560, 84).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => this.pick(size));
      this.palette.add([g, t, z]);
      this.paletteItems.push({ size, count, g, t, y });
    });
    const mk = (x, y, label, w, cb, variant = 'secondary') => {
      const b = new Button(this, px + x, py + y, { label, width: w, height: 80, variant, style: 'button-2xl', onClick: cb });
      this.ui.add(b); return b;
    };
    this.btnRotate = mk(150, 470, 'Повернуть', 320, () => this.rotate());
    this.btnRandom = mk(510, 470, 'Случайно', 320, () => this.randomize());
    this.btnClear = mk(150, 580, 'Очистить', 320, () => this.clearShips());
    this.btnGo = mk(510, 580, 'В бой', 320, () => this.startBattle(), 'primary');
    this.refreshPalette();
  }

  remainingToPlace(size) {
    const total = FLEET.filter((s) => s === size).length;
    const held = this.holding && this.holding.size === size ? 1 : 0;
    return total - this.ships.filter((s) => s.size === size).length - held;
  }

  refreshPalette() {
    for (const it of this.paletteItems) {
      const sel = this.holding && this.holding.size === it.size;
      // кораблик «в руке» ещё не поставлен — считаем его в остатке, чтобы выбранная строка не выглядела пустой
      const left = this.remainingToPlace(it.size) + (sel ? 1 : 0);
      it.g.clear();
      if (sel) {
        it.g.fillStyle(COLORS.accent, 0.12).fillRoundedRect(-20, it.y - 40, 740, 80, 16);
        inkRect(it.g, -20, it.y - 40, 740, 80, { color: COLORS.accentHi, width: 2.4, alpha: 0.9, seed: 50 + it.size, amp: 0.7 });
      }
      // кораблик нужной длины + тонкие риски палуб под ним (сколько клеток займёт)
      const L = it.size * 62 - 6;
      this.boatAt(it.g, 0, it.y - 30, L, 56, true, { dim: left <= 0 });
      it.g.lineStyle(2, left > 0 ? 0x9db8e8 : 0x34405a, 0.7);
      for (let k = 0; k < it.size; k++) it.g.lineBetween(k * 62 + 6, it.y + 34, k * 62 + 50, it.y + 34);
      it.t.setText(`× ${left}`).setColor(left > 0 ? CSS.accent : CSS.fog);
    }
    const done = this.ships.length === FLEET.length;
    this.btnGo.setDisabled(!done);
    this.btnGo.setAlpha(done ? 1 : 0.45);
  }

  pick(size) {
    if (this.phase !== 'place' || this.busy) return;
    if (this.remainingToPlace(size) <= 0 && !(this.holding && this.holding.size === size)) return;
    this.holding = { size, horiz: this.horiz };
    Audio.play('paper', { volume: 0.4 });
    this.refreshPalette();
    this.setStatus(`${size}-палубный: нажми на поле · R — повернуть`, 'boy');
  }

  pickNextShip() {
    const next = [4, 3, 2, 1].find((s) => this.remainingToPlace(s) > 0);
    if (next) this.pick(next);
    else { this.holding = null; this.refreshPalette(); this.drawGhost(null); this.setStatus('Флот готов: жми «В бой»', 'good'); }
  }

  rotate() {
    if (this.phase !== 'place') return;
    this.horiz = !this.horiz;
    if (this.holding) this.holding.horiz = this.horiz;
    Audio.play('tap');
    if (this.lastPointer) this.onMove(this.lastPointer);
  }

  randomize() {
    if (this.phase !== 'place') return;
    this.ships = autoPlace().map(({ size, c, r, horiz }) => ({ size, c, r, horiz }));
    this.holding = null;
    Audio.play('paper', { volume: 0.5 });
    this.redrawShips(this.boyBoard);
    this.pickNextShip();
  }

  clearShips() {
    if (this.phase !== 'place') return;
    this.ships = [];
    Audio.play('erase', { volume: 0.5 });
    this.redrawShips(this.boyBoard);
    this.pickNextShip();
  }

  drawGhost(cell) {
    const g = this.boyBoard.over; g.clear();
    if (!cell || !this.holding) return;
    const cand = { size: this.holding.size, c: cell.c, r: cell.r, horiz: this.holding.horiz };
    // подвинуть внутрь поля, если корабль вылезает за край
    if (cand.horiz) cand.c = Math.min(cand.c, N - cand.size); else cand.r = Math.min(cand.r, N - cand.size);
    const ok = canPlace(this.ships, cand);
    this.ghost = ok ? cand : null;
    this.drawShip(g, cand, { color: ok ? 0x3c8a4a : RED, fill: ok ? 0x9be0a8 : 0xf0a0a0, alpha: 0.85 });
  }

  onMove(p) {
    this.lastPointer = p;
    if (this.phase === 'place') this.drawGhost(this.cellAt(this.boyBoard, p));
    else if (this.phase === 'battle' && !p.wasTouch) this.drawAim(this.cellAt(this.spiderBoardView, p));
  }

  onUp(p) {
    if (this.finished) return;
    if (this.rulesCard || this.time.now - (this.rulesClosedAt ?? -1e9) < 350) return; // клик закрыл правила
    if (p.rightButtonReleased && p.rightButtonReleased()) { this.removeAt(p); return; }
    if (this.phase === 'place') this.placeTap(p);
    else if (this.phase === 'battle') this.battleTap(p);
  }

  removeAt(p) {
    if (this.phase !== 'place') return;
    const cell = this.cellAt(this.boyBoard, p); if (!cell) return;
    const g = gridOf(this.ships); const si = g[idx(cell.c, cell.r)];
    if (si === -1) return;
    this.ships.splice(si, 1);
    Audio.play('erase', { volume: 0.4 });
    this.redrawShips(this.boyBoard); this.refreshPalette();
  }

  placeTap(p) {
    if (this.busy) return;
    const cell = this.cellAt(this.boyBoard, p); if (!cell) return;
    const si = gridOf(this.ships)[idx(cell.c, cell.r)];
    if (!this.holding && si !== -1) { // взять поставленный корабль
      const s = this.ships.splice(si, 1)[0];
      this.horiz = s.horiz; this.holding = { size: s.size, horiz: s.horiz };
      Audio.play('paper', { volume: 0.4 });
      this.redrawShips(this.boyBoard); this.refreshPalette(); this.drawGhost(cell);
      return;
    }
    if (!this.holding) { if (si === -1) this.pickNextShip(); return; }
    this.drawGhost(cell);
    if (!this.ghost) { this.setStatus('Так нельзя: корабли не касаются даже уголками', 'bad'); this.shake(120, 0.002); return; }
    this.ships.push({ ...this.ghost });
    Audio.play('pencil', { volume: 0.55 });
    this.holding = null; this.ghost = null;
    this.redrawShips(this.boyBoard);
    this.boyBoard.over.clear();
    this.pickNextShip();
  }

  // ---------- бой ----------

  async startBattle() {
    if (this.phase !== 'place' || this.ships.length !== FLEET.length || this.busy) return;
    this.busy = true;
    this.phase = 'lottery';
    this.boyBoard.over.clear();
    this.setStatus('Паук прячет свои корабли…', 'spider');
    this.setSubtitleLayout({ x: 1722, bottom: 930, width: 350 }); // в бою — справа, под пауком
    this.tweens.add({ targets: this.palette, alpha: 0, duration: 300, onComplete: () => this.palette.destroy() });
    [this.btnRotate, this.btnRandom, this.btnClear, this.btnGo].forEach((b) => this.tweens.add({ targets: b, alpha: 0, duration: 300, onComplete: () => b.destroy() }));
    this.boyBoard.board = createBoard(this.ships);
    this.spiderBoard = createBoard(autoPlace());
    if (this.mines) { placeMines(this.boyBoard.board, this.mines); placeMines(this.spiderBoard, this.mines); }
    this.spiderBoardView.board = this.spiderBoard;
    await this.placeBoard(this.boyBoard, LAYOUT.battle.boy);
    const sv = this.spiderBoardView;
    sv.c.setVisible(true).setAlpha(0);
    this.placeBoard(sv, { ...LAYOUT.battle.spider, x: LAYOUT.battle.spider.x + 200 }, true);
    this.tweens.add({ targets: sv.c, alpha: 1, x: LAYOUT.battle.spider.x, duration: 600, ease: 'Cubic.easeOut' });
    this.redrawShips(this.boyBoard); this.redrawMarks(this.boyBoard); this.redrawMarks(sv);
    this.drawFleetStatus(this.boyBoard); this.drawFleetStatus(sv);
    this.courageBox.setVisible(true);
    this.updateScore();
    await voice.play('S26');
    if (this.finished) return;
    if (this.mines) {
      this.setStatus('Мины расставлены: по две у каждого. Свои ты видишь', 'normal');
      await sleep(this, 1600);
      if (this.finished) return;
    }
    const boyFirst = await this.coinFlip();
    if (this.finished) return;
    this.phase = 'battle';
    if (boyFirst) this.boyTurn(); else this.spiderTurn();
  }

  // Жребий: монетка подлетает, крутится (сжимается по ширине и меняет сторону, когда «встаёт ребром»,
  // поэтому надпись никогда не видна зеркально) и падает стороной «Ты» или «Паук».
  coinFlip() {
    const boyFirst = Math.random() < 0.5;
    this.setStatus('Жребий: кто стреляет первым?', 'normal');
    const c = this.add.container(960, 600).setDepth(300).setAlpha(0);
    const disc = this.add.graphics();
    disc.fillStyle(0x000000, 0.25).fillEllipse(0, 118, 170, 26);
    disc.fillStyle(0xf2c35a, 1).fillCircle(0, 0, 110).lineStyle(8, 0xb8862a, 1).strokeCircle(0, 0, 100);
    const t = this.add.text(0, 0, 'Ты', text('heading-2', { color: CSS.accentInk })).setOrigin(0.5).setResolution(2);
    c.add([disc, t]);
    const face = (boy) => t.setText(boy ? 'Ты' : 'Паук').setFontSize(boy ? 72 : 56);
    face(true);
    Audio.play('whoosh', { volume: 0.5 });
    const turns = 9; // нечётное число полуоборотов: последняя сторона = результат
    return new Promise((resolve) => {
      this.tweens.add({ targets: c, alpha: 1, duration: 150 });
      // подброс: вверх и обратно на место
      this.tweens.add({ targets: c, y: 470, duration: 520, ease: 'Sine.easeOut', yoyo: true, hold: 60 });
      let k = 0;
      this.tweens.add({
        targets: c, scaleX: { from: 1, to: 0.04 }, duration: 62, yoyo: true, repeat: turns - 1, ease: 'Sine.easeIn',
        onYoyo: () => { k += 1; face(k === turns ? boyFirst : k % 2 === 0); },
        onComplete: () => {
          c.scaleX = 1; face(boyFirst);
          this.tweens.add({ targets: c, scale: { from: 1.12, to: 1 }, duration: 260, ease: 'Back.easeOut' });
          Audio.play('chime', { volume: 0.4 });
          this.setStatus(boyFirst ? 'Жребий: первым стреляешь ты' : 'Жребий: первым стреляет паук', boyFirst ? 'boy' : 'spider');
          this.time.delayedCall(1100, () => this.tweens.add({ targets: c, alpha: 0, scale: 0.6, duration: 300, ease: 'Sine.easeIn', onComplete: () => { c.destroy(); resolve(boyFirst); } }));
        },
      });
    });
  }

  updateScore() {
    this.setScore(0, 0, `Корабли: ты ${shipsLeft(this.boyBoard.board)} · паук ${shipsLeft(this.spiderBoard)}`);
  }

  boyTurn() {
    if (this.finished) return;
    if (this.skips.boy > 0) { // наступил на мину — этот ход пропускаешь
      this.skips.boy -= 1;
      this.turn = 'spider'; this.busy = true;
      this.setStatus('Мина: ты пропускаешь ход', 'bad');
      this.time.delayedCall(1300, () => this.spiderTurn(true));
      return;
    }
    this.turn = 'boy';
    this.busy = false;
    this.aim = null;
    this.setStatus('Твой выстрел: выбери клетку на поле паука', 'boy');
  }

  drawAim(cell, armed = false) {
    const g = this.spiderBoardView.over; g.clear();
    if (!cell || this.turn !== 'boy' || this.busy) return;
    const x = cell.c * CELL; const y = cell.r * CELL;
    const free = this.spiderBoard.shots[idx(cell.c, cell.r)] === SHOT.NONE;
    const col = free ? (armed ? RED : COLORS.accent) : 0x777777;
    g.fillStyle(col, armed ? 0.25 : 0.12).fillRect(x + 3, y + 3, CELL - 6, CELL - 6);
    g.lineStyle(armed ? 6 : 4, col, 0.95).strokeCircle(x + CELL / 2, y + CELL / 2, CELL * 0.36);
    g.lineBetween(x + CELL / 2, y + 4, x + CELL / 2, y + CELL - 4).lineBetween(x + 4, y + CELL / 2, x + CELL - 4, y + CELL / 2);
    // подсветка строки и столбца
    g.fillStyle(col, 0.05).fillRect(0, y, GRID, CELL).fillRect(x, 0, CELL, GRID);
  }

  battleTap(p) {
    if (this.turn !== 'boy' || this.busy) return;
    const cell = this.cellAt(this.spiderBoardView, p);
    if (!cell) return;
    if (this.spiderBoard.shots[idx(cell.c, cell.r)] !== SHOT.NONE) { this.setStatus(`В ${cellName(cell.c, cell.r)} ты уже стрелял`, 'bad'); return; }
    if (p.wasTouch && !(this.aim && this.aim.c === cell.c && this.aim.r === cell.r)) {
      this.aim = cell; this.drawAim(cell, true);
      Audio.play('tap');
      this.setStatus(`Прицел: ${cellName(cell.c, cell.r)}. Нажми ещё раз, чтобы выстрелить`, 'boy');
      return;
    }
    this.boyShoot(cell);
  }

  cellWorld(view, c, r) {
    const s = view.c.scale;
    return { x: view.c.x + (c * CELL + CELL / 2) * s, y: view.c.y + (r * CELL + CELL / 2) * s };
  }

  async boyShoot({ c, r }) {
    this.busy = true;
    this.hintMark?.destroy(); this.hintMark = null;
    this.spiderBoardView.over.clear();
    GameState.stats.moves += 1;
    const res = this.mines ? fireMined(this.spiderBoard, c, r) : fire(this.spiderBoard, c, r);
    const pos = this.cellWorld(this.spiderBoardView, c, r);
    await this.shotFx(pos, res.result, this.spiderBoardView);
    this.redrawMarks(this.spiderBoardView); this.redrawShips(this.spiderBoardView); this.drawFleetStatus(this.spiderBoardView);
    this.updateScore();
    if (res.result === 'mine') {
      this.badMove();
      this.mineHits.boy += 1; this.skips.boy += 1;
      this.setStatus(`${cellName(c, r)}: мина! Следующий ход ты пропускаешь`, 'bad');
      this.quip('S233', { force: true });
      await sleep(this, 1200);
      return this.spiderTurn();
    }
    if (res.result === 'miss') {
      this.badMove();
      this.setStatus(`${cellName(c, r)}: мимо`, 'normal');
      await sleep(this, 500);
      return this.spiderTurn();
    }
    if (res.result === 'sunk') {
      this.goodMove(pos.x, pos.y - 40, 24, 'Потоплен');
      this.bumpScore();
      if (res.allSunk) { await this.endGame('win'); return; }
      this.quip('S25', { cooldown: 4000 });
      this.setStatus(`${cellName(c, r)}: потоплен. Стреляй ещё`, 'good');
    } else {
      this.goodMove(pos.x, pos.y - 40, 12, 'Попал');
      this.quip('S22', { chance: 0.4 });
      this.setStatus(`${cellName(c, r)}: попал. Стреляй ещё`, 'good');
    }
    this.busy = false;
  }

  async spiderTurn(afterSkip = false) {
    if (this.finished) return;
    if (!afterSkip && this.skips.spider > 0) { // паук наступил на мину — пропускает ход
      this.skips.spider -= 1;
      this.turn = 'boy'; this.busy = true;
      this.setStatus('Мина: паук пропускает ход', 'good');
      await sleep(this, 1300);
      return this.boyTurn();
    }
    this.turn = 'spider';
    this.busy = true;
    this.setStatus('Паук целится…', 'spider');
    this.spiderThink(true);
    // прицел паука «бегает» по твоему полю
    const g = this.boyBoard.over;
    const think = Phaser.Math.Between(SPIDER_THINK_MS.min + 200, SPIDER_THINK_MS.max + 400);
    const move = chooseMove({ shots: this.boyBoard.board.shots, ships: this.boyBoard.board.ships }, this.difficulty);
    const steps = 4;
    for (let k = 0; k < steps; k++) {
      const cc = k === steps - 1 ? move.c : Phaser.Math.Between(0, N - 1); const rr = k === steps - 1 ? move.r : Phaser.Math.Between(0, N - 1);
      g.clear().lineStyle(5, 0x8a5a9e, 0.9).strokeCircle(cc * CELL + CELL / 2, rr * CELL + CELL / 2, CELL * 0.38);
      await sleep(this, think / steps);
      if (this.finished) return;
    }
    g.clear();
    this.spiderThink(false);
    this.spiderMoves += 1;
    const res = this.mines ? fireMined(this.boyBoard.board, move.c, move.r) : fire(this.boyBoard.board, move.c, move.r);
    const pos = this.cellWorld(this.boyBoard, move.c, move.r);
    await this.shotFx(pos, res.result, this.boyBoard);
    this.redrawMarks(this.boyBoard); this.redrawShips(this.boyBoard); this.drawFleetStatus(this.boyBoard);
    this.updateScore();
    if (res.result === 'mine') {
      this.mineHits.spider += 1; this.skips.spider += 1;
      GameState.addCourage(8);
      this.drawCourage();
      this.setStatus(`Паук: ${cellName(move.c, move.r)}, мина! Он пропустит ход`, 'good');
      this.quip('S234', { force: true });
      await sleep(this, 1200);
      return this.boyTurn();
    }
    if (res.result === 'miss') {
      if (this.spiderMoves > 3) this.quip('S21', { chance: 0.35 });
      this.setStatus(`Паук: ${cellName(move.c, move.r)}, мимо`, 'normal');
      await sleep(this, 450);
      return this.boyTurn();
    }
    if (res.result === 'sunk') {
      if (res.allSunk) { await this.endGame('loss'); return; }
      this.spiderLaugh(700);
      this.quip(Math.random() < 0.5 ? 'S24' : 'S27', { cooldown: 3000 });
      this.setStatus(`Паук потопил твой корабль (${cellName(move.c, move.r)})`, 'bad');
    } else {
      this.setStatus(`Паук попал в ${cellName(move.c, move.r)}…`, 'bad');
      this.quip('S28', { chance: 0.25 });
    }
    await sleep(this, 650);
    return this.spiderTurn();
  }

  // Эффекты выстрела: ядро летит, всплеск или взрыв.
  shotFx(pos, result, view) {
    return new Promise((resolve) => {
      if (result === 'repeat') { resolve(); return; }
      const s = view.c.scale;
      const ball = this.add.circle(pos.x, pos.y - 260 * s, 12 * s + 4, 0x24170f).setDepth(200);
      this.tweens.add({
        targets: ball, y: pos.y, scale: { from: 1.8, to: 0.8 }, duration: 260, ease: 'Quad.easeIn',
        onComplete: () => {
          ball.destroy();
          if (result === 'mine') {
            // бумажная мина: глухой «бум» и серое облачко, без вспышки и тряски
            Audio.play('boom', { volume: 0.38 });
            for (let k = 0; k < 4; k++) {
              const puff = this.add.circle(pos.x + (k - 1.5) * 12 * s, pos.y, 15 * s + 3, 0x8a8f9c, 0.5).setDepth(200);
              this.tweens.add({ targets: puff, y: pos.y - (26 + k * 12) * s, scale: 2.3, alpha: 0, duration: 820 + k * 90, ease: 'Sine.easeOut', onComplete: () => puff.destroy() });
            }
          } else if (result === 'miss') {
            Audio.play('splash', { volume: 0.55 });
            for (let k = 0; k < 3; k++) {
              const ring = this.add.circle(pos.x, pos.y, 10 * s, 0x000000, 0).setStrokeStyle(4, 0x6aa0e0, 0.9).setDepth(200);
              this.tweens.add({ targets: ring, radius: 46 * s, alpha: 0, duration: 650, delay: k * 120, onComplete: () => ring.destroy() });
            }
            this.burst(pos.x, pos.y, 0x9cc8ff, 8);
          } else {
            Audio.play('boom', { volume: result === 'sunk' ? 0.8 : 0.6 });
            this.burst(pos.x, pos.y, 0xffa040, result === 'sunk' ? 26 : 14);
            const flash = this.add.circle(pos.x, pos.y, 40 * s, 0xffe0a0, 0.9).setDepth(200).setBlendMode(Phaser.BlendModes.ADD);
            this.tweens.add({ targets: flash, scale: 2.2, alpha: 0, duration: 380, onComplete: () => flash.destroy() });
            this.shake(result === 'sunk' ? 320 : 180, result === 'sunk' ? 0.008 : 0.004);
          }
          this.time.delayedCall(result === 'miss' ? 250 : result === 'mine' ? 450 : 350, resolve);
        },
      });
    });
  }

  highlightData() {
    const sh = (this.spiderBoard && this.spiderBoard.shots) || [];
    return {
      shots: sh.filter((v) => v === SHOT.MISS || v === SHOT.HIT || v === SHOT.SUNK).length, hits: sh.filter((v) => v === SHOT.HIT || v === SHOT.SUNK).length,
      mines: this.mines, boyMine: this.mineHits.boy, spiderMine: this.mineHits.spider,
    };
  }

  async endGame(result) {
    this.busy = true;
    if (result === 'loss') {
      this.reveal = true; this.redrawShips(this.spiderBoardView); this.redrawMarks(this.spiderBoardView);
      this.setStatus('Паук потопил весь твой флот…', 'bad');
      Audio.play('lose', { volume: 0.6 });
      this.spiderLaugh(1200);
    } else {
      this.setStatus('Флот паука на дне. Победа', 'good');
      Audio.play('win', { volume: 0.7 });
      this.burst(1190, 610, 0xffd27a, 40);
    }
    await sleep(this, 1900);
    this.finish(result);
  }

  // Подсказка: самая вероятная клетка по карте вероятностей (по твоим выстрелам и оставшимся кораблям паука).
  computeHint() {
    if (this.phase !== 'battle' || this.turn !== 'boy') return null;
    const b = this.spiderBoard;
    const hits = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (b.shots[idx(c, r)] === SHOT.HIT) hits.push({ c, r });
    const sizes = remainingSizes({ ships: b.ships });
    const map = probabilityMap({ shots: b.shots }, sizes);
    let best = null; let bv = -1;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (b.shots[idx(c, r)] !== SHOT.NONE) continue;
      let v = map[idx(c, r)] || 0;
      if (hits.some((h) => Math.abs(h.c - c) + Math.abs(h.r - r) === 1)) v += 1000;
      if (v > bv) { bv = v; best = { c, r }; }
    }
    return best;
  }

  showHint(cell) {
    const pos = this.cellWorld(this.spiderBoardView, cell.c, cell.r);
    this.hintMark?.destroy();
    const m = this.add.container(pos.x, pos.y).setDepth(250);
    const ring = this.add.circle(0, 0, 40, 0xffd27a, 0.25).setStrokeStyle(5, 0xffd27a, 1);
    m.add(ring);
    this.tweens.add({ targets: ring, scale: { from: 0.8, to: 1.2 }, duration: 500, yoyo: true, repeat: -1 });
    this.hintMark = m;
    this.setStatus(`Подзорная труба: попробуй ${cellName(cell.c, cell.r)}`, 'good');
  }
}

