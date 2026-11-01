// Небольшой набор помощников Canvas 2D для процедурных заглушек.
export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Реестр текстур, нарисованных кодом: ключ → размер и группа. По нему собираются шаблоны и ТЗ художнику
// (?lab=export, tools/export-art.mjs). Любую из этих текстур можно заменить файлом assets/img/<ключ>.png
// того же размера: картинка загружается при старте, и рисовать её кодом уже не нужно.
export const TEX_REGISTRY = new Map();
const sizeWarned = new Set();
export function paintTexOnce(scene, key, w, h, draw, group = 'misc') {
  if (!TEX_REGISTRY.has(key)) TEX_REGISTRY.set(key, { w, h, group });
  if (scene.textures.exists(key)) {
    const src = scene.textures.get(key).getSourceImage();
    if (src && (src.width !== w || src.height !== h) && !sizeWarned.has(key)) {
      sizeWarned.add(key);
      console.warn(`[assets] ${key}: картинка ${src.width}×${src.height}, нужно ${w}×${h} — точки крепления могут съехать`);
    }
    return;
  }
  const c = makeCanvas(w, h); const ctx = c.getContext('2d');
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  draw(ctx, w, h);
  scene.textures.addImage(key, c);
}

export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function vgrad(ctx, x, y, w, h, stops) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

export function radial(ctx, x, y, r, inner, outer = 'rgba(0,0,0,0)', comp = 'source-over') {
  ctx.save();
  ctx.globalCompositeOperation = comp;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, inner); g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

export function rrect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function poly(ctx, pts, fill, stroke, lw = 4) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); }
}

export function ellipse(ctx, x, y, rx, ry, fill, stroke, lw = 4, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

export function line(ctx, pts, stroke, lw = 4, cap = 'round') {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineCap = cap; ctx.lineJoin = 'round';
  ctx.stroke();
}

// Ломаная «силуэтная» линия холмов: заливка от линии до низа.
export function ridge(ctx, w, h, baseY, amp, waves, fill, seed = 1, step = 24) {
  const r = rng(seed);
  const ph = [r() * 6, r() * 6, r() * 6];
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += step) {
    const y = baseY + Math.sin(x / w * Math.PI * 2 * waves + ph[0]) * amp
      + Math.sin(x / w * Math.PI * 2 * waves * 2.7 + ph[1]) * amp * 0.35
      + Math.sin(x / w * Math.PI * 2 * waves * 6.1 + ph[2]) * amp * 0.12;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

export function fir(ctx, x, baseY, hgt, color, snow = 'rgba(244,247,250,0.9)') {
  const w = hgt * 0.42;
  for (let k = 0; k < 4; k++) {
    const top = baseY - hgt + k * hgt * 0.2;
    const bw = w * (0.45 + k * 0.2);
    poly(ctx, [[x, top], [x + bw, top + hgt * 0.34], [x - bw, top + hgt * 0.34]], color);
    if (snow) poly(ctx, [[x, top + 2], [x + bw * 0.55, top + hgt * 0.17], [x - bw * 0.55, top + hgt * 0.17]], snow);
  }
  ctx.fillStyle = '#3a2c26';
  ctx.fillRect(x - hgt * 0.03, baseY - hgt * 0.12, hgt * 0.06, hgt * 0.12);
}

export function label(ctx, key, w, h, { x = 16, y = h - 16, size = 18 } = {}) {
  ctx.save();
  ctx.font = `600 ${size}px Literata, serif`;
  const tw = ctx.measureText(key).width;
  ctx.fillStyle = 'rgba(11,16,28,0.55)';
  rrect(ctx, x - 8, y - size - 4, tw + 16, size + 12, 8);
  ctx.fill();
  ctx.fillStyle = 'rgba(243,235,221,0.75)';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(key, x, y);
  ctx.restore();
}

export function snowSpeckles(ctx, w, h, count, seed, alpha = 0.6, maxR = 2.6) {
  const r = rng(seed);
  ctx.save();
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = `rgba(255,255,255,${alpha * (0.3 + r() * 0.7)})`;
    ctx.beginPath();
    ctx.arc(r() * w, r() * h, 0.6 + r() * maxR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Холсты рисуются один раз и больше не меняются, поэтому регистрируются через textures.addImage(key, canvas):
// CanvasTexture (addCanvas) при создании читает все пиксели (getImageData), это 8 МБ копии на каждый фон 1920×1080
// и секунды ожидания на слабых машинах.

// Старая фотография: тёплая сепия поверх цвета, чуть приподнятые тени, плёночное зерно.
export function sepia(ctx, w, h, k = 0.6, seed = 1) {
  let img;
  try { img = ctx.getImageData(0, 0, w, h); } catch { return; }
  const d = img.data; const r = rng(seed);
  for (let i = 0; i < d.length; i += 4) {
    const R = d[i]; const G = d[i + 1]; const B = d[i + 2];
    const l = 0.3 * R + 0.59 * G + 0.11 * B;
    const n = (r() - 0.5) * 10;
    d[i] = R + (Math.min(255, l * 1.08 + 26) - R) * k + n;
    d[i + 1] = G + (Math.min(255, l * 0.9 + 14) - G) * k + n;
    d[i + 2] = B + (l * 0.66 + 4 - B) * k + n;
  }
  ctx.putImageData(img, 0, 0);
}
