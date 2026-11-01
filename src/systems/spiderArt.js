// Рисунок паука по референсу пользователя: коричневое овальное брюшко с тёмными шевронами,
// круглая голова с гроздью блестящих чёрных глаз, клычки, длинные толстые лапы с высокими
// «коленями» (перевёрнутая V), тёмный контур; задние лапы светлее и серее.
// Используется и для заглушек spider_idle / spider_grin / spider_corner, и для анимированной «куклы».
export const SPIDER_COLORS = {
  body: '#8A5A33', bodyHi: '#B37C4B', bodyLo: '#5E3A1E', stripe: '#4E2F17', outline: '#24150B',
  head: '#9A673C', headHi: '#C08A57', leg: '#7A4F2E', legBack: '#857565', knee: '#5A3A22', eye: '#100D10',
  mouth: '#3A0E0E', fang: '#F3E6CF',
};

// Локальные координаты: (0, 0) — точка крепления нити (верх брюшка).
export const GEOM = {
  abdomen: { x: 0, y: 98, rx: 104, ry: 90 },
  head: { x: 0, y: 214, r: 68 },
  // точки крепления лап (правая сторона; левая — зеркально)
  attach: [{ x: 46, y: 196 }, { x: 52, y: 178 }, { x: 50, y: 160 }, { x: 42, y: 146 }],
  femur: 118, tibia: 150,
  // базовые углы (радианы, ось x вправо, y вниз): бедро вверх-наружу, голень вниз-наружу
  base: [
    { a1: -0.25, a2: 1.30 }, { a1: -0.70, a2: 1.08 }, { a1: -1.02, a2: 0.86 }, { a1: -1.28, a2: 0.62 },
  ],
  width: [30, 28, 26, 24],
};

export function legPoints(side, i, t = 0, mode = 'idle') {
  const s = side === 'left' ? -1 : 1;
  const at = GEOM.attach[i];
  const b = GEOM.base[i];
  const speed = mode === 'think' ? 10 : mode === 'laugh' ? 14 : 1.6;
  const amp = mode === 'think' ? 0.16 : mode === 'laugh' ? 0.1 : 0.05;
  const phase = i * 1.3 + (side === 'left' ? 0.7 : 0);
  let a1 = b.a1 + Math.sin(t * speed + phase) * amp;
  let a2 = b.a2 + Math.sin(t * speed * 1.1 + phase + 1.2) * amp * 1.4;
  if (mode === 'tucked') { a1 -= 0.25; a2 += 0.45; }
  // привычки и реакции Тихона (передние лапы):
  if (mode === 'clap' && i === 0) { a1 = 0.62; a2 = 2.6 + Math.sin(t * 17) * 0.16; } // хлопает: «ого!»
  if (mode === 'scratch' && i === 0 && s > 0) { a1 = -1.15; a2 = 1.95 + Math.sin(t * 15) * 0.22; } // чешет голову
  if (mode === 'tap' && i === 0) a1 = b.a1 + 0.1 + Math.max(0, Math.sin(t * 11 + (s > 0 ? 0 : Math.PI))) * 0.32; // барабанит лапами
  if (mode === 'stretch') { const k = 0.5 + 0.5 * Math.sin(t * 1.3); a1 -= 0.22 * k; a2 -= 0.38 * k; } // потягивается
  if (mode === 'count' && i <= 2) { const up = Math.floor(t * 2.2) % 4 > i; if (up) { a1 -= 0.5; a2 -= 0.7; } } // считает на лапах
  const kx = at.x + Math.cos(a1) * GEOM.femur;
  const ky = at.y + Math.sin(a1) * GEOM.femur;
  const tx = kx + Math.cos(a2) * GEOM.tibia;
  const ty = ky + Math.sin(a2) * GEOM.tibia;
  return [{ x: at.x * s, y: at.y }, { x: kx * s, y: ky }, { x: tx * s, y: ty }];
}

// Сужающийся сегмент как 4-угольник.
export function segmentQuad(p, q, w0, w1) {
  const dx = q.x - p.x; const dy = q.y - p.y; const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len; const ny = dx / len;
  return [
    { x: p.x + nx * w0 / 2, y: p.y + ny * w0 / 2 }, { x: q.x + nx * w1 / 2, y: q.y + ny * w1 / 2 },
    { x: q.x - nx * w1 / 2, y: q.y - ny * w1 / 2 }, { x: p.x - nx * w0 / 2, y: p.y - ny * w0 / 2 },
  ];
}

function polyPath(ctx, pts) {
  ctx.beginPath();
  pts.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}

export function paintLegCanvas(ctx, pts, width, back = false) {
  const C = SPIDER_COLORS;
  const [a, k, t] = pts;
  const fill = back ? C.legBack : C.leg;
  const segs = [[a, k, width, width * 0.8], [k, t, width * 0.78, width * 0.22]];
  for (const pass of [0, 1]) {
    for (const [p, q, w0, w1] of segs) {
      const extra = pass === 0 ? 7 : 0;
      polyPath(ctx, segmentQuad(p, q, w0 + extra, w1 + extra));
      ctx.fillStyle = pass === 0 ? C.outline : fill;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(k.x, k.y, width * 0.48 + (pass === 0 ? 3.5 : 0), 0, Math.PI * 2);
    ctx.fillStyle = pass === 0 ? C.outline : (back ? '#6F6256' : C.knee);
    ctx.fill();
  }
  // блик на бедре
  ctx.strokeStyle = 'rgba(255,230,200,0.18)';
  ctx.lineWidth = width * 0.18;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(a.x + (k.x - a.x) * 0.15, a.y + (k.y - a.y) * 0.15 - width * 0.2);
  ctx.lineTo(a.x + (k.x - a.x) * 0.8, a.y + (k.y - a.y) * 0.8 - width * 0.2);
  ctx.stroke();
}

export function paintAbdomen(ctx, ox, oy) {
  const C = SPIDER_COLORS; const g = GEOM.abdomen;
  const cx = ox + g.x; const cy = oy + g.y;
  ctx.save();
  ctx.beginPath(); ctx.ellipse(cx, cy, g.rx + 5, g.ry + 5, 0, 0, Math.PI * 2); ctx.fillStyle = C.outline; ctx.fill();
  const grad = ctx.createRadialGradient(cx - 35, cy - 40, 10, cx, cy, g.rx * 1.1);
  grad.addColorStop(0, C.bodyHi); grad.addColorStop(0.55, C.body); grad.addColorStop(1, C.bodyLo);
  ctx.beginPath(); ctx.ellipse(cx, cy, g.rx, g.ry, 0, 0, Math.PI * 2); ctx.fillStyle = grad; ctx.fill();
  ctx.clip();
  // шевроны
  ctx.strokeStyle = C.stripe; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let k = 0; k < 4; k++) {
    const y = cy - 52 + k * 30; const w = 64 - k * 9;
    ctx.lineWidth = 13 - k * 1.5;
    ctx.beginPath(); ctx.moveTo(cx - w, y - 12); ctx.lineTo(cx, y + 12); ctx.lineTo(cx + w, y - 12); ctx.stroke();
  }
  // пятнышки и блик
  ctx.fillStyle = 'rgba(40,20,8,0.25)';
  for (let k = 0; k < 14; k++) {
    const a = k * 2.4; const r = 30 + (k * 17) % 60;
    ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8, 3 + (k % 3), 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,235,210,0.22)';
  ctx.beginPath(); ctx.ellipse(cx - 38, cy - 44, 34, 18, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function paintHead(ctx, ox, oy, face = 'idle') {
  const C = SPIDER_COLORS; const g = GEOM.head;
  const cx = ox + g.x; const cy = oy + g.y;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, g.r + 5, 0, Math.PI * 2); ctx.fillStyle = C.outline; ctx.fill();
  const grad = ctx.createRadialGradient(cx - 22, cy - 26, 6, cx, cy, g.r);
  grad.addColorStop(0, C.headHi); grad.addColorStop(0.6, C.head); grad.addColorStop(1, C.bodyLo);
  ctx.beginPath(); ctx.arc(cx, cy, g.r, 0, Math.PI * 2); ctx.fillStyle = grad; ctx.fill();
  // волоски
  ctx.strokeStyle = 'rgba(36,21,11,0.55)'; ctx.lineWidth = 2;
  for (let k = 0; k < 18; k++) {
    const a = Math.PI * 1.05 + k * 0.08;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (g.r - 2), cy + Math.sin(a) * (g.r - 2));
    ctx.lineTo(cx + Math.cos(a) * (g.r + 7), cy + Math.sin(a) * (g.r + 7)); ctx.stroke();
  }
  // глаза: два больших и четыре маленьких
  const eye = (x, y, r0, big) => {
    const r = face === 'wow' && big ? r0 * 1.18 : r0;
    if (face === 'blink' && big) {
      ctx.strokeStyle = C.eye; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - r, y); ctx.quadraticCurveTo(x, y + r * 0.6, x + r, y); ctx.stroke();
      return;
    }
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = C.eye; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.38, r * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.arc(x + r * 0.32, y + r * 0.3, r * 0.14, 0, Math.PI * 2); ctx.fill();
    if (face === 'sly' && big) {
      // верхнее веко прикрывает глаз наполовину
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, r + 1.5, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = C.head; ctx.fillRect(x - r - 2, y - r - 2, 2 * r + 4, r * 1.05);
      ctx.restore();
      ctx.strokeStyle = C.outline; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - r, y - r * 0.02); ctx.lineTo(x + r, y + r * 0.06); ctx.stroke();
    }
  };
  eye(cx - 25, cy - 8, 20, true); eye(cx + 25, cy - 8, 20, true);
  eye(cx - 47, cy - 30, 9); eye(cx + 47, cy - 30, 9); eye(cx - 15, cy - 38, 8); eye(cx + 15, cy - 38, 8);
  // брови-складки: хитрый прищур
  ctx.strokeStyle = 'rgba(36,21,11,0.8)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  const browL = face === 'grin' ? -40 : face === 'wow' ? -56 : face === 'hmm' ? -54 : face === 'sly' ? -30 : -34;
  const browR = face === 'grin' ? -40 : face === 'wow' ? -56 : face === 'hmm' ? -30 : face === 'sly' ? -36 : -34;
  const lift = face === 'wow' ? -8 : 0;
  ctx.beginPath(); ctx.moveTo(cx - 44, cy - 24 + lift); ctx.quadraticCurveTo(cx - 26, browL + cy, cx - 8, cy - 26 + lift); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 44, cy - 24 + (face === 'hmm' ? 4 : lift)); ctx.quadraticCurveTo(cx + 26, browR + cy, cx + 8, cy - 26 + lift); ctx.stroke();
  // рот
  if (face === 'grin') {
    ctx.beginPath(); ctx.moveTo(cx - 40, cy + 20); ctx.quadraticCurveTo(cx, cy + 62, cx + 40, cy + 20);
    ctx.quadraticCurveTo(cx, cy + 34, cx - 40, cy + 20); ctx.fillStyle = C.mouth; ctx.fill();
    ctx.strokeStyle = C.outline; ctx.lineWidth = 3.5; ctx.stroke();
    ctx.fillStyle = C.fang;
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(cx + s * 22, cy + 27); ctx.lineTo(cx + s * 13, cy + 28); ctx.lineTo(cx + s * 17, cy + 44); ctx.closePath(); ctx.fill();
    }
  } else if (face === 'wow') {
    // ротик «о»
    ctx.beginPath(); ctx.ellipse(cx, cy + 32, 11, 14, 0, 0, Math.PI * 2); ctx.fillStyle = C.mouth; ctx.fill();
    ctx.strokeStyle = C.outline; ctx.lineWidth = 3.5; ctx.stroke();
  } else if (face === 'hmm') {
    ctx.strokeStyle = C.outline; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - 22, cy + 30); ctx.quadraticCurveTo(cx, cy + 26, cx + 22, cy + 22); ctx.stroke();
  } else if (face === 'sly') {
    ctx.strokeStyle = C.outline; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - 26, cy + 26); ctx.quadraticCurveTo(cx + 2, cy + 36, cx + 30, cy + 14); ctx.stroke();
    ctx.fillStyle = C.fang;
    ctx.beginPath(); ctx.moveTo(cx + 12, cy + 29); ctx.lineTo(cx + 20, cy + 26); ctx.lineTo(cx + 17, cy + 38); ctx.closePath(); ctx.fill();
  } else {
    ctx.strokeStyle = C.outline; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - 24, cy + 24); ctx.quadraticCurveTo(cx - 2, cy + 36, cx + 26, cy + 20); ctx.stroke();
  }
  // клычки-педипальпы
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(cx + s * 16, cy + 56, 9, 14, s * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = C.outline; ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + s * 16, cy + 54, 6, 11, s * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = C.head; ctx.fill();
  }
  ctx.restore();
}

export function paintSpider(ctx, ox, oy, { face = 'idle', t = 0.4, mode = 'idle', scale = 1 } = {}) {
  ctx.save();
  ctx.translate(ox, oy); ctx.scale(scale, scale);
  for (let i = 3; i >= 0; i--) for (const side of ['left', 'right']) paintLegCanvas(ctx, legPoints(side, i, t, mode), GEOM.width[i], i >= 2);
  paintAbdomen(ctx, 0, 0);
  paintHead(ctx, 0, 0, face);
  ctx.restore();
}

// Паутина в углу: радиальные нити + спираль. Угол — (cx, cy) в правом верхнем углу.
export function paintCornerWeb(ctx, cx, cy, size, alpha = 0.55) {
  ctx.save();
  ctx.strokeStyle = `rgba(230,236,245,${alpha})`; ctx.lineWidth = 1.6;
  const rays = 9; const a0 = Math.PI * 0.5; const a1 = Math.PI;
  const ends = [];
  for (let k = 0; k <= rays; k++) {
    const a = a0 + (a1 - a0) * (k / rays);
    const r = size * (0.85 + 0.15 * Math.sin(k * 1.7));
    ends.push(a);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke();
  }
  ctx.lineWidth = 1.2;
  for (let ring = 1; ring <= 7; ring++) {
    const r = size * ring / 8;
    ctx.beginPath();
    ends.forEach((a, k) => {
      const rr = r * (0.94 + 0.06 * Math.sin(ring + k));
      const x = cx + Math.cos(a) * rr; const y = cy + Math.sin(a) * rr;
      if (k) ctx.quadraticCurveTo(cx + Math.cos(a - 0.08) * rr * 0.9, cy + Math.sin(a - 0.08) * rr * 0.9, x, y); else ctx.moveTo(x, y);
    });
    ctx.stroke();
  }
  ctx.restore();
}
