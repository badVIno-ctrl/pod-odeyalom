// Отладка: только с параметром ?debug=1.
// W — победа в текущей мини-игре, L — поражение, S — пропустить катсцену, 1–5 — сразу к дню N.
// Коды клавиш физические (KeyW и т. д.), поэтому работают и на русской раскладке.
import { isDebug } from '../config/game.js';

export const Debug = {
  enabled: false,
  blockDigits: false, // открыта панель выбора: цифры 1 и 2 выбирают ответ, а не день
  handlers: new Map(),
  jumpToDay: null,

  init(onJumpToDay) {
    this.enabled = isDebug();
    if (!this.enabled) return;
    this.jumpToDay = onJumpToDay;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const map = { KeyW: 'win', KeyL: 'loss', KeyS: 'skip' };
      if (map[e.code]) { this.emit(map[e.code]); return; }
      const m = /^(?:Digit|Numpad)([1-5])$/.exec(e.code);
      if (m && this.jumpToDay && !this.blockDigits) this.jumpToDay(Number(m[1]));
    });
    console.info('[debug] W: победа, L: поражение, S: пропуск катсцены, 1…5: день');
  },

  // Обработчик действует, пока сцена жива: on(...) возвращает функцию отписки.
  on(action, fn) {
    if (!this.handlers.has(action)) this.handlers.set(action, new Set());
    this.handlers.get(action).add(fn);
    return () => this.handlers.get(action).delete(fn);
  },

  emit(action) {
    const set = this.handlers.get(action);
    if (!set || !set.size) return;
    [...set].at(-1)();
  },
};
