// Сцена поверх всех остальных: субтитры и отладочная плашка. Живёт всю игру.
import * as Phaser from 'phaser';
import { Subtitles } from '../ui/subtitles.js';
import { voice } from '../systems/voice.js';
import { Debug } from '../systems/debug.js';
import { CSS, S, text } from '../config/theme.js';
import { LiveFX } from '../systems/livefx.js';

export class OverlayScene extends Phaser.Scene {
  constructor() { super('Overlay'); }

  create() {
    this.subtitles = new Subtitles(this);
    voice.setPresenter(this.subtitles);
    // Пробел — пропустить реплику (клик по плашке тоже).
    this.input.keyboard.on('keydown-SPACE', () => voice.skip());
    if (Debug.enabled) {
      this.add.text(S[300], 1080 - S[300], 'Отладка: W победа, L поражение, S пропуск, цифры 1…5: день', text('caption-3', {
        color: CSS.accent, backgroundColor: '#131209', padding: { x: S[100], y: S[75] },
      })).setOrigin(0, 1).setDepth(2000).setAlpha(0.85);
    }
    this.scene.bringToTop();
  }

  // одна карта «живой линии» и марева на все сцены
  update(time, delta) { LiveFX.update(time, delta); }
}
