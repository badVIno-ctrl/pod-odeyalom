// Вибрация на телефонах (navigator.vibrate): короткие отклики на ход, удачу, промах и финал.
// На компьютерах и в браузерах без вибрации ничего не делает. Выключается вместе со звуком.
const can = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
  && typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

export const Haptics = {
  enabled: true,
  buzz(pattern) {
    if (!this.enabled || !can()) return false;
    try { return navigator.vibrate(pattern); } catch { return false; }
  },
  tap() { return this.buzz(8); },
  good() { return this.buzz(14); },
  bad() { return this.buzz([26, 40, 26]); },
  hit() { return this.buzz(36); },
  win() { return this.buzz([18, 70, 18, 70, 46]); },
  lose() { return this.buzz([60, 90, 120]); },
};
