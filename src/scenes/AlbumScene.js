// Альбом: рисунки мальчика из всех забегов и письма Тихона. Открывается из меню поверх него
// (меню на паузе). Разворот блокнота на пружине: по 4 рисунка на странице, клик — рисунок крупно.
// Вкладки «Рисунки» / «Письма», стрелки и ←/→ листают, Esc — закрыть.
import * as Phaser from 'phaser';
import { CSS, INK, INKN, EASE, MOTION, S, text } from '../config/theme.js';
import { prefersReducedMotion } from '../config/game.js';
import { paperTexture, inkUnderline } from '../ui/paper.js';
import { Button, FocusRing } from '../ui/button.js';
import { Journal, ENDINGS } from '../systems/journal.js';
import { drawingTexture, specKey, captionFor, DRAW_W, DRAW_H } from '../systems/drawings.js';
import { showLetter } from '../ui/letterCard.js';
import { Audio } from '../systems/audio.js';
import { I18n } from '../i18n/index.js';

const PAGE = { w: 780, h: 860, gap: 36 };
const LEFT_X = 960 - PAGE.gap / 2 - PAGE.w / 2; const RIGHT_X = 960 + PAGE.gap / 2 + PAGE.w / 2;
const TOP = 540 - PAGE.h / 2;
const PER_PAGE = 4; const THUMB = 0.5;

export class AlbumScene extends Phaser.Scene {
  constructor() { super('Album'); }

  init(data) { this.from = (data && data.from) || 'Menu'; this.tab = 'drawings'; this.spread = 0; }

  create() {
    this.reduced = prefersReducedMotion();
    const j = Journal.reload();
    this.drawings = j.drawings.slice().reverse(); // новые — первыми
    this.letters = j.letters.slice().reverse();
    this.root = this.add.container(0, 0).setAlpha(0);
    this.root.add(this.add.rectangle(960, 540, 1920, 1080, 0x04060c, 0.78).setInteractive());
    // разворот: две страницы и пружина
    this.book = this.add.container(0, 0);
    this.root.add(this.book);
    this.book.add(this.add.image(LEFT_X, 540, paperTexture(this, PAGE.w, PAGE.h, { kind: 'light', seed: 31, ruled: 'grid' })));
    this.book.add(this.add.image(RIGHT_X, 540, paperTexture(this, PAGE.w, PAGE.h, { kind: 'light', seed: 32, ruled: 'grid' })));
    const g = this.add.graphics();
    for (let y = TOP + 40; y < TOP + PAGE.h - 20; y += 44) {
      g.fillStyle(0x0b1124, 0.5).fillCircle(960 - 26, y, 7).fillCircle(960 + 26, y, 7);
      g.lineStyle(5, 0x9aa3b5, 1).beginPath(); g.arc(960, y, 26, Math.PI * 1.05, Math.PI * 1.95, false); g.strokePath();
      g.lineStyle(2, 0xe8ecf3, 0.8).beginPath(); g.arc(960, y - 1, 25, Math.PI * 1.15, Math.PI * 1.6, false); g.strokePath();
    }
    this.book.add(g);
    this.content = this.add.container(0, 0);
    this.book.add(this.content);
    // вкладки-закладки и кнопки
    this.tabBtns = {
      drawings: new Button(this, RIGHT_X + PAGE.w / 2 - 340, TOP - 34, { label: 'Рисунки', width: 200, height: 56, variant: 'segment', style: 'button-lg', onClick: () => this.setTab('drawings') }),
      letters: new Button(this, RIGHT_X + PAGE.w / 2 - 120, TOP - 34, { label: 'Письма', width: 200, height: 56, variant: 'segment', style: 'button-lg', onClick: () => this.setTab('letters') }),
    };
    this.prevBtn = new Button(this, LEFT_X - PAGE.w / 2 + 70, TOP + PAGE.h + 40, { label: '‹', width: 96, height: 56, variant: 'secondary', style: 'button-2xl', onClick: () => this.flip(-1) });
    this.nextBtn = new Button(this, RIGHT_X + PAGE.w / 2 - 70, TOP + PAGE.h + 40, { label: '›', width: 96, height: 56, variant: 'secondary', style: 'button-2xl', onClick: () => this.flip(1) });
    this.closeBtn = new Button(this, 960, TOP + PAGE.h + 40, { label: 'Закрыть', width: 240, height: 56, variant: 'primary', style: 'button-xl', onClick: () => this.close() });
    this.root.add([this.tabBtns.drawings, this.tabBtns.letters, this.prevBtn, this.nextBtn, this.closeBtn]);
    this.focus = new FocusRing(this, [this.tabBtns.drawings, this.tabBtns.letters, this.prevBtn, this.closeBtn, this.nextBtn]);
    this.input.keyboard.on('keydown-LEFT', () => this.flip(-1));
    this.input.keyboard.on('keydown-RIGHT', () => this.flip(1));
    this.input.keyboard.on('keydown-ESC', () => { if (this.zoomed) this.unzoom(); else this.close(); });
    this.render();
    Audio.play('page', { volume: 0.5 });
    this.tweens.add({ targets: this.root, alpha: 1, duration: MOTION.base, ease: EASE });
    if (!this.reduced) { this.book.setY(40).setAngle(-1); this.tweens.add({ targets: this.book, y: 0, angle: 0, duration: 650, ease: 'Back.easeOut' }); }
    window.__album = this;
  }

  pages() {
    const n = this.tab === 'drawings' ? this.drawings.length : this.letters.length;
    const per = this.tab === 'drawings' ? PER_PAGE : 6;
    return Math.max(1, Math.ceil(n / (per * 2)));
  }

  setTab(tab) {
    if (this.tab === tab) return;
    this.tab = tab; this.spread = 0;
    Audio.play('page', { volume: 0.4 });
    this.render();
  }

  flip(dir) {
    const next = Phaser.Math.Clamp(this.spread + dir, 0, this.pages() - 1);
    if (next === this.spread || this.zoomed) return;
    this.spread = next;
    Audio.play(`paper_${1 + Math.floor(Math.random() * 3)}`, { volume: 0.45 });
    if (this.reduced) { this.render(); return; }
    this.tweens.add({
      targets: this.content, alpha: 0, x: -dir * 30, duration: 160, ease: 'Sine.easeIn',
      onComplete: () => { this.render(); this.content.setX(dir * 30); this.tweens.add({ targets: this.content, alpha: 1, x: 0, duration: 240, ease: EASE }); },
    });
  }

  render() {
    this.content.removeAll(true);
    for (const [k, b] of Object.entries(this.tabBtns)) b.setSelected(k === this.tab);
    const pages = this.pages();
    this.prevBtn.setDisabled(this.spread <= 0);
    this.nextBtn.setDisabled(this.spread >= pages - 1);
    const head = (x, str, sub) => {
      const t = this.add.text(x - PAGE.w / 2 + 56, TOP + 40, str, text('heading-4', { color: INK.ink })).setResolution(2);
      const gg = this.add.graphics();
      inkUnderline(gg, t.x, t.y + 40, Math.ceil(t.width) + 8, { seed: 5, color: INKN.red, alpha: 0.6, width: 2.2, passes: 1 });
      const s = this.add.text(x + PAGE.w / 2 - 48, TOP + 50, sub, text('hand-2', { color: INK.soft })).setOrigin(1, 0).setResolution(2);
      this.content.add([t, gg, s]);
    };
    head(LEFT_X, this.tab === 'drawings' ? 'Альбом' : 'Письма Тихона', `${this.spread + 1} / ${pages}`);
    if (this.tab === 'drawings') this.renderDrawings(); else this.renderLetters();
  }

  renderDrawings() {
    if (!this.drawings.length) { this.empty('Пока пусто. Первый рисунок появится после первой ночи.'); return; }
    const start = this.spread * PER_PAGE * 2;
    const items = this.drawings.slice(start, start + PER_PAGE * 2);
    items.forEach((spec, i) => {
      const page = i < PER_PAGE ? LEFT_X : RIGHT_X; const k = i % PER_PAGE;
      const x = page + (k % 2 ? 1 : -1) * 182; const y = TOP + 270 + Math.floor(k / 2) * 340;
      const key = drawingTexture(this, specKey(spec), spec);
      const ang = ((i * 37) % 7) - 3;
      const c = this.add.container(x, y).setAngle(ang * 0.8);
      const sh = this.add.rectangle(8, 10, DRAW_W * THUMB, DRAW_H * THUMB, 0x000000, 0.22);
      const img = this.add.image(0, 0, key).setScale(THUMB);
      const tape = this.add.rectangle(0, -DRAW_H * THUMB / 2 + 2, 90, 26, 0xf3e6c0, 0.75).setAngle(-ang + 2);
      const label = spec.kind === 'day' ? `Зима ${spec.run || 1} · день ${spec.day}` : spec.kind === 'anya' ? 'Тридцать зим назад' : `Зима ${spec.run || 1} · финал`;
      const cap = this.add.text(0, DRAW_H * THUMB / 2 + 14, label, text('hand-1', { color: INK.soft })).setOrigin(0.5, 0).setResolution(2);
      c.add([sh, img, tape, cap]);
      img.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.zoom(spec));
      this.content.add(c);
    });
  }

  renderLetters() {
    if (!this.letters.length) { this.empty('Писем пока нет. Тихон пишет их в конце зимы.'); return; }
    const per = 6; const start = this.spread * per * 2;
    // письмо на языке интерфейса (в альбоме хранятся обе версии: l и l.alt)
    const inLang = (l) => ((l.lang || 'ru') === I18n.lang || !l.alt ? l : l.alt);
    this.letters.slice(start, start + per * 2).map(inLang).forEach((l, i) => {
      const page = i < per ? LEFT_X : RIGHT_X; const k = i % per;
      const x = page - PAGE.w / 2 + 64; const y = TOP + 140 + k * 112;
      const end = ENDINGS.find((e) => e.id === l.ending);
      const env = this.add.container(x, y);
      const bg = this.add.image(PAGE.w / 2 - 64, 40, paperTexture(this, PAGE.w - 128, 92, { kind: 'cream', seed: 40 + i }));
      const n = this.letters.length - (start + i);
      const t1 = this.add.text(24, 16, `Письмо №${n}${end ? ` · финал «${end.title}»` : ''}`, text('heading-6', { color: INK.ink })).setResolution(2);
      const first = (l.paragraphs && l.paragraphs[1]) || '';
      const t2 = this.add.text(24, 50, first.length > 58 ? `${first.slice(0, 56)}…` : first, text('hand-1', { color: INK.soft })).setResolution(2);
      env.add([bg, t1, t2]);
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.read(l));
      this.content.add(env);
    });
  }

  empty(str) {
    this.content.add(this.add.text(LEFT_X, 540, str, text('hand-3', { color: INK.faded, align: 'center', wordWrap: { width: PAGE.w - 160 } })).setOrigin(0.5).setResolution(2));
  }

  zoom(spec) {
    if (this.zoomed) return;
    Audio.play('paper_1', { volume: 0.45 });
    const c = this.add.container(960, 520).setDepth(50);
    const dim = this.add.rectangle(0, 20, 1920, 1080, 0x04060c, 0.6).setInteractive();
    const img = this.add.image(0, 0, drawingTexture(this, specKey(spec), spec)).setScale(1.3);
    const cap = this.add.text(0, DRAW_H * 0.65 + 28, captionFor(spec), text('hand-4', { color: CSS.paper })).setOrigin(0.5, 0).setResolution(2);
    c.add([dim, this.add.rectangle(16, 18, DRAW_W * 1.3, DRAW_H * 1.3, 0x000000, 0.35), img, cap]);
    dim.on('pointerdown', () => this.unzoom()); img.setInteractive().on('pointerdown', () => this.unzoom());
    c.setAlpha(0).setScale(0.9);
    this.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 300, ease: EASE });
    this.zoomed = c;
  }

  unzoom() {
    const c = this.zoomed; if (!c) return;
    this.zoomed = null;
    this.tweens.add({ targets: c, alpha: 0, duration: 200, onComplete: () => c.destroy() });
  }

  async read(l) {
    if (this.reading) return;
    this.reading = true;
    await showLetter(this, l, { instant: true, depth: 60, button: 'Закрыть' });
    this.reading = false;
  }

  close() {
    if (this.closing || this.reading) return;
    this.closing = true;
    Audio.play('page', { volume: 0.4 });
    this.tweens.add({
      targets: this.root, alpha: 0, duration: MOTION.fade, ease: EASE,
      onComplete: () => { this.scene.resume(this.from); this.scene.stop(); },
    });
  }
}
