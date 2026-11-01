// Открытка на память (PNG 1600×1000): последний рисунок мальчика, кусочек письма Тихона и марка
// с паучком. На телефоне — «Поделиться» (navigator.share с файлом), на компьютере — скачивание.
import { paintDrawing, DRAW_W, DRAW_H } from './drawings.js';
import { paintSpider } from './spiderArt.js';
import { GAME_TITLE } from '../config/game.js';
import { I18n, tr } from '../i18n/index.js';

const W = 1600; const H = 1000;
const INK = '#2b2030'; const RED = '#b5402f';

function wrap(ctx, str, maxW) {
  const words = str.split(' '); const lines = []; let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export function renderPostcard({ spec, letter, ending }) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const r = rnd(77);
  // бумага: тёплый картон с зерном и потемнением к краям
  ctx.fillStyle = '#efe3c8'; ctx.fillRect(0, 0, W, H);
  for (let k = 0; k < 9000; k++) {
    ctx.fillStyle = `rgba(${r() < 0.5 ? '90,60,30' : '255,250,235'},${0.04 + r() * 0.05})`;
    ctx.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2);
  }
  const vg = ctx.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 980);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(70,40,10,0.28)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  // разделительная линия, как на обороте открытки
  ctx.strokeStyle = 'rgba(43,32,48,0.25)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(900, 120); ctx.lineTo(900, H - 120); ctx.stroke();

  // рисунок на скотче
  const d = document.createElement('canvas'); d.width = DRAW_W; d.height = DRAW_H;
  paintDrawing(d.getContext('2d'), spec, 1, {});
  ctx.save(); ctx.translate(460, 500); ctx.rotate(-0.035);
  ctx.fillStyle = 'rgba(40,20,0,0.25)'; ctx.fillRect(-380 + 14, -297 + 18, 760, 594);
  ctx.drawImage(d, -380, -297, 760, 594);
  ctx.fillStyle = 'rgba(243,230,192,0.78)'; ctx.translate(0, -297); ctx.rotate(0.05); ctx.fillRect(-95, -24, 190, 52);
  ctx.restore();

  // марка с паучком и штемпель
  ctx.save(); ctx.translate(1400, 130);
  ctx.fillStyle = '#fbf6ea'; ctx.fillRect(-90, -100, 180, 210);
  ctx.fillStyle = '#efe3c8';
  for (let k = -90; k <= 90; k += 15) for (const y of [-100, 110]) { ctx.beginPath(); ctx.arc(k, y, 6, 0, Math.PI * 2); ctx.fill(); }
  for (let k = -100; k <= 110; k += 15) for (const x of [-90, 90]) { ctx.beginPath(); ctx.arc(x, k, 6, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#20345e'; ctx.fillRect(-74, -84, 148, 178);
  ctx.strokeStyle = 'rgba(230,236,245,0.7)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, -84); ctx.lineTo(0, -40); ctx.stroke();
  paintSpider(ctx, 0, -42, { face: 'idle', scale: 0.27 });
  ctx.fillStyle = '#f3e6c0'; ctx.font = '700 22px Caveat, cursive'; ctx.textAlign = 'center'; ctx.fillText(tr('ПОЧТА ПАУКОВ'), 0, 84);
  ctx.restore();
  ctx.save(); ctx.translate(1270, 190); ctx.rotate(-0.25);
  ctx.strokeStyle = 'rgba(181,64,47,0.55)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, 0, 70, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 54, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(181,64,47,0.6)'; ctx.font = '700 26px Caveat, cursive'; ctx.textAlign = 'center';
  ctx.fillText(tr('ЗИМА'), 0, 9);
  for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(80, -24 + k * 16); ctx.bezierCurveTo(130, -34 + k * 16, 170, -14 + k * 16, 230, -24 + k * 16); ctx.stroke(); }
  ctx.restore();

  // заголовок и строки письма
  ctx.textAlign = 'left'; ctx.fillStyle = INK;
  ctx.font = '400 60px Kurale, Georgia, serif'; ctx.fillText(tr(GAME_TITLE), 960, 330);
  ctx.fillStyle = RED; ctx.font = '400 40px Neucha, cursive';
  ctx.fillText(tr(ending ? `Финал: ${ending.title}` : 'Пять дней жара'), 962, 386);
  ctx.fillStyle = INK; ctx.font = '700 40px Caveat, cursive';
  let y = 470;
  const lines = [letter.greeting, ...letter.paragraphs.slice(1, 3)];
  for (const p of lines) {
    for (const l of wrap(ctx, p, 560)) { if (y > H - 190) break; ctx.fillText(l, 962, y); y += 46; }
    y += 10;
  }
  ctx.font = '700 48px Caveat, cursive'; ctx.textAlign = 'right';
  ctx.fillText(letter.sign, W - 110, Math.min(H - 110, y + 40));
  ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(43,32,48,0.55)'; ctx.font = '400 24px Literata, Georgia, serif';
  ctx.fillText(I18n.en
    ? `“${tr(GAME_TITLE)}: Five Days of Fever”, a game about a boy, his mom and an old spider`
    : `«${GAME_TITLE}. Пять дней жара» — игра про мальчика, маму и старого паука`, 110, H - 60);
  return c;
}

// → 'shared' | 'saved' | 'error'
export async function savePostcard(opts) {
  try {
    const c = renderPostcard(opts);
    window.__postcard = c;
    const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
    if (!blob) return 'error';
    const name = I18n.en ? 'under-the-blanket-postcard.png' : 'pyat-dney-zhara-otkrytka.png';
    const file = typeof File !== 'undefined' ? new File([blob], name, { type: 'image/png' }) : null;
    const touch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
    if (touch && file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: tr(GAME_TITLE) }); return 'shared'; } catch (e) { if (e && e.name === 'AbortError') return 'error'; }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return 'saved';
  } catch (e) { console.warn('postcard', e); return 'error'; }
}
