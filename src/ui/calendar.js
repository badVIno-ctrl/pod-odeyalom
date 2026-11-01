// Титр дня — отрывной календарь на картонной подложке. Сначала виден вчерашний листок
// (с карандашной отметкой: галочка — победа, крестик — поражение), его отрывают — под ним новый день.
// В прологе вместо вчерашнего листка — обложка «Пять дней жара».
// calendarCard(scene, director, { day, title, subtitle, prev: null | 'cover' | { day, result } })
import { INK, INKN, EASE, text } from '../config/theme.js';
import { prefersReducedMotion } from '../config/game.js';
import { paperTexture, inkCheck, inkCross, inkCircle, inkLine } from './paper.js';
import { Audio } from '../systems/audio.js';
import { Music } from '../systems/music.js';

const PW = 470; const PH = 540; // листок
const CX = 960; const TOP = 268; // верх листка (под переплётом)

function bgTexture(scene) {
  const key = 'calendar_bg';
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, 1920, 1080);
  const ctx = tex.context;
  const g = ctx.createRadialGradient(960, 470, 60, 960, 540, 1150);
  g.addColorStop(0, '#2a3354'); g.addColorStop(0.45, '#151b31'); g.addColorStop(1, '#05070e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1920, 1080);
  // тёплое пятно лампы снизу слева
  const l = ctx.createRadialGradient(420, 980, 10, 420, 980, 700);
  l.addColorStop(0, 'rgba(255,176,102,0.16)'); l.addColorStop(1, 'rgba(255,176,102,0)');
  ctx.fillStyle = l; ctx.fillRect(0, 0, 1920, 1080);
  tex.refresh();
  return key;
}

// Картонная подложка с гвоздиком и переплётом.
function boardTexture(scene) {
  const key = 'calendar_board';
  if (scene.textures.exists(key)) return key;
  const W = 560; const H = 720;
  const base = paperTexture(scene, W, H, { kind: 'kraft', seed: 12, edge: 'cut' });
  const src = scene.textures.get(base).getSourceImage();
  const tex = scene.textures.createCanvas(key, src.width, src.height);
  const ctx = tex.context;
  ctx.drawImage(src, 0, 0);
  const ox = (src.width - W) / 2; const oy = (src.height - H) / 2;
  // гвоздик
  const nx = ox + W / 2; const ny = oy + 36;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(nx + 2, ny + 3, 9, 0, Math.PI * 2); ctx.fill();
  const ng = ctx.createRadialGradient(nx - 3, ny - 3, 1, nx, ny, 9);
  ng.addColorStop(0, '#fff1c4'); ng.addColorStop(0.5, '#c9a14a'); ng.addColorStop(1, '#6e5220');
  ctx.fillStyle = ng; ctx.beginPath(); ctx.arc(nx, ny, 8, 0, Math.PI * 2); ctx.fill();
  // переплёт: тёмно-красная полоса со скрепками
  const by = oy + 84; const bw = PW + 16;
  ctx.fillStyle = '#7d2a22'; ctx.fillRect(ox + (W - bw) / 2, by, bw, 34);
  const bg = ctx.createLinearGradient(0, by, 0, by + 34);
  bg.addColorStop(0, 'rgba(255,255,255,0.18)'); bg.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = bg; ctx.fillRect(ox + (W - bw) / 2, by, bw, 34);
  for (const sx of [-140, 140]) {
    ctx.fillStyle = '#d8d2c4'; ctx.fillRect(ox + W / 2 + sx - 16, by + 13, 32, 6);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(ox + W / 2 + sx - 16, by + 19, 32, 2);
  }
  // край стопки листков под переплётом
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 ? '#e6dcc6' : '#d7cbb1';
    ctx.fillRect(ox + (W - PW) / 2 + 2, by + 34 + PH + 2 + i * 3, PW - 4, 3);
  }
  tex.refresh();
  return key;
}

// Обложка календаря: обычная и «Вторая зима» (год спустя — тот же календарь, новая обложка).
export const COVER = { title: 'Пять дней\nжара', sub: 'календарь болезни', note: 'отрывать по одному\nлистку каждое утро' };
export const COVER_W2 = { title: 'Вторая\nзима', sub: 'календарь болезни', note: 'год спустя.\nтот же уголок' };

// Один листок: контейнер с опорой в левом верхнем углу (так его удобно «отрывать»).
function makePage(scene, { day, title, subtitle, cover = false, result = null, seed = 1 }) {
  const c = scene.add.container(CX - PW / 2, TOP);
  const paper = scene.add.image(PW / 2, PH / 2, paperTexture(scene, PW, PH, { kind: 'light', seed, edge: 'torn', tornSides: 't', shadow: false }));
  c.add(paper);
  const mid = PW / 2;
  if (cover) {
    const ct = typeof cover === 'object' ? cover : COVER;
    c.add(scene.add.text(mid, 150, ct.title, text('heading-1', { color: INK.red, align: 'center' })).setOrigin(0.5).setResolution(2));
    const g = scene.add.graphics();
    inkLine(g, mid - 120, 250, mid + 120, 250, { seed: 4, color: INKN.ink, width: 2, alpha: 0.6 });
    c.add(g);
    c.add(scene.add.text(mid, 320, ct.sub, text('hand-4', { color: INK.soft })).setOrigin(0.5).setResolution(2));
    c.add(scene.add.text(mid, 440, ct.note, text('hand-2', { color: INK.faded, align: 'center' })).setOrigin(0.5).setResolution(2));
    return c;
  }
  c.add(scene.add.text(mid, 58, 'Д Е Н Ь', text('heading-5', { color: INK.soft })).setOrigin(0.5).setResolution(2));
  c.add(scene.add.text(mid, 196, String(day), {
    ...text('heading-7', { color: INK.red }), fontSize: '230px',
  }).setOrigin(0.5).setResolution(2));
  const g = scene.add.graphics();
  inkLine(g, 60, 330, PW - 60, 330, { seed: day * 3, color: INKN.ink, width: 1.6, alpha: 0.45, passes: 1 });
  c.add(g);
  if (title) c.add(scene.add.text(mid, 384, title, text('heading-3', { color: INK.ink, align: 'center' })).setOrigin(0.5).setResolution(2));
  if (subtitle) {
    c.add(scene.add.text(mid, 446, subtitle, text('hand-3', { color: INK.soft, align: 'center', wordWrap: { width: PW - 80 } }))
      .setOrigin(0.5, 0).setResolution(2));
  }
  if (result) {
    // карандашная отметка вчерашнего дня
    const m = scene.add.graphics();
    if (result === 'win') { inkCircle(m, PW - 86, 110, 40, { seed: day + 9, color: INKN.green, width: 3, alpha: 0.85 }); inkCheck(m, PW - 84, 112, 44, { seed: day, color: INKN.green, width: 4.5 }); } else { inkCircle(m, PW - 86, 110, 40, { seed: day + 9, color: INKN.red, width: 3, alpha: 0.85 }); inkCross(m, PW - 86, 110, 40, { seed: day, color: INKN.red, width: 4.2 }); }
    m.setAngle(-6);
    c.add(m);
  }
  return c;
}

export async function calendarCard(scene, d, { day, title = '', subtitle = '', prev = null, hold = 2000, keep = false, cover = null } = {}) {
  const reduced = prefersReducedMotion();
  const layer = scene.add.container(0, 0).setDepth(2000);
  // чёрная подложка остаётся до конца: после титра сцена сразу переключается, комната не мелькает
  const black = scene.add.rectangle(960, 540, 1920, 1080, 0x000000, 1);
  const bg = scene.add.image(960, 540, bgTexture(scene)).setAlpha(0);
  const pad = scene.add.container(0, 0);
  const board = scene.add.image(CX, TOP + PH / 2 - 52, boardTexture(scene));
  const page = makePage(scene, { day, title, subtitle, seed: day + 1 });
  pad.add([board, page]);
  let top = null;
  if (prev === 'cover') top = makePage(scene, { cover: cover || true, seed: 9 });
  else if (prev && prev.day) top = makePage(scene, { day: prev.day, title: prev.title, subtitle: prev.subtitle, result: prev.result, seed: prev.day + 1 });
  if (top) pad.add(top);
  layer.add([black, bg, pad]);
  Music.stop({ fade: 900 });
  // появление: фон, затем календарь «повисает» на гвоздике
  pad.setAlpha(0).setY(reduced ? 0 : -40).setAngle(reduced ? 0 : -2.5);
  await d.tween({ targets: bg, alpha: 1, duration: 350, ease: EASE });
  d.tween({ targets: pad, alpha: 1, duration: 420, ease: EASE });
  await d.tween({ targets: pad, y: 0, angle: 0, duration: reduced ? 1 : 700, ease: 'Back.easeOut' });
  if (top) {
    await d.wait(reduced ? 200 : 520);
    Audio.play('tear', { volume: 0.6 });
    if (reduced) await d.tween({ targets: top, alpha: 0, duration: 300 });
    else {
      await d.tween({ targets: top, y: TOP + 10, angle: 2.5, duration: 160, ease: 'Quad.easeOut' });
      d.tween({ targets: top, alpha: 0, duration: 520, delay: 380, ease: 'Linear' });
      await d.tween({ targets: top, x: top.x + 190, y: TOP + 760, angle: 34, scale: 0.94, duration: 900, ease: 'Quad.easeIn' });
    }
    top.destroy();
  }
  Music.stinger('daycard', { volume: 0.9 });
  await d.wait(hold);
  if (keep) return layer; // листок остаётся: следующую страницу перелистнут поверх (PageTurn)
  await d.tween({ targets: [bg, pad], alpha: 0, duration: 520, ease: EASE });
  layer.destroy();
  return null;
}

export const CALENDAR = { PW, PH, TOP };
