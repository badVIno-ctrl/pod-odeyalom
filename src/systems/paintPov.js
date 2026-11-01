// Сцены «глазами мальчика» (вид от первого лица): фон с подушки, край одеяла и детские ладошки,
// крупный реквизит, доктор, фельдшер, потолок при переноске на носилках. Всё рисуется кодом.
import { rrect, ellipse, poly, line, vgrad, radial, rng, paintTexOnce } from './paint.js';
import { paintCup, paintSpoon, paintSocksProp, BOY_SKIN } from './rig/parts.js';
import { paintBottle } from './paintWorld.js';

const MOM_SKIN = '#f0c6a4';

const OUT = '#24170f';

function tex(scene, key, w, h, draw) { paintTexOnce(scene, key, w, h, draw, 'pov'); }

// Крупная версия маленького рисунка (без мыла при увеличении): рисуем в масштабе k.
function scaled(scene, key, w, h, k, painter) {
  tex(scene, key, Math.round(w * k), Math.round(h * k), (ctx) => { ctx.scale(k, k); painter(ctx, w, h); });
}

// Вид с подушки: стена с обоями, край окна со светом, угол потолка. Слегка размыт — фокус на лицах.
function paintPovRoom(ctx, w, h, night) {
  vgrad(ctx, 0, 0, w, h, night ? [[0, '#1a253d'], [1, '#121a2c']] : [[0, '#3a5078'], [1, '#2a3a5a']]);
  ctx.save();
  if ('filter' in ctx) ctx.filter = 'blur(5px)';
  ctx.globalAlpha = 0.08; ctx.fillStyle = '#fff';
  for (let x = 0; x < w; x += 110) ctx.fillRect(x, 0, 36, h);
  ctx.globalAlpha = 1;
  // потолок и угол
  poly(ctx, [[0, 0], [w, 0], [w, 120], [0, 210]], night ? '#141d31' : '#30446a');
  line(ctx, [[0, 210], [w, 120]], 'rgba(0,0,0,0.3)', 6);
  // окно справа
  const wx = 1340; const wy = 230;
  rrect(ctx, wx, wy, 520, 600, 10); ctx.fillStyle = night ? '#2b3c66' : '#9fb2c6'; ctx.fill();
  if (!night) radial(ctx, wx + 260, wy + 300, 520, 'rgba(235,240,245,0.35)', 'rgba(235,240,245,0)');
  ctx.strokeStyle = night ? '#59627a' : '#e9e0d0'; ctx.lineWidth = 34; ctx.strokeRect(wx, wy, 520, 600);
  line(ctx, [[wx + 260, wy], [wx + 260, wy + 600]], night ? '#59627a' : '#e9e0d0', 18);
  for (let k = 0; k < 6; k++) {
    const x0 = wx - 120 + k * 34;
    ctx.fillStyle = k % 2 ? '#8a4632' : '#a4563a';
    ctx.beginPath(); ctx.moveTo(x0, 160); ctx.lineTo(x0 + 34, 160); ctx.quadraticCurveTo(x0 + 60, 600, x0 + 46, 1000); ctx.lineTo(x0 + 10, 1000); ctx.quadraticCurveTo(x0 + 20, 600, x0, 160); ctx.fill();
  }
  // детский рисунок слева
  ctx.fillStyle = '#c9a46a'; ctx.fillRect(140, 300, 360, 280); ctx.fillStyle = '#efe6d4'; ctx.fillRect(160, 320, 320, 240);
  ellipse(ctx, 420, 380, 30, 30, null, '#f2a65a', 6);
  poly(ctx, [[220, 540], [220, 460], [290, 410], [360, 460], [360, 540]], null, '#d9603b', 6);
  ctx.restore();
  if (!night) radial(ctx, 1500, 400, 900, 'rgba(255,236,200,0.10)', 'rgba(255,236,200,0)', 'lighter');
  else radial(ctx, 300, 900, 900, 'rgba(255,165,80,0.22)', 'rgba(255,165,80,0)', 'lighter');
}

// Край одеяла у подбородка (низ экрана).
function paintPovBlanket(ctx, w, h) {
  ctx.beginPath(); ctx.moveTo(0, 120);
  ctx.bezierCurveTo(400, 40, 760, 90, 960, 70); ctx.bezierCurveTo(1200, 50, 1560, 100, w, 60);
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
  const g = ctx.createLinearGradient(0, 40, 0, h); g.addColorStop(0, '#5a7ab0'); g.addColorStop(1, '#22345a');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 8; ctx.stroke();
  ctx.save(); ctx.clip();
  for (let k = -10; k < 30; k++) {
    line(ctx, [[k * 120, 0], [k * 120 + 400, h]], 'rgba(255,255,255,0.1)', 6);
    line(ctx, [[k * 120 + 400, 0], [k * 120, h]], 'rgba(255,255,255,0.1)', 6);
  }
  const r = rng(11);
  for (let i = 0; i < 16; i++) {
    const x = r() * w; const y = 140 + r() * (h - 160); const s = 10 + r() * 8;
    poly(ctx, [[x, y - s], [x + s * 0.3, y - s * 0.3], [x + s, y], [x + s * 0.3, y + s * 0.3], [x, y + s], [x - s * 0.3, y + s * 0.3], [x - s, y], [x - s * 0.3, y - s * 0.3]], 'rgba(242,166,90,0.8)');
  }
  ctx.restore();
  // отворот пододеяльника
  ctx.beginPath(); ctx.moveTo(0, 120);
  ctx.bezierCurveTo(400, 40, 760, 90, 960, 70); ctx.bezierCurveTo(1200, 50, 1560, 100, w, 60);
  ctx.lineTo(w, 150); ctx.bezierCurveTo(1560, 190, 1200, 140, 960, 160); ctx.bezierCurveTo(760, 180, 400, 130, 0, 210); ctx.closePath();
  const f = ctx.createLinearGradient(0, 50, 0, 200); f.addColorStop(0, '#fbf5ea'); f.addColorStop(1, '#dccdb6');
  ctx.fillStyle = f; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 7; ctx.stroke();
  ctx.setLineDash([16, 14]);
  line(ctx, [[20, 180], [400, 116], [960, 132], [1560, 160], [1900, 126]], 'rgba(120,100,80,0.45)', 4);
  ctx.setLineDash([]);
}

// Детская ладошка с рукавом пижамы, пальцы вверх (для левой руки — отразить).
function paintPovHand(ctx, w, h, skin) {
  // рукав
  rrect(ctx, 30, 150, 140, 190, 50);
  const pj = ctx.createLinearGradient(30, 0, 170, 0); pj.addColorStop(0, '#fae2a6'); pj.addColorStop(0.45, '#efcb78'); pj.addColorStop(1, '#cf9f4c');
  ctx.fillStyle = pj; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 7; ctx.stroke();
  ctx.save(); rrect(ctx, 30, 150, 140, 190, 50); ctx.clip();
  for (const x of [62, 100, 138]) line(ctx, [[x, 150], [x + 3, 340]], 'rgba(176,86,52,0.42)', 7);
  ctx.fillStyle = '#cf9f4c'; ctx.fillRect(20, 150, 170, 34);
  line(ctx, [[20, 184], [190, 184]], 'rgba(90,46,16,0.45)', 4);
  ctx.restore();
  // ладонь
  ellipse(ctx, 100, 104, 62, 70, skin, OUT, 7);
  for (const [x, y, r] of [[62, 40, 0.15], [88, 28, 0.05], [114, 30, -0.05], [138, 46, -0.2]]) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(r);
    rrect(ctx, -13, -28, 26, 62, 13); ctx.fillStyle = skin; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 6; ctx.stroke();
    ctx.restore();
  }
  ellipse(ctx, 100, 110, 56, 56, skin);
  ctx.save(); ctx.translate(40, 110); ctx.rotate(-0.7);
  rrect(ctx, -14, -34, 28, 64, 14); ctx.fillStyle = skin; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 6; ctx.stroke();
  ctx.restore();
  ellipse(ctx, 108, 116, 30, 22, 'rgba(230,120,110,0.25)');
}

// ---------------- доктор (крупно, по пояс) ----------------
function paintDoctor(ctx, w, h) {
  const cx = w / 2;
  // халат
  ctx.beginPath(); ctx.moveTo(cx - 360, h); ctx.bezierCurveTo(cx - 350, 640, cx - 250, 560, cx - 110, 540);
  ctx.lineTo(cx + 110, 540); ctx.bezierCurveTo(cx + 250, 560, cx + 350, 640, cx + 360, h); ctx.closePath();
  const g = ctx.createLinearGradient(cx - 360, 0, cx + 360, 0); g.addColorStop(0, '#d7dde4'); g.addColorStop(0.5, '#f7f9fb'); g.addColorStop(1, '#cfd6de');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 8; ctx.stroke();
  // воротник и галстук
  poly(ctx, [[cx - 110, 540], [cx, 700], [cx + 110, 540], [cx + 60, 530], [cx, 610], [cx - 60, 530]], '#9fb7cf', OUT, 6);
  poly(ctx, [[cx - 20, 600], [cx + 20, 600], [cx + 30, 760], [cx, 800], [cx - 30, 760]], '#7a3b3b', OUT, 5);
  line(ctx, [[cx - 110, 540], [cx - 150, 900]], 'rgba(0,0,0,0.25)', 6);
  line(ctx, [[cx + 110, 540], [cx + 150, 900]], 'rgba(0,0,0,0.25)', 6);
  // стетоскоп
  ctx.beginPath(); ctx.moveTo(cx - 120, 560); ctx.bezierCurveTo(cx - 170, 760, cx - 40, 860, cx + 10, 840);
  ctx.strokeStyle = '#2f3a48'; ctx.lineWidth = 12; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 120, 560); ctx.bezierCurveTo(cx + 160, 700, cx + 90, 800, cx + 10, 840); ctx.stroke();
  ellipse(ctx, cx + 10, 860, 34, 34, '#c9ced6', OUT, 6);
  // карман с ручкой
  rrect(ctx, cx + 150, 780, 110, 110, 10); ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 5; ctx.stroke();
  rrect(ctx, cx + 180, 740, 14, 70, 6); ctx.fillStyle = '#2a5fb0'; ctx.fill();
  // шея
  rrect(ctx, cx - 60, 440, 120, 130, 40); ctx.fillStyle = '#e3b28f'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 6; ctx.stroke();
  // голова
  ellipse(ctx, cx - 190, 320, 34, 50, '#ecbf9c', OUT, 6); ellipse(ctx, cx + 190, 320, 34, 50, '#ecbf9c', OUT, 6);
  ellipse(ctx, cx, 290, 190, 210, '#f0c6a4', OUT, 8);
  radial(ctx, cx - 60, 200, 200, 'rgba(255,255,255,0.18)');
  // седина по бокам
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(cx + s * 150, 230, 60, 110, s * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = '#d9d9d9'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 6; ctx.stroke();
  }
  // лобный рефлектор на обруче
  line(ctx, [[cx - 186, 170], [cx - 60, 110], [cx + 60, 110], [cx + 186, 170]], '#3a3f48', 14);
  ellipse(ctx, cx, 112, 70, 70, '#e8edf3', OUT, 7);
  ellipse(ctx, cx, 112, 46, 46, '#c3ccd8', OUT, 4);
  ellipse(ctx, cx, 112, 14, 14, '#3a3f48');
  radial(ctx, cx - 18, 92, 40, 'rgba(255,255,255,0.9)');
  // брови
  line(ctx, [[cx - 130, 240], [cx - 50, 226]], '#bfbfbf', 16);
  line(ctx, [[cx + 50, 226], [cx + 130, 240]], '#bfbfbf', 16);
  // очки
  for (const s of [-1, 1]) { ellipse(ctx, cx + s * 88, 290, 66, 56, 'rgba(220,235,255,0.25)', '#3a3f48', 8); }
  line(ctx, [[cx - 22, 288], [cx + 22, 288]], '#3a3f48', 8);
  // нос
  ctx.beginPath(); ctx.moveTo(cx - 6, 300); ctx.quadraticCurveTo(cx - 30, 380, cx, 392); ctx.quadraticCurveTo(cx + 30, 392, cx + 20, 370);
  ctx.strokeStyle = OUT; ctx.lineWidth = 6; ctx.stroke();
  ellipse(ctx, cx - 120, 370, 30, 18, 'rgba(230,120,110,0.3)'); ellipse(ctx, cx + 120, 370, 30, 18, 'rgba(230,120,110,0.3)');
  // усы
  ctx.beginPath(); ctx.moveTo(cx, 410); ctx.bezierCurveTo(cx - 40, 390, cx - 110, 400, cx - 120, 440); ctx.bezierCurveTo(cx - 70, 430, cx - 30, 430, cx, 425);
  ctx.bezierCurveTo(cx + 30, 430, cx + 70, 430, cx + 120, 440); ctx.bezierCurveTo(cx + 110, 400, cx + 40, 390, cx, 410);
  ctx.fillStyle = '#cfcfcf'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.stroke();
}
function paintDoctorEyes(ctx, w, h, kind) {
  for (const s of [-1, 1]) {
    const x = w / 2 + s * 88; const y = h / 2;
    if (kind === 'closed') { ctx.beginPath(); ctx.arc(x, y - 6, 22, 0.2, Math.PI - 0.2); ctx.strokeStyle = OUT; ctx.lineWidth = 7; ctx.stroke(); }
    else if (kind === 'smile') { ctx.beginPath(); ctx.arc(x, y + 12, 22, Math.PI * 1.15, Math.PI * 1.85); ctx.strokeStyle = OUT; ctx.lineWidth = 7; ctx.stroke(); }
    else { ellipse(ctx, x, y, 18, 20, '#fff', OUT, 5); ellipse(ctx, x + 2, y + 3, 9, 10, '#3b2a20'); ellipse(ctx, x - 2, y - 2, 3.5, 3.5, '#fff'); }
  }
}
function paintDoctorMouth(ctx, w, h, open) {
  if (open) { ellipse(ctx, w / 2, h / 2 + 4, 34, 22, '#7a2a2a', OUT, 5); ellipse(ctx, w / 2, h / 2 + 14, 18, 7, '#e07a7a'); }
  else { ctx.beginPath(); ctx.arc(w / 2, h / 2 - 14, 30, 0.35, Math.PI - 0.35); ctx.strokeStyle = OUT; ctx.lineWidth = 6; ctx.stroke(); }
}
// Фонарик и шпатель доктора.
function paintSpatula(ctx, w, h) {
  rrect(ctx, 10, h / 2 - 14, w - 20, 28, 14); ctx.fillStyle = '#e8d6b0'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.stroke();
}

// ---------------- фельдшер скорой ----------------
function paintMedic(ctx, w, h) {
  const cx = w / 2;
  ctx.beginPath(); ctx.moveTo(cx - 330, h); ctx.bezierCurveTo(cx - 320, 640, cx - 230, 560, cx - 100, 540);
  ctx.lineTo(cx + 100, 540); ctx.bezierCurveTo(cx + 230, 560, cx + 320, 640, cx + 330, h); ctx.closePath();
  const g = ctx.createLinearGradient(cx - 330, 0, cx + 330, 0); g.addColorStop(0, '#24406e'); g.addColorStop(0.5, '#33599a'); g.addColorStop(1, '#22406e');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 8; ctx.stroke();
  // светоотражающие полосы
  ctx.save(); ctx.clip();
  ctx.fillStyle = '#d8e04a'; ctx.fillRect(0, 760, w, 34); ctx.fillStyle = '#e9eef2'; ctx.fillRect(0, 770, w, 12);
  ctx.restore();
  // нашивка с крестом
  rrect(ctx, cx + 120, 640, 100, 80, 12); ctx.fillStyle = '#f3f3f3'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = '#d23a3a'; ctx.fillRect(cx + 160, 650, 20, 60); ctx.fillRect(cx + 140, 670, 60, 20);
  poly(ctx, [[cx - 100, 540], [cx, 640], [cx + 100, 540]], '#1b2f52', OUT, 6);
  rrect(ctx, cx - 56, 440, 112, 120, 40); ctx.fillStyle = '#e8b896'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 6; ctx.stroke();
  ellipse(ctx, cx - 172, 320, 30, 44, '#f0c4a0', OUT, 6); ellipse(ctx, cx + 172, 320, 30, 44, '#f0c4a0', OUT, 6);
  ellipse(ctx, cx, 300, 172, 196, '#f3cba8', OUT, 8);
  // волосы и шапочка
  ctx.beginPath(); ctx.ellipse(cx, 190, 180, 120, 0, Math.PI, Math.PI * 2); ctx.fillStyle = '#6b4a2e'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 6; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - 190, 190); ctx.bezierCurveTo(cx - 180, 30, cx + 180, 30, cx + 190, 190); ctx.closePath();
  ctx.fillStyle = '#33599a'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 7; ctx.stroke();
  rrect(ctx, cx - 200, 170, 400, 40, 18); ctx.fillStyle = '#24406e'; ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#d23a3a'; ctx.fillRect(cx - 12, 80, 24, 70); ctx.fillRect(cx - 35, 103, 70, 24);
  line(ctx, [[cx - 120, 250], [cx - 50, 244]], '#5a3d27', 12); line(ctx, [[cx + 50, 244], [cx + 120, 250]], '#5a3d27', 12);
  ctx.beginPath(); ctx.moveTo(cx - 4, 300); ctx.quadraticCurveTo(cx - 26, 370, cx, 378); ctx.strokeStyle = OUT; ctx.lineWidth = 6; ctx.stroke();
  ellipse(ctx, cx - 110, 366, 28, 16, 'rgba(230,120,110,0.3)'); ellipse(ctx, cx + 110, 366, 28, 16, 'rgba(230,120,110,0.3)');
}

// Потолок при переноске: комната → дверной проём → коридор → входная дверь в метель.
function paintCeilingStrip(ctx, w, h) {
  vgrad(ctx, 0, 0, w, h, [[0, '#2c3d5e'], [1, '#22304b']]);
  // абажур в комнате, вид снизу: шнур, тканевый абажур с фестонами, горящая лампочка в проёме
  line(ctx, [[520, 0], [520, 310]], '#3b2a1e', 8);
  const shade = ctx.createRadialGradient(520, 440, 10, 520, 420, 190);
  shade.addColorStop(0, '#fff4d6'); shade.addColorStop(0.45, '#f6d9a0'); shade.addColorStop(1, '#d6995a');
  ellipse(ctx, 520, 420, 185, 118, shade, OUT, 8);
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2;
    ellipse(ctx, 520 + Math.cos(a) * 185, 420 + Math.sin(a) * 118, 13, 10, '#c98a4c', 'rgba(60,35,20,0.6)', 2.5);
  }
  ellipse(ctx, 520, 432, 94, 60, 'rgba(255,250,232,0.92)', 'rgba(150,95,45,0.55)', 5);
  ellipse(ctx, 520, 436, 40, 34, '#fffdf2');
  radial(ctx, 520, 436, 130, 'rgba(255,248,220,0.5)', 'rgba(255,248,220,0)', 'lighter');
  radial(ctx, 520, 430, 420, 'rgba(255,230,180,0.38)', 'rgba(255,230,180,0)', 'lighter');
  // дверной проём
  ctx.fillStyle = '#6a4c38'; ctx.fillRect(1100, 0, 90, h); ctx.fillRect(1440, 0, 90, h);
  ctx.fillStyle = '#4a3528'; ctx.fillRect(1190, 0, 250, h);
  // коридор: лампочка, вешалка, обои
  vgrad(ctx, 1530, 0, 1300, h, [[0, '#4a3e38'], [1, '#3a302b']]);
  for (let x = 1560; x < 2830; x += 80) { ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(x, 0, 30, h); }
  ellipse(ctx, 2150, 500, 50, 50, '#fff3d0', OUT, 6); radial(ctx, 2150, 500, 420, 'rgba(255,220,150,0.45)', 'rgba(255,220,150,0)', 'lighter');
  // входная дверь, за ней ночь и снег
  ctx.fillStyle = '#5e412b'; ctx.fillRect(2830, 0, 110, h);
  vgrad(ctx, 2940, 0, w - 2940, h, [[0, '#0e1730'], [1, '#1b2a4e']]);
  const r = rng(5);
  for (let i = 0; i < 160; i++) ellipse(ctx, 2940 + r() * (w - 2940), r() * h, 2 + r() * 4, 2 + r() * 4, 'rgba(255,255,255,0.8)');
}

function paintEyelid(ctx, w, h, top) {
  ctx.fillStyle = '#050508';
  ctx.beginPath();
  if (top) { ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w, h - 140); ctx.quadraticCurveTo(w / 2, h + 120, 0, h - 140); }
  else { ctx.moveTo(0, h); ctx.lineTo(w, h); ctx.lineTo(w, 140); ctx.quadraticCurveTo(w / 2, -120, 0, 140); }
  ctx.closePath(); ctx.fill();
}


// ---------------- носки: вид на ноги ----------------
// Мальчик приподнял голову и смотрит на изножье кровати: стена, дверь, низкая спинка кровати.
function paintFeetBg(ctx, w, h) {
  vgrad(ctx, 0, 0, w, h, [[0, '#33476b'], [1, '#283857']]);
  ctx.save();
  if ('filter' in ctx) ctx.filter = 'blur(4px)';
  ctx.globalAlpha = 0.07; ctx.fillStyle = '#fff';
  for (let x = 0; x < w; x += 110) ctx.fillRect(x, 0, 36, h);
  ctx.globalAlpha = 1;
  // дверь слева и полоска света под ней
  rrect(ctx, 120, 150, 330, 760, 6); ctx.fillStyle = '#5e4331'; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 6; ctx.strokeRect(160, 200, 250, 290); ctx.strokeRect(160, 540, 250, 300);
  ellipse(ctx, 410, 560, 12, 12, '#d9b36a');
  // тумбочка с лампой
  rrect(ctx, 1480, 560, 260, 300, 8); ctx.fillStyle = '#7a5538'; ctx.fill();
  rrect(ctx, 1540, 380, 140, 120, 10); ctx.fillStyle = '#efe1c4'; ctx.fill();
  line(ctx, [[1610, 500], [1610, 560]], '#3b2a1e', 8);
  ctx.restore();
  // пол
  vgrad(ctx, 0, 860, w, h - 860, [[0, '#3a2a20'], [1, '#2a1e17']]);
  // низкая спинка кровати (изножье)
  rrect(ctx, 380, 600, 1160, 70, 18); ctx.fillStyle = '#8a5a34'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 6; ctx.stroke();
  rrect(ctx, 350, 520, 80, 420, 30); ctx.fillStyle = '#7a4e2c'; ctx.fill(); ctx.stroke();
  rrect(ctx, 1490, 520, 80, 420, 30); ctx.fillStyle = '#7a4e2c'; ctx.fill(); ctx.stroke();
  line(ctx, [[400, 618], [1520, 618]], 'rgba(255,230,190,0.25)', 6);
  // уходящее вдаль одеяло перед спинкой
  ctx.beginPath(); ctx.moveTo(300, 760); ctx.quadraticCurveTo(960, 640, 1620, 760); ctx.lineTo(1700, h); ctx.lineTo(220, h); ctx.closePath();
  const g = ctx.createLinearGradient(0, 660, 0, h); g.addColorStop(0, '#3e5a8c'); g.addColorStop(1, '#263a62');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 6; ctx.stroke();
  radial(ctx, 960, 420, 900, 'rgba(255,226,180,0.08)', 'rgba(255,226,180,0)', 'lighter');
}

// Передний край одеяла (холм от груди до колен), из-под него торчат ступни.
function paintBlanketFeet(ctx, w, h) {
  ctx.beginPath(); ctx.moveTo(0, 150);
  ctx.bezierCurveTo(420, 40, 760, 70, 960, 64); ctx.bezierCurveTo(1180, 58, 1500, 50, w, 150);
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
  const g = ctx.createLinearGradient(0, 40, 0, h); g.addColorStop(0, '#5f80b6'); g.addColorStop(1, '#1f3156');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 8; ctx.stroke();
  ctx.save(); ctx.clip();
  for (let k = -10; k < 30; k++) {
    line(ctx, [[k * 130, 0], [k * 130 + 420, h]], 'rgba(255,255,255,0.09)', 6);
    line(ctx, [[k * 130 + 420, 0], [k * 130, h]], 'rgba(255,255,255,0.09)', 6);
  }
  const r = rng(23);
  for (let i = 0; i < 14; i++) {
    const x = r() * w; const y = 120 + r() * (h - 140); const s = 10 + r() * 8;
    poly(ctx, [[x, y - s], [x + s * 0.3, y - s * 0.3], [x + s, y], [x + s * 0.3, y + s * 0.3], [x, y + s], [x - s * 0.3, y + s * 0.3], [x - s, y], [x - s * 0.3, y - s * 0.3]], 'rgba(242,166,90,0.75)');
  }
  // складки
  for (const [x0, x1] of [[260, 520], [1300, 1620]]) {
    ctx.beginPath(); ctx.moveTo(x0, 160); ctx.quadraticCurveTo((x0 + x1) / 2, 240, x1, 200);
    ctx.strokeStyle = 'rgba(10,18,36,0.35)'; ctx.lineWidth = 10; ctx.stroke();
  }
  ctx.restore();
}

// Детская ступня пальцами вверх (вид от лица мальчика).
function footShape(ctx, w, h) {
  ctx.beginPath();
  ctx.moveTo(w * 0.2, h);
  ctx.bezierCurveTo(w * 0.1, h * 0.62, w * 0.06, h * 0.34, w * 0.16, h * 0.2);
  ctx.bezierCurveTo(w * 0.3, h * 0.04, w * 0.74, h * 0.02, w * 0.86, h * 0.18);
  ctx.bezierCurveTo(w * 0.96, h * 0.34, w * 0.9, h * 0.66, w * 0.8, h);
  ctx.closePath();
}
function paintPovFoot(ctx, w, h, skin) {
  footShape(ctx, w, h); ctx.fillStyle = skin; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 6; ctx.stroke();
  const toes = [[0.26, 0.15, 0.1], [0.42, 0.09, 0.085], [0.56, 0.08, 0.08], [0.69, 0.1, 0.075], [0.8, 0.15, 0.065]];
  for (const [tx, ty, tr] of toes) ellipse(ctx, w * tx, h * ty, w * tr, w * tr * 1.15, skin, OUT, 5);
  ellipse(ctx, w * 0.5, h * 0.42, w * 0.22, h * 0.1, 'rgba(230,130,110,0.18)');
  line(ctx, [[w * 0.3, h * 0.7], [w * 0.44, h * 0.74]], 'rgba(120,70,50,0.25)', 4);
}
// Бабушкин шерстяной носок: красный с белыми полосками и снежинкой, резинка у щиколотки.
function paintPovSock(ctx, w, h) {
  footShape(ctx, w, h);
  ctx.save(); ctx.clip();
  ctx.fillStyle = '#c0453a'; ctx.fillRect(0, 0, w, h);
  // вязка «косичкой»
  for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 18) {
    ctx.strokeStyle = 'rgba(80,10,10,0.22)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 9, y + 10); ctx.lineTo(x + 18, y); ctx.stroke();
  }
  ctx.fillStyle = '#f3ebdd'; ctx.fillRect(0, h * 0.34, w, h * 0.06); ctx.fillRect(0, h * 0.46, w, h * 0.04);
  // снежинка
  const cx = w * 0.52; const cy = h * 0.62;
  for (let a = 0; a < 6; a++) { const t = (a * Math.PI) / 3; line(ctx, [[cx, cy], [cx + Math.cos(t) * 22, cy + Math.sin(t) * 22]], '#f3ebdd', 5); }
  // носок-мысок другого цвета
  ctx.fillStyle = '#8f2f2a'; ctx.fillRect(0, 0, w, h * 0.2);
  // резинка
  ctx.fillStyle = '#f3ebdd'; ctx.fillRect(0, h * 0.84, w, h * 0.16);
  for (let x = 6; x < w; x += 14) line(ctx, [[x, h * 0.85], [x, h]], 'rgba(150,120,100,0.45)', 3);
  ctx.restore();
  footShape(ctx, w, h); ctx.strokeStyle = OUT; ctx.lineWidth = 6; ctx.stroke();
}

// Мокрое прохладное полотенце (видно снизу: лежит на лбу, свисает краем сверху кадра).
function paintPovTowel(ctx, w, h) {
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w, h - 70);
  ctx.bezierCurveTo(w * 0.8, h - 20, w * 0.62, h - 60, w * 0.5, h - 30);
  ctx.bezierCurveTo(w * 0.36, h - 4, w * 0.18, h - 50, 0, h - 60);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#c9dcec'); g.addColorStop(1, '#e9f2f8');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 7; ctx.stroke();
  ctx.save(); ctx.clip();
  for (let y = 30; y < h; y += 60) line(ctx, [[0, y], [w, y + 10]], 'rgba(120,150,180,0.25)', 8);
  ctx.fillStyle = 'rgba(106,168,216,0.55)'; ctx.fillRect(0, h - 120, w, 18); ctx.fillRect(0, h - 150, w, 8);
  ctx.restore();
  for (const [x, y] of [[0.3, 0.92], [0.55, 0.97], [0.75, 0.9]]) ellipse(ctx, w * x, h * y, 7, 10, 'rgba(190,225,250,0.9)', 'rgba(36,23,15,0.6)', 2);
}

// Мамина ладонь (держит руку мальчика).
function paintPovMomHand(ctx, w, h) {
  rrect(ctx, w - 120, 40, 130, 120, 40); ctx.fillStyle = '#7d5a8c'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 6; ctx.stroke();
  ellipse(ctx, w * 0.5, h * 0.52, w * 0.3, h * 0.36, MOM_SKIN, OUT, 6);
  for (let i = 0; i < 4; i++) {
    ctx.save(); ctx.translate(w * 0.22 - i * 6, h * 0.3 + i * 28); ctx.rotate(-0.2);
    rrect(ctx, -70, -14, 110, 28, 14); ctx.fillStyle = MOM_SKIN; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.stroke();
    ctx.restore();
  }
  ellipse(ctx, w * 0.5, h * 0.52, w * 0.26, h * 0.3, MOM_SKIN);
}

export function createPovTextures(scene) {
  tex(scene, 'pov_room', 1920, 1080, (c, w, h) => paintPovRoom(c, w, h, false));
  tex(scene, 'pov_room_night', 1920, 1080, (c, w, h) => paintPovRoom(c, w, h, true));
  tex(scene, 'pov_blanket', 1920, 330, paintPovBlanket);
  for (const s of ['healthy', 'sick', 'very_sick', 'critical']) tex(scene, `pov_hand_${s}`, 200, 340, (c, w, h) => paintPovHand(c, w, h, BOY_SKIN[s]));
  tex(scene, 'pov_doctor', 900, 1000, paintDoctor);
  for (const k of ['open', 'closed', 'smile']) tex(scene, `pov_doctor_eyes_${k}`, 320, 80, (c, w, h) => paintDoctorEyes(c, w, h, k));
  tex(scene, 'pov_doctor_mouth_closed', 120, 70, (c, w, h) => paintDoctorMouth(c, w, h, false));
  tex(scene, 'pov_doctor_mouth_open', 120, 70, (c, w, h) => paintDoctorMouth(c, w, h, true));
  tex(scene, 'pov_spatula', 300, 60, paintSpatula);
  tex(scene, 'pov_medic', 800, 1000, paintMedic);
  for (const k of ['open', 'closed']) tex(scene, `pov_medic_eyes_${k}`, 300, 80, (c, w, h) => { const d = (x) => { if (k === 'closed') line(c, [[x - 18, h / 2], [x + 18, h / 2]], OUT, 7); else { ellipse(c, x, h / 2, 16, 18, '#fff', OUT, 5); ellipse(c, x + 2, h / 2 + 3, 8, 9, '#2a1e1a'); } }; d(w / 2 - 80); d(w / 2 + 80); });
  tex(scene, 'pov_medic_mouth_closed', 120, 70, (c, w, h) => { c.beginPath(); c.arc(w / 2, h / 2 - 16, 28, 0.4, Math.PI - 0.4); c.strokeStyle = OUT; c.lineWidth = 6; c.stroke(); });
  tex(scene, 'pov_medic_mouth_open', 120, 70, (c, w, h) => paintDoctorMouth(c, w, h, true));
  tex(scene, 'pov_ceiling', 3840, 1080, paintCeilingStrip);
  tex(scene, 'pov_lid_top', 1920, 700, (c, w, h) => paintEyelid(c, w, h, true));
  tex(scene, 'pov_lid_bot', 1920, 700, (c, w, h) => paintEyelid(c, w, h, false));
  scaled(scene, 'pov_cup', 110, 130, 4, (c, w, h) => paintCup(c, w, h, false));
  scaled(scene, 'pov_spoon', 110, 30, 4.4, (c, w, h) => paintSpoon(c, w, h, true));
  scaled(scene, 'pov_spoon_empty', 110, 30, 4.4, (c, w, h) => paintSpoon(c, w, h, false));
  scaled(scene, 'pov_socks', 130, 130, 3.2, (c, w, h) => paintSocksProp(c, w, h));
  tex(scene, 'pov_feet_bg', 1920, 1080, paintFeetBg);
  tex(scene, 'pov_blanket_feet', 1920, 480, paintBlanketFeet);
  for (const st of ['healthy', 'sick', 'very_sick', 'critical']) tex(scene, `pov_foot_${st}`, 180, 300, (c, w, h) => paintPovFoot(c, w, h, BOY_SKIN[st]));
  tex(scene, 'pov_foot_sock', 180, 300, paintPovSock);
  tex(scene, 'pov_towel', 900, 300, paintPovTowel);
  tex(scene, 'pov_mom_hand', 300, 200, paintPovMomHand);
  scaled(scene, 'pov_bottle', 70, 130, 3.2, (c, w, h) => paintBottle(c, w, h));
}
