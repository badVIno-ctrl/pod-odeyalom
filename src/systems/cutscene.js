// Режиссёр катсцен: ожидания, твины и реплики как Promise.
// skip() (кнопка «Пропустить», debug-клавиша S) мгновенно доигрывает оставшиеся шаги:
// твины прыгают в конечное состояние, паузы и реплики пропускаются — итоговое состояние сцены верное.
import { voice } from './voice.js';
import { Audio } from './audio.js';

export const LINE_GAP = 280;

const RESERVED = new Set([
  'targets', 'delay', 'duration', 'ease', 'easeParams', 'hold', 'repeat', 'repeatDelay', 'yoyo', 'flipX', 'flipY',
  'onActive', 'onStart', 'onUpdate', 'onYoyo', 'onRepeat', 'onComplete', 'onStop', 'onPause', 'onResume', 'onLoop',
  'callbackScope', 'props', 'paused', 'completeDelay', 'loop', 'loopDelay', 'persist', 'interpolation',
]);

function finalValue(cur, v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const m = /^([+\-*/])=(-?\d*\.?\d+)$/.exec(v);
    if (!m) return Number.isFinite(parseFloat(v)) ? parseFloat(v) : cur;
    const n = parseFloat(m[2]);
    return m[1] === '+' ? cur + n : m[1] === '-' ? cur - n : m[1] === '*' ? cur * n : cur / n;
  }
  if (Array.isArray(v)) return finalValue(cur, v[v.length - 1]);
  if (v && typeof v === 'object') {
    if ('to' in v) return finalValue(cur, v.to);
    if ('value' in v) return finalValue(cur, v.value);
  }
  return cur;
}

export function applyFinal(config) {
  if (config.yoyo || config.repeat === -1) return;
  const targets = [].concat(config.targets).filter(Boolean);
  const props = config.props || Object.fromEntries(Object.entries(config).filter(([k]) => !RESERVED.has(k)));
  for (const t of targets) for (const [k, v] of Object.entries(props)) if (k in t) t[k] = finalValue(t[k], v);
}

export class Director {
  constructor(scene) {
    this.scene = scene;
    this.skipping = false;
    this.alive = true;
    this.tweens = new Set();
    this.timers = new Set();
    scene.events.once('shutdown', () => this.kill());
  }

  wait(ms) {
    if (this.skipping || !this.alive || ms <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      const entry = { resolve };
      entry.timer = this.scene.time.delayedCall(ms, () => { this.timers.delete(entry); resolve(); });
      this.timers.add(entry);
    });
  }

  tween(config) {
    if (!this.alive) return Promise.resolve();
    const userComplete = config.onComplete;
    if (this.skipping) {
      applyFinal(config);
      if (userComplete) userComplete();
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const entry = { config, skipped: false };
      entry.tw = this.scene.tweens.add({
        ...config,
        onComplete: (...args) => { this.tweens.delete(entry); if (userComplete) userComplete(...args); resolve(); },
        onStop: () => { this.tweens.delete(entry); if (entry.skipped && userComplete) userComplete(); resolve(); },
      });
      this.tweens.add(entry);
    });
  }

  // Реплика + короткая пауза после неё, чтобы фразы не налетали друг на друга (при пропуске паузы нет).
  say(id, { gap = LINE_GAP } = {}) {
    if (this.skipping || !this.alive) return Promise.resolve();
    return voice.play(id).then(() => this.wait(gap));
  }

  sfx(key, opts) {
    if (this.skipping || !this.alive) return null;
    return Audio.play(key, opts);
  }

  skip() {
    if (this.skipping) return;
    this.skipping = true;
    voice.stop();
    for (const e of [...this.tweens]) {
      e.skipped = true;
      applyFinal(e.config);
      try { e.tw.stop(); } catch { /* уже остановлен */ }
    }
    for (const e of [...this.timers]) { e.timer.remove(false); e.resolve(); }
    this.timers.clear();
  }

  // Новая секция (например, после мини-игры) снова проигрывается обычным темпом.
  resume() { this.skipping = false; }

  kill() {
    this.skip();
    this.alive = false;
  }
}
