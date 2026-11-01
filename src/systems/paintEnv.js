// Процедурные заглушки окружения: спальня (утро/ночь/сумерки), дорога (3 слоя + шторм), крыльцо.
import { vgrad, radial, rrect, poly, ellipse, line, ridge, fir, rng, snowSpeckles, sepia } from './paint.js';
import { paintCornerWeb } from './spiderArt.js';
import { paintKidDrawing } from './paintWorld.js';
import { ROOM } from '../config/layout.js';
import { tr } from '../i18n/index.js';

const ROOM_PAL = {
  day: { wallTop: '#33476b', wallBot: '#273856', side: '#1e2c45', ceil: '#2a3b5a', floorA: '#4a3a33', floorB: '#3a2d28', frame: '#d9cfc0', curtain: '#a4563a', curtainLo: '#7c3d29', door: '#6a4c38', doorLo: '#563d2d', wood: '#7a5638', woodLo: '#5e412b', dim: 0 },
  night: { wallTop: '#172238', wallBot: '#111a2c', side: '#0c1322', ceil: '#131c30', floorA: '#2a2226', floorB: '#211a1e', frame: '#59627a', curtain: '#55333a', curtainLo: '#3d252b', door: '#3f2f28', doorLo: '#31241f', wood: '#4d3727', woodLo: '#3b2a1e', dim: 0.15 },
  dawn: { wallTop: '#4a4a66', wallBot: '#3a3954', side: '#2c2b42', ceil: '#3d3c58', floorA: '#5a4438', floorB: '#47352d', frame: '#e6d8c4', curtain: '#b5603f', curtainLo: '#8a452d', door: '#7a573f', doorLo: '#634632', wood: '#86603f', woodLo: '#6a4a31', dim: -0.12 },
  // тридцать зим назад (тайная глава «Аня»): та же комната ночью, но обои в цветочек, ковёр на стене, отрывной календарь
  past: { wallTop: '#3a3326', wallBot: '#2b261c', side: '#221e16', ceil: '#2e2a20', floorA: '#3a2b20', floorB: '#2b2018', frame: '#7d705c', curtain: '#6b3d2c', curtainLo: '#4d2b1f', door: '#4c3829', doorLo: '#3b2b20', wood: '#5c4129', woodLo: '#47321f', dim: 0.1 },
  dusk: { wallTop: '#2c3150', wallBot: '#1f2440', side: '#171a2f', ceil: '#232845', floorA: '#3a2d2c', floorB: '#2d2324', frame: '#8d7f79', curtain: '#8a4a36', curtainLo: '#653425', door: '#55402f', doorLo: '#463427', wood: '#644631', woodLo: '#4d3625', dim: 0.05 },
};

function windowView(ctx, mode, x, y, w, h) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  if (mode === 'day') {
    // пасмурный зимний день: мягкое ровное небо без «пересвета»
    vgrad(ctx, x, y, w, h, [[0, '#8ea2b8'], [0.65, '#b4c2d0'], [1, '#c8d3de']]);
    radial(ctx, x + 110, y + 90, 170, 'rgba(240,236,226,0.28)');
  } else if (mode === 'dawn') {
    // рассвет после пурги: персиковое небо, низкое солнце над крышами
    vgrad(ctx, x, y, w, h, [[0, '#7f86b0'], [0.45, '#d9a5a0'], [0.8, '#f2c79a'], [1, '#f6dcb6']]);
    radial(ctx, x + 300, y + h - 120, 150, 'rgba(255,236,200,0.5)');
    ellipse(ctx, x + 300, y + h - 118, 30, 30, 'rgba(255,242,214,0.95)');
  } else if (mode === 'night') {
    vgrad(ctx, x, y, w, h, [[0, '#08102a'], [1, '#1c2a4f']]);
    const r = rng(7);
    for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.6})`; ctx.fillRect(x + r() * w, y + r() * h * 0.6, 2, 2); }
    radial(ctx, x + 300, y + 90, 90, 'rgba(241,234,216,0.35)');
    ellipse(ctx, x + 300, y + 90, 26, 26, '#f1ead8');
  } else {
    vgrad(ctx, x, y, w, h, [[0, '#1f2b52'], [0.55, '#5d4e74'], [0.85, '#c98258'], [1, '#e6a066']]);
  }
  // дальние крыши и ели
  const roof = { day: '#9aa9ba', night: '#121b33', dawn: '#5d5a78' }[mode] || '#1c2238';
  const roofSnow = { day: '#e3e9ef', night: '#55607a', dawn: '#f4dcc8' }[mode] || '#8d8fa6';
  for (const [rx, rw, rh] of [[x + 20, 120, 70], [x + 170, 150, 90], [x + 300, 110, 60]]) {
    const top = y + h - rh - 40;
    poly(ctx, [[rx, top + 30], [rx + rw / 2, top], [rx + rw, top + 30], [rx + rw, y + h], [rx, y + h]], roof);
    poly(ctx, [[rx - 4, top + 32], [rx + rw / 2, top - 2], [rx + rw + 4, top + 32], [rx + rw / 2, top + 12]], roofSnow);
    if (mode !== 'day') { ctx.fillStyle = '#f2a65a'; ctx.fillRect(rx + rw * 0.3, top + 48, 16, 16); }
  }
  const firCol = { day: '#6f8399', dawn: '#3e4664' }[mode] || '#0f172b';
  const snowCol = { day: '#e3e9ef', dawn: '#f6e2cf' }[mode] || '#56617a';
  for (const fx of [x + 140, x + 290, x + 395]) fir(ctx, fx, y + h - 20, 120, firCol, snowCol);
  ctx.fillStyle = snowCol;
  ctx.fillRect(x, y + h - 24, w, 24);
  ctx.restore();
}

export function paintRoom(ctx, w, h, mode = 'day') {
  const P = ROOM_PAL[mode];
  const W = ROOM.window; const D = ROOM.door; const N = ROOM.nightstand;
  // стены, потолок, угол
  const past = mode === 'past';
  vgrad(ctx, 0, 0, w, 900, [[0, P.wallTop], [1, P.wallBot]]);
  if (past) pastWallpaper(ctx);
  else {
    ctx.save(); ctx.globalAlpha = 0.05; ctx.fillStyle = '#ffffff';
    for (let x = 0; x < 1760; x += 72) ctx.fillRect(x, 40, 24, 860);
    ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.07; ctx.fillStyle = '#ffffff';
    for (let yy = 120; yy < 900; yy += 96) for (let x = 36; x < 1760; x += 72) { poly(ctx, [[x, yy - 7], [x + 6, yy], [x, yy + 7], [x - 6, yy]], '#ffffff'); }
    ctx.restore();
  }
  poly(ctx, [[0, 0], [w, 0], [w, 0], [1762, 42], [0, 42]], P.ceil);
  poly(ctx, [[1762, 42], [w, 0], [w, h], [1762, 900]], P.side);
  line(ctx, [[1762, 42], [1762, 900]], 'rgba(0,0,0,0.25)', 3);
  line(ctx, [[0, 42], [1762, 42]], 'rgba(0,0,0,0.22)', 3);
  // пол
  vgrad(ctx, 0, 900, w, h - 900, [[0, P.floorA], [1, P.floorB]]);
  ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
  for (let k = 0; k < 8; k++) { const y0 = 900 + k * 24 + k * k * 2; ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(w, y0); ctx.stroke(); }
  for (let k = -10; k < 30; k++) { ctx.beginPath(); ctx.moveTo(960 + k * 90, 900); ctx.lineTo(960 + k * 160, 1080); ctx.stroke(); }
  ctx.restore();
  poly(ctx, [[1762, 900], [w, 1080], [w, 1080]], P.floorB);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 892, 1762, 12);
  // окно: шторы, рама, вид
  ctx.fillStyle = P.wood; ctx.fillRect(W.x - 70, W.y - 34, W.w + 140, 10);
  windowView(ctx, past ? 'night' : mode, W.x, W.y, W.w, W.h);
  ctx.strokeStyle = P.frame; ctx.lineWidth = 22; ctx.strokeRect(W.x, W.y, W.w, W.h);
  ctx.lineWidth = 10; line(ctx, [[W.x + W.w / 2, W.y], [W.x + W.w / 2, W.y + W.h]], P.frame, 10, 'butt'); line(ctx, [[W.x, W.y + W.h * 0.42], [W.x + W.w, W.y + W.h * 0.42]], P.frame, 10, 'butt');
  // лёгкий блик на стекле (без белых пятен)
  ctx.save(); ctx.beginPath(); ctx.rect(W.x + 11, W.y + 11, W.w - 22, W.h - 22); ctx.clip();
  line(ctx, [[W.x + 40, W.y + W.h - 30], [W.x + 150, W.y + 60]], 'rgba(255,255,255,0.10)', 18);
  line(ctx, [[W.x + 250, W.y + W.h - 40], [W.x + 330, W.y + 140]], 'rgba(255,255,255,0.07)', 10);
  ctx.restore();
  rrect(ctx, W.x - 20, W.y + W.h + 4, W.w + 40, 22, 6); ctx.fillStyle = P.frame; ctx.fill();
  for (const [cx, dir] of [[W.x - 40, 1], [W.x + W.w + 40, -1]]) {
    for (let k = 0; k < 5; k++) {
      const x0 = cx - 50 + k * 22;
      const g = ctx.createLinearGradient(x0, 0, x0 + 22, 0);
      g.addColorStop(0, P.curtainLo); g.addColorStop(0.5, P.curtain); g.addColorStop(1, P.curtainLo);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x0, W.y - 26); ctx.lineTo(x0 + 22, W.y - 26);
      ctx.quadraticCurveTo(x0 + 26 + dir * 18, W.y + 300, x0 + 30 + dir * 8, W.y + W.h + 60);
      ctx.lineTo(x0 + 6 + dir * 8, W.y + W.h + 60); ctx.quadraticCurveTo(x0 + dir * 18, W.y + 300, x0, W.y - 26); ctx.fill();
    }
  }
  // дверь
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(D.x - 16, D.y - 16, D.w + 32, D.h + 16);
  vgrad(ctx, D.x, D.y, D.w, D.h, [[0, P.door], [1, P.doorLo]]);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 4;
  ctx.strokeRect(D.x + 30, D.y + 40, D.w - 60, 250); ctx.strokeRect(D.x + 30, D.y + 340, D.w - 60, 260);
  ellipse(ctx, D.x + D.w - 34, D.y + 350, 11, 11, '#d9b36a', '#5a4022', 3);
  // рисунок на стене (детский)
  // мамин детский рисунок: дом, солнце, девочка и паук на ниточке с подписью «ТИХОН»
  // (тридцать зим назад его ещё нет — Аня нарисует его в конце главы; на его месте пока ковёр и календарь)
  if (!past) {
    ctx.fillStyle = '#c9a46a'; ctx.fillRect(1240, 220, 230, 180);
    paintKidDrawing(ctx, 1254, 234, 202, 152);
    if (P.dim > 0.1) { ctx.fillStyle = `rgba(10,14,28,${P.dim})`; ctx.fillRect(1254, 234, 202, 152); }
  } else {
    pastCarpet(ctx, 1130, 430, 570, 330);
    pastCalendar(ctx, 1030, 250);
  }
  // тумбочка и лампа
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ellipse(ctx, N.x + N.w / 2, N.y + N.h + 4, N.w * 0.62, 14, 'rgba(0,0,0,0.3)');
  vgrad(ctx, N.x, N.y, N.w, N.h, [[0, P.wood], [1, P.woodLo]]);
  rrect(ctx, N.x - 12, N.y - 14, N.w + 24, 22, 6); ctx.fillStyle = P.wood; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 3; ctx.strokeRect(N.x + 16, N.y + 30, N.w - 32, 70);
  ellipse(ctx, N.x + N.w / 2, N.y + 65, 8, 8, '#d9b36a');
  const lampOn = mode === 'night' || mode === 'dusk' || past;
  ctx.fillStyle = '#3b2a1e'; ctx.fillRect(N.x + 46, N.y - 110, 8, 98); ellipse(ctx, N.x + 50, N.y - 14, 30, 8, '#3b2a1e');
  poly(ctx, [[N.x + 8, N.y - 110], [N.x + 92, N.y - 110], [N.x + 74, N.y - 186], [N.x + 26, N.y - 186]], lampOn ? '#f7c987' : '#e6d3b3', 'rgba(0,0,0,0.35)', 3);
  // ковёр
  ellipse(ctx, 760, 1000, 430, 58, '#6e3b33'); ellipse(ctx, 760, 1000, 400, 48, null, '#c9784a', 4);
  // паутина в углу потолка
  paintCornerWeb(ctx, 1762, 42, 250, mode === 'day' ? 0.32 : 0.45);
  // свет
  if (mode === 'day' || mode === 'dawn') {
    // мягкий растушёванный свет из окна на пол
    const warm = mode === 'dawn';
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (typeof ctx.filter === 'string') ctx.filter = 'blur(30px)';
    const g = ctx.createLinearGradient(0, W.y + W.h, 0, 1080);
    g.addColorStop(0, warm ? 'rgba(255,200,140,0.12)' : 'rgba(225,232,240,0.07)'); g.addColorStop(1, 'rgba(255,236,200,0)');
    poly(ctx, [[W.x + 20, W.y + W.h], [W.x + W.w - 20, W.y + W.h], [W.x + W.w + 520, 1080], [W.x + 160, 1080]], g);
    ctx.restore();
    radial(ctx, W.x + W.w / 2, W.y + W.h / 2, 560, warm ? 'rgba(255,196,140,0.14)' : 'rgba(230,236,244,0.06)', 'rgba(255,240,215,0)', 'lighter');
  } else {
    radial(ctx, N.x + 50, N.y - 150, 520, mode === 'night' || past ? 'rgba(255,165,80,0.30)' : 'rgba(255,170,90,0.26)', 'rgba(255,165,80,0)', 'lighter');
    if (mode === 'night' || past) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      poly(ctx, [[W.x, W.y + W.h], [W.x + W.w, W.y + W.h], [W.x + W.w + 300, 1080], [W.x + 60, 1080]], 'rgba(150,180,255,0.05)');
      ctx.restore();
    }
  }
  // мягкая виньетка
  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 1.05);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(5,8,16,${0.45 + P.dim})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  if (past) sepia(ctx, w, h, 0.62, 23);
}

// Обои «в цветочек»: тонкие вертикальные полосы и ряды мелких пятилепестковых цветов со стебельком.
function pastWallpaper(ctx) {
  const r = rng(31);
  ctx.save();
  ctx.globalAlpha = 0.06; ctx.fillStyle = '#f3e2b8';
  for (let x = 0; x < 1760; x += 96) { ctx.fillRect(x, 40, 3, 860); ctx.fillRect(x + 10, 40, 1.5, 860); }
  ctx.globalAlpha = 1;
  for (let row = 0, yy = 92; yy < 900; yy += 84, row++) {
    for (let x = (row % 2) * 48 + 24; x < 1760; x += 96) {
      const cx = x + (r() - 0.5) * 3; const cy = yy + (r() - 0.5) * 3;
      line(ctx, [[cx, cy + 6], [cx - 4, cy + 22]], 'rgba(120,140,90,0.22)', 2);
      ellipse(ctx, cx - 7, cy + 17, 5, 2.4, 'rgba(120,140,90,0.2)');
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
        ellipse(ctx, cx + Math.cos(a) * 5.5, cy + Math.sin(a) * 5.5, 4, 4, 'rgba(226,190,150,0.17)');
      }
      ellipse(ctx, cx, cy, 2.4, 2.4, 'rgba(240,200,110,0.28)');
    }
  }
  ctx.restore();
}

// Ковёр на стене над кроватью: каёмка с зигзагом, красное поле, ромб-медальон и звёздочки по углам.
function pastCarpet(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x + 8, y + 10, w, h);
  ctx.fillStyle = '#2b3550'; ctx.fillRect(x, y, w, h);
  const b = 26;
  ctx.fillStyle = '#6a2420'; ctx.fillRect(x + b, y + b, w - b * 2, h - b * 2);
  // зигзаг по каёмке
  ctx.strokeStyle = 'rgba(214,180,120,0.7)'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  const zig = (x0, y0, x1, y1, n, amp) => {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const t = i / n; const px = x0 + (x1 - x0) * t; const py = y0 + (y1 - y0) * t;
      const o = (i % 2 ? amp : -amp);
      if (x0 === x1) ctx.lineTo(px + o, py); else ctx.lineTo(px, py + o);
    }
    ctx.stroke();
  };
  zig(x + 10, y + b / 2, x + w - 10, y + b / 2, 36, 6); zig(x + 10, y + h - b / 2, x + w - 10, y + h - b / 2, 36, 6);
  zig(x + b / 2, y + 10, x + b / 2, y + h - 10, 20, 6); zig(x + w - b / 2, y + 10, x + w - b / 2, y + h - 10, 20, 6);
  // медальон: вложенные ромбы
  const cx = x + w / 2; const cy = y + h / 2;
  const dia = (rx, ry, fill) => poly(ctx, [[cx, cy - ry], [cx + rx, cy], [cx, cy + ry], [cx - rx, cy]], fill);
  dia(170, 120, '#2b3550'); dia(146, 100, '#b5763a'); dia(118, 80, '#6a2420'); dia(80, 54, '#d6b478'); dia(50, 34, '#2b3550'); dia(22, 15, '#b5763a');
  // звёздочки-«гёли» в углах поля
  const star = (sx, sy, s, col) => {
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2;
      poly(ctx, [[sx, sy], [sx + Math.cos(a - 0.35) * s * 0.5, sy + Math.sin(a - 0.35) * s * 0.5], [sx + Math.cos(a) * s, sy + Math.sin(a) * s], [sx + Math.cos(a + 0.35) * s * 0.5, sy + Math.sin(a + 0.35) * s * 0.5]], col);
    }
  };
  for (const [sx, sy] of [[x + 80, y + 70], [x + w - 80, y + 70], [x + 80, y + h - 70], [x + w - 80, y + h - 70]]) { star(sx, sy, 30, '#d6b478'); star(sx, sy, 14, '#2b3550'); }
  for (const sx of [x + 190, x + w - 190]) { star(sx, cy, 20, '#b5763a'); }
  // ворс: мелкая штриховка и потёртость
  const r = rng(77);
  for (let i = 0; i < 1600; i++) { ctx.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,230,190'},${0.03 + r() * 0.05})`; ctx.fillRect(x + r() * w, y + r() * h, 2, 2); }
  ctx.restore();
}

// Отрывной календарь: картонка, красная шапка с месяцем, большое число.
function pastCalendar(ctx, x, y) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x + 5, y + 6, 96, 128);
  ctx.fillStyle = '#7a6a52'; ctx.fillRect(x - 6, y - 8, 108, 16);
  ctx.fillStyle = '#e9e0cc'; ctx.fillRect(x, y, 96, 128);
  // корешки оторванных листков
  for (let k = 0; k < 6; k++) { ctx.fillStyle = `rgba(233,224,204,${0.5 + k * 0.05})`; ctx.fillRect(x + 4 + k * 15, y + 1, 10, 5); }
  ctx.fillStyle = '#a8322b'; ctx.fillRect(x, y + 8, 96, 26);
  ctx.fillStyle = '#f3e9d6'; ctx.font = '700 15px Literata, Georgia, serif'; ctx.textAlign = 'center';
  ctx.fillText(tr('ЯНВАРЬ'), x + 48, y + 27);
  ctx.fillStyle = '#2a2522'; ctx.font = '700 58px Literata, Georgia, serif';
  ctx.fillText('14', x + 48, y + 92);
  ctx.fillStyle = '#a8322b'; ctx.font = '500 13px Literata, Georgia, serif';
  ctx.fillText(tr('суббота'), x + 48, y + 114);
  ctx.restore();
}

// ---------- Дорога: дальний слой непрозрачный, средний и ближний — с прозрачностью ----------
export function paintRoadFar(ctx, w, h, storm = false) {
  if (!storm) {
    vgrad(ctx, 0, 0, w, h, [[0, '#93abc6'], [0.55, '#d4dfea'], [0.62, '#e6edf3'], [1, '#eef2f6']]);
    radial(ctx, 1100, 230, 260, 'rgba(255,248,232,0.85)');
    ellipse(ctx, 1100, 230, 46, 46, 'rgba(255,250,240,0.95)');
  } else {
    vgrad(ctx, 0, 0, w, h, [[0, '#2f3a4f'], [0.55, '#5f6c83'], [0.62, '#76829a'], [1, '#8f9bb0']]);
    const r = rng(11);
    for (let i = 0; i < 26; i++) ellipse(ctx, r() * w, 80 + r() * 260, 160 + r() * 260, 40 + r() * 50, 'rgba(32,40,56,0.45)');
  }
  ridge(ctx, w, h, 560, 40, 3, storm ? '#56637a' : '#b8c7d8', 3);
  ridge(ctx, w, h, 615, 26, 5, storm ? '#4a566c' : '#a3b4c8', 5);
  const r = rng(21);
  for (let x = 20; x < w; x += 26 + r() * 40) fir(ctx, x, 640 + r() * 14, 40 + r() * 40, storm ? '#36425a' : '#7d90a8', storm ? 'rgba(200,210,225,0.5)' : 'rgba(244,247,250,0.85)');
  vgrad(ctx, 0, 650, w, h - 650, [[0, storm ? '#8794a8' : '#e4ebf2'], [1, storm ? '#a2adbf' : '#f2f5f8']]);
  // далёкая деревня с дымками
  for (const vx of [700, 2300, 3300]) {
    for (let k = 0; k < 4; k++) {
      const x = vx + k * 46; const top = 620 - (k % 2) * 8;
      poly(ctx, [[x, top + 14], [x + 18, top], [x + 36, top + 14], [x + 36, top + 36], [x, top + 36]], storm ? '#3c465a' : '#8a9ab0');
      if (!storm) { ctx.fillStyle = '#f2a65a'; ctx.fillRect(x + 12, top + 20, 8, 8); }
      if (!storm) line(ctx, [[x + 26, top + 4], [x + 30, top - 20], [x + 22, top - 44], [x + 30, top - 70]], 'rgba(255,255,255,0.45)', 5);
    }
  }
}

export function paintRoadMid(ctx, w, h) {
  const r = rng(31);
  ridge(ctx, w, h, 760, 18, 4, '#dde5ee', 9, 30);
  for (let x = 40; x < w; x += 140 + r() * 220) fir(ctx, x, 770 + r() * 20, 170 + r() * 120, '#58708c', 'rgba(246,248,251,0.95)');
  // берёзы
  for (let x = 300; x < w; x += 700 + r() * 300) {
    ctx.fillStyle = '#e8e4dc'; ctx.fillRect(x, 520, 16, 260);
    for (let k = 0; k < 7; k++) { ctx.fillStyle = '#3a3438'; ctx.fillRect(x + (k % 2) * 6, 540 + k * 34, 10, 4); }
  }
  // дома с тёплыми окнами
  for (const hx of [900, 2650]) {
    poly(ctx, [[hx, 640], [hx + 150, 560], [hx + 300, 640], [hx + 300, 790], [hx, 790]], '#5b4436', 'rgba(0,0,0,0.35)', 3);
    poly(ctx, [[hx - 14, 646], [hx + 150, 552], [hx + 314, 646], [hx + 150, 590]], '#f4f7fa');
    for (const wx of [hx + 50, hx + 190]) { ctx.fillStyle = '#f2a65a'; ctx.fillRect(wx, 680, 60, 56); ctx.strokeStyle = '#3b2a1e'; ctx.lineWidth = 5; ctx.strokeRect(wx, 680, 60, 56); }
    radial(ctx, hx + 150, 708, 220, 'rgba(242,166,90,0.25)');
  }
  // заборчик
  ctx.fillStyle = '#6b5446';
  for (let x = 0; x < w; x += 46) ctx.fillRect(x, 770, 12, 60);
  ctx.fillRect(0, 786, w, 8); ctx.fillRect(0, 812, w, 8);
  ridge(ctx, w, h, 812, 8, 9, '#e8eef4', 13, 30);
}

export function paintRoadFront(ctx, w, h) {
  // дорога
  vgrad(ctx, 0, 850, w, h - 850, [[0, '#cfd9e4'], [1, '#e8eef4']]);
  ctx.save(); ctx.strokeStyle = 'rgba(150,168,190,0.6)'; ctx.lineWidth = 8;
  for (const y of [905, 960]) { ctx.beginPath(); for (let x = 0; x <= w; x += 40) ctx.lineTo(x, y + Math.sin(x / 300) * 4); ctx.stroke(); }
  ctx.restore();
  // сугробы по краям
  ridge(ctx, w, h, 850, 10, 12, '#f4f7fa', 17, 24);
  ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.restore();
  const r = rng(41);
  ctx.beginPath(); ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 30) ctx.lineTo(x, 1010 + Math.sin(x / 170) * 14 + r() * 6);
  ctx.lineTo(w, h); ctx.closePath(); ctx.fillStyle = '#f6f8fb'; ctx.fill();
  ctx.strokeStyle = 'rgba(160,180,205,0.7)'; ctx.lineWidth = 3; ctx.stroke();
  // столбики и сухая трава спереди
  for (let x = 120; x < w; x += 520 + r() * 260) {
    ctx.fillStyle = '#4a3a30'; ctx.fillRect(x, 960, 26, 120);
    ellipse(ctx, x + 13, 960, 20, 9, '#f6f8fb');
    for (let k = 0; k < 6; k++) line(ctx, [[x + 60 + k * 8, 1030], [x + 54 + k * 10, 990 - r() * 20]], 'rgba(120,96,70,0.8)', 3);
  }
  snowSpeckles(ctx, w, 230, 260, 5, 0.5, 2);
}

// ---------- Крыльцо в метель ----------
export function paintPorch(ctx, w, h, open = false) {
  vgrad(ctx, 0, 0, w, h, [[0, '#0f1628'], [1, '#27324b']]);
  // стена дома
  const g = ctx.createLinearGradient(0, 140, 0, 900);
  g.addColorStop(0, '#5a4033'); g.addColorStop(1, '#3f2c23');
  ctx.fillStyle = g; ctx.fillRect(260, 140, 1400, 760);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 3;
  for (let y = 170; y < 900; y += 34) { ctx.beginPath(); ctx.moveTo(260, y); ctx.lineTo(1660, y); ctx.stroke(); }
  poly(ctx, [[200, 150], [1720, 150], [1660, 100], [260, 100]], '#2e2622');
  rrect(ctx, 210, 86, 1500, 40, 20); ctx.fillStyle = '#eef3f8'; ctx.fill();
  // окна
  for (const [x, lit] of [[420, false], [1280, true]]) {
    ctx.fillStyle = lit ? '#f2a65a' : '#1b2438'; ctx.fillRect(x, 400, 220, 220);
    if (lit) radial(ctx, x + 110, 510, 260, 'rgba(242,166,90,0.35)');
    ctx.strokeStyle = '#d9cfc0'; ctx.lineWidth = 14; ctx.strokeRect(x, 400, 220, 220);
    line(ctx, [[x + 110, 400], [x + 110, 620]], '#d9cfc0', 8); line(ctx, [[x, 500], [x + 220, 500]], '#d9cfc0', 8);
    rrect(ctx, x - 16, 612, 252, 24, 10); ctx.fillStyle = '#eef3f8'; ctx.fill();
  }
  // дверь
  const dx = 820; const dy = 330; const dw = 280; const dh = 540;
  ctx.fillStyle = '#2b1f18'; ctx.fillRect(dx - 24, dy - 24, dw + 48, dh + 24);
  if (!open) {
    vgrad(ctx, dx, dy, dw, dh, [[0, '#6a4c38'], [1, '#553c2c']]);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 4;
    ctx.strokeRect(dx + 34, dy + 160, dw - 68, 150); ctx.strokeRect(dx + 34, dy + 340, dw - 68, 160);
    ctx.fillStyle = '#f2a65a'; ctx.fillRect(dx + 70, dy + 40, dw - 140, 90);
    ellipse(ctx, dx + dw - 40, dy + 300, 12, 12, '#d9b36a', '#5a4022', 3);
  } else {
    vgrad(ctx, dx, dy, dw, dh, [[0, '#ffd9a0'], [1, '#f2a65a']]);
    radial(ctx, dx + dw / 2, dy + dh / 2, 420, 'rgba(255,210,150,0.55)');
    poly(ctx, [[dx, dy], [dx + 60, dy + 30], [dx + 60, dy + dh - 10], [dx, dy + dh]], '#553c2c', 'rgba(0,0,0,0.4)', 3);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    poly(ctx, [[dx, dy + dh], [dx + dw, dy + dh], [dx + dw + 260, h], [dx - 260, h]], 'rgba(255,190,120,0.28)');
    ctx.restore();
  }
  // фонарь над дверью
  radial(ctx, 960, 290, 240, 'rgba(255,190,120,0.45)');
  ellipse(ctx, 960, 290, 20, 26, '#ffe3b3', '#3b2a1e', 4);
  // ступени и перила
  for (let k = 0; k < 3; k++) {
    const y = 870 + k * 34; const ex = k * 40;
    ctx.fillStyle = '#4a3a30'; ctx.fillRect(dx - 60 - ex, y, dw + 120 + ex * 2, 34);
    rrect(ctx, dx - 64 - ex, y - 6, dw + 128 + ex * 2, 14, 7); ctx.fillStyle = '#eef3f8'; ctx.fill();
  }
  for (const x of [dx - 90, dx + dw + 80]) { ctx.fillStyle = '#3b2a1e'; ctx.fillRect(x, 700, 18, 270); rrect(ctx, x - 8, 692, 34, 14, 7); ctx.fillStyle = '#eef3f8'; ctx.fill(); }
  // сугробы
  ctx.beginPath(); ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 40) ctx.lineTo(x, (x < dx - 200 || x > dx + dw + 200 ? 900 : 990) + Math.sin(x / 120) * 18);
  ctx.lineTo(w, h); ctx.closePath(); ctx.fillStyle = '#e3eaf2'; ctx.fill();
  // косая метель
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 2;
  const r = rng(51);
  for (let i = 0; i < 260; i++) { const x = r() * w; const y = r() * h; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 60, y + 14); ctx.stroke(); }
  ctx.restore();
  snowSpeckles(ctx, w, h, 400, 52, 0.5, 2.4);
}

// Паутина на окне (оверлей состояния C), 460×460, прозрачный фон.
export function paintWebWindow(ctx, w, h) {
  const cx = w * 0.42; const cy = h * 0.4;
  ctx.strokeStyle = 'rgba(232,238,246,0.7)'; ctx.lineWidth = 2;
  const rays = 14; const ends = [];
  for (let k = 0; k < rays; k++) {
    const a = (k / rays) * Math.PI * 2 + 0.2;
    const r = Math.min(w, h) * (0.48 + 0.08 * Math.sin(k * 2.1));
    ends.push([a, r]);
    line(ctx, [[cx, cy], [cx + Math.cos(a) * r, cy + Math.sin(a) * r]], 'rgba(232,238,246,0.7)', 2);
  }
  for (let ring = 1; ring < 10; ring++) {
    ctx.beginPath();
    ends.forEach(([a, r], k) => {
      const rr = r * ring / 10; const x = cx + Math.cos(a) * rr; const y = cy + Math.sin(a) * rr;
      if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    ctx.closePath(); ctx.strokeStyle = 'rgba(232,238,246,0.55)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  // капли росы
  const r = rng(61);
  for (let i = 0; i < 26; i++) ellipse(ctx, cx + (r() - 0.5) * w * 0.8, cy + (r() - 0.5) * h * 0.8, 2.5, 2.5, 'rgba(255,255,255,0.8)');
}
