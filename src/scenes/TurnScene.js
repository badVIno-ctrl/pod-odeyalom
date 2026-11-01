// Перелистывание страницы между сценами. Снимок последнего кадра старой сцены (renderer.snapshot)
// режется на вертикальные полосы и «закручивается» вокруг цилиндра справа налево, как страница
// книги: под ней уже идёт новая сцена. Оборот листа — бумага (или тёмный картон обложки).
// Работает и на Canvas (только картинки с crop и прямоугольники), при reduced motion — простое затухание.
import * as Phaser from 'phaser';
import { prefersReducedMotion } from '../config/game.js';

const N = 48; const W = 1920; const H = 1080; const SW = W / N;
const R = 150; // радиус завитка

function backTexture(scene, kind) {
  const key = `turn_back_${kind}`;
  if (scene.textures.exists(key)) return key;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const base = kind === 'night' ? ['#1d2a4d', '#16203d'] : ['#f3ead6', '#e6d9bd'];
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, base[0]); g.addColorStop(1, base[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  let s = 7;
  const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let k = 0; k < 14000; k++) {
    ctx.fillStyle = kind === 'night' ? `rgba(255,255,255,${0.02 + r() * 0.03})` : `rgba(90,60,30,${0.03 + r() * 0.04})`;
    ctx.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2);
  }
  if (kind !== 'night') {
    // клетка тетрадного листа на обороте (видна насквозь)
    ctx.strokeStyle = 'rgba(86,128,182,0.16)'; ctx.lineWidth = 1;
    for (let x = 14; x < W; x += 36) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke(); }
    for (let y = 14; y < H; y += 36) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke(); }
  } else {
    ctx.strokeStyle = 'rgba(230,200,140,0.35)'; ctx.setLineDash([10, 8]); ctx.lineWidth = 2;
    ctx.strokeRect(40, 40, W - 80, H - 80);
  }
  scene.textures.addCanvas(key, c);
  return key;
}

export class TurnScene extends Phaser.Scene {
  constructor() { super('Turn'); }

  init(data) { this.opts = data || {}; }

  create() {
    const { snap, back = 'paper', ms = 1250, waitFor = null, onDone } = this.opts;
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    this.reduced = prefersReducedMotion();
    this.backKey = backTexture(this, back);
    this.cover = this.add.image(0, 0, snap).setOrigin(0, 0).setDisplaySize(W, H);
    this.k = 0;
    const begin = () => {
      if (this.reduced) {
        this.tweens.add({ targets: this.cover, alpha: 0, duration: 450, onComplete: () => this.done(onDone) });
        return;
      }
      this.cover.setVisible(false);
      this.strips = [];
      for (let i = 0; i < N; i++) {
        const front = this.add.image(0, 0, snap).setOrigin(0, 0).setCrop(i * SW, 0, SW + 1, H);
        const backImg = this.add.image(0, 0, this.backKey).setOrigin(0, 0).setVisible(false);
        const shade = this.add.rectangle(0, 0, SW + 1, H, 0x000000, 0).setOrigin(0, 0);
        this.strips.push({ i, front, backImg, shade });
      }
      // мягкая тень под завитком на новой сцене
      this.shadow = this.add.image(0, 0, this.shadowTex()).setOrigin(0, 0).setDisplaySize(190, H).setDepth(-10000);
      this.layout(0);
      this.tweens.add({
        targets: this, k: 1, duration: ms, ease: 'Sine.easeInOut',
        onUpdate: () => this.layout(this.k),
        onComplete: () => this.done(onDone),
      });
      this.sound?.stopAll?.();
    };
    if (waitFor) {
      // ждём, пока новая сцена построится и отрисует первый кадр
      const target = this.scene.get(waitFor);
      let started = false;
      const go = () => { if (started) return; started = true; this.time.delayedCall(120, begin); };
      if (target && target.sys.isActive() && target.sys.settings.status >= Phaser.Scenes.RUNNING) go();
      else if (target) target.events.once('create', go);
      this.time.delayedCall(4000, go);
    } else begin();
  }

  shadowTex() {
    const key = 'turn_shadow';
    if (this.textures.exists(key)) return key;
    const c = document.createElement('canvas'); c.width = 140; c.height = 4;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 140, 0); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 140, 4);
    this.textures.addCanvas(key, c);
    return key;
  }

  // Положение линии сгиба c: от правого края до полного ухода листа влево.
  layout(k) {
    const c = W + 40 - k * (W * 1.5 + Math.PI * R + 80);
    const X = (u) => {
      const s = u - c;
      if (s <= 0) return { x: u, z: 0, s };
      if (s < Math.PI * R) return { x: c + R * Math.sin(s / R), z: R * (1 - Math.cos(s / R)), s };
      return { x: c - (s - Math.PI * R), z: 2 * R, s };
    };
    let maxX = -Infinity;
    for (const st of this.strips) {
      const u0 = st.i * SW; const u1 = u0 + SW;
      const a = X(u0); const b = X(u1);
      const um = (u0 + u1) / 2; const m = X(um);
      const depth = m.s; // чем дальше по завитку, тем выше слой
      st.front.setDepth(depth); st.backImg.setDepth(depth); st.shade.setDepth(depth + 0.1);
      if (b.x >= a.x) {
        // лицевая сторона
        const w = Math.max(0.01, b.x - a.x);
        st.backImg.setVisible(false);
        st.front.setVisible(true).setScale(w / SW * 1.0, 1);
        st.front.x = a.x - u0 * (w / SW);
        const lit = m.s > 0 ? Math.sin(Math.min(Math.PI / 2, m.s / R)) : 0;
        st.shade.setPosition(a.x, 0).setSize(w + 1, H).setFillStyle(0x000000, 0.55 * lit);
      } else {
        // оборот: бумага, зеркально
        const w = Math.max(0.01, a.x - b.x);
        st.front.setVisible(false);
        const bu = W - u1; // оборот читается справа налево
        st.backImg.setVisible(true).setCrop(bu, 0, SW + 1, H).setScale(w / SW, 1);
        st.backImg.x = b.x - bu * (w / SW);
                // оборот на завитке: блик у вершины, к сгибу — тень; плоская часть чуть темнее
        const top = m.s < Math.PI * R ? Math.sin(m.s / R) : 0;
        const toFold = m.s < Math.PI * R ? Math.max(0, (m.s / R - Math.PI / 2) / (Math.PI / 2)) : 1;
        st.shade.setPosition(b.x, 0).setSize(w + 1, H).setFillStyle(top > 0.55 ? 0xffffff : 0x000000, top > 0.55 ? 0.2 * top : 0.08 + 0.22 * toFold * (1 - top));
      }
      maxX = Math.max(maxX, a.x, b.x);
    }
    this.shadow.setX(Math.min(W, maxX - 2)).setAlpha(k < 0.98 ? 1 : 0);
  }

  done(onDone) {
    if (this.finished) return;
    this.finished = true;
    if (onDone) onDone();
    this.scene.stop();
  }
}
