// Субтитры — листок из блокнота внизу экрана: имя говорящего его «чернилами», текст реплики печатается
// быстрее голоса (буквы не прыгают: перенос строк считается заранее). Субтитры показываются всегда.
// Клик по листку или пробел — следующая реплика.
// В комнате листок широкий и стоит внизу по центру. В мини-играх сцена задаёт компактную раскладку
// (setLayout): листок уже, шрифт мельче и стоит на свободном месте — иначе он закрывал бы нижний ряд
// кнопок и клеток, а клик по нему пропускал бы реплику вместо хода.
import { INK, INKN, EASE, MOTION, S, text } from '../config/theme.js';
import { SPEAKERS, prefersReducedMotion } from '../config/game.js';
import { voice } from '../systems/voice.js';
import { paperTexture, inkUnderline, tilt } from './paper.js';
import { lineText } from '../i18n/index.js';

const WIDTH = 1360;
const PAD_X = S[500]; const PAD_Y = S[300];
const BOTTOM = 1080 - S[500];
const DEFAULT = { x: 960, bottom: BOTTOM, width: WIDTH, compact: false };
const CPS = 70; // скорость «печати», знаков в секунду

const seedOf = (id) => { let h = 7; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) % 9973; return h + 1; };

export class Subtitles {
  constructor(scene) {
    this.scene = scene;
    this.reduced = prefersReducedMotion();
    this.container = scene.add.container(960, BOTTOM).setDepth(1000).setAlpha(0).setVisible(false);
    this.sheet = scene.add.container(0, 0);
    this.paper = scene.add.image(0, 0, '__DEFAULT');
    this.ink = scene.add.graphics();
    this.name = scene.add.text(0, 0, '', text('heading-5')).setResolution(2);
    this.body = scene.add.text(0, 0, '', text('body-7', { color: INK.ink, fontStyle: '500' })).setResolution(2);
    this.body.noTranslate = true; // текст уже на нужном языке (lineText), а печать «по буквам» не должна переводиться
    this.hint = scene.add.text(0, 0, 'клик — дальше', text('hand-1', { color: INK.faded })).setOrigin(1, 1).setResolution(2);
    this.zone = scene.add.zone(0, 0, WIDTH, 160).setInteractive({ useHandCursor: true });
    this.zone.on('pointerdown', () => voice.skip());
    this.sheet.add([this.paper, this.ink, this.name, this.body, this.hint]);
    this.container.add([this.sheet, this.zone]);
    this.currentId = null;
    this.line = null;
    this.full = '';
    this.setLayout(null);
  }

  // layout: { x, bottom, width, compact } — x и bottom: центр нижнего края листка; null — обычная раскладка.
  setLayout(layout) {
    const L = { ...DEFAULT, ...(layout || {}) };
    this.layout = L;
    const c = !!L.compact;
    this.padX = c ? S[300] : PAD_X;
    this.padY = c ? S[200] : PAD_Y;
    this.gap = c ? S[50] : S[75];
    const nameSt = text(c ? 'heading-6' : 'heading-5');
    const bodySt = text(c ? 'body-9' : 'body-7');
    this.name.setFontSize(nameSt.fontSize);
    this.body.setFontSize(bodySt.fontSize).setLineSpacing(bodySt.lineSpacing + (c ? 2 : 4));
    this.hint.setVisible(!c);
    this.container.setPosition(L.x, L.bottom);
    if (this.currentId && this.line) this.render(this.line, false);
  }

  show(line) {
    this.currentId = line.id;
    this.line = line;
    this.render(line, !this.reduced);
    const sc = this.scene;
    sc.tweens.killTweensOf(this.container);
    sc.tweens.killTweensOf(this.sheet);
    this.container.setVisible(true);
    if (this.reduced) { sc.tweens.add({ targets: this.container, alpha: 1, duration: MOTION.fadeMin, ease: EASE }); return; }
    const base = this.sheet.angle;
    this.sheet.setY(12).setAngle(base - 0.8);
    sc.tweens.add({ targets: this.container, alpha: 1, duration: 220, ease: EASE });
    sc.tweens.add({ targets: this.sheet, y: 0, angle: base, duration: 380, ease: 'Back.easeOut' });
  }

  render(line, reveal) {
    const speaker = SPEAKERS[line.speaker] || {};
    const inkColor = speaker.ink || INK.red;
    const { padX, padY, gap } = this;
    const c = this.layout.compact;
    this.name.setText(line.speaker).setColor(inkColor);
    // перенос строк — заранее, по полной реплике; дальше текст печатается без переносов «на лету»
    this.body.setWordWrapWidth(this.layout.width - padX * 2, true);
    const lines = this.body.getWrappedText(lineText(line));
    this.full = lines.join('\n');
    this.body.setWordWrapWidth(null);
    this.body.setText(this.full);
    const contentW = Math.max(this.body.width, this.name.width + 40);
    const W = c ? Math.min(this.layout.width, Math.ceil(contentW) + padX * 2) : this.layout.width;
    const nameH = Math.ceil(this.name.height);
    const h = Math.ceil(padY + nameH + gap + this.body.height + padY + (c ? 0 : 6));
    const top = -h;
    const seed = seedOf(line.id);
    this.paper.setTexture(paperTexture(this.scene, W, h, { kind: 'cream', seed: (seed % 7) + 1, edge: 'torn', tornSides: 'tb' }));
    this.paper.setPosition(0, top + h / 2);
    this.sheet.setAngle(c ? 0 : tilt(seed, 0.35));
    this.name.setPosition(-W / 2 + padX, top + padY - 2);
    this.body.setPosition(-W / 2 + padX, top + padY + nameH + gap);
    this.hint.setPosition(W / 2 - padX + 8, top + padY + nameH - 2);
    this.ink.clear();
    inkUnderline(this.ink, -W / 2 + padX, top + padY + nameH + 1, Math.ceil(this.name.width) + 6, {
      seed, color: Number.parseInt(inkColor.slice(1), 16) || INKN.red, alpha: 0.55, width: 2, passes: 1,
    });
    this.zone.setSize(W, h).setPosition(0, -h / 2);
    if (this.zone.input && this.zone.input.hitArea) this.zone.input.hitArea.setTo(0, 0, W, h);
    if (this.typeTween) { this.typeTween.stop(); this.typeTween = null; }
    if (!reveal) return;
    const full = this.full; const holder = { n: 0 };
    this.body.setText('');
    this.typeTween = this.scene.tweens.add({
      targets: holder, n: full.length, duration: Math.max(200, (full.length / CPS) * 1000), ease: 'Linear',
      onUpdate: () => this.body.setText(full.slice(0, Math.round(holder.n))),
      onComplete: () => { this.body.setText(full); this.typeTween = null; },
    });
  }

  hide(id) {
    if (id && id !== this.currentId) return;
    this.currentId = null;
    const sc = this.scene;
    sc.tweens.killTweensOf(this.container);
    sc.tweens.add({
      targets: this.container, alpha: 0, duration: MOTION.fadeMin, ease: EASE,
      onComplete: () => { if (!this.currentId) this.container.setVisible(false); },
    });
    if (!this.reduced) sc.tweens.add({ targets: this.sheet, y: 6, duration: MOTION.fadeMin, ease: EASE });
  }
}
