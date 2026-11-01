// Процедурные заглушки персонажей и предметов.
import { vgrad, radial, rrect, poly, ellipse, line, rng, sepia } from './paint.js';
import { tr } from '../i18n/index.js';

const OUT = '#24170f';
const SKIN = {
  healthy: '#f1c7a5', sick: '#efc4ab', very_sick: '#eeb49e', critical: '#e99a86', sleep: '#efc4a8',
};

// Кровать с мальчиком, 860×540. Изголовье справа, голова на подушке.
export function paintBoyBed(ctx, w, h, state = 'sick') {
  ctx.save();
  // тень
  ellipse(ctx, 430, 520, 420, 22, 'rgba(0,0,0,0.35)');
  // изголовье
  rrect(ctx, 740, 50, 100, 460, 40); ctx.fillStyle = '#7a5638'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.stroke();
  rrect(ctx, 758, 80, 64, 400, 28); ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 4; ctx.stroke();
  // изножье
  rrect(ctx, 22, 250, 62, 260, 26); ctx.fillStyle = '#7a5638'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.stroke();
  // матрас и простыня
  rrect(ctx, 60, 320, 700, 120, 18); ctx.fillStyle = '#e9e3d8'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = '#6a4a30'; ctx.fillRect(50, 430, 720, 42); ctx.strokeStyle = OUT; ctx.strokeRect(50, 430, 720, 42);
  ctx.fillStyle = '#5a3d27'; ctx.fillRect(70, 472, 26, 50); ctx.fillRect(724, 472, 26, 50);
  // подушка
  ellipse(ctx, 652, 268, 112, 56, '#eef1f5', OUT, 4);
  ellipse(ctx, 640, 282, 80, 26, 'rgba(160,175,200,0.35)');
  // голова
  const skin = SKIN[state] || SKIN.sick;
  const hx = 636; const hy = 222;
  ellipse(ctx, hx + 6, hy + 4, 64, 60, 'rgba(0,0,0,0.18)');
  ellipse(ctx, hx, hy, 62, 58, skin, OUT, 4);
  // волосы
  ctx.beginPath(); ctx.ellipse(hx + 10, hy - 26, 60, 40, 0.2, Math.PI * 0.95, Math.PI * 2.08); ctx.fillStyle = '#6b4a2e'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke();
  line(ctx, [[hx - 30, hy - 40], [hx - 44, hy - 18]], '#6b4a2e', 10); line(ctx, [[hx - 8, hy - 50], [hx - 18, hy - 24]], '#6b4a2e', 10);
  // лицо
  const cheek = state === 'healthy' ? 'rgba(232,120,110,0.35)' : state === 'sick' ? 'rgba(225,95,85,0.45)' : 'rgba(215,60,55,0.6)';
  ellipse(ctx, hx - 34, hy + 18, 15, 10, cheek); ellipse(ctx, hx + 30, hy + 18, 15, 10, cheek);
  const eyeY = hy + 2;
  if (state === 'healthy') {
    for (const ex of [hx - 20, hx + 18]) { ellipse(ctx, ex, eyeY, 9, 11, '#ffffff', OUT, 3); ellipse(ctx, ex + 1, eyeY + 2, 5, 6, '#2a1e1a'); }
    ctx.beginPath(); ctx.arc(hx, hy + 22, 16, 0.2, Math.PI - 0.2); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke();
  } else if (state === 'sick') {
    for (const ex of [hx - 20, hx + 18]) {
      ellipse(ctx, ex, eyeY + 2, 9, 7, '#ffffff', OUT, 3); ellipse(ctx, ex + 1, eyeY + 4, 4.5, 4.5, '#2a1e1a');
      line(ctx, [[ex - 11, eyeY - 2], [ex + 11, eyeY - 1]], OUT, 4);
    }
    ellipse(ctx, hx - 1, hy + 14, 8, 6, 'rgba(220,80,70,0.8)');
    line(ctx, [[hx - 12, hy + 32], [hx + 12, hy + 31]], OUT, 4);
  } else {
    for (const ex of [hx - 20, hx + 18]) {
      ctx.beginPath(); ctx.arc(ex, eyeY + (state === 'critical' ? 4 : 0), 9, Math.PI * 0.15, Math.PI * 0.85); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke();
      if (state === 'critical') ellipse(ctx, ex, eyeY + 14, 10, 4, 'rgba(90,40,60,0.35)');
    }
    if (state === 'critical') ellipse(ctx, hx, hy + 32, 7, 9, '#5a1e1e', OUT, 3);
    else { ctx.beginPath(); ctx.arc(hx, hy + 40, 12, Math.PI * 1.15, Math.PI * 1.85); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke(); }
    // капли пота
    for (const [sx, sy] of [[hx - 52, hy - 8], [hx + 50, hy - 14], [hx + 40, hy + 30]]) poly(ctx, [[sx, sy - 10], [sx + 6, sy + 2], [sx, sy + 8], [sx - 6, sy + 2]], 'rgba(180,220,255,0.9)', OUT, 2);
    // мокрое полотенце на лбу
    ctx.save(); ctx.translate(hx - 4, hy - 30); ctx.rotate(-0.12);
    rrect(ctx, -46, -14, 92, 26, 8); ctx.fillStyle = '#f4f4f0'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
    line(ctx, [[-30, -4], [30, -4]], 'rgba(120,150,190,0.5)', 3);
    ctx.restore();
  }
  // одеяло с телом под ним
  ctx.beginPath();
  ctx.moveTo(70, 440); ctx.lineTo(70, 330);
  ctx.bezierCurveTo(110, 290, 190, 270, 260, 286);
  ctx.bezierCurveTo(330, 300, 380, 262, 470, 250);
  ctx.bezierCurveTo(540, 240, 590, 262, 612, 280);
  ctx.lineTo(626, 440); ctx.closePath();
  const bg = ctx.createLinearGradient(0, 250, 0, 440);
  bg.addColorStop(0, state === 'critical' ? '#2f4470' : '#46659a'); bg.addColorStop(1, '#2f4470');
  ctx.fillStyle = bg; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.stroke();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 3;
  for (let k = -6; k < 14; k++) { line(ctx, [[k * 60, 240], [k * 60 + 200, 440]], 'rgba(255,255,255,0.12)', 3); line(ctx, [[k * 60 + 200, 240], [k * 60, 440]], 'rgba(255,255,255,0.12)', 3); }
  const r = rng(3);
  for (let i = 0; i < 9; i++) { const x = 100 + r() * 480; const y = 290 + r() * 130; poly(ctx, [[x, y - 8], [x + 3, y - 2], [x + 9, y], [x + 3, y + 2], [x, y + 8], [x - 3, y + 2], [x - 9, y], [x - 3, y - 2]], 'rgba(242,166,90,0.8)'); }
  ctx.restore();
  // отворот простыни у подбородка
  rrect(ctx, 520, 262, 120, 30, 12); ctx.fillStyle = '#f2e9da'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
  // рука поверх одеяла
  if (state !== 'critical' && state !== 'sleep') {
    rrect(ctx, 420, 300, 130, 34, 16); ctx.fillStyle = '#c9784a'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3.5; ctx.stroke();
    ellipse(ctx, 412, 318, 18, 15, skin, OUT, 3);
  }
  ctx.restore();
}

// Тайная глава: маленькая Аня в той же комнате тридцать зим назад, 860×540 (как boy_bed_*).
// Железная кровать с шишечками, подушка с кружевом, клетчатое шерстяное одеяло, две косички с бантами.
export function paintGirlBed(ctx, w, h) {
  ctx.save();
  ellipse(ctx, 430, 520, 420, 22, 'rgba(0,0,0,0.35)');
  const iron = '#3c4a58'; const ironHi = '#6c7d8e'; const brass = '#c9a24e';
  const post = (x, y0, y1) => {
    rrect(ctx, x - 9, y0, 18, y1 - y0, 8); ctx.fillStyle = iron; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke();
    line(ctx, [[x - 3, y0 + 14], [x - 3, y1 - 10]], ironHi, 3);
    ellipse(ctx, x, y0 - 12, 16, 16, brass, OUT, 3.5); ellipse(ctx, x - 5, y0 - 17, 5, 5, 'rgba(255,240,200,0.6)');
  };
  const bars = (x0, x1, y0, y1, n) => {
    for (const yy of [y0, y1]) { rrect(ctx, x0, yy - 6, x1 - x0, 12, 6); ctx.fillStyle = iron; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke(); }
    for (let k = 1; k < n; k++) { const xx = x0 + ((x1 - x0) * k) / n; line(ctx, [[xx, y0 + 6], [xx, y1 - 6]], OUT, 7); line(ctx, [[xx, y0 + 6], [xx, y1 - 6]], iron, 4); }
  };
  // изголовье (справа) и изножье (слева)
  bars(744, 836, 96, 300, 4); post(744, 60, 512); post(836, 60, 512);
  bars(26, 92, 290, 420, 2); post(26, 262, 512); post(92, 262, 512);
  // панцирная сетка и матрас
  rrect(ctx, 60, 320, 700, 120, 18); ctx.fillStyle = '#e6dfd2'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = iron; ctx.fillRect(50, 436, 720, 18); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.strokeRect(50, 436, 720, 18);
  // подушка с кружевной каймой
  ellipse(ctx, 652, 268, 114, 58, '#f2f0ea', OUT, 4);
  ctx.save(); ctx.strokeStyle = 'rgba(150,140,120,0.55)'; ctx.lineWidth = 2;
  for (let k = 0; k < 22; k++) { const a = Math.PI * 0.05 + (k / 22) * Math.PI * 0.9; const px = 652 + Math.cos(a) * 104; const py = 268 + Math.sin(a) * 50; ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
  ellipse(ctx, 640, 282, 80, 26, 'rgba(160,150,130,0.3)');
  // косички с бантами — лежат на подушке по обе стороны головы
  const hx = 636; const hy = 222; const hair = '#9a6a3c'; const hairLo = '#6e4724';
  const braid = (pts) => {
    line(ctx, pts, OUT, 20); line(ctx, pts, hair, 14);
    for (let k = 1; k < pts.length; k++) { const [x0, y0] = pts[k - 1]; const [x1, y1] = pts[k]; line(ctx, [[(x0 + x1) / 2 - 5, (y0 + y1) / 2 - 3], [(x0 + x1) / 2 + 5, (y0 + y1) / 2 + 3]], hairLo, 2.5); }
  };
  const bow = (x, y, a) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    poly(ctx, [[0, 0], [-24, -15], [-22, 15]], '#d8402c', OUT, 3); poly(ctx, [[0, 0], [24, -15], [22, 15]], '#d8402c', OUT, 3);
    ellipse(ctx, 0, 0, 7, 7, '#b8321f', OUT, 2.5);
    ctx.restore();
  };
  braid([[hx - 52, hy - 10], [hx - 88, hy + 10], [hx - 110, hy + 44]]); bow(hx - 94, hy + 16, 0.5);
  braid([[hx + 50, hy - 16], [hx + 86, hy + 2], [hx + 104, hy + 38]]); bow(hx + 90, hy + 8, -0.4);
  // голова
  const skin = SKIN.sick;
  ellipse(ctx, hx + 6, hy + 4, 64, 60, 'rgba(0,0,0,0.18)');
  ellipse(ctx, hx, hy, 60, 57, skin, OUT, 4);
  // волосы с чёлкой и пробором
  ctx.beginPath(); ctx.ellipse(hx + 2, hy - 22, 62, 42, 0, Math.PI * 0.98, Math.PI * 2.02); ctx.fillStyle = hair; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke();
  for (const [x0, x1] of [[-40, -30], [-20, -14], [0, 2], [18, 16], [36, 30]]) line(ctx, [[hx + x0, hy - 46], [hx + x1, hy - 22]], hairLo, 3);
  line(ctx, [[hx - 2, hy - 64], [hx + 4, hy - 46]], hairLo, 2.5);
  // лицо: жар — румянец и красный нос, но глаза хитрые и смеются
  ellipse(ctx, hx - 32, hy + 20, 14, 9, 'rgba(225,95,85,0.45)'); ellipse(ctx, hx + 30, hy + 20, 14, 9, 'rgba(225,95,85,0.45)');
  for (const ex of [hx - 21, hx + 19]) {
    ellipse(ctx, ex, hy + 4, 8.5, 9, '#ffffff', OUT, 3);
    ellipse(ctx, ex + 2, hy + 5, 5, 5.5, '#2a1e1a');
    ellipse(ctx, ex + 3.5, hy + 2.5, 1.8, 1.8, '#ffffff');
    ctx.beginPath(); ctx.arc(ex, hy + 30, 14, Math.PI * 1.32, Math.PI * 1.68); ctx.strokeStyle = 'rgba(150,70,55,0.5)'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(ex + 1, hy + 4, 15, Math.PI * 1.22, Math.PI * 1.72); ctx.strokeStyle = hairLo; ctx.lineWidth = 3.5; ctx.stroke();
  }
  ellipse(ctx, hx - 1, hy + 17, 6.5, 5, 'rgba(220,80,70,0.75)');
  ctx.beginPath(); ctx.moveTo(hx - 13, hy + 29); ctx.quadraticCurveTo(hx + 1, hy + 41, hx + 16, hy + 26);
  ctx.strokeStyle = OUT; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.stroke();
  line(ctx, [[hx + 15, hy + 23], [hx + 19, hy + 28]], OUT, 2.5);
  // клетчатое шерстяное одеяло
  ctx.beginPath();
  ctx.moveTo(70, 440); ctx.lineTo(70, 330);
  ctx.bezierCurveTo(110, 292, 190, 272, 260, 288);
  ctx.bezierCurveTo(330, 302, 380, 264, 470, 252);
  ctx.bezierCurveTo(540, 242, 590, 264, 612, 282);
  ctx.lineTo(626, 440); ctx.closePath();
  ctx.fillStyle = '#7a2e2a'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.stroke();
  ctx.save(); ctx.clip();
  for (let x = 40; x < 660; x += 64) { ctx.fillStyle = 'rgba(30,40,70,0.45)'; ctx.fillRect(x, 230, 22, 220); ctx.fillStyle = 'rgba(214,180,120,0.35)'; ctx.fillRect(x + 30, 230, 4, 220); }
  for (let y = 250; y < 450; y += 52) { ctx.fillStyle = 'rgba(30,40,70,0.4)'; ctx.fillRect(40, y, 640, 18); ctx.fillStyle = 'rgba(214,180,120,0.3)'; ctx.fillRect(40, y + 26, 640, 3); }
  const r = rng(5);
  for (let i = 0; i < 700; i++) { ctx.fillStyle = `rgba(255,220,190,${0.03 + r() * 0.05})`; ctx.fillRect(60 + r() * 570, 250 + r() * 190, 3, 1.5); }
  ctx.restore();
  // отворот пододеяльника — полоса вдоль края одеяла, с кружевом по низу
  ctx.beginPath();
  ctx.moveTo(446, 258); ctx.bezierCurveTo(530, 240, 588, 262, 616, 282);
  ctx.lineTo(620, 308); ctx.bezierCurveTo(588, 288, 532, 268, 452, 284); ctx.closePath();
  ctx.fillStyle = '#efe6d4'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
  ctx.save(); ctx.strokeStyle = 'rgba(150,140,120,0.6)'; ctx.lineWidth = 2;
  for (let k = 0; k <= 12; k++) { const t = k / 12; const px = 456 + t * 160; const py = 284 - Math.sin(t * Math.PI) * 6 + t * 22; ctx.beginPath(); ctx.arc(px, py + 3, 4, 0, Math.PI); ctx.stroke(); }
  ctx.restore();
  // рука в рукаве ночнушки (розовая, в горошек)
  rrect(ctx, 420, 302, 130, 34, 16); ctx.fillStyle = '#d98aa0'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3.5; ctx.stroke();
  for (const [px, py] of [[440, 312], [468, 326], [496, 312], [524, 324]]) ellipse(ctx, px, py, 3.5, 3.5, 'rgba(255,255,255,0.75)');
  ellipse(ctx, 412, 320, 18, 15, skin, OUT, 3);
  ctx.restore();
  sepia(ctx, w, h, 0.5, 29); // как и комната — старая фотография
}

// Мама в полный рост, 380×860, низ по центру — опорная точка.
export function paintMom(ctx, w, h) {
  const cx = w / 2;
  ellipse(ctx, cx, h - 14, 120, 14, 'rgba(0,0,0,0.3)');
  // ноги и туфли
  ctx.fillStyle = '#2e2a33'; ctx.fillRect(cx - 44, 760, 26, 70); ctx.fillRect(cx + 18, 760, 26, 70);
  ellipse(ctx, cx - 36, 834, 30, 13, '#3a2c26', OUT, 3); ellipse(ctx, cx + 36, 834, 30, 13, '#3a2c26', OUT, 3);
  // юбка
  poly(ctx, [[cx - 86, 470], [cx + 86, 470], [cx + 128, 790], [cx - 128, 790]], '#3e4c6e', OUT, 5);
  for (const k of [-60, -20, 20, 60]) line(ctx, [[cx + k * 0.8, 490], [cx + k * 1.3, 780]], 'rgba(0,0,0,0.2)', 3);
  // свитер
  rrect(ctx, cx - 98, 220, 196, 280, 46); ctx.fillStyle = '#c9784a'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.stroke();
  for (let y = 250; y < 490; y += 22) line(ctx, [[cx - 80, y], [cx + 80, y]], 'rgba(120,60,30,0.25)', 3);
  // шаль на плечах
  poly(ctx, [[cx - 104, 236], [cx + 104, 236], [cx + 60, 330], [cx, 370], [cx - 60, 330]], '#8c97a8', OUT, 4);
  // руки, сложенные у пояса
  rrect(ctx, cx - 122, 250, 46, 220, 22); ctx.fillStyle = '#b86a40'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke();
  rrect(ctx, cx + 76, 250, 46, 220, 22); ctx.fillStyle = '#b86a40'; ctx.fill(); ctx.stroke();
  ellipse(ctx, cx - 20, 476, 26, 20, '#f0c6a4', OUT, 4); ellipse(ctx, cx + 20, 476, 26, 20, '#f0c6a4', OUT, 4);
  poly(ctx, [[cx - 100, 452], [cx - 40, 478], [cx - 60, 492], [cx - 112, 468]], '#b86a40', OUT, 3);
  poly(ctx, [[cx + 100, 452], [cx + 40, 478], [cx + 60, 492], [cx + 112, 468]], '#b86a40', OUT, 3);
  // шея и голова
  ctx.fillStyle = '#e8b896'; ctx.fillRect(cx - 18, 196, 36, 34);
  ellipse(ctx, cx, 132, 64, 76, '#f0c6a4', OUT, 5);
  // волосы с пучком
  ellipse(ctx, cx, 40, 34, 28, '#4a3328', OUT, 4);
  ctx.beginPath(); ctx.ellipse(cx, 104, 70, 56, 0, Math.PI * 1.02, Math.PI * 1.98); ctx.fillStyle = '#4a3328'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke();
  poly(ctx, [[cx - 66, 104], [cx - 50, 168], [cx - 62, 186], [cx - 74, 130]], '#4a3328');
  poly(ctx, [[cx + 66, 104], [cx + 50, 168], [cx + 62, 186], [cx + 74, 130]], '#4a3328');
  // лицо: мягкий, чуть встревоженный взгляд
  for (const ex of [cx - 24, cx + 24]) {
    ctx.beginPath(); ctx.arc(ex, 136, 9, Math.PI * 1.1, Math.PI * 1.9, false); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke();
    ellipse(ctx, ex, 140, 4.5, 4.5, '#2a1e1a');
  }
  line(ctx, [[cx - 36, 116], [cx - 14, 112]], '#4a3328', 4); line(ctx, [[cx + 36, 116], [cx + 14, 112]], '#4a3328', 4);
  line(ctx, [[cx, 146], [cx - 4, 164], [cx + 2, 166]], 'rgba(120,70,50,0.7)', 3);
  ctx.beginPath(); ctx.arc(cx, 172, 14, 0.25, Math.PI - 0.25); ctx.strokeStyle = '#8a3d33'; ctx.lineWidth = 4; ctx.stroke();
  ellipse(ctx, cx - 38, 164, 12, 7, 'rgba(232,120,110,0.3)'); ellipse(ctx, cx + 38, 164, 12, 7, 'rgba(232,120,110,0.3)');
}

// Пара «мама + мальчик» сбоку, 6 кадров по 360×480. Шарф рисуется отдельным спрайтом.
export const PAIR_FRAME = { w: 360, h: 480, frames: 6, scarfAnchor: { x: 262, y: 300 } };

export function paintPairFrame(ctx, ox, f) {
  const ph = (f / PAIR_FRAME.frames) * Math.PI * 2;
  const H = PAIR_FRAME.h;
  const bobM = -Math.abs(Math.sin(ph)) * 5;
  const bobB = -Math.abs(Math.sin(ph + 0.6)) * 4;
  const legs = (hipX, hipY, len, sw, color, boot, lw) => {
    for (const s of [1, -1]) {
      const a = Math.sin(ph + (s > 0 ? 0 : Math.PI)) * sw;
      const fx = hipX + Math.sin(a) * len; const fy = hipY + Math.cos(a) * len;
      line(ctx, [[hipX, hipY], [fx, fy]], color, lw);
      ellipse(ctx, fx + 8, fy + 2, lw * 0.75, lw * 0.4, boot, OUT, 2);
    }
  };
  ctx.save(); ctx.translate(ox, 0);
  ellipse(ctx, 190, H - 12, 150, 12, 'rgba(60,80,110,0.25)');
  // мама
  ctx.save(); ctx.translate(0, bobM);
  legs(128, 330, 128, 0.42, '#2e2a33', '#2a211d', 20);
  poly(ctx, [[96, 120], [160, 120], [186, 350], [80, 350]], '#6e3b2e', OUT, 4);
  line(ctx, [[86, 250], [180, 250]], '#4a2a20', 6);
  line(ctx, [[150, 138], [178, 210], [204, 272]], '#6e3b2e', 18);
  ellipse(ctx, 206, 276, 11, 10, '#f0c6a4', OUT, 2);
  line(ctx, [[110, 138], [92 - Math.sin(ph) * 16, 230]], '#5d3226', 16);
  ellipse(ctx, 134, 82, 32, 36, '#f0c6a4', OUT, 4);
  poly(ctx, [[160, 80], [172, 92], [160, 98]], '#f0c6a4', OUT, 2);
  ctx.beginPath(); ctx.ellipse(130, 60, 36, 26, 0, Math.PI, 0); ctx.fillStyle = '#8c97a8'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
  ellipse(ctx, 128, 30, 12, 12, '#f2a65a', OUT, 2);
  poly(ctx, [[100, 64], [96, 104], [108, 108], [112, 70]], '#4a3328');
  ellipse(ctx, 148, 78, 3.5, 3.5, '#2a1e1a');
  ctx.restore();
  // мальчик
  ctx.save(); ctx.translate(0, bobB);
  legs(262, 392, 78, 0.5, '#2e3a55', '#5a3a2e', 16);
  rrect(ctx, 226, 292, 76, 110, 30); ctx.fillStyle = '#3f5a8c'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke();
  line(ctx, [[240, 306], [214, 284]], '#3f5a8c', 15);
  ellipse(ctx, 210, 280, 9, 8, '#f1c7a5', OUT, 2);
  line(ctx, [[288, 310], [300 + Math.sin(ph) * 12, 360]], '#35507e', 14);
  ellipse(ctx, 266, 262, 28, 30, '#f1c7a5', OUT, 4);
  poly(ctx, [[292, 262], [302, 270], [292, 276]], '#f1c7a5', OUT, 2);
  ellipse(ctx, 252, 270, 7, 5, 'rgba(225,95,85,0.45)');
  ellipse(ctx, 280, 256, 3.5, 3.5, '#2a1e1a');
  ctx.beginPath(); ctx.ellipse(262, 244, 31, 22, 0, Math.PI, 0); ctx.fillStyle = '#e07b39'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
  ellipse(ctx, 262, 218, 10, 10, '#f3ebdd', OUT, 2);
  ctx.restore();
  ctx.restore();
}

export function paintScarf(ctx, w, h) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(10, 30);
  ctx.bezierCurveTo(60, 0, 120, 60, 200, 26);
  ctx.lineTo(206, 56);
  ctx.bezierCurveTo(130, 90, 60, 34, 14, 62);
  ctx.closePath();
  ctx.fillStyle = '#d9603b'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke();
  ctx.clip();
  for (let x = 20; x < 220; x += 34) { ctx.fillStyle = '#f2a65a'; ctx.fillRect(x, 0, 12, h); }
  ctx.restore();
  for (let k = 0; k < 5; k++) line(ctx, [[200 + k * 1.5, 30 + k * 6], [216 + k * 1.5, 30 + k * 7]], '#d9603b', 4);
}

export function paintThermometer(ctx, w, h) {
  rrect(ctx, 30, 20, 190, 24, 12); ctx.fillStyle = 'rgba(232,238,244,0.9)'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
  ellipse(ctx, 30, 32, 18, 18, '#d9453b', OUT, 3);
  ctx.fillStyle = '#d9453b'; ctx.fillRect(30, 28, 128, 8);
  for (let k = 0; k < 12; k++) line(ctx, [[70 + k * 12, 22], [70 + k * 12, k % 2 ? 28 : 31]], 'rgba(36,23,15,0.7)', 2);
  ellipse(ctx, 120, 26, 60, 3, 'rgba(255,255,255,0.6)');
}

export function paintJam(ctx, w, h) {
  ellipse(ctx, w / 2, h - 8, 62, 9, 'rgba(0,0,0,0.3)');
  rrect(ctx, 28, 58, 114, 128, 26); ctx.fillStyle = '#7a1f2b'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke();
  radial(ctx, 64, 96, 50, 'rgba(255,120,130,0.35)');
  rrect(ctx, 44, 106, 82, 44, 8); ctx.fillStyle = '#f3ebdd'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = '#7a1f2b'; ctx.font = '700 26px Caveat, cursive'; ctx.textAlign = 'center'; ctx.fillText(tr('малина'), 85, 137);
  // крышка-тряпочка в клетку
  ctx.save(); ctx.beginPath(); ctx.ellipse(85, 52, 70, 22, 0, 0, Math.PI * 2); ctx.clip();
  for (let x = 0; x < 180; x += 16) for (let y = 20; y < 80; y += 16) { ctx.fillStyle = ((x + y) / 16) % 2 ? '#f2a65a' : '#f3ebdd'; ctx.fillRect(x, y, 16, 16); }
  ctx.restore();
  ellipse(ctx, 85, 52, 70, 22, null, OUT, 3);
  line(ctx, [[30, 64], [140, 64]], '#8a3d33', 4);
  // ложка
  ctx.save(); ctx.translate(138, 40); ctx.rotate(0.5);
  rrect(ctx, -5, 0, 10, 92, 5); ctx.fillStyle = '#c9ced6'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.stroke();
  ellipse(ctx, 0, -10, 13, 18, '#c9ced6', OUT, 2.5);
  ctx.restore();
}

export function paintSocks(ctx, w, h) {
  for (const [dx, rot] of [[50, -0.15], [120, 0.12]]) {
    ctx.save(); ctx.translate(dx, 20); ctx.rotate(rot);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(44, 0); ctx.lineTo(44, 70); ctx.quadraticCurveTo(46, 104, 90, 104); ctx.quadraticCurveTo(104, 116, 88, 124); ctx.lineTo(30, 124); ctx.quadraticCurveTo(-2, 120, 0, 84); ctx.closePath();
    ctx.fillStyle = '#c9784a'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3.5; ctx.stroke();
    ctx.save(); ctx.clip(); for (let y = 6; y < 130; y += 22) { ctx.fillStyle = '#8c97a8'; ctx.fillRect(-10, y, 120, 9); } ctx.restore();
    ctx.restore();
  }
}

export function paintPotatoPot(ctx, w, h) {
  ellipse(ctx, w / 2, h - 10, 110, 12, 'rgba(0,0,0,0.3)');
  const g = ctx.createLinearGradient(30, 0, 230, 0); g.addColorStop(0, '#4b5463'); g.addColorStop(0.4, '#8a94a5'); g.addColorStop(1, '#3f4756');
  rrect(ctx, 30, 86, 200, 106, 20); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke();
  for (const x of [14, 222]) { rrect(ctx, x, 104, 24, 14, 7); ctx.fillStyle = '#3f4756'; ctx.fill(); ctx.stroke(); }
  for (const [x, y] of [[80, 84], [118, 78], [156, 86]]) ellipse(ctx, x, y, 22, 15, '#c89b5e', OUT, 3);
  ctx.save(); ctx.translate(178, 64); ctx.rotate(0.35); ellipse(ctx, 0, 0, 74, 14, '#6d7686', OUT, 4); ellipse(ctx, 0, -12, 12, 8, '#3f4756', OUT, 3); ctx.restore();
  for (const x of [70, 120, 160]) line(ctx, [[x, 60], [x - 10, 40], [x + 6, 22], [x - 4, 4]], 'rgba(255,255,255,0.55)', 6);
}
