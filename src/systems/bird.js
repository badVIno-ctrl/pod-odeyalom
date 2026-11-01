// Снегирь на внешнем подоконнике — друг мальчика. С первого дня сидит за стеклом; с каждой серебряной нитью
// садится ближе (крупнее), к третьей — стучит клювом в стекло. Искра Огнёвки его пугает: улетает до утра.
// Живёт сам по себе: перескакивает, вертит головой, клюёт, распушается, иногда подаёт голос. По нему можно щёлкнуть.
import * as Phaser from 'phaser';
import { Audio } from './audio.js';
import { prefersReducedMotion } from '../config/game.js';

// Нижние стёкла окна: птица сидит на внешнем отливе, не заходя на переплёт (x = 675…685).
const SPOTS = [
  { x: 818, s: 0.5 }, { x: 772, s: 0.62 }, { x: 598, s: 0.74 }, { x: 590, s: 0.86 },
];
const SILL_Y = 580;
const RANGES = [[528, 632], [732, 836]];

export class Bullfinch {
  constructor(scene, { depth = 1, scrollFactor = 0.32 } = {}) {
    this.scene = scene;
    this.reduced = prefersReducedMotion();
    this.img = scene.add.image(-200, SILL_Y, 'bullfinch').setOrigin(0.5, 1).setDepth(depth).setAlpha(0)
      .setScrollFactor(scrollFactor, scrollFactor);
    this.present = false;
    this.busy = false;
    this.timer = null;
    this.flap = null;
    this.img.setInteractive({ useHandCursor: true, pixelPerfect: false });
    this.img.on('pointerdown', (p, lx, ly, ev) => { if (ev) ev.stopPropagation(); this.poke(); });
    scene.events.once('shutdown', () => this.stop());
  }

  spotFor(wins) { return SPOTS[Math.max(0, Math.min(SPOTS.length - 1, wins))]; }

  rangeOf(x) { return RANGES.find(([a, b]) => x >= a - 40 && x <= b + 40) || RANGES[0]; }

  stop() { if (this.timer) { this.timer.remove(false); this.timer = null; } this.stopFlap(); }

  stopFlap() { if (this.flap) { this.flap.remove(false); this.flap = null; } }

  startFlap() {
    this.stopFlap();
    let f = 0;
    this.img.setTexture('bullfinch_fly_0');
    this.flap = this.scene.time.addEvent({ delay: 85, loop: true, callback: () => { f ^= 1; this.img.setTexture(`bullfinch_fly_${f}`); } });
  }

  // Сразу сидит на месте (утро, птица уже прилетела).
  sit(wins) {
    const sp = this.spotFor(wins);
    this.stopFlap();
    this.img.setTexture('bullfinch').setPosition(sp.x, SILL_Y).setScale(sp.s).setFlipX(false).setAlpha(1);
    this.present = true;
    this.schedule();
    return this;
  }

  // Прилетает слева сверху и садится.
  arrive(wins, ms = 1500) {
    const sp = this.spotFor(wins);
    this.stop();
    this.present = true;
    this.img.setPosition(sp.x - 260, SILL_Y - 170).setScale(sp.s).setFlipX(true).setAlpha(0);
    this.startFlap();
    return new Promise((resolve) => {
      this.scene.tweens.add({ targets: this.img, alpha: 1, duration: 300 });
      this.scene.tweens.add({
        targets: this.img, x: sp.x, duration: ms, ease: 'Sine.easeOut',
      });
      this.scene.tweens.add({
        targets: this.img, y: SILL_Y, duration: ms, ease: 'Back.easeOut',
        onComplete: () => {
          this.stopFlap(); this.img.setTexture('bullfinch').setFlipX(false);
          this.chirp(0.3);
          this.schedule();
          resolve();
        },
      });
    });
  }

  // Испугался и улетел (искра) или улетел ночевать.
  flyAway(ms = 1100) {
    if (!this.present) return Promise.resolve();
    this.stop();
    this.present = false;
    this.startFlap();
    this.img.setFlipX(true);
    this.chirp(0.32, 1.25);
    return new Promise((resolve) => {
      this.scene.tweens.killTweensOf(this.img);
      this.scene.tweens.add({
        targets: this.img, x: this.img.x - 300, y: SILL_Y - 230, alpha: 0, duration: ms, ease: 'Sine.easeIn',
        onComplete: () => { this.stopFlap(); resolve(); },
      });
    });
  }

  hide() { this.stop(); this.present = false; this.scene.tweens.killTweensOf(this.img); this.img.setAlpha(0); }

  chirp(volume = 0.25, rate = 1) {
    Audio.play('bullfinch', { volume, rate: rate * (0.94 + Math.random() * 0.12), pan: -0.45 });
  }

  // Щелчок по снегирю: подпрыгивает и отвечает.
  poke() {
    if (!this.present || this.busy) return;
    this.chirp(0.35, 1.1);
    this.hop(0);
  }

  schedule() {
    if (this.timer) this.timer.remove(false);
    this.timer = this.scene.time.delayedCall(1400 + Math.random() * 2800, () => { this.act(); this.schedule(); });
  }

  act() {
    if (!this.present || this.busy || this.img.alpha < 0.5) return;
    const r = Math.random();
    if (r < 0.28) this.hop((Math.random() - 0.5) * 60);
    else if (r < 0.5) this.img.setFlipX(!this.img.flipX);
    else if (r < 0.7) this.peck();
    else if (r < 0.85) this.fluff();
    else this.chirp(0.16);
  }

  hop(dx) {
    if (this.reduced) return;
    const [a, b] = this.rangeOf(this.img.x);
    const x = Phaser.Math.Clamp(this.img.x + dx, a, b);
    if (dx) this.img.setFlipX(dx > 0);
    this.busy = true;
    this.scene.tweens.add({ targets: this.img, x, duration: 260, ease: 'Sine.easeInOut' });
    this.scene.tweens.add({
      targets: this.img, y: SILL_Y - 16 * this.img.scaleY, duration: 130, yoyo: true, ease: 'Sine.easeOut',
      onComplete: () => { this.busy = false; },
    });
  }

  peck() {
    this.busy = true;
    this.img.setTexture('bullfinch_peck');
    // к третьей нити снегирь стучит клювом прямо в стекло
    if (this.img.scaleX > 0.7) Audio.play('tap', { volume: 0.08, rate: 1.9, pan: -0.45 });
    this.scene.time.delayedCall(260, () => { if (this.img.active) this.img.setTexture('bullfinch'); this.busy = false; });
  }

  fluff() {
    if (this.reduced) return;
    const s = this.img.scaleX; const sy = this.img.scaleY;
    this.scene.tweens.add({ targets: this.img, scaleX: s * 1.08, scaleY: sy * 1.06, duration: 220, yoyo: true, ease: 'Sine.easeInOut' });
  }
}
