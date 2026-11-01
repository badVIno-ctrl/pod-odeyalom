// Выгрузка всех картинок, нарисованных кодом, — шаблоны для художника.
// 1) запустить игру: npm run build && npm run preview  (или любой сервер на папке dist, порт 4173)
// 2) node tools/export-art.mjs [адрес]      — нужен playwright: npm i -D playwright && npx playwright install chromium
// Результат: docs/художнику/шаблоны/<группа>/<ключ>.png (точный размер), листы по группам и текстуры.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs', 'художнику');
const BASE = process.argv[2] || 'http://127.0.0.1:4173/';
const exe = process.env.CHROMIUM || (fs.existsSync('/usr/local/bin/chromium') ? '/usr/local/bin/chromium' : undefined);

const browser = await chromium.launch({ executablePath: exe, args: ['--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${BASE}?lab=export&renderer=canvas`);
await page.waitForFunction(() => Array.isArray(window.__artExport), null, { timeout: 120000 });
const list = await page.evaluate(() => window.__artExport);
fs.rmSync(path.join(OUT, 'шаблоны'), { recursive: true, force: true });
fs.rmSync(path.join(OUT, 'листы'), { recursive: true, force: true });
for (const t of list) {
  const dir = path.join(OUT, 'шаблоны', t.group);
  fs.mkdirSync(dir, { recursive: true });
  const { url, ext } = await page.evaluate((k) => window.__artPng(k), t.key);
  t.template = `шаблоны/${t.group}/${t.key}.${ext}`;
  fs.writeFileSync(path.join(OUT, t.template), Buffer.from(url.split(',')[1], 'base64'));
}
// листы по группам: уменьшенные картинки с подписью «ключ  ширина×высота» и красным крестиком пивота
const groups = [...new Set(list.map((t) => t.group))];
fs.mkdirSync(path.join(OUT, 'листы'), { recursive: true });
for (const g of groups) {
  const items = list.filter((t) => t.group === g);
  const url = await page.evaluate((items) => {
    const W = 1920; const pad = 18; const lab = 26; const maxH = items.some((t) => t.w >= 1900) ? 300 : 220;
    const place = []; let x = pad; let y = pad; let rowH = 0;
    const m = document.createElement('canvas').getContext('2d'); m.font = '15px sans-serif';
    for (const t of items) {
      // мелкие детали (глаза, рты, кисти) — вдвое крупнее, чтобы было видно пивот
      const s = Math.min(t.w <= 260 && t.h <= 260 ? 2 : 1, maxH / t.h, (W - pad * 2) / t.w);
      const w = Math.max(t.w * s, m.measureText(`${t.key}  ${t.w}×${t.h}`).width + 6); const h = t.h * s;
      if (x + w > W - pad) { x = pad; y += rowH + lab + pad; rowH = 0; }
      place.push({ t, x, y, s }); x += w + pad; rowH = Math.max(rowH, h);
    }
    const H = y + rowH + lab + pad;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#2b2f3a'; ctx.fillRect(0, 0, W, H);
    for (const { t, x, y: yy, s } of place) {
      const src = window.__game.scene.getScene('Lab').textures.get(t.key).getSourceImage();
      for (let i = 0; i < t.w * s; i += 12) for (let j = 0; j < t.h * s; j += 12) {
        ctx.fillStyle = ((i + j) / 12) % 2 ? '#3a3f4c' : '#343845'; ctx.fillRect(x + i, yy + j, 12, 12);
      }
      ctx.drawImage(src, x, yy, t.w * s, t.h * s);
      if (t.pivot) {
        const px = x + t.pivot.ox * s; const py = yy + t.pivot.oy * s;
        ctx.strokeStyle = '#ff4d4d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px - 7, py); ctx.lineTo(px + 7, py); ctx.moveTo(px, py - 7); ctx.lineTo(px, py + 7); ctx.stroke();
      }
      ctx.fillStyle = '#e8e2d4'; ctx.font = '15px sans-serif';
      ctx.fillText(`${t.key}  ${t.w}×${t.h}`, x, yy + t.h * s + 18);
    }
    return c.toDataURL('image/jpeg', 0.9);
  }, items);
  fs.writeFileSync(path.join(OUT, 'листы', `${g}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
}
fs.writeFileSync(path.join(OUT, 'текстуры.json'), JSON.stringify(list, null, 1));
console.log(`${list.length} картинок, групп: ${groups.length} (${groups.join(', ')})${errors.length ? `; ошибки: ${errors.join(' | ')}` : ''}`);
await browser.close();
process.exit(0);
