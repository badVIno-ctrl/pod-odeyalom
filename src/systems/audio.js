// Звук через Howler. Нет файла — тишина, без ошибок. Контекст создаётся только после первого
// клика/клавиши пользователя (политика автозапуска браузеров).
import { Howl, Howler } from 'howler';
import { Assets } from './assets.js';
import { Music } from './music.js';

// Музыкальные звуки играют ровно (без случайного сдвига высоты), стингеры идут через музыкальную шину.
const TONAL = new Set(['win', 'lose', 'daycard', 'chime', 'combo', 'sparkle', 'magic', 'musicbox', 'doorbell', 'bullfinch', 'siren', 'clock', 'engine']);
const STINGERS = new Set(['win', 'lose', 'daycard']);

export const Audio = {
  unlocked: false,
  muted: false,
  howls: new Map(),
  failed: new Set(), // файлы, которые не загрузились: дальше вместо них тишина и субтитр по таймеру
  loops: new Map(),
  pendingLoops: new Map(),
  lastVariant: new Map(),
  suspended: null, // [howl, ids] на время скрытой вкладки

  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    Howler.autoSuspend = false;
    Howler.mute(this.muted);
    if (Howler.ctx && Howler.ctx.state === 'suspended') Howler.ctx.resume().catch(() => {});
    for (const [key, opts] of this.pendingLoops) this.loop(key, opts);
    this.pendingLoops.clear();
    Music.unlock();
  },

  howlFor(src, opts = {}) {
    const id = src.join('|');
    if (!this.howls.has(id)) {
      const howl = new Howl({ src, preload: true, html5: false, ...opts });
      howl.on('loaderror', () => {
        if (!this.failed.has(id)) console.info(`[audio] нет звука ${src[0]}, игра идёт с субтитрами`);
        this.failed.add(id);
      });
      this.howls.set(id, howl);
    }
    return this.howls.get(id);
  },

  // cough_soft → cough_soft_1..9, если ключа без номера нет.
  variants(key) {
    if (Assets.soundEntry(key)) return [key];
    const out = [];
    for (let i = 1; i <= 9; i++) if (Assets.soundEntry(`${key}_${i}`)) out.push(`${key}_${i}`);
    return out;
  },

  has(key) {
    return this.variants(key).some((k) => Assets.resolveSound(k).length);
  },

  // Один и тот же шорох подряд звучит «машинно», поэтому шумовые звуки каждый раз чуть отличаются
  // по высоте (±3.5 %) и громкости (±1.5 дБ), и один и тот же вариант не повторяется дважды подряд.
  // Положение источника в кадре: pan −1…1 или x (0…1920) — звук слева/справа (стерео-панорама Howler).
  panFor({ pan, x } = {}) {
    if (pan != null) return Math.max(-1, Math.min(1, pan));
    if (x != null) return Math.max(-0.85, Math.min(0.85, (x - 960) / 960 * 0.8));
    return null;
  },

  play(key, { volume, rate, pan, x } = {}) {
    if (!this.unlocked) return null;
    let options = this.variants(key).filter((k) => Assets.resolveSound(k).length);
    if (!options.length) return null;
    if (options.length > 1) options = options.filter((k) => k !== this.lastVariant.get(key));
    const k = options[Math.floor(Math.random() * options.length)];
    this.lastVariant.set(key, k);
    const entry = Assets.soundEntry(k) || {};
    let v = volume ?? entry.volume ?? 1;
    if (STINGERS.has(key)) {
      // победа/поражение звучат только в конце партии: музыка игры уходит, фраза звучит одна
      if (key === 'win' || key === 'lose') Music.stop({ fade: 350 });
      Music.stinger(k, { gain: v, duck: key === 'daycard' ? 0.35 : 1 });
      return null;
    }
    const src = Assets.resolveSound(k);
    if (this.failed.has(src.join('|'))) return null;
    const howl = this.howlFor(src);
    let r = rate || 1;
    if (!TONAL.has(key)) {
      r *= 1 + (Math.random() * 2 - 1) * 0.035;
      v *= 10 ** ((Math.random() * 2 - 1) * 1.5 / 20);
    }
    const id = howl.play();
    howl.volume(Math.min(1, v), id);
    if (r !== 1) howl.rate(r, id);
    const p = this.panFor({ pan, x });
    if (p !== null && howl.stereo) howl.stereo(p, id);
    return { howl, id };
  },

  // Громкость и панорама играющей петли (часы ночью громче, радио за стеной).
  setLoop(key, { volume, pan, ms = 800 } = {}) {
    const l = this.loops.get(key);
    if (!l) return;
    if (volume != null) { l.howl.fade(l.howl.volume(l.id), volume, ms, l.id); l.v = volume; }
    if (pan != null && l.howl.stereo) l.howl.stereo(pan, l.id);
  },

  loop(key, { volume, fade = 900, pan = null } = {}) {
    if (!this.unlocked) { this.pendingLoops.set(key, { volume, fade, pan }); return; }
    if (this.loops.has(key)) return;
    const src = Assets.resolveSound(key);
    if (!src.length || this.failed.has(src.join('|'))) return;
    const entry = Assets.soundEntry(key) || {};
    const v = volume ?? entry.volume ?? 0.6;
    const howl = this.howlFor(src, { loop: true });
    const id = howl.play();
    howl.loop(true, id);
    howl.volume(0, id);
    howl.fade(0, v, fade, id);
    if (pan !== null && howl.stereo) howl.stereo(pan, id);
    this.loops.set(key, { howl, id, v });
  },

  stopLoop(key, { fade = 900 } = {}) {
    this.pendingLoops.delete(key);
    const l = this.loops.get(key);
    if (!l) return;
    this.loops.delete(key);
    l.howl.fade(l.howl.volume(l.id), 0, fade, l.id);
    setTimeout(() => l.howl.stop(l.id), fade + 40);
  },

  stopAllLoops(fade = 700) {
    for (const k of [...this.loops.keys()]) this.stopLoop(k, { fade });
    this.pendingLoops.clear();
  },

  // Вкладка скрыта или телефон заблокирован: Phaser ставит игру на паузу, и звук замирает вместе с ней.
  // Реплика, петли и музыка потом продолжаются с того же места (реплика не «доигрывает» без картинки).
  suspend() {
    if (!this.unlocked || this.suspended) return;
    this.suspended = [];
    for (const howl of this.howls.values()) {
      const ids = (howl._sounds || []).filter((snd) => !snd._paused && !snd._ended).map((snd) => snd._id);
      if (!ids.length) continue;
      ids.forEach((id) => howl.pause(id));
      this.suspended.push([howl, ids]);
    }
    if (Howler.ctx && Howler.ctx.state === 'running') Howler.ctx.suspend().catch(() => {});
  },

  resume() {
    if (!this.suspended) return;
    const list = this.suspended; this.suspended = null;
    const go = () => {
      list.forEach(([howl, ids]) => ids.forEach((id) => howl.play(id)));
      for (const l of this.loops.values()) l.howl.volume(l.v, l.id); // прерванное нарастание петли
    };
    if (Howler.ctx && Howler.ctx.state === 'suspended') Howler.ctx.resume().then(go, go);
    else go();
  },

  ctxState() { return Howler.ctx ? Howler.ctx.state : null; },

  setMuted(m) {
    this.muted = m;
    if (this.unlocked) Howler.mute(m);
  },

  voiceHowl(path) {
    if (!this.unlocked || !path) return null;
    const src = Assets.resolveSound(path);
    if (!src.length || this.failed.has(src.join('|'))) return null;
    return this.howlFor(src);
  },

  preload(paths) {
    if (!this.unlocked) return;
    for (const p of paths) this.voiceHowl(p);
  },
};
