// «Кукла» паука: брюшко и голова — текстуры, лапы перерисовываются каждый кадр (покачивание,
// «думает» — быстрое шевеление лапами, «смеётся» — подпрыгивание и ухмылка).
// Если в assets/img лежат настоящие spider_idle.png / spider_grin.png — используется картинка целиком
// с мягкой анимацией масштабом (точка крепления нити — середина верхнего края, 12 px от верха).
import * as Phaser from 'phaser';
import { GEOM, SPIDER_COLORS, legPoints, segmentQuad } from './spiderArt.js';
import { SPIDER_PARTS } from './placeholders.js';
import { Assets } from './assets.js';
import { prefersReducedMotion } from '../config/game.js';

const hex = (s) => Number.parseInt(s.slice(1), 16);
const C = {
  outline: hex(SPIDER_COLORS.outline), leg: hex(SPIDER_COLORS.leg), legBack: hex(SPIDER_COLORS.legBack),
  knee: hex(SPIDER_COLORS.knee), kneeBack: 0x6f6256,
};
const IMG = { w: 480, h: 340, attachY: 12 };

// Чёрный силуэт текстуры (для тени на стене): создаётся один раз.
export function silhouetteOf(scene, key) {
  const k = `${key}__sil`;
  if (scene.textures.exists(k)) return k;
  const src = scene.textures.get(key).getSourceImage();
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const ctx = c.getContext('2d'); ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, c.width, c.height);
  scene.textures.addImage(k, c);
  return k;
}

export class SpiderRig extends Phaser.GameObjects.Container {
  // silhouette — чёрный силуэт (тень на стене), follow — повторять позу другой куклы (те же t, режим и лицо)
  constructor(scene, x, y, { scale = 0.8, threadTop = null, silhouette = false, follow = null } = {}) {
    super(scene, x, y);
    this.silhouette = silhouette;
    this.follow = follow;
    this.t = Math.random() * 10;
    this.mode = 'idle';
    this.face = 'idle';
    this.reduced = prefersReducedMotion();
    this.useImages = Assets.isReal('spider_idle');
    this.thread = null;
    if (threadTop !== null) {
      this.threadTop = threadTop;
      this.thread = scene.add.graphics();
    }
    if (this.useImages) {
      this.img = scene.add.image(0, 0, 'spider_idle').setOrigin(0.5, IMG.attachY / IMG.h);
      this.add(this.img);
    } else {
      const B = SPIDER_PARTS.spider_part_body;
      this.legs = scene.add.graphics();
      this.body = scene.add.image(0, 0, 'spider_part_body').setOrigin(B.ox / B.w, B.oy / B.h);
      this.head = scene.add.image(GEOM.head.x, GEOM.head.y, 'spider_part_head_idle');
      this.add([this.legs, this.body, this.head]);
    }
    if (silhouette) {
      // чёрные копии текстур (Canvas-рендер тонировать не умеет)
      if (this.img) this.img.setTexture(silhouetteOf(scene, this.img.texture.key));
      if (this.body) { this.body.setTexture(silhouetteOf(scene, 'spider_part_body')); this.head.setTexture(silhouetteOf(scene, 'spider_part_head_idle')); }
    }
    this.setScale(scale);
    scene.add.existing(this);
    scene.events.on('update', this.tick, this);
    this.once('destroy', () => {
      scene.events.off('update', this.tick, this);
      if (this.blinkTimer) this.blinkTimer.remove(false);
      if (this.thread) this.thread.destroy();
    });
    this.scheduleBlink();
    this.tick(0, 0);
  }

  setRigDepth(d) {
    this.setDepth(d);
    if (this.thread) this.thread.setDepth(d - 0.01);
    return this;
  }

  setMode(mode) { this.mode = mode; return this; }

  setFace(face) {
    this.face = face;
    if (this.useImages) this.img.setTexture(face === 'grin' ? 'spider_grin' : 'spider_idle');
    else this.head.setTexture(`spider_part_head_${face}`);
    return this;
  }

  scheduleBlink() {
    if (this.useImages || this.follow) return;
    this.blinkTimer = this.scene.time.delayedCall(2200 + Math.random() * 3200, () => {
      if (!this.active) return;
      if (this.face === 'idle') {
        this.head.setTexture('spider_part_head_blink');
        this.scene.time.delayedCall(130, () => { if (this.active && this.face === 'idle') this.head.setTexture('spider_part_head_idle'); });
      }
      this.scheduleBlink();
    });
  }

  // Реакция на ход мальчика или привычка на время ms: лицо + движение лап, потом обратно к покою.
  // kind: impressed (ого!) | puzzled (чешет голову) | smug (хитрый прищур) | impatient (барабанит)
  //       | stretch (потягивается) | count (считает на лапах) | pluck (перебирает нити — колыбельная)
  react(kind, ms = 1400) {
    if (this.mode === 'laugh') return this;
    const R = {
      impressed: ['wow', 'clap'], puzzled: ['hmm', 'scratch'], smug: ['sly', 'idle'], impatient: ['idle', 'tap'],
      stretch: ['blink', 'stretch'], count: ['hmm', 'count'], pluck: ['blink', 'count'],
    }[kind];
    if (!R) return this;
    if (this.reactTimer) this.reactTimer.remove(false);
    const [face, mode] = R;
    if (!this.useImages) this.setFace(face);
    this.setMode(mode);
    this.reacting = kind;
    if (kind === 'impressed' && !this.reduced) {
      this.scene.tweens.add({ targets: this, scaleY: this.scaleY * 1.05, duration: 140, yoyo: true, ease: 'Sine.easeOut' });
    }
    this.reactTimer = this.scene.time.delayedCall(ms, () => {
      this.reactTimer = null; this.reacting = null;
      if (!this.active) return;
      if (this.mode === mode) this.setMode('idle');
      if (this.face === face) this.setFace('idle');
    });
    return this;
  }

  // Смех: ухмылка + подпрыгивание. Возвращает Promise.
  laugh(ms = 1500) {
    this.setFace('grin').setMode('laugh');
    const base = this.y;
    return new Promise((resolve) => {
      if (this.reduced) { this.scene.time.delayedCall(ms, () => { this.setMode('idle'); resolve(); }); return; }
      this.scene.tweens.add({
        targets: this, y: base + 10, duration: 110, yoyo: true, repeat: Math.max(1, Math.round(ms / 220) - 1),
        ease: 'Sine.easeInOut',
        onComplete: () => { this.y = base; this.setMode('idle'); resolve(); },
        onStop: () => { this.y = base; resolve(); },
      });
    });
  }

  tick(time, delta) {
    if (!this.active) return;
    const f = this.follow;
    if (f) {
      this.t = f.t; this.mode = f.mode;
      const want = this.useImages ? f.img.texture.key : f.head.texture.key;
      if (want !== this.srcKey) {
        this.srcKey = want; this.face = f.face;
        const k = this.silhouette ? silhouetteOf(this.scene, want) : want;
        if (this.useImages) this.img.setTexture(k); else this.head.setTexture(k);
      }
      if (!this.visible) return;
    } else this.t += (this.reduced ? 0.35 : 1) * (delta || 0) / 1000;
    if (this.useImages) {
      const sp = this.mode === 'think' ? 9 : this.mode === 'laugh' ? 14 : 1.4;
      const amp = this.mode === 'think' ? 0.035 : this.mode === 'laugh' ? 0.045 : 0.012;
      const s = Math.sin(this.t * sp) * amp;
      this.img.setScale(1 + s, 1 - s * 0.6);
    } else {
      this.drawLegs();
    }
    if (this.thread) {
      this.thread.clear();
      if (this.visible && this.alpha > 0.01) {
        this.thread.lineStyle(2, 0xe6ecf5, 0.55 * this.alpha);
        this.thread.lineBetween(this.x, this.threadTop, this.x, this.y + 6 * this.scaleY);
      }
    }
  }

  drawLegs() {
    const g = this.legs;
    g.clear();
    for (let i = 3; i >= 0; i--) {
      for (const side of ['left', 'right']) {
        const [a, k, tip] = legPoints(side, i, this.t, this.mode);
        const w = GEOM.width[i];
        const back = i >= 2;
        const segs = [[a, k, w, w * 0.8], [k, tip, w * 0.78, w * 0.22]];
        g.fillStyle(this.silhouette ? 0x000000 : C.outline, 1);
        for (const [p, q, w0, w1] of segs) g.fillPoints(segmentQuad(p, q, w0 + 7, w1 + 7), true);
        g.fillCircle(k.x, k.y, w * 0.48 + 3.5);
        if (this.silhouette) continue;
        g.fillStyle(back ? C.legBack : C.leg, 1);
        for (const [p, q, w0, w1] of segs) g.fillPoints(segmentQuad(p, q, w0, w1), true);
        g.fillStyle(back ? C.kneeBack : C.knee, 1);
        g.fillCircle(k.x, k.y, w * 0.48);
      }
    }
  }
}
