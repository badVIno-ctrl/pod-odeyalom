// Сохранение забега (localStorage): пишется в начале каждого дня, стирается, когда финал засчитан.
// «Продолжить» в меню начинает сохранённый день с утра. Версия формата — VERSION: старые сохранения
// с другой версией просто не предлагаются.
import { TOTAL_DAYS } from '../config/game.js';

const KEY = 'pod-odeyalom:save';
const VERSION = 2;
const FIELDS = ['difficulty', 'mode', 'day', 'wins', 'losses', 'temp', 'dayResults', 'lastEvent', 'courage', 'trust', 'choices', 'secrets', 'stats', 'frost', 'highlights'];

const store = () => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } };

export const Save = {
  write(state) {
    const s = store(); if (!s || state.finished) return false;
    const snap = { v: VERSION, at: Date.now() };
    for (const f of FIELDS) snap[f] = JSON.parse(JSON.stringify(state[f] ?? null));
    try { s.setItem(KEY, JSON.stringify(snap)); return true; } catch { return false; }
  },

  read() {
    const s = store(); if (!s) return null;
    try {
      const j = JSON.parse(s.getItem(KEY) || 'null');
      if (!j || j.v !== VERSION) return null;
      if (!(j.day >= 1 && j.day <= TOTAL_DAYS) || !Array.isArray(j.dayResults) || j.dayResults.length !== TOTAL_DAYS) return null;
      if (j.wins >= 3 || j.losses >= 3) return null; // финал уже наступил
      return j;
    } catch { return null; }
  },

  has() { return !!this.read(); },

  // Восстановить забег в GameState. → true, если сохранение было.
  restore(state) {
    const j = this.read(); if (!j) return false;
    state.reset(j.difficulty, j.mode || 'main');
    for (const f of FIELDS) if (j[f] !== null && j[f] !== undefined) state[f] = j[f];
    state.finished = false; state.ending = null; state.archived = false;
    return true;
  },

  clear() { const s = store(); try { if (s) s.removeItem(KEY); } catch { /* */ } },
};
