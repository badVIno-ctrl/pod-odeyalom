// Процедурные текстуры сюжета (временные, до настоящих рисунков художника):
// Огнёвка — огненная бабочка-жар и её «остывшая» белая форма, ледяная паутина, кресло, плед, снегирь,
// телефон, флакон с сиропом, ноги в шерстяных носках под одеялом, ночная улица и машина скорой,
// мягкий растушёванный луч из окна, мамин детский рисунок с пауком Тихоном.
import { rrect, ellipse, poly, line, vgrad, radial, rng, fir, snowSpeckles, paintTexOnce } from './paint.js';
import { FONT } from '../config/theme.js';
import { tr } from '../i18n/index.js';

const OUT = '#24170f';

function tex(scene, key, w, h, draw) { paintTexOnce(scene, key, w, h, draw, 'world'); }

const canFilter = (ctx) => typeof ctx.filter === 'string';

// ---------------- Огнёвка ----------------
// open — раскрытие крыльев (1 — плоско к зрителю, 0.15 — почти сложены): кадры взмаха.
export function paintMoth(ctx, w, h, white = false, open = 1) {
  const cx = w / 2; const cy = h * 0.48;
  const P = white
    ? { a: '#ffffff', b: '#eef3f9', c: '#c3cfde', vein: 'rgba(120,140,170,0.4)', spot: '#f7f9fc', ring: '#a9b8cc', body: '#dfe4ec', bodyLo: '#b9c2cf', eye: '#3a4558' }
    : { a: '#ffe08a', b: '#f59a3e', c: '#c4402a', vein: 'rgba(120,30,10,0.42)', spot: '#fff1b8', ring: '#8a2a1a', body: '#6a2c1a', bodyLo: '#3f1a10', eye: '#ffd36b' };
  const wing = (s, upper) => {
    ctx.save();
    // ракурс: крыло поворачивается вокруг оси тела — сжимается по ширине, верхнее чуть приподнимается
    ctx.translate(cx, cy); ctx.scale(open, 1 + (upper ? 0.06 : -0.04) * (1 - open)); ctx.translate(-cx, -cy);
    ctx.beginPath();
    if (upper) {
      ctx.moveTo(cx + s * 8, cy - 6);
      ctx.bezierCurveTo(cx + s * 40, cy - 70, cx + s * 100, cy - 92, cx + s * 120, cy - 70);
      ctx.bezierCurveTo(cx + s * 128, cy - 40, cx + s * 110, cy + 2, cx + s * 70, cy + 14);
      ctx.quadraticCurveTo(cx + s * 30, cy + 18, cx + s * 8, cy + 6);
    } else {
      ctx.moveTo(cx + s * 8, cy + 6);
      ctx.bezierCurveTo(cx + s * 50, cy + 10, cx + s * 92, cy + 30, cx + s * 84, cy + 64);
      ctx.bezierCurveTo(cx + s * 74, cy + 92, cx + s * 30, cy + 84, cx + s * 10, cy + 40);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(cx, cy, 6, cx + s * 40, cy, upper ? 128 : 96);
    g.addColorStop(0, P.a); g.addColorStop(0.5, P.b); g.addColorStop(1, P.c);
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3.5; ctx.stroke();
    ctx.save(); ctx.clip();
    for (let k = 0; k < 4; k++) {
      const a = upper ? -1.35 + k * 0.3 : 0.35 + k * 0.3;
      line(ctx, [[cx + s * 10, cy], [cx + s * Math.cos(a) * 130, cy + Math.sin(a) * 130]], P.vein, 2);
    }
    ctx.restore();
    if (upper) { ellipse(ctx, cx + s * 78, cy - 44, 15, 13, P.spot, P.ring, 3); ellipse(ctx, cx + s * 80, cy - 44, 5, 5, P.ring); }
    else ellipse(ctx, cx + s * 52, cy + 46, 9, 8, P.spot, P.ring, 2.5);
    // изнанка крыла темнее: чем сильнее сложено, тем больше тени
    if (open < 0.99) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = white ? `rgba(90,110,140,${0.35 * (1 - open)})` : `rgba(70,16,6,${0.45 * (1 - open)})`;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  };
  for (const s of [-1, 1]) { wing(s, false); wing(s, true); }
  ellipse(ctx, cx, cy + 12, 11, 40, P.body, OUT, 3.5);
  for (let k = 0; k < 4; k++) line(ctx, [[cx - 8, cy + 6 + k * 12], [cx + 8, cy + 6 + k * 12]], P.bodyLo, 2);
  ellipse(ctx, cx, cy - 30, 12, 11, P.body, OUT, 3);
  ellipse(ctx, cx - 5, cy - 32, 3, 3, P.eye); ellipse(ctx, cx + 5, cy - 32, 3, 3, P.eye);
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(cx + s * 4, cy - 40); ctx.quadraticCurveTo(cx + s * 14, cy - 70, cx + s * 34, cy - 78);
    ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
    for (let k = 1; k < 5; k++) {
      const t = k / 5; const x = cx + s * (4 + 30 * t); const y = cy - 40 - 36 * t;
      line(ctx, [[x, y], [x + s * 6, y - 6]], OUT, 2);
    }
  }
}

// ---------------- паутина ----------------
function webPath(ctx, cx, cy, R, rays, rings, seed, stroke, lw) {
  const r = rng(seed); const ends = [];
  for (let k = 0; k < rays; k++) {
    const a = (k / rays) * Math.PI * 2 + 0.2 + (r() - 0.5) * 0.12;
    const rr = R * (0.86 + 0.14 * r());
    ends.push([a, rr]);
    line(ctx, [[cx, cy], [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]], stroke, lw);
  }
  for (let ring = 1; ring <= rings; ring++) {
    ctx.beginPath();
    ends.forEach(([a, rr], k) => {
      const q = rr * ring / (rings + 1);
      const x = cx + Math.cos(a) * q; const y = cy + Math.sin(a) * q;
      if (k) ctx.quadraticCurveTo(cx + Math.cos(a - 0.12) * q * 0.94, cy + Math.sin(a - 0.12) * q * 0.94, x, y); else ctx.moveTo(x, y);
    });
    ctx.closePath(); ctx.strokeStyle = stroke; ctx.lineWidth = lw * 0.75; ctx.stroke();
  }
  return ends;
}

// Ледяная сеть из снега (финал «Скорая»): голубые нити с инеем.
function paintIceWeb(ctx, w, h) {
  const cx = w / 2; const cy = h / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(170,220,255,0.9)'; ctx.shadowBlur = 14;
  const ends = webPath(ctx, cx, cy, w * 0.47, 16, 9, 71, 'rgba(214,240,255,0.9)', 3);
  ctx.restore();
  const r = rng(72);
  for (const [a, rr] of ends) {
    for (let k = 2; k < 10; k += 2) {
      const q = rr * k / 10; const x = cx + Math.cos(a) * q; const y = cy + Math.sin(a) * q; const s = 3 + r() * 4;
      poly(ctx, [[x, y - s], [x + s * 0.5, y], [x, y + s], [x - s * 0.5, y]], 'rgba(255,255,255,0.95)');
    }
  }
  radial(ctx, cx, cy, w * 0.3, 'rgba(200,235,255,0.18)');
}

// Серебряная сеть Тихона (финал «Рассвет»): тёплые блики на нитях.
function paintSilverNet(ctx, w, h) {
  const cx = w / 2; const cy = h / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(255,240,210,0.8)'; ctx.shadowBlur = 10;
  webPath(ctx, cx, cy, w * 0.47, 14, 8, 81, 'rgba(236,240,248,0.92)', 2.6);
  ctx.restore();
  const r = rng(82);
  for (let i = 0; i < 30; i++) ellipse(ctx, cx + (r() - 0.5) * w * 0.8, cy + (r() - 0.5) * h * 0.8, 2.4, 2.4, 'rgba(255,248,230,0.95)');
}

// ---------------- мебель и реквизит ----------------
// Кресло-«ушастик» (вид спереди): высокая спинка с «ушами», каретная стяжка с пуговицами, мягкие
// валики подлокотников, вязаная салфетка на спинке. Над кроватью видна верхняя часть — силуэт сразу
// читается как кресло, а не как «капсула».
function paintArmchair(ctx, w, h) {
  const base = '#64765c'; const lo = '#4b5946'; const hi = '#7f9373'; const deep = '#3c4838';
  const cx = w / 2;
  ellipse(ctx, cx, h - 8, w * 0.46, 12, 'rgba(0,0,0,0.3)');
  // ножки
  for (const x of [62, w - 62]) {
    ctx.beginPath(); ctx.moveTo(x - 10, h - 44); ctx.lineTo(x + 10, h - 44); ctx.lineTo(x + 6, h - 10); ctx.lineTo(x - 6, h - 10); ctx.closePath();
    ctx.fillStyle = '#5a3d28'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3.5; ctx.stroke();
  }
  // спинка
  const back = () => {
    ctx.beginPath();
    ctx.moveTo(74, 300); ctx.lineTo(66, 96);
    ctx.bezierCurveTo(64, 30, 110, 12, cx, 12);
    ctx.bezierCurveTo(w - 110, 12, w - 64, 30, w - 66, 96);
    ctx.lineTo(w - 74, 300); ctx.closePath();
  };
  back();
  let g = ctx.createLinearGradient(0, 12, 0, 300); g.addColorStop(0, hi); g.addColorStop(0.55, base); g.addColorStop(1, lo);
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.stroke();
  // каретная стяжка: ромбы и пуговицы
  ctx.save(); back(); ctx.clip();
  const bx = [cx - 62, cx, cx + 62]; const by = [92, 168, 244];
  ctx.strokeStyle = 'rgba(30,40,28,0.28)'; ctx.lineWidth = 2.5;
  for (let r = 0; r < by.length - 1; r++) for (let i = 0; i < bx.length; i++) {
    const x = bx[i] + (r % 2 ? 31 : 0); const y = by[r];
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 31, y + 38); ctx.lineTo(x, y + 76); ctx.lineTo(x - 31, y + 38); ctx.closePath(); ctx.stroke();
  }
  for (let r = 0; r < by.length; r++) for (let i = 0; i < bx.length; i++) {
    const x = bx[i] + (r % 2 ? 31 : 0) - (r % 2 ? 0 : 0); const y = by[r];
    if (x > w - 80 || x < 80) continue;
    ellipse(ctx, x, y, 5.5, 5, deep, null);
    ellipse(ctx, x - 1.5, y - 1.5, 2, 2, 'rgba(255,255,255,0.25)');
  }
  // мягкий свет по левому краю
  const sh = ctx.createLinearGradient(66, 0, w - 66, 0);
  sh.addColorStop(0, 'rgba(255,240,210,0.10)'); sh.addColorStop(0.5, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = sh; ctx.fillRect(0, 0, w, 300);
  ctx.restore();
  // «уши» спинки
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? 66 : w - 66;
    ctx.beginPath();
    ctx.moveTo(x0, 92);
    ctx.bezierCurveTo(x0 + side * 46, 96, x0 + side * 54, 150, x0 + side * 44, 196);
    ctx.bezierCurveTo(x0 + side * 38, 222, x0 + side * 14, 236, x0 - side * 2, 240);
    ctx.closePath();
    g = ctx.createLinearGradient(0, 92, 0, 240); g.addColorStop(0, side < 0 ? hi : base); g.addColorStop(1, lo);
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.stroke();
    line(ctx, [[x0 + side * 10, 110], [x0 + side * 30, 160], [x0 + side * 22, 214]], 'rgba(30,40,28,0.25)', 3);
  }
  // сиденье
  rrect(ctx, 62, 292, w - 124, 56, 22);
  g = ctx.createLinearGradient(0, 292, 0, 348); g.addColorStop(0, hi); g.addColorStop(1, base);
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.stroke();
  // юбка-основание
  rrect(ctx, 44, 336, w - 88, 84, 16); ctx.fillStyle = lo; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.stroke();
  for (let x = 70; x < w - 60; x += 38) line(ctx, [[x, 352], [x - 2, 412]], 'rgba(0,0,0,0.14)', 3);
  // подлокотники-валики
  for (const side of [-1, 1]) {
    const ax = side < 0 ? 22 : w - 22 - 66;
    rrect(ctx, ax, 238, 66, 150, 26);
    g = ctx.createLinearGradient(ax, 0, ax + 66, 0); g.addColorStop(0, side < 0 ? hi : base); g.addColorStop(1, side < 0 ? base : lo);
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.stroke();
    // завиток валика спереди
    ellipse(ctx, ax + 33, 262, 27, 22, side < 0 ? hi : base, OUT, 4);
    ctx.beginPath(); ctx.arc(ax + 33, 263, 11, 0.4, Math.PI * 1.7); ctx.strokeStyle = 'rgba(30,40,28,0.45)'; ctx.lineWidth = 3; ctx.stroke();
  }
  // вязаная салфетка на спинке
  ctx.save(); ctx.translate(cx, 22);
  ctx.beginPath();
  for (let k = 0; k <= 16; k++) {
    const a = Math.PI + (k / 16) * Math.PI; const rr = 70 + (k % 2) * 7;
    const x = Math.cos(a) * rr; const y = 26 + Math.sin(a) * rr * 0.36;
    if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.lineTo(70, 34);
  for (let k = 0; k <= 10; k++) { const x = 70 - (k / 10) * 140; ctx.quadraticCurveTo(x + 7, 50 + (k % 2) * 8, x, 40); }
  ctx.closePath();
  ctx.fillStyle = '#f3eee4'; ctx.fill(); ctx.strokeStyle = 'rgba(36,23,15,0.6)'; ctx.lineWidth = 3; ctx.stroke();
  for (let k = 0; k < 7; k++) ellipse(ctx, -48 + k * 16, 20, 4, 4, null, 'rgba(150,135,115,0.7)', 2);
  for (let k = 0; k < 5; k++) ellipse(ctx, -32 + k * 16, 32, 3, 3, null, 'rgba(150,135,115,0.6)', 1.6);
  ctx.restore();
}

function paintPlaid(ctx, w, h) {
  ctx.beginPath();
  ctx.moveTo(18, 40); ctx.quadraticCurveTo(w / 2, -6, w - 18, 40);
  ctx.lineTo(w - 6, h - 40);
  for (let k = 0; k <= 8; k++) { const x = w - 6 - (k / 8) * (w - 12); ctx.quadraticCurveTo(x + (w - 12) / 16, h - 16 - (k % 2) * 16, x, h - 34); }
  ctx.closePath();
  ctx.fillStyle = '#b8473a'; ctx.fill();
  ctx.save(); ctx.clip();
  for (let x = -20; x < w; x += 56) { ctx.fillStyle = 'rgba(244,231,206,0.55)'; ctx.fillRect(x, 0, 14, h); ctx.fillStyle = 'rgba(60,70,50,0.35)'; ctx.fillRect(x + 26, 0, 8, h); }
  for (let y = 10; y < h; y += 56) { ctx.fillStyle = 'rgba(244,231,206,0.45)'; ctx.fillRect(0, y, w, 12); ctx.fillStyle = 'rgba(60,70,50,0.3)'; ctx.fillRect(0, y + 24, w, 6); }
  const sh = ctx.createLinearGradient(0, 0, w, 0); sh.addColorStop(0, 'rgba(0,0,0,0.25)'); sh.addColorStop(0.4, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = sh; ctx.fillRect(0, 0, w, h);
  for (const x of [w * 0.3, w * 0.62]) line(ctx, [[x, 30], [x + 10, h - 30]], 'rgba(0,0,0,0.18)', 6);
  ctx.restore();
  ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke();
  for (let x = 24; x < w - 20; x += 14) line(ctx, [[x, h - 30], [x - 2, h - 10]], '#8f3328', 3);
}

export const MOTH_OPEN = [1, 0.74, 0.44, 0.18];

// Искра-уголёк Огнёвки и снежинка (в финале угольки остывают в снег).
function stops(ctx, x, y, r, list) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  list.forEach(([o, c]) => g.addColorStop(o, c));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function paintEmber(ctx, w, h) {
  stops(ctx, w / 2, h / 2, w / 2, [[0, 'rgba(255,246,200,1)'], [0.25, 'rgba(255,190,90,0.95)'], [0.6, 'rgba(240,96,40,0.45)'], [1, 'rgba(200,40,20,0)']]);
}
function paintFlake(ctx, w, h) {
  const c = w / 2; ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 1.6;
  for (let k = 0; k < 6; k++) {
    const a = k * Math.PI / 3; const ex = c + Math.cos(a) * 10; const ey = c + Math.sin(a) * 10;
    ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(ex, ey); ctx.stroke();
    const mx = c + Math.cos(a) * 6; const my = c + Math.sin(a) * 6;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + Math.cos(a + s * 0.9) * 3.4, my + Math.sin(a + s * 0.9) * 3.4); ctx.stroke(); }
  }
  stops(ctx, c, c, 4, [[0, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']]);
}

// Снегирь в полёте (вид сбоку, клювом влево): wing 1 — крылья вверх, −1 — вниз.
function paintBullfinchFly(ctx, w, h, wing) {
  const cx = 66; const cy = 58;
  poly(ctx, [[cx + 28, cy], [cx + 56, cy + 6], [cx + 54, cy + 14], [cx + 26, cy + 10]], '#1d1f26', OUT, 2.5);
  const far = () => {
    ctx.beginPath(); ctx.moveTo(cx - 4, cy - 6);
    if (wing > 0) { ctx.quadraticCurveTo(cx + 4, cy - 46, cx + 34, cy - 52); ctx.quadraticCurveTo(cx + 22, cy - 26, cx + 14, cy - 4); }
    else { ctx.quadraticCurveTo(cx + 4, cy + 30, cx + 30, cy + 44); ctx.quadraticCurveTo(cx + 22, cy + 18, cx + 14, cy + 2); }
    ctx.closePath(); ctx.fillStyle = '#23262e'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.stroke();
  };
  far();
  ellipse(ctx, cx, cy, 30, 20, '#7d8594', OUT, 3);
  ctx.save(); ctx.beginPath(); ctx.ellipse(cx, cy, 30, 20, 0, 0, Math.PI * 2); ctx.clip();
  ellipse(ctx, cx - 8, cy + 10, 26, 16, '#e2553e'); ctx.restore();
  ellipse(ctx, cx, cy, 30, 20, null, OUT, 3);
  ctx.beginPath(); ctx.moveTo(cx - 2, cy - 4);
  if (wing > 0) { ctx.quadraticCurveTo(cx - 10, cy - 50, cx + 20, cy - 62); ctx.quadraticCurveTo(cx + 16, cy - 30, cx + 16, cy - 2); }
  else { ctx.quadraticCurveTo(cx - 8, cy + 36, cx + 18, cy + 52); ctx.quadraticCurveTo(cx + 18, cy + 22, cx + 16, cy + 4); }
  ctx.closePath(); ctx.fillStyle = '#2a2d36'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.stroke();
  line(ctx, wing > 0 ? [[cx + 2, cy - 14], [cx + 14, cy - 40]] : [[cx + 2, cy + 8], [cx + 14, cy + 30]], '#f2f2f2', 3);
  ellipse(ctx, cx - 26, cy - 10, 15, 13, '#1d1f26', OUT, 3);
  ellipse(ctx, cx - 31, cy - 2, 9, 7, '#e2553e');
  poly(ctx, [[cx - 39, cy - 12], [cx - 49, cy - 7], [cx - 38, cy - 3]], '#2a2a2a', OUT, 2);
  ellipse(ctx, cx - 29, cy - 12, 2.6, 2.6, '#ffffff'); ellipse(ctx, cx - 29.5, cy - 12, 1.5, 1.5, '#111');
}

function paintBullfinch(ctx, w, h, pose = 'sit') {
  // снегирь, смотрит влево, сидит на подоконнике; pose 'peck' — клюёт (голова ниже)
  const cx = 56; const cy = 48;
  const hy = pose === 'peck' ? 14 : 0; const hx = pose === 'peck' ? -4 : 0;
  poly(ctx, [[cx + 30, cy + 2], [cx + 54, cy + 14], [cx + 50, cy + 22], [cx + 26, cy + 16]], '#1d1f26', OUT, 2.5); // хвост
  ellipse(ctx, cx, cy, 30, 26, '#7d8594', OUT, 3);
  ctx.save(); ctx.beginPath(); ctx.ellipse(cx, cy, 30, 26, 0, 0, Math.PI * 2); ctx.clip();
  ellipse(ctx, cx - 10, cy + 12, 26, 20, '#e2553e');
  ctx.restore();
  ellipse(ctx, cx, cy, 30, 26, null, OUT, 3);
  ctx.beginPath(); ctx.moveTo(cx + 2, cy - 4); ctx.quadraticCurveTo(cx + 18, cy - 10, cx + 28, cy + 4); ctx.quadraticCurveTo(cx + 16, cy + 10, cx + 2, cy + 2); ctx.closePath();
  ctx.fillStyle = '#2a2d36'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.stroke();
  line(ctx, [[cx + 6, cy + 2], [cx + 24, cy + 4]], '#f2f2f2', 3);
  ellipse(ctx, cx - 20 + hx, cy - 20 + hy, 16, 14, '#1d1f26', OUT, 3);
  ellipse(ctx, cx - 26 + hx, cy - 12 + hy, 10, 8, '#e2553e');
  poly(ctx, [[cx - 34 + hx, cy - 22 + hy * 1.3], [cx - 44 + hx, cy - 17 + hy * 1.6], [cx - 33 + hx, cy - 13 + hy * 1.2]], '#2a2a2a', OUT, 2);
  ellipse(ctx, cx - 24 + hx, cy - 22 + hy, 2.8, 2.8, '#ffffff'); ellipse(ctx, cx - 24.5 + hx, cy - 22 + hy, 1.6, 1.6, '#111');
  for (const x of [cx - 6, cx + 6]) line(ctx, [[x, cy + 24], [x - 2, cy + 34], [x - 7, cy + 36]], '#6b5a4a', 2.5);
}

function paintPhone(ctx, w, h) {
  rrect(ctx, 3, 3, w - 6, h - 6, 9); ctx.fillStyle = '#2a2f38'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
  rrect(ctx, 8, 12, w - 16, h - 26, 4); ctx.fillStyle = '#7fa6cf'; ctx.fill();
  line(ctx, [[w / 2 - 5, 7], [w / 2 + 5, 7]], '#58606e', 2);
}

export function paintBottle(ctx, w, h) {
  ellipse(ctx, w / 2, h - 6, w * 0.36, 5, 'rgba(0,0,0,0.25)');
  rrect(ctx, 10, 40, w - 20, h - 48, 14);
  const g = ctx.createLinearGradient(10, 0, w - 10, 0); g.addColorStop(0, '#8a4a1c'); g.addColorStop(0.5, '#c27a32'); g.addColorStop(1, '#7a3f16');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3.5; ctx.stroke();
  rrect(ctx, w / 2 - 12, 26, 24, 18, 4); ctx.fillStyle = '#8a4a1c'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
  rrect(ctx, w / 2 - 17, 4, 34, 26, 6); ctx.fillStyle = '#f3f1ec'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
  for (let k = 0; k < 3; k++) line(ctx, [[w / 2 - 12, 11 + k * 6], [w / 2 - 6, 11 + k * 6]], 'rgba(60,60,60,0.5)', 1.5);
  rrect(ctx, 14, 62, w - 28, h - 92, 6); ctx.fillStyle = '#f6efe2'; ctx.fill(); ctx.strokeStyle = 'rgba(36,23,15,0.5)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w / 2, 74); ctx.quadraticCurveTo(w / 2 + 12, 92, w / 2, 98); ctx.quadraticCurveTo(w / 2 - 12, 92, w / 2, 74);
  ctx.fillStyle = '#6aa8d8'; ctx.fill();
  line(ctx, [[22, h - 40], [w - 22, h - 40]], 'rgba(120,100,80,0.5)', 2);
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(16, 46, 6, h - 64);
}

// Ноги в шерстяных носках, торчат из-под одеяла (вид сбоку, пальцы вверх).
function paintSocksPeek(ctx, w, h) {
  const sock = (x, y, col, lo) => {
    ctx.beginPath();
    ctx.moveTo(x, y + 60); ctx.lineTo(x, y + 16);
    ctx.quadraticCurveTo(x - 2, y - 4, x + 18, y - 2);
    ctx.quadraticCurveTo(x + 38, y, x + 40, y + 22);
    ctx.lineTo(x + 44, y + 60); ctx.closePath();
    const g = ctx.createLinearGradient(x, 0, x + 44, 0); g.addColorStop(0, lo); g.addColorStop(0.6, col); g.addColorStop(1, lo);
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3.5; ctx.stroke();
    ctx.save(); ctx.clip();
    for (let yy = y + 8; yy < y + 60; yy += 9) line(ctx, [[x - 4, yy], [x + 48, yy + 2]], 'rgba(255,255,255,0.22)', 2.5);
    ctx.fillStyle = '#f1e6d2'; ctx.fillRect(x - 4, y - 6, 52, 14);
    ctx.restore();
  };
  sock(34, 26, '#c9584a', '#a03e33');
  sock(84, 18, '#d4675a', '#ad4a3e');
}

// ---------------- растушёванный луч из окна ----------------
function paintBeamSoft(ctx, w, h) {
  const draw = (a) => {
    const g = ctx.createLinearGradient(0, 60, 0, h);
    g.addColorStop(0, `rgba(255,244,222,${a})`); g.addColorStop(0.55, `rgba(255,244,222,${a * 0.45})`); g.addColorStop(1, 'rgba(255,244,222,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(w * 0.28, 60); ctx.lineTo(w * 0.7, 60); ctx.lineTo(w - 40, h - 40); ctx.lineTo(w * 0.36, h - 40); ctx.closePath(); ctx.fill();
  };
  if (canFilter(ctx)) { ctx.filter = 'blur(34px)'; draw(0.5); ctx.filter = 'none'; }
  else { ctx.globalAlpha = 0.25; for (let i = 0; i < 4; i++) { ctx.save(); ctx.translate((i - 1.5) * 18, 0); draw(0.5); ctx.restore(); } ctx.globalAlpha = 1; }
}

// ---------------- мамин детский рисунок ----------------
// Мелкая версия — на стене спальни (в paintEnv), крупная — для финального наезда камеры.
export function paintKidDrawing(ctx, x, y, w, h, { detail = 1 } = {}) {
  const k = w / 202; // масштаб относительно маленькой картинки на стене
  const r = rng(91);
  const crayon = (pts, col, lw) => {
    for (let p = 0; p < (detail > 1 ? 3 : 1); p++) {
      const j = detail > 1 ? 1.6 * k * 0.2 : 0;
      line(ctx, pts.map(([px, py]) => [x + px * k + (r() - 0.5) * j * 6, y + py * k + (r() - 0.5) * j * 6]), col, lw * k * (p ? 0.55 : 1));
    }
  };
  ctx.fillStyle = '#efe6d4'; ctx.fillRect(x, y, w, h);
  if (detail > 1) {
    for (let i = 0; i < 900; i++) { ctx.fillStyle = `rgba(150,120,80,${0.03 + r() * 0.05})`; ctx.fillRect(x + r() * w, y + r() * h, 2, 2); }
    crayon([[0, 8], [202, 6]], 'rgba(110,160,220,0.55)', 10);
  }
  // снег-земля
  crayon([[14, 128], [60, 124], [120, 127], [188, 123]], '#7cc47f', 4);
  // дом
  crayon([[40, 126], [40, 84], [90, 84], [90, 126]], '#d9603b', 4);
  crayon([[34, 86], [65, 58], [96, 86]], '#a0522d', 4);
  crayon([[56, 98], [74, 98], [74, 112], [56, 112], [56, 98]], '#f2a65a', 3);
  // солнце
  ctx.beginPath(); ctx.arc(x + 172 * k, y + 32 * k, 14 * k, 0, Math.PI * 2); ctx.strokeStyle = '#f2a65a'; ctx.lineWidth = 4 * k; ctx.stroke();
  for (let q = 0; q < 8; q++) { const a = q * Math.PI / 4; crayon([[172 + Math.cos(a) * 19, 32 + Math.sin(a) * 19], [172 + Math.cos(a) * 26, 32 + Math.sin(a) * 26]], '#f2a65a', 3); }
  // девочка
  ctx.beginPath(); ctx.arc(x + 112 * k, y + 94 * k, 6 * k, 0, Math.PI * 2); ctx.strokeStyle = '#6b4a2e'; ctx.lineWidth = 3 * k; ctx.stroke();
  crayon([[112, 100], [112, 114], [106, 126]], '#6b4a2e', 3); crayon([[112, 114], [118, 126]], '#6b4a2e', 3);
  crayon([[104, 106], [120, 106]], '#6b4a2e', 3);
  crayon([[106, 106], [100, 114], [124, 114], [118, 106]], '#c9584a', 3);
  // паук на ниточке
  crayon([[146, 0], [146, 62]], 'rgba(90,90,110,0.9)', 2);
  ellipse(ctx, x + 146 * k, y + 70 * k, 9 * k, 8 * k, '#4a3328');
  ellipse(ctx, x + 146 * k, y + 80 * k, 6 * k, 5.5 * k, '#4a3328');
  for (const s of [-1, 1]) for (let q = 0; q < 4; q++) {
    const yy = 68 + q * 4;
    crayon([[146 + s * 6, yy], [146 + s * 14, yy - 6 + q * 2], [146 + s * 19, yy + 4 + q * 2]], '#4a3328', 2);
  }
  ellipse(ctx, x + 143 * k, y + 79 * k, 1.6 * k, 1.6 * k, '#ffffff'); ellipse(ctx, x + 149 * k, y + 79 * k, 1.6 * k, 1.6 * k, '#ffffff');
  ctx.beginPath(); ctx.arc(x + 146 * k, y + 82 * k, 2.6 * k, 0.2, Math.PI - 0.2); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2 * k; ctx.stroke();
  // надписи
  ctx.save();
  ctx.fillStyle = '#7a4fa0'; ctx.font = `700 ${Math.round(16 * k)}px ${FONT.hand}`; ctx.textAlign = 'center';
  ctx.fillText(tr('ТИХОН'), x + 160 * k, y + 104 * k);
  ctx.fillStyle = '#5a6b8a'; ctx.font = `700 ${Math.round(12 * k)}px ${FONT.hand}`; ctx.textAlign = 'right';
  ctx.fillText(tr('Аня, 7 лет'), x + 196 * k, y + 146 * k);
  ctx.restore();
  // крестики-нолики в углу: два крестика в одной клетке
  crayon([[10, 20], [46, 20]], '#5a6b8a', 2); crayon([[10, 32], [46, 32]], '#5a6b8a', 2);
  crayon([[22, 8], [22, 44]], '#5a6b8a', 2); crayon([[34, 8], [34, 44]], '#5a6b8a', 2);
  for (const [cx, cy] of [[16, 14], [28, 26], [31, 23]]) { crayon([[cx - 3, cy - 3], [cx + 3, cy + 3]], '#d9603b', 1.6); crayon([[cx + 3, cy - 3], [cx - 3, cy + 3]], '#d9603b', 1.6); }
  ctx.beginPath(); ctx.arc(x + 40 * k, y + 38 * k, 3 * k, 0, Math.PI * 2); ctx.strokeStyle = '#2c406a'; ctx.lineWidth = 1.5 * k; ctx.stroke();
}

function paintDrawingHiRes(ctx, w, h) {
  vgrad(ctx, 0, 0, w, h, [[0, '#c9a46a'], [1, '#b48f58']]);
  ctx.strokeStyle = OUT; ctx.lineWidth = 6; ctx.strokeRect(3, 3, w - 6, h - 6);
  const pad = 56;
  paintKidDrawing(ctx, pad, pad, w - pad * 2, h - pad * 2, { detail: 2 });
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 4; ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2);
}

// ---------------- ночная улица и скорая ----------------
function paintStreetNight(ctx, w, h) {
  vgrad(ctx, 0, 0, w, h, [[0, '#0a1124'], [0.55, '#16223f'], [1, '#22304f']]);
  const r = rng(101);
  for (let i = 0; i < 8; i++) ellipse(ctx, r() * w, 80 + r() * 260, 260 + r() * 300, 40 + r() * 40, 'rgba(40,52,80,0.35)');
  // дальние дома
  for (let x = -40; x < w; x += 180 + r() * 120) {
    const hw = 130 + r() * 90; const hh = 80 + r() * 60; const top = 640 - hh;
    poly(ctx, [[x, top + 30], [x + hw / 2, top], [x + hw, top + 30], [x + hw, 700], [x, 700]], '#18213a');
    poly(ctx, [[x - 6, top + 32], [x + hw / 2, top - 4], [x + hw + 6, top + 32], [x + hw / 2, top + 14]], '#5a6684');
    if (r() > 0.35) { ctx.fillStyle = '#e8a45c'; ctx.fillRect(x + hw * 0.3, top + 46, 20, 20); radial(ctx, x + hw * 0.3 + 10, top + 56, 50, 'rgba(232,164,92,0.25)'); }
  }
  for (let x = 30; x < w; x += 90 + r() * 140) fir(ctx, x, 712 + r() * 10, 90 + r() * 70, '#101a30', 'rgba(150,165,195,0.7)');
  vgrad(ctx, 0, 700, w, h - 700, [[0, '#7f8ca8'], [0.2, '#a9b6cc'], [1, '#c9d3e2']]);
  // дом героя слева
  const hx = 70; const hy = 430; const hw = 620; const hh = 400;
  poly(ctx, [[hx - 40, hy + 10], [hx + hw / 2, hy - 150], [hx + hw + 40, hy + 10]], '#2e2622', OUT, 5);
  poly(ctx, [[hx - 50, hy + 14], [hx + hw / 2, hy - 160], [hx + hw + 50, hy + 14], [hx + hw / 2, hy - 120]], '#e6edf5');
  vgrad(ctx, hx, hy, hw, hh, [[0, '#5a4033'], [1, '#3f2c23']]);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 3;
  for (let y = hy + 26; y < hy + hh; y += 30) { ctx.beginPath(); ctx.moveTo(hx, y); ctx.lineTo(hx + hw, y); ctx.stroke(); }
  ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.strokeRect(hx, hy, hw, hh);
  // окно детской (горит ночник)
  const wx = hx + 90; const wy = hy + 90;
  ctx.fillStyle = '#e9a560'; ctx.fillRect(wx, wy, 170, 170);
  radial(ctx, wx + 85, wy + 85, 240, 'rgba(233,165,96,0.28)');
  ctx.strokeStyle = '#d9cfc0'; ctx.lineWidth = 12; ctx.strokeRect(wx, wy, 170, 170);
  line(ctx, [[wx + 85, wy], [wx + 85, wy + 170]], '#d9cfc0', 7, 'butt'); line(ctx, [[wx, wy + 70], [wx + 170, wy + 70]], '#d9cfc0', 7, 'butt');
  rrect(ctx, wx - 14, wy + 164, 198, 18, 8); ctx.fillStyle = '#eef3f8'; ctx.fill();
  // второе окно — тёмное
  ctx.fillStyle = '#1b2438'; ctx.fillRect(hx + 360, hy + 90, 150, 150);
  ctx.strokeStyle = '#d9cfc0'; ctx.lineWidth = 12; ctx.strokeRect(hx + 360, hy + 90, 150, 150);
  // дверь и крыльцо
  const dx = hx + 300; const dy = hy + 170;
  ctx.fillStyle = '#ffd9a0'; ctx.fillRect(dx, dy, 120, 230);
  radial(ctx, dx + 60, dy + 120, 260, 'rgba(255,200,140,0.35)');
  poly(ctx, [[dx, dy], [dx - 40, dy + 16], [dx - 40, dy + 224], [dx, dy + 230]], '#553c2c', OUT, 3);
  ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.strokeRect(dx, dy, 120, 230);
  ellipse(ctx, dx + 60, dy - 30, 14, 18, '#ffe3b3', '#3b2a1e', 3); radial(ctx, dx + 60, dy - 30, 160, 'rgba(255,200,130,0.35)');
  for (let k = 0; k < 2; k++) { ctx.fillStyle = '#4a3a30'; ctx.fillRect(dx - 30 - k * 20, dy + 230 + k * 22, 180 + k * 40, 22); rrect(ctx, dx - 34 - k * 20, dy + 226 + k * 22, 188 + k * 40, 10, 5); ctx.fillStyle = '#eef3f8'; ctx.fill(); }
  // сугроб у дома
  ctx.beginPath(); ctx.moveTo(0, h);
  for (let x = 0; x <= 760; x += 30) ctx.lineTo(x, 880 + Math.sin(x / 90) * 14);
  ctx.lineTo(760, h); ctx.closePath(); ctx.fillStyle = '#dfe7f1'; ctx.fill();
  // дорога
  vgrad(ctx, 0, 905, w, 120, [[0, '#9aa7bd'], [1, '#b6c2d4']]);
  ctx.strokeStyle = 'rgba(80,95,125,0.45)'; ctx.lineWidth = 7;
  for (const y of [940, 990]) { ctx.beginPath(); for (let x = 0; x <= w; x += 40) ctx.lineTo(x, y + Math.sin(x / 260) * 3); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 30) ctx.lineTo(x, 1030 + Math.sin(x / 140) * 10 + r() * 4);
  ctx.lineTo(w, h); ctx.closePath(); ctx.fillStyle = '#e8eef5'; ctx.fill();
  // фонарь справа
  const lx = 1560;
  ctx.fillStyle = '#2b3142'; ctx.fillRect(lx - 7, 470, 14, 440);
  line(ctx, [[lx, 476], [lx + 70, 456], [lx + 96, 470]], '#2b3142', 10);
  ellipse(ctx, lx + 96, 482, 22, 12, '#ffe7b8', OUT, 3);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  if (canFilter(ctx)) ctx.filter = 'blur(18px)';
  poly(ctx, [[lx + 76, 490], [lx + 116, 490], [lx + 210, 920], [lx - 20, 920]], 'rgba(255,220,160,0.10)');
  ctx.restore();
  radial(ctx, lx + 96, 486, 120, 'rgba(255,220,160,0.3)');
  snowSpeckles(ctx, w, h, 380, 103, 0.45, 2.2);
}

function paintAmbulance(ctx, w, h, open = false) {
  const body = '#eef1f4'; const lo = '#c9d0d9';
  const y0 = 70; const by = 280; // верх кузова и низ кузова
  ellipse(ctx, w / 2, h - 14, w * 0.46, 14, 'rgba(0,0,0,0.3)');
  // кузов-фургон
  rrect(ctx, 20, y0, 520, by - y0, 22);
  let g = ctx.createLinearGradient(0, y0, 0, by); g.addColorStop(0, '#ffffff'); g.addColorStop(1, lo);
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.stroke();
  // кабина
  ctx.beginPath(); ctx.moveTo(540, y0 + 26); ctx.lineTo(640, y0 + 26); ctx.quadraticCurveTo(690, y0 + 40, 722, by - 110);
  ctx.lineTo(738, by - 76); ctx.lineTo(738, by); ctx.lineTo(540, by); ctx.closePath();
  g = ctx.createLinearGradient(0, y0, 0, by); g.addColorStop(0, '#ffffff'); g.addColorStop(1, lo);
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.stroke();
  // лобовое и боковое стекло
  poly(ctx, [[600, y0 + 40], [646, y0 + 40], [700, by - 112], [600, by - 112]], '#2f4a70', OUT, 4);
  line(ctx, [[612, y0 + 50], [628, y0 + 50]], 'rgba(255,255,255,0.4)', 4);
  // полоса и надпись
  ctx.fillStyle = '#d23a3a'; ctx.fillRect(22, 196, 716, 26);
  ctx.fillStyle = '#d23a3a'; ctx.font = `600 34px ${FONT.ui}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(tr('СКОРАЯ ПОМОЩЬ'), 300, 160);
  ctx.fillStyle = '#ffffff'; ctx.font = `600 20px ${FONT.ui}`; ctx.fillText('03', 640, 210);
  // окна салона (матовые)
  for (const x of [250, 400]) { rrect(ctx, x, y0 + 22, 110, 56, 8); ctx.fillStyle = '#dfe8f1'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3.5; ctx.stroke(); }
  // крест на боку
  rrect(ctx, 70, 110, 70, 70, 10); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = 'rgba(36,23,15,0.4)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#d23a3a'; ctx.fillRect(96, 118, 18, 54); ctx.fillRect(78, 136, 54, 18);
  // проблесковый маячок (выключен; свет — отдельный спрайт)
  rrect(ctx, 520, y0 - 2, 90, 26, 8); ctx.fillStyle = '#3d6fd6'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3.5; ctx.stroke();
  rrect(ctx, 60, y0 - 12, 30, 14, 5); ctx.fillStyle = '#3d6fd6'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
  // фара и бампер
  ellipse(ctx, 728, by - 40, 9, 13, '#fff3c8', OUT, 3);
  rrect(ctx, 700, by - 12, 46, 18, 6); ctx.fillStyle = '#9aa3ae'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
  rrect(ctx, 6, by - 12, 44, 18, 6); ctx.fillStyle = '#9aa3ae'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
  // задние двери
  if (!open) {
    line(ctx, [[34, y0 + 12], [34, by - 6]], 'rgba(36,23,15,0.35)', 3);
  } else {
    rrect(ctx, 22, y0 + 12, 70, by - y0 - 18, 8); ctx.fillStyle = '#ffdca0'; ctx.fill();
    radial(ctx, 60, by - 70, 120, 'rgba(255,210,140,0.45)');
    poly(ctx, [[22, y0 + 10], [-2, y0 + 30], [-2, by - 10], [22, by - 4]], '#dfe4ea', OUT, 3.5);
  }
  // колёсные арки
  for (const x of [150, 600]) { ctx.beginPath(); ctx.arc(x, by + 2, 62, Math.PI, 0); ctx.fillStyle = '#1b1f27'; ctx.fill(); }
}

function paintWheel(ctx, w, h) {
  const c = w / 2;
  ellipse(ctx, c, c, c - 3, c - 3, '#1f232b', OUT, 4);
  ellipse(ctx, c, c, c * 0.52, c * 0.52, '#aab3bf', OUT, 3);
  for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5; line(ctx, [[c, c], [c + Math.cos(a) * c * 0.48, c + Math.sin(a) * c * 0.48]], '#7d8794', 4); }
  ellipse(ctx, c, c, 8, 8, '#59616d');
}

// Тёмная «тень» в углу, куда уходит паук (финал А).
function paintCornerShadow(ctx, w, h) {
  const g = ctx.createRadialGradient(w, 0, 10, w, 0, w);
  g.addColorStop(0, 'rgba(4,6,12,0.85)'); g.addColorStop(0.55, 'rgba(4,6,12,0.45)'); g.addColorStop(1, 'rgba(4,6,12,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

export function createWorldTextures(scene) {
  tex(scene, 'moth_fire', 260, 200, (c, w, h) => paintMoth(c, w, h, false));
  tex(scene, 'moth_white', 260, 200, (c, w, h) => paintMoth(c, w, h, true));
  // кадры взмаха: 0 — раскрыты … 3 — почти сложены
  MOTH_OPEN.forEach((k, i) => {
    tex(scene, `moth_fire_${i}`, 260, 200, (c, w, h) => paintMoth(c, w, h, false, k));
    tex(scene, `moth_white_${i}`, 260, 200, (c, w, h) => paintMoth(c, w, h, true, k));
  });
  tex(scene, 'fx_ember', 24, 24, paintEmber);
  tex(scene, 'fx_flake', 24, 24, paintFlake);
  tex(scene, 'ice_web', 640, 640, paintIceWeb);
  tex(scene, 'silver_net', 560, 560, paintSilverNet);
  tex(scene, 'armchair', 330, 450, paintArmchair);
  tex(scene, 'plaid', 320, 250, paintPlaid);
  tex(scene, 'bullfinch', 110, 92, paintBullfinch);
  tex(scene, 'bullfinch_peck', 110, 92, (c, w, h) => paintBullfinch(c, w, h, 'peck'));
  tex(scene, 'bullfinch_fly_0', 130, 110, (c, w, h) => paintBullfinchFly(c, w, h, 1));
  tex(scene, 'bullfinch_fly_1', 130, 110, (c, w, h) => paintBullfinchFly(c, w, h, -1));
  tex(scene, 'prop_phone', 34, 64, paintPhone);
  tex(scene, 'prop_bottle', 70, 130, paintBottle);
  tex(scene, 'socks_peek', 150, 96, paintSocksPeek);
  tex(scene, 'fx_beam_soft', 1000, 1000, paintBeamSoft);
  tex(scene, 'drawing_tikhon', 900, 700, paintDrawingHiRes);
  tex(scene, 'street_night', 1920, 1080, paintStreetNight);
  tex(scene, 'ambulance', 760, 360, (c, w, h) => paintAmbulance(c, w, h, false));
  tex(scene, 'ambulance_open', 760, 360, (c, w, h) => paintAmbulance(c, w, h, true));
  tex(scene, 'ambulance_wheel', 120, 120, paintWheel);
  tex(scene, 'corner_shadow', 520, 420, paintCornerShadow);
}
