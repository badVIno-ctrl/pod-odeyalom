// voice.play(id) → Promise, который резолвится, когда фраза закончилась (или её пропустили).
// Источник текстов и путей к звуку — data/dialogue.json: [{ id, speaker, text, audio }].
// Нет файла — субтитр висит (1500 + 55 × длина текста) мс. Клик или пробел — пропустить.
import dialogue from '../../data/dialogue.json';
import lipsync from '../../data/lipsync.json';
import { Audio } from './audio.js';
import { Music } from './music.js';
import { SUBTITLE_FALLBACK } from '../config/game.js';

// Таймер, который встаёт на паузу вместе с игрой (скрытая вкладка).
class Timer {
  constructor() { this.id = null; this.due = 0; this.fn = null; this.left = null; }
  set(fn, ms) {
    this.clear(); this.fn = fn; this.due = performance.now() + ms;
    this.id = setTimeout(() => { this.id = null; fn(); }, ms);
  }
  clear() { clearTimeout(this.id); this.id = null; this.left = null; }
  pause() { if (this.id === null) return; clearTimeout(this.id); this.id = null; this.left = Math.max(0, this.due - performance.now()); }
  resume() { if (this.left === null) return; const ms = this.left; this.left = null; this.set(this.fn, ms); }
}

class VoiceSystem {
  constructor(lines) {
    this.lines = new Map(lines.map((l) => [l.id, l]));
    this.presenter = null;
    this.current = null;
    this.history = []; // сыгранные ID по порядку (для отладки и автотестов)
  }

  setPresenter(p) { this.presenter = p; }

  get(id) { return this.lines.get(id); }

  all() { return [...this.lines.values()]; }

  fallbackMs(text) { return SUBTITLE_FALLBACK.base + SUBTITLE_FALLBACK.perChar * text.length; }

  preload() { Audio.preload(this.all().map((l) => l.audio).filter(Boolean)); }

  play(id, { subtitle = true } = {}) {
    const line = this.lines.get(id);
    if (!line) {
      console.warn(`[voice] нет реплики ${id}`);
      return Promise.resolve();
    }
    this.stop();
    this.history.push(id);
    if (this.history.length > 300) this.history.shift();
    return new Promise((resolve) => {
      const timer = new Timer(); const safety = new Timer();
      const cur = { id, line, done: false, startedAt: performance.now(), audio: false, timers: [timer, safety], pausedAt: 0 };
      let howl = null; let soundId = null;
      const finish = () => {
        if (cur.done) return;
        cur.done = true;
        timer.clear(); safety.clear();
        if (howl && soundId !== null) howl.stop(soundId);
        if (this.current === cur) this.current = null;
        if (subtitle && this.presenter && !this.current) this.presenter.hide(id);
        if (!this.current) Music.duck(false);
        resolve();
      };
      cur.finish = finish;
      this.current = cur;
      Music.duck(true);
      if (subtitle && this.presenter) this.presenter.show(line);
      howl = Audio.voiceHowl(line.audio);
      if (howl) {
        soundId = howl.play();
        howl.once('end', () => { timer.set(finish, 220); }, soundId);
        howl.once('play', () => {
          if (cur.done || cur.failed) return;
          timer.clear();
          cur.startedAt = performance.now(); cur.audio = true;
          const d = howl.duration(soundId) || 0;
          safety.set(finish, d * 1000 + 1500);
        }, soundId);
        // Звук не загрузился или не играет: субтитр держится по длине текста, как будто файла нет.
        const fail = () => {
          if (cur.done || cur.audio || cur.failed) return;
          cur.failed = true;
          safety.clear();
          const left = this.fallbackMs(line.text) - (performance.now() - cur.startedAt);
          timer.set(finish, Math.max(400, left));
        };
        howl.once('playerror', fail, soundId);
        if (howl.state() !== 'loaded') {
          howl.once('loaderror', fail);
          // Ошибка загрузки придёт событием loaderror. Если файл завис в загрузке, ждём его не дольше 6 с.
          timer.set(fail, 6000);
        }
        safety.set(finish, this.fallbackMs(line.text) + 8000);
      } else {
        timer.set(finish, this.fallbackMs(line.text));
      }
    });
  }

  // Открытость рта говорящего 0..1 (для кукол). Есть звук — по огибающей из data/lipsync.json
  // (кадры по 50 мс), нет звука — мягкое «бормотание», пока висит субтитр.
  mouth(speaker) {
    const c = this.current;
    if (!c || c.line.speaker !== speaker) return 0;
    const t = performance.now() - c.startedAt;
    const env = lipsync[c.id];
    if (env && c.audio) {
      const i = Math.floor(t / 50);
      if (i >= env.length) return 0;
      const a = Number(env[i]) || 0; const b = Number(env[Math.min(env.length - 1, i + 1)]) || 0;
      const k = (t % 50) / 50;
      return (a + (b - a) * k) / 9;
    }
    const n = 0.5 + 0.5 * Math.sin(t / 70) * Math.sin(t / 190 + 1.3);
    return Math.max(0, n * 0.9);
  }

  speaker() { return this.current ? this.current.line.speaker : null; }

  skip() { if (this.current) this.current.finish(); }

  // Вкладка скрыта: таймеры реплики и липсинк ждут (звук ставит на паузу Audio.suspend).
  pause() {
    const c = this.current;
    if (!c || c.pausedAt) return;
    c.pausedAt = performance.now();
    c.timers.forEach((t) => t.pause());
  }

  resume() {
    const c = this.current;
    if (!c || !c.pausedAt) return;
    c.startedAt += performance.now() - c.pausedAt;
    c.pausedAt = 0;
    c.timers.forEach((t) => t.resume());
  }

  stop() { this.skip(); }

  get isPlaying() { return !!this.current; }
}

export const voice = new VoiceSystem(dialogue);
