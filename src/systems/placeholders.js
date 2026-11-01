// Заглушки для всех ключей картинок. Если файла assets/img/<key>.png нет — рисуем текстуру кодом
// (палитра: тёмно-синий, серый, тёплый оранжевый) и подписываем ключ мелким текстом.
import { makeCanvas, label, paintTexOnce } from './paint.js';
import { paintRoom, paintRoadFar, paintRoadMid, paintRoadFront, paintPorch, paintWebWindow } from './paintEnv.js';
import {
  paintBoyBed, paintGirlBed, paintMom, paintPairFrame, PAIR_FRAME, paintScarf, paintThermometer,
} from './paintChars.js';
import { paintSpider, paintAbdomen, paintHead } from './spiderArt.js';

const roomWithBed = (ctx, w, h, mode) => {
  paintRoom(ctx, w, h, mode);
  ctx.save(); ctx.translate(1470 - 430, 1000 - 540); paintBoyBed(ctx, 860, 540, 'sleep'); ctx.restore();
  // мягкий тёплый свет поверх
  const g = ctx.createRadialGradient(1000, 520, 50, 1000, 520, 700);
  g.addColorStop(0, 'rgba(255,170,90,0.07)'); g.addColorStop(1, 'rgba(255,170,90,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
};

// Подписи ключей на нарисованных кодом текстурах — только в режиме ?labels=1 (для художника).
const DEBUG_LABELS = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('labels') === '1';

export const PAINTERS = {
  menu_bg: { w: 1920, h: 1080, draw: (c, w, h) => roomWithBed(c, w, h, 'dusk') },
  road_far: { w: 3840, h: 1080, draw: (c, w, h) => paintRoadFar(c, w, h, false) },
  road_mid: { w: 3840, h: 1080, draw: paintRoadMid },
  road_front: { w: 3840, h: 1080, draw: paintRoadFront },
  road_far_storm: { w: 3840, h: 1080, draw: (c, w, h) => paintRoadFar(c, w, h, true) },
  porch: { w: 1920, h: 1080, draw: (c, w, h) => paintPorch(c, w, h, false) },
  porch_door_open: { w: 1920, h: 1080, draw: (c, w, h) => paintPorch(c, w, h, true) },
  bedroom_day: { w: 1920, h: 1080, draw: (c, w, h) => paintRoom(c, w, h, 'day') },
  bedroom_night: { w: 1920, h: 1080, draw: (c, w, h) => paintRoom(c, w, h, 'night') },
  bedroom_dawn: { w: 1920, h: 1080, draw: (c, w, h) => paintRoom(c, w, h, 'dawn') },
  // тайная глава «Аня»: рисуются по запросу (Assets.ensure), а не при загрузке
  bedroom_past: { w: 1920, h: 1080, lazy: true, draw: (c, w, h) => paintRoom(c, w, h, 'past') },
  anya_bed: { w: 860, h: 540, lazy: true, draw: paintGirlBed },
  boy_bed_sleep: { w: 860, h: 540, lazy: true, draw: (c, w, h) => paintBoyBed(c, w, h, 'sleep') },
  web_window: { w: 460, h: 460, draw: paintWebWindow },
  thermometer_item: { w: 240, h: 64, draw: paintThermometer },
  boy_bed_healthy: { w: 860, h: 540, draw: (c, w, h) => paintBoyBed(c, w, h, 'healthy') },
  boy_bed_sick: { w: 860, h: 540, draw: (c, w, h) => paintBoyBed(c, w, h, 'sick') },
  boy_bed_very_sick: { w: 860, h: 540, draw: (c, w, h) => paintBoyBed(c, w, h, 'very_sick') },
  boy_bed_critical: { w: 860, h: 540, draw: (c, w, h) => paintBoyBed(c, w, h, 'critical') },
  pair_walk: {
    w: PAIR_FRAME.w * PAIR_FRAME.frames, h: PAIR_FRAME.h, frames: PAIR_FRAME.frames,
    draw: (c) => { for (let f = 0; f < PAIR_FRAME.frames; f++) paintPairFrame(c, f * PAIR_FRAME.w, f); },
  },
  scarf: { w: 230, h: 90, draw: paintScarf },
  mom_stand: { w: 380, h: 860, draw: paintMom },
  spider_idle: { w: 480, h: 340, draw: (c) => paintSpider(c, 240, 12, { face: 'idle' }) },
  spider_grin: { w: 480, h: 340, draw: (c) => paintSpider(c, 240, 12, { face: 'grin', t: 1.2 }) },
  spider_corner: { w: 240, h: 170, draw: (c) => paintSpider(c, 120, 8, { face: 'idle', mode: 'tucked', scale: 0.46 }) },
};

// Внутренние текстуры «куклы» паука (не ключи манифеста).
export const SPIDER_PARTS = {
  spider_part_body: { w: 230, h: 200, ox: 115, oy: 6 },
  spider_part_head_idle: { w: 170, h: 170, ox: 85, oy: -129, face: 'idle' },
  spider_part_head_grin: { w: 170, h: 170, ox: 85, oy: -129, face: 'grin' },
  spider_part_head_blink: { w: 170, h: 170, ox: 85, oy: -129, face: 'blink' },
  spider_part_head_wow: { w: 170, h: 170, ox: 85, oy: -129, face: 'wow' }, // удивлён: «ого, вот это ход»
  spider_part_head_hmm: { w: 170, h: 170, ox: 85, oy: -129, face: 'hmm' }, // озадачен: бровь вверх
  spider_part_head_sly: { w: 170, h: 170, ox: 85, oy: -129, face: 'sly' }, // хитрый прищур, ухмылка набок
};

export function createPlaceholder(scene, key, def = PAINTERS[key]) {
  if (!def) {
    const c = makeCanvas(256, 256);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#2c3a55'; ctx.fillRect(0, 0, 256, 256);
    label(ctx, key, 256, 256);
    scene.textures.addImage(key, c);
    return;
  }
  const c = makeCanvas(def.w, def.h);
  const ctx = c.getContext('2d');
  def.draw(ctx, def.w, def.h);
  if (def.frames) {
    for (let f = 0; f < def.frames && DEBUG_LABELS; f++) label(ctx, `${key} ${f + 1}/${def.frames}`, def.w, def.h, { x: f * (def.w / def.frames) + 12, size: 14 });
  } else {
    const small = def.w < 400;
    if (DEBUG_LABELS) label(ctx, key, def.w, def.h, { size: small ? 13 : 18, x: small ? 6 : 16, y: def.h - (small ? 5 : 16) });
  }
  const tex = scene.textures.addImage(key, c);
  if (def.frames) sliceFrames(tex, def.frames);
}

// Нарезка спрайтшита на N кадров по горизонтали (работает и для PNG, и для заглушки).
export function sliceFrames(texture, frames) {
  const src = texture.getSourceImage();
  const fw = Math.floor(src.width / frames);
  for (let i = 0; i < frames; i++) {
    if (!texture.has(i)) texture.add(i, 0, i * fw, 0, fw, src.height);
  }
}

export function createSpiderParts(scene) {
  for (const [key, d] of Object.entries(SPIDER_PARTS)) {
    paintTexOnce(scene, key, d.w, d.h, (ctx) => {
      ctx.lineJoin = 'miter'; ctx.lineCap = 'butt'; // как раньше: стыки паука рисуются со значениями холста по умолчанию
      if (d.face) paintHead(ctx, d.ox, d.oy, d.face); else paintAbdomen(ctx, d.ox, d.oy);
    }, 'spider');
  }
}

export function createUtilityTextures(scene) {
  const tex = (key, w, h, draw) => {
    if (scene.textures.exists(key)) return;
    const c = makeCanvas(w, h); draw(c.getContext('2d'), w, h); scene.textures.addImage(key, c);
  };
  tex('fx_snow', 24, 24, (ctx) => {
    const g = ctx.createRadialGradient(12, 12, 0, 12, 12, 12);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 24, 24);
  });
  tex('fx_streak', 64, 8, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 2, 64, 4);
  });
  tex('fx_dust', 16, 16, (ctx) => {
    const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, 'rgba(255,236,200,0.9)'); g.addColorStop(1, 'rgba(255,236,200,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 16, 16);
  });
  tex('fx_vignette', 960, 540, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.28, w / 2, h / 2, h * 0.95);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });
  tex('fx_glow', 256, 256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
  });
  tex('fx_pixel', 4, 4, (ctx) => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 4, 4); });
}
