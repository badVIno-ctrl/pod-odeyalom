// Выбор реплики мальчика: тёмная карточка со звёздочками и бумажные бирки-ответы.
// Мышь или клавиатура (1 / 2, стрелки + Enter). choose() → Promise<номер>.
// resolveDefault() — для отладочного пропуска (первый вариант).
// Первые 700 мс панель не принимает нажатий: пробел, которым листали реплики, не выберет ответ случайно.
import { CSS, EASE, MOTION, S, text } from '../config/theme.js';
import { prefersReducedMotion } from '../config/game.js';
import { Button, FocusRing } from './button.js';
import { paperTexture } from './paper.js';
import { Debug } from '../systems/debug.js';
import { Audio } from '../systems/audio.js';

const ARM_MS = 700;

const W = 1200; const PAD = S[500]; const BTN_H = 84; const GAP = S[200];

export class ChoicePanel {
  constructor(scene, { prompt = 'Что ответить Тихону?', options, depth = 960 }) {
    this.scene = scene;
    this.done = false;
    this.reduced = prefersReducedMotion();
    Debug.blockDigits = true;
    this.armAt = performance.now() + ARM_MS; // реальное время: ускорение отладки (speed) не сокращает защиту
    scene.events.once('shutdown', () => { Debug.blockDigits = false; });
    const head = 32 + S[300];
    const h = PAD + head + options.length * BTN_H + (options.length - 1) * GAP + PAD;
    const y = 1080 - S[500] - h;
    this.c = scene.add.container(960, y).setDepth(depth).setAlpha(0);
    const bg = scene.add.image(0, h / 2, paperTexture(scene, W, h, { kind: 'night', seed: 4, border: true, edge: 'cut' }));
    const title = scene.add.text(-W / 2 + PAD, PAD - 4, prompt, text('heading-4', { color: CSS.accent })).setResolution(2);
    const keys = scene.add.text(W / 2 - PAD, PAD + 2, 'клавиши 1 и 2 или мышь', text('hand-2', { color: CSS.fog })).setOrigin(1, 0).setResolution(2);
    this.c.add([bg, title, keys]);
    this.buttons = options.map((o, i) => {
      const by = PAD + head + i * (BTN_H + GAP) + BTN_H / 2;
      const b = new Button(scene, 0, by, {
        label: `${i + 1}.  ${o.label}`, width: W - PAD * 2, height: BTN_H, variant: 'secondary', style: 'button-2xl', align: 'left',
        onClick: () => this.pick(i),
      });
      this.c.add(b);
      return b;
    });
    this.focus = new FocusRing(scene, this.buttons, { autofocus: true });
    this.onKey = (e) => {
      const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
      if (m && Number(m[1]) <= options.length) this.pick(Number(m[1]) - 1);
    };
    scene.input.keyboard.on('keydown', this.onKey);
    this.promise = new Promise((resolve) => { this.resolve = resolve; });
    Audio.play('paper', { volume: 0.3 });
    if (this.reduced) scene.tweens.add({ targets: this.c, alpha: 1, duration: MOTION.fade, ease: EASE });
    else {
      this.c.y += S[400];
      scene.tweens.add({ targets: this.c, alpha: 1, y: this.c.y - S[400], duration: MOTION.base, ease: EASE });
      this.buttons.forEach((b, i) => {
        const by = b.y; b.setAlpha(0); b.y = by + 18;
        scene.tweens.add({ targets: b, alpha: 1, y: by, duration: 420, delay: 160 + i * 110, ease: 'Back.easeOut' });
      });
    }
  }

  choose() { return this.promise; }

  pick(i, force = false) {
    if (this.done || (!force && performance.now() < this.armAt)) return;
    this.done = true;
    // Цифры снова переключают день (только в отладке) не сразу: второе быстрое нажатие той же цифры
    // не должно прыгнуть на другой день.
    this.scene.time.delayedCall(800, () => { if (!this.scene.choice || this.scene.choice === this) Debug.blockDigits = false; });
    this.scene.input.keyboard.off('keydown', this.onKey);
    this.focus.destroy();
    Audio.play('pencil', { volume: 0.35 });
    this.buttons.forEach((b, k) => {
      b.setDisabled(true);
      if (k === i) {
        b.setSelected(true);
        b.inner.setAlpha(1);
        if (!this.reduced) this.scene.tweens.add({ targets: b, scale: { from: 1.04, to: 1 }, duration: 320, ease: 'Back.easeOut' });
      } else this.scene.tweens.add({ targets: b, alpha: 0.35, duration: 200 });
    });
    this.scene.tweens.add({
      targets: this.c, alpha: 0, duration: MOTION.fade, ease: EASE, delay: 380,
      onComplete: () => this.c.destroy(),
    });
    this.resolve(i);
  }

  resolveDefault() { this.pick(0, true); }
}
