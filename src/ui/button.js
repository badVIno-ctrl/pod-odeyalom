// Кнопка интерфейса — бумажная бирка: лист с зерном и тенью, надпись шрифтом Kurale.
// Наведение: бирка чуть приподнимается (тень растёт, наклон выпрямляется), лист светлеет;
// нажатие — прижимается к столу. Фокус с клавиатуры — карандашная обводка, выбранный сегмент
// обведён красным карандашом. Звук: тихий «тук» при наведении и деревянный щелчок при нажатии.
// При prefers-reduced-motion движения нет, меняется только цвет.
import * as Phaser from 'phaser';
import { CSS, INK, INKN, EASE, MOTION, text } from '../config/theme.js';
import { prefersReducedMotion } from '../config/game.js';
import { paperTexture, blobShadowTexture, inkRect, inkCircle, tilt } from './paper.js';
import { Audio } from '../systems/audio.js';

const VARIANTS = {
  primary: { kind: 'amber', hover: 'amberHi', text: INK.ink },
  secondary: { kind: 'cream', hover: 'light', text: INK.ink },
  segment: { kind: 'cream', hover: 'light', text: INK.soft, selText: INK.ink },
  ghost: { kind: 'night', hover: 'nightHi', text: CSS.paper, alpha: 0.92 },
};

const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) % 997 + 1; };
let lastHoverSound = 0;

export class Button extends Phaser.GameObjects.Container {
  constructor(scene, x, y, {
    label, width = 360, height = 64, variant = 'primary', style = 'button-xl', onClick, align = 'center', radius = 12,
  } = {}) {
    super(scene, x, y);
    this.w = width; this.h = height;
    this.round = radius >= height / 2 - 1; // круглая «пуговица» (кнопка правил «?»)
    this.variant = variant;
    this.v = VARIANTS[variant] || VARIANTS.primary;
    this.onClick = onClick;
    this.state = { hover: false, pressed: false, focus: false, selected: false, disabled: false };
    this.reduced = prefersReducedMotion();
    this.hoverK = 0;
    this.seed = hash(`${label}|${width}|${height}`);
    this.tiltDeg = this.round ? 0 : tilt(this.seed, width > 300 ? 0.45 : 0.8);

    this.inner = scene.add.container(0, 0);
    this.shadow = scene.add.image(0, 3, blobShadowTexture(scene, width - 8, height - 6, 12)).setAlpha(0.55);
    this.bg = scene.add.image(0, 0, '__DEFAULT');
    this.bgHover = scene.add.image(0, 0, '__DEFAULT').setAlpha(0);
    this.ring = scene.add.graphics();
    const tx = align === 'left' ? -width / 2 + 28 : 0;
    this.text = scene.add.text(tx, -1, label, text(style, { color: this.v.text, align })).setOrigin(align === 'left' ? 0 : 0.5, 0.5).setResolution(2);
    this.inner.add([this.bg, this.bgHover, this.ring, this.text]);
    this.inner.setAngle(this.tiltDeg);
    this.zone = scene.add.zone(0, 0, width, height).setInteractive({ useHandCursor: true });
    this.add([this.shadow, this.inner, this.zone]);
    this.applyTextures();

    this.zone.on('pointerover', () => {
      if (!this.state.disabled && performance.now() - lastHoverSound > 70) { lastHoverSound = performance.now(); Audio.play('ui_hover', { volume: 0.2 }); }
      this.set({ hover: true });
    });
    this.zone.on('pointerout', () => this.set({ hover: false, pressed: false }));
    this.zone.on('pointerdown', () => this.set({ pressed: true }));
    this.zone.on('pointerup', () => {
      const was = this.state.pressed;
      this.set({ pressed: false });
      if (was) this.activate();
    });
    this.redraw();
    scene.add.existing(this);
  }

  applyTextures() {
    const { w, h, v } = this;
    const o = { seed: this.seed, edge: this.round ? 'soft' : 'cut', radius: this.round ? h / 2 : 10, shadow: false, alpha: v.alpha ?? 1 };
    this.bg.setTexture(paperTexture(this.scene, w, h, { ...o, kind: v.kind }));
    this.bgHover.setTexture(paperTexture(this.scene, w, h, { ...o, kind: v.hover }));
  }

  activate() {
    if (!this.scene || this.state.disabled || !this.onClick) return;
    if (this.lockUntil && performance.now() < this.lockUntil) return;
    Audio.play('ui_click', { volume: 0.4 });
    // короткая отдача нажатия и для клавиатуры
    if (!this.reduced) {
      this.scene.tweens.add({ targets: this.inner, y: { from: 2, to: this.restY() }, duration: 260, ease: EASE });
    }
    this.onClick(this);
  }

  setLabel(label) { this.text.setText(label); return this; }

  // Кнопка видна, но первые ms не нажимается: клик или пробел, которыми листали реплики,
  // не должен сразу сработать на только что появившейся кнопке.
  lock(ms) { this.lockUntil = performance.now() + ms; return this; }

  setSelected(v) { return this.set({ selected: v }); }

  // Смена вида без отключения кнопки (например, подсказка «ещё не готова», но нажатие объясняет почему).
  setVariant(variant) {
    if (this.variant === variant) return this;
    this.variant = variant; this.v = VARIANTS[variant] || VARIANTS.primary;
    this.applyTextures();
    this.redraw(false);
    return this;
  }

  setFocused(v) { return this.set({ focus: v }); }

  setDisabled(v) {
    this.set({ disabled: v });
    if (v) this.zone.disableInteractive(); else this.zone.setInteractive({ useHandCursor: true });
    return this;
  }

  restScale() { return 1; }

  restY() { return this.state.pressed ? 1.5 : (this.state.hover || this.state.focus) && !this.state.disabled ? -3 : 0; }

  set(patch) {
    const before = this.state.hover || this.state.focus;
    Object.assign(this.state, patch);
    const now = this.state.hover || this.state.focus;
    if (before !== now) {
      const holder = { k: this.hoverK };
      if (this.hoverTween) this.hoverTween.stop();
      this.hoverTween = this.scene.tweens.add({
        targets: holder, k: now ? 1 : 0, duration: MOTION.fade, ease: EASE,
        onUpdate: () => { this.hoverK = holder.k; this.redraw(false); },
      });
    }
    this.redraw();
    return this;
  }

  redraw(animate = true) {
    const { w, h, v, state } = this;
    const k = state.disabled ? 0 : this.hoverK;
    this.bgHover.setAlpha(k);
    const on = (this.variant === 'segment' || this.variant === 'secondary') && state.selected;
    this.text.setColor(on ? (v.selText || v.text) : v.text);
    this.inner.setAlpha(state.disabled ? 0.5 : 1);
    this.ring.clear();
    if (on) {
      // выбранный вариант обведён красным карандашом
      inkCircle(this.ring, 0, 0, w / 2 - 6, { seed: this.seed, squash: Math.min(1, (h / w) * 1.25), color: INKN.red, width: 2.6, alpha: 0.9, over: 0.1 });
    }
    if (state.focus) inkRect(this.ring, -w / 2 - 7, -h / 2 - 7, w + 14, h + 14, { seed: this.seed + 3, color: 0xf2b45e, width: 2.6, alpha: 0.95 });
    if (this.reduced || !animate) {
      this.inner.y = this.reduced ? 0 : this.restY();
      return;
    }
    if (this.moveTween) this.moveTween.stop();
    const lifted = (state.hover || state.focus) && !state.disabled;
    this.moveTween = this.scene.tweens.add({
      targets: this.inner, y: this.restY(), angle: lifted ? 0 : this.tiltDeg, duration: state.pressed ? 120 : MOTION.fade, ease: EASE,
    });
    this.scene.tweens.add({
      targets: this.shadow, y: lifted ? 7 : state.pressed ? 2 : 3, alpha: state.disabled ? 0.2 : lifted ? 0.75 : 0.55, scaleX: lifted ? 1.03 : 1, scaleY: lifted ? 1.08 : 1,
      duration: MOTION.fade, ease: EASE,
    });
  }
}

// Фокус с клавиатуры: Tab / Shift+Tab / стрелки — переход, Enter / Space — нажать.
// Кольцо фокуса показывается после первого нажатия клавиш навигации (или сразу, если autofocus).
export class FocusRing {
  constructor(scene, items, { autofocus = false } = {}) {
    this.scene = scene;
    this.items = items;
    this.index = -1;
    this.alive = true;
    const kb = scene.input.keyboard;
    this.onKey = (e) => {
      if (!this.alive || e.repeat) return;
      const next = { Tab: e.shiftKey ? -1 : 1, ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.code];
      if (next !== undefined) {
        e.preventDefault?.();
        this.move(next);
      } else if ((e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') && this.index >= 0) {
        e.preventDefault?.();
        this.items[this.index].activate();
      }
    };
    kb.on('keydown', this.onKey);
    scene.events.once('shutdown', () => this.destroy());
    if (autofocus) this.move(0);
  }

  move(step) {
    if (!this.items.length) return;
    if (this.index >= 0) this.items[this.index].setFocused(false);
    this.index = this.index < 0 ? 0 : (this.index + step + this.items.length) % this.items.length;
    this.items[this.index].setFocused(true);
  }

  destroy() {
    if (!this.alive) return;
    this.alive = false;
    this.scene.input.keyboard.off('keydown', this.onKey);
  }
}
