// Запись игры кадр в кадр для скриншотов, GIF и трейлера (Playwright + Chromium, WebGL через SwiftShader).
// Виртуальное время (vt.js): performance.now, Date.now, таймеры и requestAnimationFrame идут только по команде,
// поэтому даже медленная машина пишет ровные 30 к/с. Звук не играет: реплики идут по длительности файлов и
// записываются в shots.json (когда какая началась) — по ним ставятся голоса при монтаже.
// Нужна запущенная сборка: npm run build && npm run preview (порт 4173, другой — PORT=…).
// node capture.mjs <папка> <сценарий.mjs> ["debug=1&lang=ru"]   (env: VW, VH, FPS, MODE=gl|canvas, CHROMIUM)
// В сценарии: rec(имя, сек, [{ t, fn }]) — кадры JPEG; ff(условие, сек) — перемотка без отрисовки;
// wait(сек); still(имя, { hideSubs }) — PNG; press(клавиша); ev(fn, arg) — код в странице.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const [,, out = './_снимки', shotsFile = './shots-stills.mjs', query = 'debug=1'] = process.argv;
const VW = Number(process.env.VW || 1920); const VH = Number(process.env.VH || 1080);
const FPS = Number(process.env.FPS || 30); const DT = 1000 / FPS;
const MODE = process.env.MODE || 'gl';
fs.mkdirSync(out, { recursive: true });
const args = MODE === 'gl'
  ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  : ['--disable-gpu', '--disable-accelerated-2d-canvas', '--disable-gpu-compositing'];
const browser = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args });
const page = await browser.newPage({ viewport: { width: VW, height: VH } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
// звук не грузим: голоса заменяет «немой» плеер с настоящими длительностями (для субтитров и губ)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const durs = {};
for (const f of fs.readdirSync(`${ROOT}/assets/audio/voice`)) {
  if (!f.endsWith('.mp3')) continue;
  const d = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', `${ROOT}/assets/audio/voice/${f}`]).toString().trim();
  durs[`audio/voice/${f}`] = Number(d);
}
await page.addInitScript({ path: fileURLToPath(new URL('./vt.js', import.meta.url)) });
await page.addInitScript((d) => { window.__voiceDur = d; window.__voiceLog = []; }, durs);
await page.route(/\/audio\/(music|sfx|voice)\//, (r) => r.abort());
await page.goto(`http://127.0.0.1:${process.env.PORT || 4173}/?${query}${MODE === 'gl' ? '' : '&renderer=canvas'}`);
await page.waitForFunction(() => window.__game && window.__game.scene.isActive('Menu'), null, { timeout: 180000 });
await page.mouse.click(4, 4); // разблокировать «звук» (логика игры ждёт первого жеста)
await page.waitForTimeout(600);
await page.evaluate(() => {
  // немой голос: события play/end по виртуальным часам, длительность — как у настоящего файла
  const A = window.__audio;
  A.voiceHowl = (src) => {
    if (!src) return null;
    const dur = window.__voiceDur[src] || 2.0; const ev = {}; const ts = [];
    const fire = (e) => { const l = ev[e] || []; ev[e] = []; l.forEach((f) => f()); };
    return {
      play() { ts.push(setTimeout(() => fire('play'), 0), setTimeout(() => fire('end'), dur * 1000)); window.__voiceLog.push({ src, t: window.__vt.t, dur }); return 1; },
      once(e, cb) { (ev[e] = ev[e] || []).push(cb); return this; },
      duration() { return dur; }, state() { return 'loaded'; }, stop() { ts.forEach((t) => clearTimeout(t)); },
    };
  };
  window.__vt.enable();
  const g = window.__game;
  window.__clean = () => {
    for (const sc of g.scene.getScenes(true)) if (sc.skipBtn && sc.skipBtn.visible) sc.skipBtn.setVisible(false);
    const ov = g.scene.getScene('Overlay');
    if (ov) ov.children.list.forEach((o) => { if (o.type === 'Text' && /^(Отладка|Debug)/.test(o.text || '') && o.visible) o.setVisible(false); });
  };
  g.events.on('prerender', () => window.__clean());
});
const cdp = await page.context().newCDPSession(page);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n = 1) => { for (let i = 0; i < n; i++) await page.evaluate((dt) => window.__vt.step(dt), DT); };
const vnow = () => page.evaluate(() => window.__vt.t / 1000);
const until = async (cond, maxSec = 20, arg) => {
  const t0 = await vnow();
  for (;;) { if (await page.evaluate(cond, arg)) return true; if ((await vnow()) - t0 > maxSec) { logs.push('[until] timeout ' + cond.toString().slice(0, 80)); return false; } await step(3); }
};
const ff = async (cond, maxSec = 60, arg) => {
  await page.evaluate(() => { const g = window.__game; g.__cb = g.loop.callback; g.loop.callback = g.headlessStep.bind(g); });
  let ok = false;
  try {
    for (let i = 0; i < maxSec * 10; i++) {
      if (await page.evaluate(cond, arg)) { ok = true; break; }
      await page.evaluate(() => window.__vt.step(100));
    }
  } finally {
    await page.evaluate(() => { const g = window.__game; for (let i = 0; i < 10; i++) window.__vt.step(1000 / 30); g.loop.callback = g.__cb; });
  }
  if (!ok) logs.push('[ff] timeout ' + cond.toString().slice(0, 120));
  return ok;
};
const wait = (sec) => ff(() => false, sec).then(() => true);
fs.mkdirSync(path.join(out, 'stills'), { recursive: true });
const still = async (name, { hideSubs = false } = {}) => {
  if (hideSubs) await page.evaluate(() => { const s = window.__game.scene.getScene('Overlay').subtitles; window.__subsVis = s.sheet.visible; s.sheet.setVisible(false); });
  await step(1);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(out, 'stills', name + '.png'), Buffer.from(data, 'base64'));
  if (hideSubs) await page.evaluate(() => { window.__game.scene.getScene('Overlay').subtitles.sheet.setVisible(window.__subsVis); });
  console.log('[still] ' + name);
};
const press = async (k) => { await page.keyboard.press(k); await step(1); };
const shotsLog = [];
// rec(name, сек, [{ t, fn }]) — снять сцену; действия — в момент t (с) от начала дубля
const rec = async (name, sec, actions = []) => {
  const dir = path.join(out, name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const n = Math.round(sec * FPS); const todo = actions.slice().sort((a, b) => a.t - b.t);
  const v0 = await vnow(); const voice0 = await page.evaluate(() => window.__voiceLog.length);
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    while (todo.length && todo[0].t <= i / FPS + 1e-6) { const a = todo.shift(); try { await a.fn(); } catch (e) { logs.push(`[rec ${name}] action ${e.message}`); } }
    await page.evaluate((dt) => window.__vt.step(dt), DT);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 93 });
    fs.writeFileSync(path.join(dir, String(i).padStart(5, '0') + '.jpg'), Buffer.from(data, 'base64'));
  }
  const voices = await page.evaluate((k) => window.__voiceLog.slice(k), voice0);
  shotsLog.push({ name, sec, frames: n, start: v0, voices: voices.map((v) => ({ ...v, t: +(v.t / 1000 - v0).toFixed(3) })) });
  console.log(`[rec] ${name}: ${n} кадров за ${((Date.now() - t0) / 1000).toFixed(0)} с`);
};
const api = { page, ev, step, until, press, rec, vnow, logs, FPS, ff, wait, still, sleep: (s) => step(Math.round(s * FPS)) };
const mod = await import(path.resolve(shotsFile));
try { await mod.default(api); } catch (e) { logs.push('[capture] ' + e.stack); }
fs.writeFileSync(path.join(out, 'shots.json'), JSON.stringify(shotsLog, null, 1));
fs.writeFileSync(path.join(out, 'logs.txt'), logs.join('\n'));
console.log(logs.slice(0, 30).join('\n'));
await browser.close();
process.exit(0);
