// Качество графики под устройство. Картинка (текстуры, шрифты, анимации персонажей) одинаковая везде —
// на слабых устройствах убираются только «дорогие» эффекты: размытие фона (фильтр WebGL),
// часть частиц и частота перерисовки паутины/волн. Уровень можно форсировать: ?q=high|mid|low.
export const Quality = {
  level: 'high',
  particles: 1,
  blur: true,
  fps: 60,
  samples: [],
  listeners: new Set(),

  init(game) {
    const q = new URLSearchParams(window.location.search).get('q');
    const nav = window.navigator || {};
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent || '') || (nav.maxTouchPoints > 1 && window.innerWidth < 1100);
    const cores = nav.hardwareConcurrency || 4;
    const mem = nav.deviceMemory || 4;
    let level = 'high';
    if (mobile || cores <= 4 || mem <= 3) level = 'mid';
    if ((mobile && (cores <= 4 || mem <= 2)) || cores <= 2) level = 'low';
    if (['high', 'mid', 'low'].includes(q)) level = q;
    this.forced = !!q;
    this.apply(level);
    if (game) this.watch(game);
  },

  apply(level) {
    this.level = level;
    this.particles = level === 'high' ? 1 : level === 'mid' ? 0.6 : 0.3;
    this.blur = level === 'high';
    for (const fn of this.listeners) fn(level);
  },

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },

  // Если 4 секунды подряд меньше ~40 FPS — понижаем уровень на ступень (не чаще раза в 6 с).
  watch(game) {
    let acc = 0; let frames = 0; let low = 0; let lastDrop = 0;
    game.events.on('step', (time, delta) => {
      acc += delta; frames += 1;
      if (acc < 1000) return;
      this.fps = Math.round((frames * 1000) / acc);
      acc = 0; frames = 0;
      if (this.forced || document.hidden) return;
      low = this.fps < 40 ? low + 1 : 0;
      if (low >= 4 && time - lastDrop > 6000) {
        lastDrop = time; low = 0;
        if (this.level === 'high') this.apply('mid'); else if (this.level === 'mid') this.apply('low');
        console.info(`[quality] FPS ${this.fps} → уровень ${this.level}`);
      }
    });
  },
};
