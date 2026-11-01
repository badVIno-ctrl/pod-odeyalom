// Детали «кукол» мамы и мальчика (рисуются кодом в canvas один раз при загрузке).
// Стиль — как у остальной игры: плоская заливка, мягкие градиенты, тёмный контур #24170f.
import { rrect, ellipse, poly, line, rng, paintTexOnce } from '../paint.js';

const OUT = '#24170f';
export const BOY_SKIN = { healthy: '#f1c7a5', sick: '#efc4ab', very_sick: '#eeb49e', critical: '#e99a86' };
const MOM_SKIN = '#f0c6a4';
// пижама: мягкая фланель цвета топлёного масла с тонкой терракотовой полоской
const PJ = '#efcb78'; const PJ_HI = '#fae2a6'; const PJ_DARK = '#cf9f4c'; const PJ_STRIPE = 'rgba(176,86,52,0.42)';
const KNIT = '#c9784a'; const KNIT_DARK = '#a95f36';

function capsule(ctx, x, y1, y2, w, fill, stroke = OUT, lw = 4) {
  rrect(ctx, x - w / 2, y1 - w / 2, w, y2 - y1 + w, w / 2);
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

// группа для ТЗ художнику: по префиксу ключа
const groupOf = (key) => (key.startsWith('boy_') ? 'boy' : key.startsWith('mom_') ? 'mom' : key.startsWith('prop_') ? 'props' : 'bed');
function tex(scene, key, w, h, draw) { paintTexOnce(scene, key, w, h, draw, groupOf(key)); }

// ---------------- кровать без мальчика ----------------
export function paintBedFrame(ctx) {
  ellipse(ctx, 430, 520, 420, 22, 'rgba(0,0,0,0.35)');
  rrect(ctx, 740, 50, 100, 460, 40); ctx.fillStyle = '#7a5638'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.stroke();
  rrect(ctx, 758, 80, 64, 400, 28); ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 4; ctx.stroke();
  rrect(ctx, 22, 250, 62, 260, 26); ctx.fillStyle = '#7a5638'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.stroke();
  rrect(ctx, 60, 320, 700, 120, 18); ctx.fillStyle = '#e9e3d8'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = '#6a4a30'; ctx.fillRect(50, 430, 720, 42); ctx.strokeStyle = OUT; ctx.strokeRect(50, 430, 720, 42);
  ctx.fillStyle = '#5a3d27'; ctx.fillRect(70, 472, 26, 50); ctx.fillRect(724, 472, 26, 50);
  // подушка
  ellipse(ctx, 660, 270, 118, 58, '#eef1f5', OUT, 4);
  ellipse(ctx, 650, 288, 86, 26, 'rgba(160,175,200,0.35)');
  line(ctx, [[580, 236], [600, 250]], 'rgba(160,175,200,0.6)', 3);
  line(ctx, [[742, 240], [728, 256]], 'rgba(160,175,200,0.6)', 3);
}

// Одеяло (без отворота): под ним угадываются ноги и туловище.
export function paintBlanket(ctx, critical = false) {
  ctx.beginPath();
  ctx.moveTo(66, 444); ctx.lineTo(66, 332);
  ctx.bezierCurveTo(100, 292, 180, 270, 252, 284);
  ctx.bezierCurveTo(320, 298, 372, 262, 462, 252);
  ctx.bezierCurveTo(540, 244, 600, 262, 640, 290);
  ctx.lineTo(650, 444); ctx.closePath();
  const bg = ctx.createLinearGradient(0, 250, 0, 444);
  bg.addColorStop(0, critical ? '#34497a' : '#4a6aa0'); bg.addColorStop(1, '#2c406a');
  ctx.fillStyle = bg; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.stroke();
  ctx.save(); ctx.clip();
  for (let k = -6; k < 14; k++) {
    line(ctx, [[k * 60, 240], [k * 60 + 200, 444]], 'rgba(255,255,255,0.12)', 3);
    line(ctx, [[k * 60 + 200, 240], [k * 60, 444]], 'rgba(255,255,255,0.12)', 3);
  }
  const r = rng(3);
  for (let i = 0; i < 10; i++) {
    const x = 100 + r() * 500; const y = 300 + r() * 120;
    poly(ctx, [[x, y - 8], [x + 3, y - 2], [x + 9, y], [x + 3, y + 2], [x, y + 8], [x - 3, y + 2], [x - 9, y], [x - 3, y - 2]], 'rgba(242,166,90,0.85)');
  }
  // мягкие тени складок: колени и живот под одеялом
  const sh = ctx.createRadialGradient(250, 300, 10, 250, 300, 120);
  sh.addColorStop(0, 'rgba(255,255,255,0.10)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sh; ctx.fillRect(100, 240, 320, 200);
  line(ctx, [[150, 360], [240, 330], [330, 352]], 'rgba(0,0,0,0.18)', 5);
  line(ctx, [[420, 370], [500, 340]], 'rgba(0,0,0,0.15)', 5);
  ctx.restore();
}

// Отворот: край пододеяльника у груди — из-под него выходит рука.
export function paintFold(ctx) {
  ctx.beginPath();
  ctx.moveTo(6, 30); ctx.bezierCurveTo(60, 12, 150, 8, 214, 30);
  ctx.lineTo(214, 66); ctx.bezierCurveTo(150, 50, 60, 52, 6, 70); ctx.closePath();
  const g = ctx.createLinearGradient(0, 8, 0, 70);
  g.addColorStop(0, '#fbf5ea'); g.addColorStop(1, '#e3d6c2');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke();
  ctx.setLineDash([7, 6]);
  line(ctx, [[14, 58], [70, 46], [150, 44], [206, 54]], 'rgba(120,100,80,0.5)', 2);
  ctx.setLineDash([]);
  // кант-полоска синего одеяла под отворотом
  line(ctx, [[10, 72], [70, 58], [150, 56], [210, 68]], '#2c406a', 5);
}

// Голова мальчика на подушке (без глаз и рта), 170×170, центр головы (85, 85).
export function paintBoyHead(ctx, state) {
  const hx = 85; const hy = 85; const skin = BOY_SKIN[state] || BOY_SKIN.sick;
  ellipse(ctx, hx + 8, hy + 8, 64, 58, 'rgba(60,70,100,0.22)');
  // уши
  ellipse(ctx, hx - 60, hy + 6, 11, 15, skin, OUT, 3.5);
  ellipse(ctx, hx + 60, hy + 6, 11, 15, skin, OUT, 3.5);
  ellipse(ctx, hx, hy, 62, 58, skin, OUT, 4);
  const sh = ctx.createRadialGradient(hx - 20, hy - 20, 10, hx, hy, 70);
  sh.addColorStop(0, 'rgba(255,255,255,0.18)'); sh.addColorStop(1, 'rgba(120,60,40,0.12)');
  ctx.save(); ctx.beginPath(); ctx.ellipse(hx, hy, 60, 56, 0, 0, Math.PI * 2); ctx.clip(); ctx.fillStyle = sh; ctx.fillRect(0, 0, 170, 170); ctx.restore();
  // волосы
  ctx.beginPath(); ctx.ellipse(hx + 8, hy - 26, 62, 42, 0.18, Math.PI * 0.95, Math.PI * 2.08);
  ctx.fillStyle = '#6b4a2e'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke();
  line(ctx, [[hx - 30, hy - 42], [hx - 46, hy - 16]], '#6b4a2e', 11);
  line(ctx, [[hx - 6, hy - 52], [hx - 18, hy - 26]], '#6b4a2e', 11);
  line(ctx, [[hx + 22, hy - 54], [hx + 14, hy - 32]], '#6b4a2e', 9);
  line(ctx, [[hx - 10, hy - 60], [hx + 30, hy - 66]], 'rgba(255,255,255,0.12)', 4);
  // щёки
  const cheek = state === 'healthy' ? 'rgba(232,120,110,0.35)' : state === 'sick' ? 'rgba(225,95,85,0.5)' : 'rgba(215,60,55,0.62)';
  ellipse(ctx, hx - 34, hy + 18, 15, 10, cheek); ellipse(ctx, hx + 32, hy + 18, 15, 10, cheek);
  // нос
  ellipse(ctx, hx, hy + 14, 7, 5, state === 'healthy' ? 'rgba(210,130,110,0.6)' : 'rgba(220,80,70,0.8)');
  if (state === 'very_sick' || state === 'critical') {
    for (const [sx, sy] of [[hx - 54, hy - 6], [hx + 52, hy - 12]]) poly(ctx, [[sx, sy - 10], [sx + 6, sy + 2], [sx, sy + 8], [sx - 6, sy + 2]], 'rgba(180,220,255,0.9)', OUT, 2);
    ctx.save(); ctx.translate(hx - 2, hy - 32); ctx.rotate(-0.12);
    rrect(ctx, -48, -14, 96, 26, 8); ctx.fillStyle = '#f4f4f0'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
    line(ctx, [[-32, -4], [32, -4]], 'rgba(120,150,190,0.5)', 3);
    ctx.restore();
  }
}

export function paintBoyEyes(ctx, kind) {
  const cy = 25; const L = 35; const R = 73;
  const brow = (x, tilt = 0, y = cy - 18) => line(ctx, [[x - 10, y + tilt], [x + 10, y - tilt]], '#5a3d27', 3.5);
  if (kind === 'open' || kind === 'wide' || kind === 'sad') {
    const ry = kind === 'wide' ? 13 : 11; const rx = kind === 'wide' ? 11 : 9;
    for (const x of [L, R]) {
      ellipse(ctx, x, cy, rx, ry, '#ffffff', OUT, 3);
      ellipse(ctx, x + 1, cy + 2, kind === 'wide' ? 4 : 5, kind === 'wide' ? 5 : 6, '#2a1e1a');
      ellipse(ctx, x - 1, cy - 1, 1.8, 1.8, '#ffffff');
    }
    if (kind === 'sad') { brow(L, -4); brow(R, 4); } else if (kind === 'wide') { brow(L, 0, cy - 24); brow(R, 0, cy - 24); } else { brow(L); brow(R); }
  } else if (kind === 'half') {
    for (const x of [L, R]) {
      ellipse(ctx, x, cy + 2, 9, 7, '#ffffff', OUT, 3);
      ellipse(ctx, x + 1, cy + 4, 4.5, 4.5, '#2a1e1a');
      line(ctx, [[x - 11, cy - 2], [x + 11, cy - 1]], OUT, 4);
    }
  } else if (kind === 'closed') {
    for (const x of [L, R]) { ctx.beginPath(); ctx.arc(x, cy - 2, 9, Math.PI * 0.15, Math.PI * 0.85); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke(); }
  } else if (kind === 'happy') {
    for (const x of [L, R]) { ctx.beginPath(); ctx.arc(x, cy + 6, 9, Math.PI * 1.15, Math.PI * 1.85); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke(); }
  } else if (kind === 'squint') {
    for (const x of [L, R]) line(ctx, [[x - 9, cy - 3], [x + 9, cy + 1]], OUT, 4);
  }
}

export function paintBoyMouth(ctx, kind) {
  const x = 30; const y = 18;
  if (kind === 'closed') line(ctx, [[x - 11, y], [x + 11, y - 1]], OUT, 4);
  else if (kind === 'half') { ellipse(ctx, x, y, 9, 5, '#7a2a2a', OUT, 3); }
  else if (kind === 'open') { ellipse(ctx, x, y + 2, 11, 9, '#7a2a2a', OUT, 3); ellipse(ctx, x, y + 6, 6, 3, '#e07a7a'); }
  else if (kind === 'O') { ellipse(ctx, x, y + 2, 9, 12, '#5a1e1e', OUT, 3); }
  else if (kind === 'smile') { ctx.beginPath(); ctx.arc(x, y - 8, 15, 0.25, Math.PI - 0.25); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke(); }
  else if (kind === 'grin') { ctx.beginPath(); ctx.moveTo(x - 16, y - 4); ctx.quadraticCurveTo(x, y + 18, x + 16, y - 4); ctx.closePath(); ctx.fillStyle = '#7a2a2a'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3.5; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillRect(x - 10, y - 3, 20, 5); }
  else if (kind === 'frown') { ctx.beginPath(); ctx.arc(x, y + 14, 12, Math.PI * 1.15, Math.PI * 1.85); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke(); }
  else if (kind === 'wavy') { line(ctx, [[x - 13, y], [x - 6, y - 3], [x, y], [x + 6, y - 3], [x + 13, y]], OUT, 3.5); }
}

// Рукав пижамы: плечо и предплечье. Объём — светотень поперёк рукава, полоски идут вдоль,
// складки ткани у локтя, у предплечья — мягкая манжета. Рукав чуть шире к локтю (ткань собирается).
function paintSleeve(ctx, w, h, wid, cuff) {
  const x = w / 2; const top = 2; const bot = h - 2;
  const shape = () => {
    const a = wid / 2; const b = wid / 2 + 2; // у локтя (низ плеча / верх предплечья) ткань пышнее
    ctx.beginPath();
    if (cuff) { // предплечье: сверху (локоть) шире, к манжете уже
      ctx.moveTo(x - b, top + b); ctx.arc(x, top + b, b, Math.PI, 0);
      ctx.lineTo(x + a - 1, bot - a); ctx.arc(x, bot - a, a - 1, 0, Math.PI); ctx.closePath();
    } else { // плечо: сверху уже (уходит под отворот), к локтю шире
      ctx.moveTo(x - a, top + a); ctx.arc(x, top + a, a, Math.PI, 0);
      ctx.lineTo(x + b, bot - b); ctx.arc(x, bot - b, b, 0, Math.PI); ctx.closePath();
    }
  };
  shape();
  const g = ctx.createLinearGradient(x - wid / 2 - 2, 0, x + wid / 2 + 2, 0);
  g.addColorStop(0, PJ_HI); g.addColorStop(0.42, PJ); g.addColorStop(1, PJ_DARK);
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); shape(); ctx.clip();
  for (const k of [-0.3, 0.02, 0.33]) line(ctx, [[x + k * wid, top], [x + k * wid + 1.5, bot]], PJ_STRIPE, 3);
  // складки у локтя
  const fy = cuff ? top + 16 : bot - 22;
  ctx.strokeStyle = 'rgba(120,64,24,0.34)'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - wid * 0.42, fy); ctx.quadraticCurveTo(x - wid * 0.05, fy - 6, x + wid * 0.22, fy + 1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - wid * 0.1, fy + 9); ctx.quadraticCurveTo(x + wid * 0.15, fy + 5, x + wid * 0.42, fy + 10); ctx.stroke();
  // блик сверху
  ctx.fillStyle = 'rgba(255,248,226,0.22)'; ctx.fillRect(x - wid * 0.42, top, wid * 0.16, h);
  if (cuff) {
    ctx.fillStyle = PJ_DARK; ctx.fillRect(x - wid, bot - 17, wid * 2, 17);
    line(ctx, [[x - wid, bot - 17], [x + wid, bot - 17]], 'rgba(90,46,16,0.45)', 2);
    for (const k of [-0.3, 0.02, 0.33]) line(ctx, [[x + k * wid, bot - 15], [x + k * wid, bot]], 'rgba(255,236,190,0.35)', 2);
  }
  ctx.restore();
  shape(); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.stroke();
}

export function paintHand(ctx, w, h, skin) {
  const x = w / 2;
  ellipse(ctx, x, h * 0.52, w * 0.36, h * 0.38, skin, OUT, 3.5);
  ellipse(ctx, x + w * 0.3, h * 0.38, w * 0.13, h * 0.17, skin, OUT, 3); // большой палец
  ellipse(ctx, x, h * 0.52, w * 0.36 - 3, h * 0.38 - 3, skin);
  line(ctx, [[x - 6, h * 0.78], [x - 4, h * 0.62]], 'rgba(120,60,40,0.35)', 2);
  line(ctx, [[x + 2, h * 0.8], [x + 2, h * 0.64]], 'rgba(120,60,40,0.35)', 2);
}

// ---------------- мама (рост ~600 px, смотрит вправо, вид 3/4) ----------------
function paintMomTorso(ctx) {
  // свитер: талия внизу (85, 180), плечи сверху (y ≈ 22)
  ctx.beginPath();
  ctx.moveTo(44, 182); ctx.lineTo(126, 182);
  ctx.bezierCurveTo(132, 130, 140, 70, 128, 34);
  ctx.bezierCurveTo(116, 14, 54, 12, 40, 30);
  ctx.bezierCurveTo(28, 70, 36, 130, 44, 182); ctx.closePath();
  const g = ctx.createLinearGradient(30, 0, 140, 0);
  g.addColorStop(0, KNIT_DARK); g.addColorStop(0.6, KNIT); g.addColorStop(1, '#d88a5a');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.stroke();
  ctx.save(); ctx.clip();
  for (let y = 44; y < 182; y += 16) line(ctx, [[30, y], [140, y + 3]], 'rgba(110,50,20,0.25)', 3);
  for (let x = 50; x < 130; x += 18) line(ctx, [[x, 30], [x + 4, 182]], 'rgba(255,220,180,0.10)', 2);
  ctx.restore();
  // резинка свитера у талии
  rrect(ctx, 42, 166, 86, 18, 8); ctx.fillStyle = KNIT_DARK; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
  // шаль
  poly(ctx, [[34, 30], [132, 26], [138, 56], [112, 104], [86, 122], [62, 96], [38, 60]], '#8c97a8', OUT, 4);
  for (const x of [70, 92, 112]) line(ctx, [[x, 34], [x - 6, 100]], 'rgba(255,255,255,0.18)', 3);
  // бахрома
  for (let k = 0; k < 6; k++) line(ctx, [[66 + k * 9, 104 + Math.abs(k - 2.5) * -3], [64 + k * 9, 122]], '#7a8596', 3);
}

function paintMomSkirt(ctx) {
  ctx.beginPath();
  ctx.moveTo(48, 10); ctx.lineTo(142, 10); ctx.lineTo(176, 196);
  ctx.quadraticCurveTo(95, 210, 14, 196); ctx.closePath();
  const g = ctx.createLinearGradient(14, 0, 176, 0);
  g.addColorStop(0, '#32405e'); g.addColorStop(0.6, '#3e4c6e'); g.addColorStop(1, '#4a5a80');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.stroke();
  for (const k of [-50, -18, 14, 46]) line(ctx, [[95 + k * 0.7, 22], [95 + k * 1.35, 196]], 'rgba(0,0,0,0.22)', 3);
  line(ctx, [[48, 12], [142, 12]], '#2a3550', 6);
}

function paintMomHead(ctx) {
  const hx = 72; const hy = 86;
  // шея
  rrect(ctx, 58, 120, 28, 46, 10); ctx.fillStyle = '#e2b28f'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3.5; ctx.stroke();
  // волосы сзади + пучок
  ellipse(ctx, 24, 54, 28, 26, '#4a3328', OUT, 4);
  ctx.beginPath(); ctx.ellipse(hx - 6, hy - 4, 52, 58, 0, Math.PI * 0.5, Math.PI * 1.6); ctx.fillStyle = '#4a3328'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke();
  // лицо (вид 3/4: подбородок и нос смотрят вправо)
  ctx.beginPath();
  ctx.moveTo(hx - 40, hy - 30);
  ctx.bezierCurveTo(hx - 10, hy - 66, hx + 44, hy - 60, hx + 50, hy - 12);
  ctx.lineTo(hx + 56, hy + 10); ctx.lineTo(hx + 49, hy + 14);
  ctx.bezierCurveTo(hx + 50, hy + 40, hx + 36, hy + 58, hx + 12, hy + 60);
  ctx.bezierCurveTo(hx - 18, hy + 58, hx - 44, hy + 30, hx - 44, hy);
  ctx.closePath();
  ctx.fillStyle = MOM_SKIN; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke();
  // ухо
  ellipse(ctx, hx - 26, hy + 8, 9, 13, '#e8b896', OUT, 3);
  // румянец
  ellipse(ctx, hx + 26, hy + 26, 12, 8, 'rgba(230,120,110,0.35)');
  ellipse(ctx, hx - 6, hy + 28, 9, 6, 'rgba(230,120,110,0.22)');
  // чёлка и прядь
  ctx.beginPath(); ctx.moveTo(hx - 46, hy - 6);
  ctx.bezierCurveTo(hx - 42, hy - 62, hx + 30, hy - 74, hx + 52, hy - 20);
  ctx.bezierCurveTo(hx + 24, hy - 40, hx - 2, hy - 30, hx - 18, hy - 16);
  ctx.bezierCurveTo(hx - 26, hy - 10, hx - 34, hy, hx - 46, hy - 6);
  ctx.fillStyle = '#4a3328'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke();
  line(ctx, [[hx - 10, hy - 50], [hx + 28, hy - 44]], 'rgba(255,255,255,0.15)', 4);
}

function paintMomEyes(ctx, kind) {
  const cy = 22; const A = 26; const Bx = 58; // A — ближний глаз, B — дальний (уже)
  const brows = (tilt = 0) => { line(ctx, [[A - 11, cy - 14 - tilt], [A + 10, cy - 16 + tilt]], '#3a271e', 3.5); line(ctx, [[Bx - 7, cy - 16 + tilt], [Bx + 7, cy - 15 - tilt]], '#3a271e', 3); };
  if (kind === 'open' || kind === 'worry') {
    ellipse(ctx, A, cy, 8, 9, '#ffffff', OUT, 2.5); ellipse(ctx, A + 2, cy + 1, 4.5, 5.5, '#3a271e'); ellipse(ctx, A + 1, cy - 1, 1.5, 1.5, '#fff');
    ellipse(ctx, Bx, cy, 5, 8, '#ffffff', OUT, 2.5); ellipse(ctx, Bx + 1, cy + 1, 3, 5, '#3a271e');
    line(ctx, [[A - 9, cy - 6], [A + 9, cy - 8]], OUT, 3); // ресницы-верхнее веко
    brows(kind === 'worry' ? -3 : 0);
  } else if (kind === 'closed') {
    for (const [x, r] of [[A, 9], [Bx, 6]]) { ctx.beginPath(); ctx.arc(x, cy - 2, r, Math.PI * 0.15, Math.PI * 0.85); ctx.strokeStyle = OUT; ctx.lineWidth = 3.5; ctx.stroke(); }
    brows();
  } else if (kind === 'happy') {
    for (const [x, r] of [[A, 9], [Bx, 6]]) { ctx.beginPath(); ctx.arc(x, cy + 6, r, Math.PI * 1.15, Math.PI * 1.85); ctx.strokeStyle = OUT; ctx.lineWidth = 3.5; ctx.stroke(); }
    brows(2);
  }
}

function paintMomMouth(ctx, kind) {
  const x = 20; const y = 14;
  if (kind === 'closed') { ctx.beginPath(); ctx.arc(x, y - 6, 9, 0.35, Math.PI - 0.35); ctx.strokeStyle = OUT; ctx.lineWidth = 3.5; ctx.stroke(); }
  else if (kind === 'smile') { ctx.beginPath(); ctx.arc(x, y - 9, 13, 0.3, Math.PI - 0.3); ctx.strokeStyle = OUT; ctx.lineWidth = 3.5; ctx.stroke(); }
  else if (kind === 'half') ellipse(ctx, x, y, 7, 4.5, '#8a3030', OUT, 2.5);
  else if (kind === 'open') { ellipse(ctx, x, y + 1, 8, 7.5, '#8a3030', OUT, 2.5); ellipse(ctx, x, y + 4, 4.5, 2.5, '#e08080'); }
  else if (kind === 'worry') { ctx.beginPath(); ctx.arc(x, y + 9, 8, Math.PI * 1.2, Math.PI * 1.8); ctx.strokeStyle = OUT; ctx.lineWidth = 3.5; ctx.stroke(); }
}

function paintKnitSleeve(ctx, w, h, wid, cuff) {
  const x = w / 2;
  capsule(ctx, x, wid / 2 + 2, h - wid / 2 - 2, wid, KNIT);
  ctx.save(); rrect(ctx, x - wid / 2, 2, wid, h - 4, wid / 2); ctx.clip();
  for (let y = 14; y < h; y += 15) line(ctx, [[x - wid, y], [x + wid, y + 2]], 'rgba(110,50,20,0.25)', 3);
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x + wid * 0.18, 0, wid, h);
  if (cuff) { ctx.fillStyle = KNIT_DARK; ctx.fillRect(x - wid, h - 22, wid * 2, 22); }
  ctx.restore();
  rrect(ctx, x - wid / 2, 2, wid, h - 4, wid / 2); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke();
}

// ---------------- реквизит ----------------
export function paintCup(ctx, w, h, steam = false) {
  // чашка с чаем и блюдце, низ по центру
  ellipse(ctx, w / 2, h - 10, 44, 9, '#f3ebdd', OUT, 3);
  ctx.beginPath(); ctx.moveTo(w / 2 - 32, h - 58); ctx.lineTo(w / 2 + 32, h - 58); ctx.quadraticCurveTo(w / 2 + 30, h - 14, w / 2, h - 14); ctx.quadraticCurveTo(w / 2 - 30, h - 14, w / 2 - 32, h - 58); ctx.closePath();
  ctx.fillStyle = '#f7f1e6'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3.5; ctx.stroke();
  ctx.beginPath(); ctx.arc(w / 2 + 36, h - 42, 11, -Math.PI / 2, Math.PI / 2); ctx.strokeStyle = OUT; ctx.lineWidth = 6; ctx.stroke();
  ctx.beginPath(); ctx.arc(w / 2 + 36, h - 42, 11, -Math.PI / 2, Math.PI / 2); ctx.strokeStyle = '#f7f1e6'; ctx.lineWidth = 2.5; ctx.stroke();
  ellipse(ctx, w / 2, h - 58, 32, 7, '#a0522d', OUT, 3);
  ellipse(ctx, w / 2 - 8, h - 59, 10, 2.5, 'rgba(255,220,170,0.6)');
  // красный горошек
  for (const [dx, dy] of [[-16, -40], [4, -34], [20, -44], [-4, -24]]) ellipse(ctx, w / 2 + dx, h + dy, 3.5, 3.5, '#d9603b');
  if (steam) for (const dx of [-12, 6]) line(ctx, [[w / 2 + dx, h - 70], [w / 2 + dx - 8, h - 86], [w / 2 + dx + 4, h - 102], [w / 2 + dx - 4, h - 118]], 'rgba(255,255,255,0.7)', 4);
}

export function paintSpoon(ctx, w, h, jam = true) {
  // ручка вдоль x, черпак справа
  line(ctx, [[6, h / 2 + 2], [w - 40, h / 2]], OUT, 9);
  line(ctx, [[6, h / 2 + 2], [w - 40, h / 2]], '#c9ced6', 5);
  ellipse(ctx, w - 24, h / 2, 20, 13, '#d7dbe2', OUT, 3);
  if (jam) { ellipse(ctx, w - 24, h / 2 - 1, 14, 8, '#b02a3a'); ellipse(ctx, w - 28, h / 2 - 4, 5, 2.5, 'rgba(255,200,200,0.7)'); }
}

function paintTray(ctx, w, h) {
  // поднос с чашкой чая, банкой варенья и ложкой (вид сбоку)
  ctx.save(); ctx.translate(16, h - 150); paintCupInto(ctx); ctx.restore();
  // банка
  rrect(ctx, 120, h - 96, 64, 76, 12); ctx.fillStyle = '#b02a3a'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3.5; ctx.stroke();
  rrect(ctx, 116, h - 110, 72, 18, 6); ctx.fillStyle = '#e8dcc0'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(128, h - 86, 8, 50);
  rrect(ctx, 130, h - 70, 44, 22, 4); ctx.fillStyle = '#f3ebdd'; ctx.fill();
  ctx.save(); ctx.translate(196, h - 74); ctx.rotate(-0.9); paintSpoonInto(ctx, 90, 24, false); ctx.restore();
  // сам поднос
  rrect(ctx, 0, h - 22, w, 16, 7); ctx.fillStyle = '#8f5d36'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke();
  line(ctx, [[8, h - 18], [w - 8, h - 18]], 'rgba(255,255,255,0.2)', 3);
}
function paintCupInto(ctx) { paintCup(ctx, 110, 130, true); }
function paintSpoonInto(ctx, w, h, jam) { paintSpoon(ctx, w, h, jam); }

export function paintPlate(ctx, w, h) {
  // тарелка картошки с маслом и укропом (сбоку) + пар
  ellipse(ctx, w / 2, h - 22, 96, 18, '#f3ebdd', OUT, 4);
  ellipse(ctx, w / 2, h - 26, 70, 10, '#e4dccd');
  const r = rng(8);
  for (const [dx, dy, s] of [[-40, -44, 26], [0, -52, 30], [38, -42, 25], [-18, -64, 24], [20, -68, 24]]) {
    ellipse(ctx, w / 2 + dx, h + dy, s, s * 0.8, '#f2d27a', OUT, 3);
    ellipse(ctx, w / 2 + dx - s * 0.3, h + dy - s * 0.3, s * 0.3, s * 0.2, 'rgba(255,255,255,0.4)');
  }
  rrect(ctx, w / 2 - 14, h - 90, 28, 16, 4); ctx.fillStyle = '#fff2b0'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
  for (let i = 0; i < 16; i++) { ctx.fillStyle = '#4f8a3a'; ctx.fillRect(w / 2 - 50 + r() * 100, h - 80 + r() * 40, 4, 2); }
  for (const dx of [-30, 0, 30]) line(ctx, [[w / 2 + dx, h - 100], [w / 2 + dx - 8, h - 118], [w / 2 + dx + 4, h - 134]], 'rgba(255,255,255,0.65)', 4);
}

export function paintSocksProp(ctx, w, h) {
  // пара шерстяных носков, висят из руки (вверх ногами — пятка внизу)
  const sock = (x, col) => {
    ctx.beginPath(); ctx.moveTo(x, 6); ctx.lineTo(x + 34, 6); ctx.lineTo(x + 34, 70); ctx.quadraticCurveTo(x + 34, 100, x + 60, 104); ctx.quadraticCurveTo(x + 66, 124, x + 40, 126); ctx.quadraticCurveTo(x, 126, x, 92); ctx.closePath();
    ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3.5; ctx.stroke();
    ctx.fillStyle = '#f3ebdd'; ctx.fillRect(x + 2, 8, 30, 14);
    for (let y = 34; y < 96; y += 14) line(ctx, [[x + 4, y], [x + 30, y]], 'rgba(255,255,255,0.35)', 3);
  };
  sock(10, '#b8423a'); sock(50, '#c9584a');
}

// ---------------- регистрация ----------------
export const BOY_STATES_ALL = ['healthy', 'sick', 'very_sick', 'critical'];
export const BOY_EYES = ['open', 'half', 'closed', 'happy', 'wide', 'sad', 'squint'];
export const BOY_MOUTHS = ['closed', 'half', 'open', 'O', 'smile', 'grin', 'frown', 'wavy'];
export const MOM_EYES = ['open', 'closed', 'happy', 'worry'];
export const MOM_MOUTHS = ['closed', 'smile', 'half', 'open', 'worry'];

export function createRigTextures(scene) {
  tex(scene, 'bed_frame', 860, 540, (ctx) => paintBedFrame(ctx));
  tex(scene, 'blanket_body', 860, 540, (ctx) => paintBlanket(ctx));
  tex(scene, 'blanket_fold', 220, 80, (ctx) => paintFold(ctx));
  for (const s of BOY_STATES_ALL) tex(scene, `boy_head_${s}`, 170, 170, (ctx) => paintBoyHead(ctx, s));
  for (const e of BOY_EYES) tex(scene, `boy_eyes_${e}`, 110, 50, (ctx) => paintBoyEyes(ctx, e));
  for (const m of BOY_MOUTHS) tex(scene, `boy_mouth_${m}`, 60, 40, (ctx) => paintBoyMouth(ctx, m));
  tex(scene, 'boy_upper', 44, 104, (ctx, w, h) => paintSleeve(ctx, w, h, 34, false));
  tex(scene, 'boy_fore', 40, 96, (ctx, w, h) => paintSleeve(ctx, w, h, 30, true));
  for (const s of BOY_STATES_ALL) tex(scene, `boy_hand_${s}`, 40, 44, (ctx, w, h) => paintHand(ctx, w, h, BOY_SKIN[s]));

  tex(scene, 'mom_torso', 170, 190, (ctx) => paintMomTorso(ctx));
  tex(scene, 'mom_skirt', 190, 210, (ctx) => paintMomSkirt(ctx));
  tex(scene, 'mom_head', 150, 170, (ctx) => paintMomHead(ctx));
  for (const e of MOM_EYES) tex(scene, `mom_eyes_${e}`, 80, 40, (ctx) => paintMomEyes(ctx, e));
  for (const m of MOM_MOUTHS) tex(scene, `mom_mouth_${m}`, 40, 30, (ctx) => paintMomMouth(ctx, m));
  tex(scene, 'mom_upper', 50, 140, (ctx, w, h) => paintKnitSleeve(ctx, w, h, 40, false));
  tex(scene, 'mom_fore', 44, 128, (ctx, w, h) => paintKnitSleeve(ctx, w, h, 34, true));
  tex(scene, 'mom_hand', 46, 52, (ctx, w, h) => paintHand(ctx, w, h, MOM_SKIN));
  tex(scene, 'mom_thigh', 46, 150, (ctx, w, h) => capsule(ctx, w / 2, 20, h - 20, 38, '#2e2a33'));
  tex(scene, 'mom_shin', 38, 150, (ctx, w, h) => { capsule(ctx, w / 2, 16, h - 16, 28, '#2e2a33'); line(ctx, [[w / 2 + 6, 20], [w / 2 + 6, h - 20]], 'rgba(255,255,255,0.08)', 4); });
  tex(scene, 'mom_shoe', 76, 36, (ctx) => { rrect(ctx, 4, 8, 68, 24, 12); ctx.fillStyle = '#5a3a2a'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3.5; ctx.stroke(); line(ctx, [[10, 28], [68, 28]], '#2a1a12', 4); });

  tex(scene, 'prop_cup', 110, 130, (ctx, w, h) => paintCup(ctx, w, h, true));
  tex(scene, 'prop_cup_still', 110, 130, (ctx, w, h) => paintCup(ctx, w, h, false));
  tex(scene, 'prop_spoon', 110, 30, (ctx, w, h) => paintSpoon(ctx, w, h, true));
  tex(scene, 'prop_spoon_empty', 110, 30, (ctx, w, h) => paintSpoon(ctx, w, h, false));
  tex(scene, 'prop_tray', 260, 170, (ctx, w, h) => paintTray(ctx, w, h));
  tex(scene, 'prop_plate', 220, 150, (ctx, w, h) => paintPlate(ctx, w, h));
  tex(scene, 'prop_socks', 130, 130, (ctx, w, h) => paintSocksProp(ctx, w, h));
}
