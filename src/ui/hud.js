// HUD дня — записка на скотче в левом верхнем углу: «День N», пять кружков-дней (галочка — победа,
// крестик — поражение), нити Тихона (победы), искры Огнёвки (поражения) и градусник «Жар» без чисел.
// Всё нарисовано карандашом и чернилами; при итоге дня отметка «ставится» с лёгким нажимом.
import * as Phaser from 'phaser';
import { INK, INKN, EASE, MOTION, S, text } from '../config/theme.js';
import { TOTAL_DAYS, WINS_TO_RECOVER, LOSSES_TO_HOSPITAL, prefersReducedMotion } from '../config/game.js';
import { wellbeingFor } from '../state.js';
import { paperTexture, inkCircle, inkCheck, inkCross, inkStroke, inkLine, rng } from './paper.js';

const X = S[500]; const Y = S[400];
const W = 452; const H = 236;
const ROW_Y = [44, 104, 150, 198];
const ICON_X = 262;
const MARK_X = 214; const MARK_GAP = 46;
const TUBE = { x: 112, w: 150 };

const heatOf = (t) => Phaser.Math.Clamp((t - 36.6) / (40.2 - 36.6), 0, 1);

export class Hud extends Phaser.GameObjects.Container {
  constructor(scene, { day, results, temp, wins = 0, losses = 0 }) {
    super(scene, X, Y);
    this.reduced = prefersReducedMotion();
    this.wins = wins; this.losses = losses;
    this.day = day;
    this.results = results.slice();
    this.temp = temp;
    this.highlight = -1;
    this.h = H;
    this.paper = scene.add.image(W / 2, H / 2, paperTexture(scene, W, H, { kind: 'note', seed: 3, tape: 'top', edge: 'cut' }));
    const label = (row, t, style = 'hand-3', color = INK.soft) => scene.add.text(S[300], ROW_Y[row], t, text(style, { color })).setOrigin(0, 0.5).setResolution(2);
    this.dayLabel = label(0, '', 'heading-3', INK.ink);
    this.threadLabel = label(1, 'Нити Тихона');
    this.emberLabel = label(2, 'Искры Огнёвки');
    this.heatLabel = label(3, 'Жар');
    this.heatWord = scene.add.text(W - S[300], ROW_Y[3], '', text('hand-2', { color: INK.ink })).setOrigin(1, 0.5).setResolution(2);
    this.icons = scene.add.graphics();
    this.meter = scene.add.graphics();
    this.add([this.paper, this.dayLabel, this.threadLabel, this.emberLabel, this.heatLabel, this.heatWord, this.icons, this.meter]);
    this.markDots = [];
    for (let i = 0; i < TOTAL_DAYS; i++) {
      const g = scene.add.graphics({ x: MARK_X + i * MARK_GAP, y: ROW_Y[0] + 2 });
      this.markDots.push(g); this.add(g);
    }
    this.setAngle(-1.1);
    this.drawMarks(); this.drawIcons(); this.setTemp(temp);
    this.setAlpha(0);
    scene.add.existing(this);
  }

  drawMarks() {
    this.dayLabel.setText(`День ${this.day}`);
    this.markDots.forEach((g, i) => {
      g.clear();
      const res = this.results[i];
      const cur = i === this.day - 1 || i === this.highlight;
      inkCircle(g, 0, 0, 15, { seed: 20 + i, color: cur ? INKN.ink : INKN.pencil, width: cur ? 2.8 : 1.8, alpha: cur ? 0.95 : 0.55, passes: cur ? 2 : 1 });
      if (res === 'win') inkCheck(g, 1, 0, 17, { seed: 40 + i, color: INKN.green, width: 3.6 });
      else if (res === 'loss') inkCross(g, 0, 0, 16, { seed: 60 + i, color: INKN.red, width: 3.4 });
    });
  }

  drawIcons() {
    const g = this.icons; g.clear();
    for (let i = 0; i < WINS_TO_RECOVER; i++) {
      const x = ICON_X + 30 + i * 56; const y = ROW_Y[1]; const on = i < this.wins;
      // нить: волнистая вертикальная линия с узелком
      const pts = []; for (let k = 0; k <= 10; k++) pts.push([x + Math.sin(k * 0.9) * 4, y - 19 + k * 3.8]);
      if (on) {
        inkStroke(g, pts, { seed: 80 + i, color: 0x5f7fa8, width: 3.2, amp: 0.4 });
        inkStroke(g, pts.map(([px, py]) => [px - 1, py]), { seed: 81 + i, color: 0xffffff, width: 1.2, alpha: 0.7, amp: 0.3, passes: 1 });
        g.fillStyle(0x5f7fa8, 1).fillCircle(x, y - 19, 4.5);
      } else {
        for (let k = 0; k < 10; k += 2) inkLine(g, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], { seed: 90 + i * 10 + k, color: INKN.pencil, width: 1.6, alpha: 0.45, passes: 1 });
      }
    }
    for (let i = 0; i < LOSSES_TO_HOSPITAL; i++) {
      const x = ICON_X + 30 + i * 56; const y = ROW_Y[2] + 2; const on = i < this.losses;
      // искра: капля пламени
      const flame = [];
      for (let k = 0; k <= 18; k++) {
        const a = Math.PI / 2 + (k / 18) * Math.PI * 2;
        const rr = 10 * (1 - 0.0 * Math.sin(a));
        const px = Math.cos(a) * rr; let py = Math.sin(a) * rr;
        if (py < 0) py *= 2.0 + Math.cos(a) * 0.2;
        flame.push([x + px, y + 4 + py]);
      }
      if (on) {
        g.fillStyle(0xd9603b, 1).fillTriangle(x - 9, y + 2, x + 9, y + 2, x, y - 18);
        g.fillCircle(x, y + 4, 9.5);
        g.fillStyle(0xf2a65a, 1).fillCircle(x, y + 6, 4.5);
        inkStroke(g, flame, { seed: 100 + i, color: 0x8a2f18, width: 1.8, alpha: 0.8, close: true, passes: 1 });
      } else {
        inkStroke(g, flame, { seed: 110 + i, color: INKN.pencil, width: 1.6, alpha: 0.45, close: true, passes: 1 });
      }
    }
  }

  setTemp(t) {
    this.temp = t;
    const k = heatOf(t);
    const g = this.meter; g.clear();
    const y = ROW_Y[3]; const x0 = TUBE.x; const L = TUBE.w;
    // стеклянная трубка с колбой
    g.fillStyle(0xffffff, 0.55).fillRoundedRect(x0, y - 7, L, 14, 7);
    g.fillStyle(0xc0392b, 1).fillCircle(x0, y, 11);
    g.fillRoundedRect(x0, y - 4, Math.max(8, (L - 10) * (0.1 + 0.9 * k)), 8, 4);
    g.fillStyle(0xffffff, 0.55).fillCircle(x0 - 3, y - 4, 3);
    inkCircle(g, x0, y, 12, { seed: 130, color: INKN.ink, width: 1.6, alpha: 0.75, passes: 1, over: 0 });
    inkStroke(g, [[x0 + 10, y - 8], [x0 + L - 6, y - 8], [x0 + L, y - 4], [x0 + L, y + 4], [x0 + L - 6, y + 8], [x0 + 10, y + 8]], { seed: 131, color: INKN.ink, width: 1.6, alpha: 0.75, passes: 1 });
    const r = rng(132);
    for (let i = 1; i < 8; i++) { const tx = x0 + 12 + i * ((L - 20) / 8); g.lineStyle(1.2, INKN.ink, 0.45).lineBetween(tx, y - 8, tx, y - 13 - (i % 2 ? 0 : 3) - r() * 0.6); }
    this.heatWord.setText(wellbeingFor(t).label);
  }

  setScore(wins, losses, pop = false) {
    this.wins = wins; this.losses = losses;
    this.drawIcons();
    if (pop) this.pulse(this.icons);
  }

  pulse(target) {
    if (this.reduced) { this.scene.tweens.add({ targets: target, alpha: { from: 0.4, to: 1 }, duration: MOTION.fade, ease: EASE }); return; }
    this.scene.tweens.add({ targets: this, scale: { from: 1.035, to: 1 }, angle: { from: -2, to: -1.1 }, duration: MOTION.base, ease: 'Back.easeOut' });
  }

  show(instant = false) {
    if (instant || this.reduced) {
      if (instant) { this.setAlpha(1); return Promise.resolve(); }
      return new Promise((resolve) => this.scene.tweens.add({ targets: this, alpha: 1, duration: MOTION.fade, ease: EASE, onComplete: resolve }));
    }
    this.y = Y - S[400]; this.setAngle(-4);
    return new Promise((resolve) => this.scene.tweens.add({
      targets: this, alpha: 1, y: Y, angle: -1.1, duration: 620, ease: 'Back.easeOut', onComplete: resolve,
    }));
  }

  hide(ms = MOTION.fade) {
    return new Promise((resolve) => this.scene.tweens.add({ targets: this, alpha: 0, duration: ms, ease: EASE, onComplete: resolve }));
  }

  // Итог дня: отметка ставится с нажимом, нить или искра добавляется, градусник плавно меняется.
  applyDay(dayIndex, result, newTemp, { instant = false } = {}) {
    this.results[dayIndex] = result;
    this.highlight = dayIndex;
    this.drawMarks();
    const dot = this.markDots[dayIndex];
    if (instant) { this.setTemp(newTemp); return Promise.resolve(); }
    if (this.reduced) this.scene.tweens.add({ targets: dot, alpha: { from: 0, to: 1 }, duration: MOTION.fade, ease: EASE });
    else this.scene.tweens.add({ targets: dot, scale: { from: 1.9, to: 1 }, angle: { from: -14, to: 0 }, duration: 520, ease: 'Back.easeOut' });
    const holder = { t: this.temp };
    return new Promise((resolve) => this.scene.tweens.add({
      targets: holder, t: newTemp, duration: 1200, ease: EASE,
      onUpdate: () => this.setTemp(holder.t),
      onComplete: () => { this.setTemp(newTemp); resolve(); },
    }));
  }

  // Подсветить отметку дня (перед финалом): мягкая пульсация.
  focusMark(dayIndex) {
    this.highlight = dayIndex; this.drawMarks();
    const dot = this.markDots[dayIndex];
    if (!dot) return;
    if (this.reduced) return;
    this.scene.tweens.add({ targets: dot, scale: { from: 1, to: 1.35 }, duration: MOTION.base, ease: EASE, yoyo: true, repeat: 1 });
  }

  setDay(day) { this.day = day; this.drawMarks(); }
}
