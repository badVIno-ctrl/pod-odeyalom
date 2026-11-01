// Письмо Тихона: тёмно-синий тетрадный лист, серебряные буквы (Caveat) появляются строка за строкой,
// как будто их выводят ниткой. Клик или пробел — дописать сразу, ещё раз (или «Дальше») — закрыть.
// В углу листа на нитке покачивается маленький Тихон. instant — показать целиком (перечитать из альбома).
import { FONT, EASE, MOTION } from '../config/theme.js';
import { paperTexture } from './paper.js';
import { Button } from './button.js';
import { Audio } from '../systems/audio.js';
import { prefersReducedMotion } from '../config/game.js';

const W = 940; const PAD = 64; const SILVER = '#e3e9f3'; const SILVER_SOFT = '#b9c4d6';
const CPS = 75; // букв в секунду

const style = (size, color = SILVER, extra = {}) => ({
  fontFamily: FONT.hand, fontSize: `${size}px`, color, lineSpacing: Math.round(size * 0.06),
  wordWrap: { width: W - PAD * 2, useAdvancedWrap: true }, ...extra,
});

export function showLetter(scene, letter, { instant = false, depth = 1500, button = 'Дальше' } = {}) {
  const reduced = prefersReducedMotion();
  return new Promise((resolve) => {
    const root = scene.add.container(960, 540).setDepth(depth).setAlpha(0);
    const dim = scene.add.rectangle(0, 0, 1920, 1080, 0x04060c, 0.66).setInteractive();
    root.add(dim);
    const sheet = scene.add.container(0, 0);
    root.add(sheet);
    // строки: приветствие, абзацы, подпись, P.S. — заранее раскладываем по строкам, чтобы при
    // появлении букв слова не перескакивали
    const blocks = [];
    const mk = (str, size, color, gap, align = 'left') => {
      const t = scene.add.text(0, 0, '', style(size, color, { align })).setResolution(2);
      const lines = t.getWrappedText(str);
      const full = lines.join('\n');
      t.setText(full);
      const h = t.height; t.setText('');
      blocks.push({ t, full, h, gap, align });
      return t;
    };
    mk(letter.greeting, 54, SILVER, 18);
    letter.paragraphs.forEach((p) => mk(p, 38, SILVER, 14));
    mk(letter.sign, 50, SILVER, 10, 'right');
    if (letter.ps) mk(letter.ps, 32, SILVER_SOFT, 0);
    const bodyH = blocks.reduce((a, b) => a + b.h + b.gap, 0);
    const H = Math.min(1000, PAD + bodyH + 40 + 64 + PAD * 0.6);
    const top = -H / 2;
    const paper = scene.add.image(0, 0, paperTexture(scene, W, Math.round(H), { kind: 'night', seed: 23, edge: 'torn', tornSides: 't' }));
    sheet.add(paper);
    let y = top + PAD;
    for (const b of blocks) {
      b.t.setPosition(b.align === 'right' ? W / 2 - PAD : -W / 2 + PAD, y).setOrigin(b.align === 'right' ? 1 : 0, 0);
      sheet.add(b.t);
      y += b.h + b.gap;
    }
    // маленький Тихон на нитке в правом верхнем углу
    const sp = scene.add.container(W / 2 - 70, top - 6);
    const thread = scene.add.graphics();
    thread.lineStyle(2, 0xe6ecf5, 0.7).lineBetween(0, -30, 0, 52);
    const spider = scene.add.image(0, 52, 'spider_corner').setOrigin(0.5, 8 / 170).setScale(0.36);
    sp.add([thread, spider]);
    sheet.add(sp);
    if (!reduced) scene.tweens.add({ targets: sp, angle: { from: -5, to: 5 }, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const btn = new Button(scene, W / 2 - PAD - 130, top + H - PAD * 0.6 - 32, {
      label: button, width: 260, height: 60, variant: 'primary', style: 'button-xl', onClick: () => close(),
    });
    sheet.add(btn);

    // появление букв
    const total = blocks.reduce((a, b) => a + b.full.length, 0);
    let shown = instant || reduced ? total : 0;
    let done = false; let closing = false;
    const render = () => {
      let left = Math.floor(shown);
      for (const b of blocks) {
        const n = Math.max(0, Math.min(b.full.length, left));
        if (b.t.text.length !== n) b.t.setText(b.full.slice(0, n));
        left -= b.full.length;
      }
    };
    const complete = () => {
      if (done) return;
      done = true; shown = total; render();
      Audio.stopLoop('pencil_scribble', { fade: 200 });
    };
    const onUpdate = (time, delta) => {
      if (done) return;
      shown += CPS * (delta || 16) / 1000;
      if (shown >= total) complete(); else render();
    };
    function close() {
      if (closing) return;
      if (!done) { complete(); return; }
      closing = true;
      scene.events.off('update', onUpdate);
      scene.input.keyboard?.off('keydown-SPACE', onKey);
      scene.input.keyboard?.off('keydown-ENTER', onKey);
      scene.input.keyboard?.off('keydown-ESC', onEsc);
      Audio.play('paper_2', { volume: 0.4 });
      scene.tweens.add({
        targets: root, alpha: 0, duration: MOTION.fade, ease: EASE,
        onComplete: () => { root.destroy(); resolve(); },
      });
      if (!reduced) scene.tweens.add({ targets: sheet, y: 40, angle: 2, duration: MOTION.fade, ease: 'Sine.easeIn' });
    }
    const onKey = () => close();
    const onEsc = () => { complete(); close(); };
    dim.on('pointerdown', () => close());
    paper.setInteractive().on('pointerdown', () => { if (!done) complete(); });
    scene.input.keyboard?.on('keydown-SPACE', onKey);
    scene.input.keyboard?.on('keydown-ENTER', onKey);
    scene.input.keyboard?.on('keydown-ESC', onEsc);
    scene.events.on('update', onUpdate);
    scene.events.once('shutdown', () => scene.events.off('update', onUpdate));
    render();
    if (!done && !instant) Audio.loop('pencil_scribble', { volume: 0.16, fade: 300 });
    if (shown >= total) done = true;
    btn.lock(700);
    Audio.play('page', { volume: 0.5 });
    scene.tweens.add({ targets: root, alpha: 1, duration: MOTION.base, ease: EASE });
    if (!reduced) {
      sheet.setAngle(-3).setY(60);
      scene.tweens.add({ targets: sheet, angle: -0.8, y: 0, duration: 700, ease: 'Back.easeOut' });
    }
    window.__letter = { root, complete, close, blocks: () => blocks.map((b) => b.t.text) };
  });
}
