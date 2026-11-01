// Музыка: бесшовные петли через Web Audio (общий контекст Howler, общий mute), плавная смена треков,
// приглушение под голос (ducking) и короткие стингеры. Нет файла — тишина, без ошибок.
// Music.play('mus_menu') — перейти к треку (кроссфейд); Music.stop(); Music.stinger('daycard');
// Music.duck(true|false) — вызывает voice.js, пока звучит реплика.
// Слои (stems): если у трека в манифесте есть stems, все слои стартуют одновременно и идут синхронно;
// Music.setLayers(n) плавно включает первые n слоёв поверх базового (ночь: слой на каждую нить Тихона).
// Жар: Music.setFever(0..1) — «плывущая» высота (wow/flutter через detune), глухой фильтр — музыка как сквозь вату.
import { Howler } from 'howler';
import { Assets } from './assets.js';

const canOgg = (() => {
  try {
    const a = document.createElement('audio');
    return !!(a.canPlayType && a.canPlayType('audio/ogg; codecs="vorbis"'));
  } catch { return false; }
})();

const DUCK = 0.42; // уровень музыки под голосом
const STORE_KEY = 'pyat-dney-zhara:music-volume';

export const Music = {
  ctx: null,
  bus: null,
  duckNode: null,
  buffers: new Map(),
  loading: new Map(),
  failed: new Set(),
  current: null, // { key, src, gain, vol }
  wanted: null,
  pending: null,
  unlocked: false,
  volume: 0.7,
  duckDepth: 0,
  duckTimer: null,

  init() {
    try {
      const v = parseFloat(localStorage.getItem(STORE_KEY));
      if (Number.isFinite(v)) this.volume = Math.max(0, Math.min(1, v));
    } catch { /* приватный режим */ }
  },

  ensure() {
    if (this.bus) return true;
    const ctx = Howler.ctx;
    if (!ctx || !Howler.masterGain) return false;
    this.ctx = ctx;
    this.bus = ctx.createGain();
    this.bus.gain.value = this.volume;
    this.duckNode = ctx.createGain();
    this.duckNode.gain.value = 1;
    // жар: фильтр низких частот + медленное «плавание» высоты (wow) и мелкая дрожь (flutter)
    this.lowpass = ctx.createBiquadFilter();
    this.lowpass.type = 'lowpass'; this.lowpass.frequency.value = 20000; this.lowpass.Q.value = 0.4;
    this.bus.connect(this.lowpass);
    this.lowpass.connect(this.duckNode);
    this.duckNode.connect(Howler.masterGain);
    try {
      this.wow = ctx.createOscillator(); this.wow.frequency.value = 0.42;
      this.wowDepth = ctx.createGain(); this.wowDepth.gain.value = 0;
      this.wow.connect(this.wowDepth); this.wow.start();
      this.flutter = ctx.createOscillator(); this.flutter.frequency.value = 5.7;
      this.flutterDepth = ctx.createGain(); this.flutterDepth.gain.value = 0;
      this.flutter.connect(this.flutterDepth); this.flutter.start();
    } catch { this.wow = null; }
    if (this.feverK) this.setFever(this.feverK, 10);
    return true;
  },

  // Вызывается из Audio.unlock() после первого жеста пользователя.
  unlock() {
    this.unlocked = true;
    if (!this.ensure()) return;
    if (this.pending) { const p = this.pending; this.pending = null; this.play(p.key, p.opts); }
  },

  url(key) {
    const files = Assets.resolveSound(key);
    if (!files.length) return null;
    const ogg = files.find((f) => f.endsWith('.ogg'));
    const mp3 = files.find((f) => f.endsWith('.mp3'));
    return (canOgg && ogg) || mp3 || files[0];
  },

  load(key) {
    if (this.buffers.has(key)) return Promise.resolve(this.buffers.get(key));
    if (this.loading.has(key)) return this.loading.get(key);
    const url = this.url(key);
    if (!url || this.failed.has(key) || !this.ensure()) return Promise.resolve(null);
    const p = fetch(url)
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then((ab) => new Promise((res, rej) => this.ctx.decodeAudioData(ab, res, rej)))
      .then((buf) => { this.buffers.set(key, buf); this.loading.delete(key); return buf; })
      .catch(() => {
        this.failed.add(key); this.loading.delete(key);
        console.info(`[music] нет музыки ${key}`);
        return null;
      });
    this.loading.set(key, p);
    return p;
  },

  // Заранее подгрузить треки (без воспроизведения).
  preload(keys) { if (this.unlocked) keys.forEach((k) => this.load(k)); },

  entryVolume(key) {
    const e = Assets.soundEntry(key);
    return (e && typeof e.volume === 'number') ? e.volume : 1;
  },

  stemsOf(key) {
    const e = Assets.soundEntry(key);
    return e && Array.isArray(e.stems) && e.stems.length ? e.stems : null;
  },

  // detune источника следует за общими «генераторами жара» (все слои сдвигаются одинаково — синхрон не теряется)
  attachFever(src) {
    if (!this.wow || !src.detune) return;
    try { this.wowDepth.connect(src.detune); this.flutterDepth.connect(src.detune); } catch { /* старый браузер */ }
  },

  play(key, opts = {}) {
    const { fade = 1800, volume = 1 } = opts;
    if (this.stemsOf(key)) return this.playStems(key, opts);
    this.wanted = key;
    if (!this.unlocked || !this.ensure()) { this.pending = { key, opts }; return; }
    const cur = this.current;
    const vol = volume * this.entryVolume(key);
    if (cur && cur.key === key) {
      this.ramp(cur.gain, vol, fade * 0.6);
      cur.vol = vol;
      return;
    }
    this.load(key).then((buf) => {
      if (!buf || this.wanted !== key) return;
      if (this.current && this.current.key === key) return;
      this.fadeOutCurrent(fade);
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = opts.loop !== false;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(gain); gain.connect(this.bus);
      this.attachFever(src);
      const offset = opts.offset ? opts.offset % buf.duration : 0;
      const at = ctx.currentTime + 0.03;
      src.start(at, offset);
      this.ramp(gain, vol, fade);
      this.current = { key, src, gain, vol, t0: at - offset, dur: buf.duration };
      src.onended = () => { if (this.current && this.current.src === src) this.current = null; };
    });
  },

  // Сколько секунд трек key уже играет (по часам AudioContext); null — если он сейчас не звучит.
  position(key) {
    const c = this.current;
    if (!c || c.key !== key || c.t0 == null || !this.ctx) return null;
    const t = this.ctx.currentTime - c.t0;
    return t < 0 ? 0 : (c.src && c.src.loop ? t % c.dur : t);
  },

  // Музыка для key не загрузится (файла нет / ошибка декодирования / звук ещё не разблокирован)?
  silent(key) { return !this.unlocked || this.failed.has(key) || !this.url(key); },

  // Трек из синхронных слоёв: базовый слой всегда, следующие — по числу layers.
  playStems(key, opts = {}) {
    const { fade = 1800, volume = 1, layers = 1 } = opts;
    this.wanted = key;
    if (!this.unlocked || !this.ensure()) { this.pending = { key, opts }; return; }
    const vol = volume * this.entryVolume(key);
    const cur = this.current;
    if (cur && cur.key === key) {
      this.ramp(cur.gain, vol, fade * 0.6); cur.vol = vol;
      this.setLayers(layers);
      return;
    }
    const stems = this.stemsOf(key);
    Promise.all(stems.map((k) => this.load(k))).then((bufs) => {
      if (this.wanted !== key) return;
      if (this.current && this.current.key === key) return;
      if (!bufs[0]) { // слоёв нет — обычный файл трека
        const e = Assets.soundEntry(key); const keep = e.stems; e.stems = null;
        this.play(key, opts); e.stems = keep; return;
      }
      this.fadeOutCurrent(fade);
      const ctx = this.ctx;
      const gain = ctx.createGain(); gain.gain.value = 0; gain.connect(this.bus);
      const t0 = ctx.currentTime + 0.06;
      const srcs = []; const layerGains = [];
      bufs.forEach((buf, i) => {
        if (!buf) return;
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        const g = ctx.createGain(); g.gain.value = i === 0 || i <= layers ? 1 : 0;
        src.connect(g); g.connect(gain);
        this.attachFever(src);
        src.start(t0);
        srcs.push(src); layerGains[i] = g;
      });
      this.ramp(gain, vol, fade);
      this.current = { key, src: srcs[0], srcs, gain, vol, layerGains, layers };
      srcs[0].onended = () => { if (this.current && this.current.src === srcs[0]) this.current = null; };
    });
  },

  setLayers(n, ms = 2600) {
    const cur = this.current;
    if (!cur || !cur.layerGains) return;
    cur.layers = n;
    cur.layerGains.forEach((g, i) => { if (g && i > 0) this.ramp(g, i <= n ? 1 : 0, ms); });
  },

  // Жар 0..1: 0 — чистый звук; 1 — высота плывёт (±22 цента), глухо (≈1.3 кГц), мелкая дрожь.
  feverK: 0,
  setFever(k, ms = 2500) {
    this.feverK = Math.max(0, Math.min(1, k || 0));
    if (!this.lowpass) return;
    const kk = this.feverK; const now = this.ctx.currentTime; const tc = Math.max(0.01, ms / 3000);
    const f = 20000 * Math.pow(1300 / 20000, kk * kk * 0.85 + kk * 0.15);
    this.lowpass.frequency.setTargetAtTime(f, now, tc);
    this.lowpass.Q.setTargetAtTime(0.4 + kk * 0.5, now, tc);
    if (this.wow) {
      this.wowDepth.gain.setTargetAtTime(22 * kk, now, tc);
      this.flutterDepth.gain.setTargetAtTime(4 * kk, now, tc);
    }
  },

  fadeOutCurrent(fade = 1500) {
    const cur = this.current;
    if (!cur) return;
    this.current = null;
    this.ramp(cur.gain, 0, fade);
    const t = this.ctx.currentTime + fade / 1000 + 0.1;
    for (const src of cur.srcs || [cur.src]) { try { src.stop(t); } catch { /* уже остановлен */ } }
  },

  stop({ fade = 1500 } = {}) {
    this.wanted = null;
    this.pending = null;
    if (this.ctx) this.fadeOutCurrent(fade);
  },

  // Громкость текущего трека (например, тише во время напряжённой сцены).
  setLevel(k, ms = 1200) {
    const cur = this.current;
    if (cur) this.ramp(cur.gain, cur.vol * k, ms);
  },

  ramp(gainNode, to, ms) {
    const ctx = this.ctx; const now = ctx.currentTime;
    const g = gainNode.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(to, now + Math.max(0.02, ms / 1000));
  },

  // Короткая музыкальная фраза поверх (музыка на это время притихает).
  // gain — итоговая громкость (как volume у Audio.play), иначе volume × громкость из манифеста.
  stinger(key, { volume = 1, gain: abs, duck = 0.35 } = {}) {
    if (!this.unlocked || !this.ensure()) return;
    this.load(key).then((buf) => {
      if (!buf) return;
      const ctx = this.ctx;
      const src = ctx.createBufferSource(); src.buffer = buf;
      const gain = ctx.createGain(); gain.gain.value = abs ?? volume * this.entryVolume(key);
      src.connect(gain); gain.connect(this.bus);
      src.start();
      const cur = this.current;
      if (cur && duck < 1) {
        this.ramp(cur.gain, cur.vol * duck, 250);
        setTimeout(() => { if (this.current === cur) this.ramp(cur.gain, cur.vol, 1600); }, Math.max(300, buf.duration * 1000 - 600));
      }
    });
  },

  // Голос: музыка тише, пока идёт реплика; возвращается с небольшой задержкой (между репликами не «качает»).
  duck(on) {
    if (!this.duckNode) return;
    clearTimeout(this.duckTimer);
    const g = this.duckNode.gain; const now = this.ctx.currentTime;
    if (on) {
      g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(DUCK, now + 0.25);
    } else {
      this.duckTimer = setTimeout(() => {
        const t = this.ctx.currentTime;
        g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
        g.linearRampToValueAtTime(1, t + 1.2);
      }, 650);
    }
  },

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    try { localStorage.setItem(STORE_KEY, String(this.volume)); } catch { /* ignore */ }
    if (this.bus) this.ramp(this.bus, this.volume, 120);
  },

  get playing() { return this.current ? this.current.key : null; },
};

Music.init();
