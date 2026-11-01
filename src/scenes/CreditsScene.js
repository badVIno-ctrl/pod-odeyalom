// Титры — книжка в тканевом переплёте: развороты листаются сами под песню «Ниточка» (колыбельная Тихона),
// клик/→ — дальше, ← — назад, Esc или «В меню» — выход. Страницы переворачиваются вокруг корешка.
// Строки куплета «прошиваются» в такт песне: паучок тянет под строкой нитку, а строка проступает чернилами.
// Часы — позиция трека в AudioContext (если звука нет — часы сцены), разметка — SONG в config/credits.js.
import * as Phaser from 'phaser';
import { PageTurn } from '../systems/pageTurn.js';
import { CSS, INK, INKN, FONT, text } from '../config/theme.js';
import { prefersReducedMotion } from '../config/game.js';
import { inkUnderline } from '../ui/paper.js';
import { Button, FocusRing } from '../ui/button.js';
import { Audio } from '../systems/audio.js';
import { Music } from '../systems/music.js';
import { Journal } from '../systems/journal.js';
import { drawingTexture, specKey } from '../systems/drawings.js';
import { makeCanvas, rng } from '../systems/paint.js';
import { Quality } from '../systems/quality.js';
import { SPREADS, SONG, songLineAt, SPREAD_AT } from '../config/credits.js';
import { Assets } from '../systems/assets.js';

const W = 800; const H = 900; // страница
const LINE_S = (60 / SONG.bpm) * SONG.beatsPerBar * SONG.barsPerLine; // строка = 10 с
const SUNG_S = LINE_S * 0.75; // последний слог тянется весь 4-й такт — нитка доходит до конца строки к нему
const FAINT = 0.42; // ещё не спетая строка — бледным карандашом

export class CreditsScene extends Phaser.Scene {
  constructor() { super('Credits'); }

  init(data) {
    this.from = (data && data.from) || 'Menu'; this.idx = 0; this.busy = false; this.leaving = false;
    this.lyrics = []; this.songT = 0; this.clock = 0;
  }

  create() {
    this.reduced = prefersReducedMotion();
    this.makeTextures();
    this.cameras.main.setBackgroundColor('#070a12');
    if (!PageTurn.active) this.cameras.main.fadeIn(700, 0, 0, 0);
    // за окном книги — медленный снег
    if (Quality.particles > 0 && !this.reduced) {
      this.add.particles(0, 0, 'fx_dust', {
        x: { min: 0, max: 1920 }, y: -20, lifespan: 16000, speedY: { min: 18, max: 40 }, speedX: { min: -6, max: 10 },
        scale: { min: 0.15, max: 0.4 }, alpha: { min: 0.15, max: 0.35 }, frequency: Math.round(260 / Quality.particles), tint: 0xffffff,
      });
    }
    this.add.image(960, 540, 'credits_cover');
    // нижние (неподвижные) листы — видны под переворачиваемой страницей
    this.add.image(960 - W / 2, 540, 'credits_page_l');
    this.add.image(960 + W / 2, 540, 'credits_page_r');
    this.pages = SPREADS.map((sp, i) => ({ left: this.buildPage(sp.left, -1, i), right: this.buildPage(sp.right, 1, i) }));
    this.pages.forEach((p, i) => { p.left.setVisible(i === 0); p.right.setVisible(i === 0); });
    // тень корешка поверх всего
    this.add.image(960, 540, 'credits_gutter').setDepth(50);

    const zl = this.add.zone(960 - W / 2, 540, W, H).setInteractive({ useHandCursor: true });
    const zr = this.add.zone(960 + W / 2, 540, W, H).setInteractive({ useHandCursor: true });
    zl.on('pointerdown', () => { this.auto = false; this.turn(-1); });
    zr.on('pointerdown', () => { this.auto = false; this.turn(1); });
    const y = 1046;
    this.prevBtn = new Button(this, 960 - W + 60, y, { label: '‹', width: 96, height: 52, variant: 'ghost', style: 'button-2xl', onClick: () => { this.auto = false; this.turn(-1); } }).setDepth(60);
    this.nextBtn = new Button(this, 960 + W - 60, y, { label: '›', width: 96, height: 52, variant: 'ghost', style: 'button-2xl', onClick: () => { this.auto = false; this.turn(1); } }).setDepth(60);
    this.menuBtn = new Button(this, 960, y, { label: 'В меню', width: 240, height: 52, variant: 'secondary', style: 'button-lg', onClick: () => this.leave() }).setDepth(60);
    new FocusRing(this, [this.prevBtn, this.menuBtn, this.nextBtn]);
    this.input.keyboard.on('keydown-RIGHT', () => { this.auto = false; this.turn(1); });
    this.input.keyboard.on('keydown-SPACE', () => { this.auto = false; this.turn(1); });
    this.input.keyboard.on('keydown-LEFT', () => { this.auto = false; this.turn(-1); });
    this.input.keyboard.on('keydown-ESC', () => this.leave());
    this.updateArrows();

    this.auto = true;
    Audio.stopAllLoops(800);
    Music.setFever(0, 400);
    // живой голос, если его положили (assets/audio/music/mus_credits_vocal.*), иначе инструментальная версия
    this.songKey = Assets.resolveSound('mus_credits_vocal').length ? 'mus_credits_vocal' : 'mus_credits';
    Music.play(this.songKey, { fade: 1200, loop: false });
    this.makeStitcher();
    window.__credits = this;
  }

  // ---------- текстуры: тканевая обложка, кремовые страницы, тень корешка ----------
  makeTextures() {
    if (this.textures.exists('credits_cover')) return;
    const r = rng(77);
    const cw = W * 2 + 120; const ch = H + 70;
    const c = makeCanvas(cw, ch); const x = c.getContext('2d');
    x.fillStyle = '#3a1d22'; x.beginPath(); x.roundRect(0, 0, cw, ch, 26); x.fill();
    // переплётная ткань: мелкая «рогожка»
    for (let i = 0; i < 9000; i++) {
      x.fillStyle = r() < 0.5 ? 'rgba(255,220,200,0.035)' : 'rgba(0,0,0,0.08)';
      x.fillRect(r() * cw, r() * ch, 1 + r() * 3, 1);
    }
    for (let yy = 0; yy < ch; yy += 3) { x.fillStyle = 'rgba(0,0,0,0.05)'; x.fillRect(0, yy, cw, 1); }
    // вышитая золотистая рамка по краю
    x.setLineDash([9, 6]); x.lineWidth = 3; x.strokeStyle = 'rgba(214,176,106,0.75)';
    x.beginPath(); x.roundRect(16, 16, cw - 32, ch - 32, 18); x.stroke();
    x.setLineDash([]);
    const g = x.createRadialGradient(cw / 2, ch / 2, 100, cw / 2, ch / 2, cw * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
    x.fillStyle = g; x.fillRect(0, 0, cw, ch);
    this.textures.addCanvas('credits_cover', c);

    const page = (side) => {
      const p = makeCanvas(W, H); const q = p.getContext('2d');
      q.fillStyle = '#f3ead8'; q.fillRect(0, 0, W, H);
      const rr = rng(side > 0 ? 91 : 92);
      for (let i = 0; i < 2600; i++) { q.fillStyle = `rgba(120,90,60,${0.02 + rr() * 0.04})`; q.fillRect(rr() * W, rr() * H, 1 + rr() * 6, 1); }
      // к корешку бумага темнеет и «уходит» вглубь
      const gx = side > 0 ? 0 : W;
      const gg = q.createLinearGradient(gx, 0, gx + side * 120, 0);
      gg.addColorStop(0, 'rgba(70,45,25,0.28)'); gg.addColorStop(1, 'rgba(70,45,25,0)');
      q.fillStyle = gg; q.fillRect(0, 0, W, H);
      // внешний край: срез блока (тонкие линии листов)
      const ex = side > 0 ? W - 1 : 0;
      for (let k = 0; k < 5; k++) { q.fillStyle = `rgba(120,100,80,${0.25 - k * 0.04})`; q.fillRect(ex - side * k * 2, 4, 1, H - 8); }
      return p;
    };
    this.textures.addCanvas('credits_page_r', page(1));
    this.textures.addCanvas('credits_page_l', page(-1));
    const gt = makeCanvas(120, H); const gq = gt.getContext('2d');
    const gr = gq.createLinearGradient(0, 0, 120, 0);
    gr.addColorStop(0, 'rgba(40,25,15,0)'); gr.addColorStop(0.5, 'rgba(40,25,15,0.35)'); gr.addColorStop(1, 'rgba(40,25,15,0)');
    gq.fillStyle = gr; gq.fillRect(0, 0, 120, H);
    this.textures.addCanvas('credits_gutter', gt);
  }

  // ---------- страница: бумага + блоки текста; side −1 — левая, 1 — правая ----------
  buildPage(blocks, side, idx) {
    const c = this.add.container(960, 540).setDepth(10);
    c.add(this.add.image(side * W / 2, 0, side > 0 ? 'credits_page_r' : 'credits_page_l'));
    const cx = side * W / 2 + (side > 0 ? 14 : -14);
    const g = this.add.graphics(); c.add(g);
    const total = blocks.reduce((s, b) => s + this.blockHeight(b), 0);
    let y = -H / 2 + Math.max(70, (H - total) / 2);
    for (const b of blocks) {
      const h = this.blockHeight(b);
      this.addBlock(c, g, b, cx, y, idx);
      y += h;
    }
    c.shade = this.add.rectangle(side * W / 2, 0, W, H, 0x2a1a10, 0);
    c.add(c.shade);
    return c;
  }

  blockHeight(b) {
    switch (b.t) {
      case 'spider': return 170;
      case 'title': return 92;
      case 'sub': return 70;
      case 'note': return 150;
      case 'h': return 74;
      case 'p': return (b.s.split('\n').length) * 34 + 30;
      case 'cast': return b.rows.length * 52 + 10;
      case 'lyrics': return b.lines.length * 38 + 10;
      case 'drawing': return 300;
      case 'sign': return 60;
      default: return 40;
    }
  }

  addBlock(c, g, b, cx, y, idx) {
    const T = (str, style, color, extra = {}) => {
      const t = this.add.text(cx, y, str, text(style, { color, align: 'center', ...extra })).setOrigin(0.5, 0).setResolution(2);
      c.add(t); return t;
    };
    switch (b.t) {
      case 'spider': {
        // Тихон на нитке — покачивается, пока страница открыта
        const rig = this.add.container(cx, y - 60);
        const th = this.add.graphics(); th.lineStyle(2, 0x9aa3b5, 0.8).lineBetween(0, -40, 0, 120);
        const sp = this.add.image(0, 120, 'spider_corner').setOrigin(0.5, 8 / 170).setScale(0.62);
        rig.add([th, sp]); c.add(rig);
        if (!this.reduced) { rig.setAngle(-4); this.tweens.add({ targets: rig, angle: 4, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }); }
        break;
      }
      case 'title': T(b.s, 'heading-1', INK.red); break;
      case 'sub': T(b.s, 'heading-4', INK.soft); break;
      case 'note': T(b.s, 'hand-3', INK.soft, { lineSpacing: 6 }); break;
      case 'h': {
        const t = T(b.s, 'heading-3', INK.ink);
        inkUnderline(g, cx - t.width / 2, y + 50, t.width, { seed: 11 + idx, color: INKN.red, alpha: 0.55, width: 2, passes: 1 });
        break;
      }
      case 'p': T(b.s, 'body-9', INK.ink, { lineSpacing: 2 }); break;
      case 'cast':
        b.rows.forEach(([name, role], i) => {
          const yy = y + i * 52;
          c.add(this.add.text(cx - 14, yy, name, text('heading-5', { color: INK.red })).setOrigin(1, 0).setResolution(2));
          c.add(this.add.text(cx + 14, yy + 2, role, text('hand-2', { color: INK.soft })).setOrigin(0, 0).setResolution(2));
        });
        break;
      case 'lyrics': {
        const threads = this.add.graphics(); c.add(threads);
        let k = 0;
        b.lines.forEach((line, i) => {
          if (!line) return;
          const t = this.add.text(cx, y + i * 38, line, { fontFamily: FONT.hand, fontSize: '32px', color: INK.blue }).setOrigin(0.5, 0).setResolution(2);
          c.add(t);
          if (b.verse == null) return;
          t.setAlpha(FAINT);
          const at = songLineAt(b.verse, k++);
          this.lyrics.push({ t, at, page: c, threads, x0: cx - t.width / 2 - 6, x1: cx + t.width / 2 + 6, y: y + i * 38 + 37, inked: false });
        });
        break;
      }
      case 'drawing': {
        const j = Journal.reload();
        const spec = j.drawings.length ? j.drawings[j.drawings.length - 1] : { kind: 'final_recovered', seed: 7 };
        const key = drawingTexture(this, specKey(spec), spec);
        const img = this.add.image(cx, y + 140, key).setScale(0.42).setAngle(-2);
        const tape = this.add.rectangle(cx, y + 140 - img.displayHeight / 2, 110, 26, 0xf2e2a8, 0.75).setAngle(3);
        c.add([img, tape]);
        break;
      }
      case 'sign': c.add(this.add.text(cx + 220, y, b.s, { fontFamily: FONT.hand, fontSize: '36px', color: INK.red }).setOrigin(1, 0).setResolution(2)); break;
      default: break;
    }
  }

  // ---------- «прошивка» строк под песню ----------
  makeStitcher() {
    // паучок на нитке; живёт в контейнере той страницы, где сейчас поют
    this.stitcher = this.reduced ? null : this.add.image(0, 0, 'spider_corner').setOrigin(0.5, 8 / 170).setScale(0.17).setVisible(false);
    this.lyricsByPage = new Map();
    for (const L of this.lyrics) {
      if (!this.lyricsByPage.has(L.threads)) this.lyricsByPage.set(L.threads, []);
      this.lyricsByPage.get(L.threads).push(L);
    }
  }

  // Время песни: позиция трека; если музыки нет (выключен звук, файл не загрузился) — часы сцены.
  songTime(dt) {
    this.clock += dt;
    const pos = Music.position(this.songKey);
    if (pos != null) { this.songT = pos; this.heard = true; }
    else if (!this.heard && (Music.silent(this.songKey) || this.clock > 3)) this.songT += dt; // ждём загрузки не дольше 3 с
    // (песня кончилась — время стоит на месте)
    return this.songT + (this.tOffset || 0);
  }

  // для отладки и съёмки: перемотать «прошивку» на t секунд песни (сама музыка не перематывается)
  seek(t) { this.tOffset = t - this.songT; }

  update(time, delta) {
    const t = this.songTime(Math.min(delta, 100) / 1000);
    // нитки: спетые строки — целиком, текущая — по ходу строки
    let cur = null;
    for (const [g, list] of this.lyricsByPage) {
      g.clear();
      for (const L of list) {
        if (t < L.at) continue;
        const k = Math.min(1, (t - L.at) / SUNG_S);
        if (t < L.at + LINE_S) cur = { L, k };
        if (!L.inked) {
          L.inked = true;
          if (this.reduced) L.t.setAlpha(1);
          else this.tweens.add({ targets: L.t, alpha: 1, duration: 1100, ease: 'Sine.easeOut' });
        }
        const x = L.x0 + (L.x1 - L.x0) * (this.reduced ? 1 : k);
        g.lineStyle(1.6, 0x8e98ad, 0.75);
        g.beginPath(); g.moveTo(L.x0, L.y);
        // шёлковая нитка чуть провисает
        const sag = Math.min(3, (x - L.x0) * 0.01);
        for (let s = 1; s <= 8; s++) {
          const u = s / 8;
          g.lineTo(L.x0 + (x - L.x0) * u, L.y + sag * 4 * u * (1 - u));
        }
        g.strokePath();
      }
    }
    // паучок — на кончике текущей нитки, догоняет её (между строками перебегает к началу следующей)
    const sp = this.stitcher;
    if (sp) {
      const page = cur && cur.L.page;
      const visible = !!(cur && page.visible && page.scaleX > 0.98);
      if (visible) {
        if (sp.parentContainer !== page) { page.add(sp); sp.setPosition(cur.L.x0, cur.L.y); }
        const tx = cur.L.x0 + (cur.L.x1 - cur.L.x0) * cur.k; const ty = cur.L.y;
        const a = Math.min(1, delta / 1000 * 9);
        sp.x += (tx - sp.x) * a; sp.y += (ty - sp.y) * a;
        sp.setAngle(Math.sin(time / 260) * 4);
      }
      sp.setVisible(visible);
    }
    // автолистание по песне: разворот открывается, когда в песне начинается «его» куплет
    if (this.auto && !this.busy && this.idx < this.pages.length - 1 && t >= SPREAD_AT[this.idx + 1]) this.turn(1);
  }

  updateArrows() {
    this.prevBtn.setAlpha(this.idx > 0 ? 1 : 0.35);
    this.nextBtn.setAlpha(this.idx < this.pages.length - 1 ? 1 : 0.35);
  }

  // Переворот: текущая страница сжимается к корешку, затем с другой стороны раскрывается следующая.
  turn(dir) {
    if (this.busy || this.leaving) return;
    const next = this.idx + dir;
    if (next < 0 || next >= this.pages.length) return;
    this.busy = true;
    const cur = this.pages[this.idx]; const nxt = this.pages[next];
    const going = dir > 0 ? cur.right : cur.left; const under = dir > 0 ? nxt.right : nxt.left;
    const coming = dir > 0 ? nxt.left : nxt.right; const leaving = dir > 0 ? cur.left : cur.right;
    Audio.play('page', { volume: 0.45 });
    under.setVisible(true).setDepth(15).setScale(1, 1);
    going.setDepth(30);
    const half = this.reduced ? 1 : 340;
    this.tweens.add({ targets: going.shade, fillAlpha: 0.35, duration: half, ease: 'Sine.easeIn' });
    this.tweens.add({
      targets: going, scaleX: 0, duration: half, ease: 'Sine.easeIn',
      onComplete: () => {
        going.setVisible(false).setScale(1, 1); going.shade.fillAlpha = 0;
        coming.setVisible(true).setDepth(30).setScale(0, 1); coming.shade.fillAlpha = 0.35;
        this.tweens.add({ targets: coming.shade, fillAlpha: 0, duration: half, ease: 'Sine.easeOut' });
        this.tweens.add({
          targets: coming, scaleX: 1, duration: half, ease: 'Sine.easeOut',
          onComplete: () => {
            leaving.setVisible(false); coming.setDepth(10); under.setDepth(10);
            this.idx = next; this.busy = false; this.updateArrows();
          },
        });
      },
    });
  }

  leave() {
    if (this.leaving) return;
    this.leaving = true;
    Music.stop({ fade: 900 });
    PageTurn.go(this, 'Menu', {}, { back: 'night', ms: 1300 });
  }
}
