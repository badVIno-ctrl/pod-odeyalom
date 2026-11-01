// Очередь реплик для катсцен. Каждая реплика ждёт окончания предыдущей;
// перед репликой можно сыграть звук (кашель и т. п.), между репликами — короткая пауза.
import { voice } from './voice.js';
import { Audio } from './audio.js';

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

export const Dialogue = {
  gapMs: 160,

  // items: 'M01' или { id: 'B04', sfx: 'cough_soft', sfxLeadMs: 700 }
  async queue(items, { isCancelled = () => false } = {}) {
    for (const item of items) {
      if (isCancelled()) return;
      const it = typeof item === 'string' ? { id: item } : item;
      if (it.sfx) {
        Audio.play(it.sfx);
        if (it.sfxLeadMs) await pause(it.sfxLeadMs);
      }
      await voice.play(it.id);
      if (this.gapMs) await pause(this.gapMs);
    }
  },

  say(id) { return voice.play(id); },
  skip() { voice.skip(); },
};
