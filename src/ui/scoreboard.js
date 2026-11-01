// Табло мини-игр: счёт на бумажной бирке и строка статуса на записке под ней.
// Цвет карандашной черты под статусом подсказывает, чей сейчас ход и чем закончился ход.
import { INK, INKN, S, EASE, MOTION, text } from '../config/theme.js';
import { paperTexture, inkUnderline } from './paper.js';

const TONE = { boy: INKN.blue, spider: INKN.violet, good: INKN.green, bad: INKN.red, normal: null };
const SCORE_H = 72;
const STATUS_H = 54;
const bucket = (w) => Math.ceil(w / 24) * 24;

export class Scoreboard {
  constructor(scene, { x = 960, y = S[400] + SCORE_H / 2, reduced = false } = {}) {
    this.scene = scene; this.x = x; this.y = y; this.reduced = reduced;
    this.scoreBg = scene.add.image(x, y, '__DEFAULT');
    this.score = scene.add.text(x, y - 2, '', text('heading-3', { color: INK.ink })).setOrigin(0.5).setResolution(2);
    this.statusY = y + SCORE_H / 2 + S[200] + STATUS_H / 2;
    this.statusBg = scene.add.image(x, this.statusY, '__DEFAULT').setAngle(0.6);
    this.status = scene.add.text(x, this.statusY - 2, '', text('hand-3', { color: INK.ink })).setOrigin(0.5).setResolution(2);
    this.line = scene.add.graphics();
    this.items = [this.scoreBg, this.score, this.statusBg, this.line, this.status];
    this.scoreW = 0; this.statusW = 0;
  }

  setScore(str) {
    this.score.setText(str);
    const w = bucket(Math.max(320, Math.ceil(this.score.width) + S[600] * 2));
    if (w !== this.scoreW) {
      this.scoreW = w;
      this.scoreBg.setTexture(paperTexture(this.scene, w, SCORE_H, { kind: 'cream', seed: 6, tape: 'corners' }));
    }
  }

  bump() {
    if (this.reduced) return;
    this.scene.tweens.add({ targets: this.score, scale: { from: 1.14, to: 1 }, duration: MOTION.base, ease: 'Back.easeOut' });
  }

  setStatus(str, tone = 'normal') {
    const changed = str !== this.status.text;
    this.status.setText(str);
    const w = bucket(Math.max(360, Math.ceil(this.status.width) + S[500] * 2));
    if (w !== this.statusW) {
      this.statusW = w;
      this.statusBg.setTexture(paperTexture(this.scene, w, STATUS_H, { kind: 'note', seed: 8 }));
    }
    const c = TONE[tone] ?? null;
    this.line.clear();
    if (c !== null) {
      const tw = Math.ceil(this.status.width);
      inkUnderline(this.line, this.x - tw / 2, this.statusY + 16, tw, { seed: str.length + 3, color: c, width: 2.6, alpha: 0.8 });
    }
    if (changed && !this.reduced) {
      this.scene.tweens.killTweensOf(this.status);
      this.status.setAlpha(0.2).setY(this.statusY + 4);
      this.scene.tweens.add({ targets: this.status, alpha: 1, y: this.statusY - 2, duration: 220, ease: EASE });
      if (tone === 'bad') {
        this.scene.tweens.killTweensOf([this.statusBg, this.line]);
        this.scene.tweens.add({ targets: [this.statusBg, this.status], x: { from: this.x + 8, to: this.x }, duration: 420, ease: 'Elastic.easeOut' });
        this.scene.tweens.add({ targets: this.line, x: { from: 8, to: 0 }, duration: 420, ease: 'Elastic.easeOut' });
      }
    }
  }
}
